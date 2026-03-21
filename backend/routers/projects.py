"""
RAKSHAK — Projects Router
National-grade project management with risk calculation and alert engine
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from database import get_db
from models import (
    User, Project, Milestone, RiskHistory, Alert, AlertType, AlertSeverity,
    ProjectStatus, RiskLevel, ProjectOfficer, Contractor
)
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, ProjectMapOut, ProjectListOut,
    MilestoneCreate, MilestoneOut, MilestoneUpdate,
    RiskResponse, RiskBreakdown, RiskHistoryOut,
    AlertOut, SimulateFailureRequest, SimulationResponse
)
from auth import get_current_user, require_admin, require_admin_or_officer
from risk_engine import risk_engine
from realtime import publish_event
from audit import log_action
from cache import cached
import logging

logger = logging.getLogger("rakshak.projects")
router = APIRouter(prefix="/projects", tags=["Projects"])

# How many days must pass before an alert of the same TYPE is re-generated for the same project
ALERT_DEDUP_HOURS = 24


async def _should_create_alert(
    db: AsyncSession,
    project_id: str,
    alert_type: AlertType,
    cooldown_hours: int = ALERT_DEDUP_HOURS
) -> bool:
    """
    Prevent alert spam: check whether the same alert type was already generated
    for this project within the cooldown window.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=cooldown_hours)
    result = await db.execute(
        select(func.count()).select_from(Alert).where(
            Alert.project_id == project_id,
            Alert.alert_type == alert_type,
            Alert.is_resolved == False,
            Alert.created_at >= cutoff
        )
    )
    return result.scalar() == 0  # True = should create (no recent dupe)


async def _recalculate_risk(
    project: Project,
    db: AsyncSession,
    trigger: str = "manual",
    persist_history: bool = True
):
    """
    Recalculate project risk score with full feature extraction.
    This is the core risk engine integration point.

    Args:
        project: The Project ORM instance to recalculate
        db: Async DB session
        trigger: What triggered this recalc (for audit trail)
        persist_history: Whether to write to risk_history table.
                         Pass False for read-only queries.
    """
    from models import Evidence

    now = datetime.now(timezone.utc)

    # ── Gather evidence stats ──────────────────────────────────────────────
    ev_result = await db.execute(
        select(Evidence)
        .where(Evidence.project_id == project.id, Evidence.is_valid == True)
        .order_by(Evidence.created_at.desc())
    )
    evidences = ev_result.scalars().all()
    evidence_count = len(evidences)

    # Project age and evidence gap
    start_aware = project.start_date.replace(tzinfo=timezone.utc) if project.start_date.tzinfo is None else project.start_date
    project_age_days = max((now - start_aware).days, 1)

    last_evidence_days = float(project_age_days)  # Assume no evidence since start
    if evidences:
        latest = max(e.created_at for e in evidences)
        latest_aware = latest.replace(tzinfo=timezone.utc) if latest.tzinfo is None else latest
        last_evidence_days = float(max((now - latest_aware).days, 0))

    # ── Gather milestone stats ─────────────────────────────────────────────
    ms_result = await db.execute(select(Milestone).where(Milestone.project_id == project.id))
    milestones = ms_result.scalars().all()
    total_ms = len(milestones)
    completed_ms = sum(1 for m in milestones if m.is_completed)
    overdue_ms = sum(
        1 for m in milestones
        if not m.is_completed and (
            m.due_date.replace(tzinfo=timezone.utc) if m.due_date.tzinfo is None else m.due_date
        ) < now
    )

    # ── Gather contractor stats ────────────────────────────────────────────
    contractor_risk = 0.0
    contractor_failure_rate = 0.0
    contractor_avg_delay = 0.0
    if project.contractor_id:
        c_result = await db.execute(select(Contractor).where(Contractor.id == project.contractor_id))
        contractor = c_result.scalar_one_or_none()
        if contractor:
            contractor_risk = contractor.risk_score or 0.0
            contractor_failure_rate = contractor.failure_rate or 0.0
            contractor_avg_delay = contractor.avg_delay_days or 0.0

    # ── Compute risk using engine ──────────────────────────────────────────
    deadline_aware = project.deadline.replace(tzinfo=timezone.utc) if project.deadline.tzinfo is None else project.deadline

    result = risk_engine.compute_risk(
        start_date=start_aware,
        deadline=deadline_aware,
        progress_percent=project.progress_percent,
        last_evidence_days=last_evidence_days,
        evidence_count=evidence_count,
        project_age_days=float(project_age_days),
        budget=project.budget,
        spent=project.spent_amount,
        total_milestones=total_ms,
        completed_milestones=completed_ms,
        overdue_milestones=overdue_ms,
        contractor_risk=contractor_risk,
        contractor_failure_rate=contractor_failure_rate,
        contractor_avg_delay=contractor_avg_delay
    )

    # Store old score for comparison
    old_score = project.risk_score or 0.0
    old_level = project.risk_level

    # Update project
    project.risk_score = result.score
    project.risk_level = result.level
    project.last_risk_calc = now

    # Persist risk history entry (skip for read-only queries)
    if persist_history:
        rh = RiskHistory(
            project_id=project.id,
            risk_score=result.score,
            risk_level=result.level,
            factors=result.feature_weights,
            trigger_event=trigger
        )
        db.add(rh)

        # Generate alerts based on current conditions (with dedup)
        await _generate_alerts(project, db, old_score, result, last_evidence_days, now)

        await db.flush()

        # Broadcast update via WebSocket / Redis pub/sub
        await publish_event("risk_updated", {
            "project_id": project.id,
            "project_name": project.name,
            "old_score": old_score,
            "new_score": result.score,
            "old_level": old_level.value if old_level else None,
            "new_level": result.level.value,
            "latitude": project.latitude,
            "longitude": project.longitude,
            "trigger": trigger,
        })

    return result


async def _generate_alerts(
    project: Project,
    db: AsyncSession,
    old_score: float,
    result,
    last_evidence_days: float,
    now: datetime
):
    """
    Generate smart alerts based on risk conditions.
    Each alert type is deduplicated within ALERT_DEDUP_HOURS to prevent spam.
    """
    min_interval = project.min_evidence_interval_days or 7

    # 1. Evidence gap alert
    if last_evidence_days > min_interval * 2:
        if await _should_create_alert(db, project.id, AlertType.NO_EVIDENCE):
            severity = AlertSeverity.HIGH if last_evidence_days > 21 else AlertSeverity.MEDIUM
            alert = Alert(
                project_id=project.id,
                alert_type=AlertType.NO_EVIDENCE,
                severity=severity,
                title=f"No evidence uploaded for {int(last_evidence_days)} days",
                message=(
                    f"Project '{project.name}' has not received valid evidence for "
                    f"{int(last_evidence_days)} days. Required interval: {min_interval} days."
                )
            )
            db.add(alert)
            await publish_event("alert_triggered", {
                "project_id": project.id,
                "alert_type": AlertType.NO_EVIDENCE.value,
                "severity": severity.value,
                "message": alert.message,
            })

    # 2. Deadline risk alert
    deadline_aware = project.deadline.replace(tzinfo=timezone.utc) if project.deadline.tzinfo is None else project.deadline
    days_to_deadline = (deadline_aware - now).days
    if 0 <= days_to_deadline <= 30 and project.progress_percent < 70:
        if await _should_create_alert(db, project.id, AlertType.DEADLINE_RISK):
            severity = AlertSeverity.CRITICAL if days_to_deadline <= 7 else AlertSeverity.HIGH
            alert = Alert(
                project_id=project.id,
                alert_type=AlertType.DEADLINE_RISK,
                severity=severity,
                title=f"Deadline risk: {days_to_deadline} days remaining, {project.progress_percent:.1f}% complete",
                message=(
                    f"Project '{project.name}' is at risk of missing its deadline. "
                    f"Only {days_to_deadline} days remain with {project.progress_percent:.1f}% completion."
                )
            )
            db.add(alert)
            await publish_event("alert_triggered", {
                "project_id": project.id,
                "alert_type": AlertType.DEADLINE_RISK.value,
                "severity": severity.value,
                "message": alert.message,
            })

    # 3. Risk score spike alert
    spike = result.score - old_score
    if spike > 15:
        if await _should_create_alert(db, project.id, AlertType.ANOMALY_SPIKE, cooldown_hours=6):
            alert = Alert(
                project_id=project.id,
                alert_type=AlertType.ANOMALY_SPIKE,
                severity=AlertSeverity.HIGH,
                title=f"Risk score spike: {old_score:.1f} → {result.score:.1f}",
                message=(
                    f"Project '{project.name}' experienced a sudden {spike:.1f} point risk increase. "
                    f"Contributing factors: {', '.join(result.contributing_factors[:3]) or 'See breakdown'}"
                )
            )
            db.add(alert)
            await publish_event("alert_triggered", {
                "project_id": project.id,
                "alert_type": AlertType.ANOMALY_SPIKE.value,
                "severity": AlertSeverity.HIGH.value,
                "message": alert.message,
            })

    # 4. Budget overrun alert
    if project.budget > 0:
        util = project.spent_amount / project.budget
        if util > 1.15 and project.progress_percent < 90:  # >115% spend but not nearly done
            if await _should_create_alert(db, project.id, AlertType.BUDGET_OVERRUN):
                alert = Alert(
                    project_id=project.id,
                    alert_type=AlertType.BUDGET_OVERRUN,
                    severity=AlertSeverity.HIGH,
                    title=f"Budget overrun: {util*100:.1f}% spent",
                    message=(
                        f"Project '{project.name}' has spent {util*100:.1f}% of its budget "
                        f"but achieved only {project.progress_percent:.1f}% progress."
                    )
                )
                db.add(alert)


# ── Project Routes ──────────────────────────────────────────────────────────────

@router.get("/map", response_model=List[ProjectMapOut])
@cached("projects:map", ttl_seconds=300)
async def get_projects_map(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get lightweight project data optimized for map rendering."""
    result = await db.execute(
        select(Project).where(Project.status != ProjectStatus.SUSPENDED)
    )
    return [ProjectMapOut.model_validate(p) for p in result.scalars()]


@router.get("/", response_model=List[ProjectListOut])
async def list_projects(
    status: Optional[ProjectStatus] = Query(None),
    risk_level: Optional[RiskLevel] = Query(None),
    state: Optional[str] = Query(None),
    contractor_id: Optional[str] = Query(None),
    min_budget: Optional[float] = Query(None),
    max_budget: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """List projects with filtering, search and pagination."""
    query = (
        select(Project, Contractor.name.label('contractor_name'))
        .outerjoin(Contractor)
    )

    if status:
        query = query.where(Project.status == status)
    if risk_level:
        query = query.where(Project.risk_level == risk_level)
    if state:
        query = query.where(Project.state.ilike(f"%{state}%"))
    if contractor_id:
        query = query.where(Project.contractor_id == contractor_id)
    if min_budget is not None:
        query = query.where(Project.budget >= min_budget)
    if max_budget is not None:
        query = query.where(Project.budget <= max_budget)
    if search:
        query = query.where(
            or_(
                Project.name.ilike(f"%{search}%"),
                Project.description.ilike(f"%{search}%"),
                Project.state.ilike(f"%{search}%"),
                Project.district.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)

    projects = []
    for row in result.all():
        project, contractor_name = row
        data = ProjectListOut.model_validate(project)
        data.contractor_name = contractor_name
        projects.append(data)

    return projects


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    req: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new project with initial risk calculation."""
    # Validate contractor exists if provided
    if req.contractor_id:
        c_res = await db.execute(select(Contractor).where(Contractor.id == req.contractor_id))
        if not c_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Contractor not found")

    project = Project(
        **req.model_dump(),
        created_by=current_user.id,
        status=ProjectStatus.ACTIVE
    )

    # Set PostGIS geography point using WKT string format
    if project.latitude is not None and project.longitude is not None:
        project.geog_point = f"SRID=4326;POINT({project.longitude} {project.latitude})"

    db.add(project)
    await db.flush()

    # Initial risk calculation (with persistence)
    await _recalculate_risk(project, db, trigger="project_created", persist_history=True)
    await db.commit()
    await db.refresh(project)

    await log_action(
        db, current_user.id, "create_project", "project", project.id,
        {"name": project.name, "budget": project.budget, "state": project.state}
    )
    await db.commit()

    await publish_event("project_created", {
        "project_id": project.id,
        "name": project.name,
        "latitude": project.latitude,
        "longitude": project.longitude
    })

    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get detailed project information."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.contractor),
            selectinload(Project.milestones),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    """Update project details and recalculate risk if needed."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = req.model_dump(exclude_none=True)
    changes = {}

    for key, value in update_data.items():
        old_value = getattr(project, key, None)
        if old_value != value:
            changes[key] = {"old": str(old_value), "new": str(value)}
            setattr(project, key, value)

    if changes:
        # Update geography point if coordinates changed
        if "latitude" in changes or "longitude" in changes:
            project.geog_point = f"SRID=4326;POINT({project.longitude} {project.latitude})"

        await _recalculate_risk(project, db, trigger="project_updated", persist_history=True)
        await db.commit()

        await log_action(
            db, current_user.id, "update_project", "project", project_id, changes
        )
        await db.commit()
    else:
        await db.commit()

    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a project (requires admin)."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_name = project.name
    await db.delete(project)

    await log_action(
        db, current_user.id, "delete_project", "project", project_id,
        {"name": project_name}
    )
    await db.commit()

    await publish_event("project_deleted", {"project_id": project_id, "name": project_name})


# ── Risk Routes ────────────────────────────────────────────────────────────────

@router.get("/{project_id}/risk", response_model=RiskResponse)
async def get_project_risk(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get current risk score for a project.
    Recalculates live but does NOT write to history (read-only call).
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Read-only recalculation (persist_history=False avoids noisy history writes)
    risk_result = await _recalculate_risk(project, db, trigger="risk_query", persist_history=False)
    # Persist updated score on the project itself
    await db.commit()

    return RiskResponse(
        project_id=project_id,
        project_name=project.name,
        risk_score=project.risk_score,
        risk_level=project.risk_level,
        calculated_at=datetime.now(timezone.utc)
    )


@router.get("/{project_id}/risk/breakdown", response_model=RiskBreakdown)
async def get_risk_breakdown(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get detailed risk breakdown with feature weights and recommendations.
    Endpoint: GET /projects/{id}/risk-breakdown (also accessible at /risk/breakdown)
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Full recalculation with history and alerts persisted
    risk_result = await _recalculate_risk(project, db, trigger="breakdown_query", persist_history=True)
    await db.commit()

    from schemas import RiskFeatures

    return RiskBreakdown(
        project_id=project_id,
        project_name=project.name,
        risk_score=risk_result.score,
        risk_level=risk_result.level,
        features=RiskFeatures(**risk_result.features.to_dict()),
        feature_weights=risk_result.feature_weights,
        contributing_factors=risk_result.contributing_factors,
        recommendations=risk_result.recommendations,
        calculated_at=datetime.now(timezone.utc)
    )


# Also expose at the path expected by spec: GET /projects/{id}/risk-breakdown
@router.get("/{project_id}/risk-breakdown", response_model=RiskBreakdown, include_in_schema=False)
async def get_risk_breakdown_alt(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Alias: GET /projects/{id}/risk-breakdown (as specified in requirements)."""
    return await get_risk_breakdown(project_id, db, _)


@router.get("/{project_id}/risk/history", response_model=List[RiskHistoryOut])
async def get_risk_history(
    project_id: str,
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get historical risk scores for trend analysis."""
    result = await db.execute(
        select(RiskHistory)
        .where(RiskHistory.project_id == project_id)
        .order_by(RiskHistory.calculated_at.desc())
        .limit(limit)
    )
    return [RiskHistoryOut.model_validate(r) for r in result.scalars()]


# ── Milestone Routes ───────────────────────────────────────────────────────────

@router.post("/{project_id}/milestones", response_model=MilestoneOut)
async def create_milestone(
    project_id: str,
    req: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add a milestone to a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    milestone = Milestone(project_id=project_id, **req.model_dump())
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)

    await log_action(
        db, current_user.id, "create_milestone", "milestone", milestone.id,
        {"title": milestone.title, "project_id": project_id}
    )
    await db.commit()

    return MilestoneOut.model_validate(milestone)


@router.get("/{project_id}/milestones", response_model=List[MilestoneOut])
async def list_milestones(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get all milestones for a project."""
    result = await db.execute(
        select(Milestone)
        .where(Milestone.project_id == project_id)
        .order_by(Milestone.order_index)
    )
    return [MilestoneOut.model_validate(m) for m in result.scalars()]


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    project_id: str,
    milestone_id: str,
    req: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    """Update milestone and recalculate project progress + risk."""
    result = await db.execute(
        select(Milestone)
        .where(Milestone.id == milestone_id, Milestone.project_id == project_id)
    )
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(ms, key, value)

    # If marking completed without providing a date, set it now
    if req.is_completed and not ms.completion_date:
        ms.completion_date = datetime.now(timezone.utc)

    await db.flush()

    # Recalculate project progress from milestone weights
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one()

    all_ms_result = await db.execute(
        select(Milestone).where(Milestone.project_id == project_id)
    )
    all_ms = all_ms_result.scalars().all()

    if all_ms:
        total_weight = sum(m.weight_percent for m in all_ms)
        completed_weight = sum(m.weight_percent for m in all_ms if m.is_completed)
        project.progress_percent = round((completed_weight / total_weight) * 100, 2) if total_weight else 0

    await _recalculate_risk(project, db, trigger="milestone_updated", persist_history=True)
    await db.commit()
    await db.refresh(ms)

    await log_action(
        db, current_user.id, "update_milestone", "milestone", milestone_id,
        {"is_completed": ms.is_completed, "project_id": project_id}
    )
    await db.commit()

    return MilestoneOut.model_validate(ms)


# ── Alert Routes ───────────────────────────────────────────────────────────────

@router.get("/{project_id}/alerts", response_model=List[AlertOut])
async def get_project_alerts(
    project_id: str,
    unresolved_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get alerts for a specific project."""
    query = select(Alert).where(Alert.project_id == project_id)
    if unresolved_only:
        query = query.where(Alert.is_resolved == False)
    query = query.order_by(Alert.created_at.desc()).limit(50)

    result = await db.execute(query)
    return [AlertOut.model_validate(a) for a in result.scalars()]


# ── Assignment Routes ──────────────────────────────────────────────────────────

@router.post("/{project_id}/officers/{officer_id}")
async def assign_officer(
    project_id: str,
    officer_id: str,
    is_primary: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Assign an officer to a project."""
    # Verify both exist
    p_res = await db.execute(select(Project).where(Project.id == project_id))
    if not p_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    o_res = await db.execute(select(User).where(User.id == officer_id))
    if not o_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Officer not found")

    existing = await db.execute(
        select(ProjectOfficer).where(
            ProjectOfficer.project_id == project_id,
            ProjectOfficer.officer_id == officer_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Officer already assigned to this project")

    po = ProjectOfficer(
        project_id=project_id,
        officer_id=officer_id,
        assigned_by=current_user.id,
        is_primary=is_primary
    )
    db.add(po)
    await db.commit()

    await log_action(
        db, current_user.id, "assign_officer", "project", project_id,
        {"officer_id": officer_id, "is_primary": is_primary}
    )
    await db.commit()

    return {"message": "Officer assigned successfully", "project_id": project_id, "officer_id": officer_id}


# ── Simulation Route ─────────────────────────────────────────────────────────

@router.post("/{project_id}/simulate-failure", response_model=SimulationResponse)
async def simulate_failure(
    project_id: str,
    req: SimulateFailureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulate a failure scenario for a specific project.
    Applies scenario effects, recalculates risk, broadcasts real-time alert.
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    original_score = project.risk_score
    intensity = req.intensity

    # Apply scenario effects
    if req.scenario == "no_evidence":
        # Simulate no evidence gap by regressing progress
        project.progress_percent = max(0, project.progress_percent - (20 * intensity))
    elif req.scenario == "budget_overrun":
        project.spent_amount = project.budget * (1 + (0.5 * intensity))
    elif req.scenario == "missed_milestones":
        project.progress_percent = max(0, project.progress_percent - (30 * intensity))
    elif req.scenario == "contractor_failure":
        project.progress_percent = max(0, project.progress_percent - (25 * intensity))
    elif req.scenario == "risk_spike":
        # Direct risk injection — bypass engine this once to demonstrate real-time broadcast
        project.risk_score = min(100, project.risk_score + 40 * intensity)
        project.risk_level = RiskLevel.RED if project.risk_score >= 70 else RiskLevel.YELLOW
        project.last_risk_calc = datetime.now(timezone.utc)

    if req.scenario != "risk_spike":
        # Recalculate via engine for non-direct scenarios
        await _recalculate_risk(project, db, trigger=f"simulation:{req.scenario}", persist_history=True)
    else:
        # For risk_spike — create history entry and alert manually
        rh = RiskHistory(
            project_id=project.id,
            risk_score=project.risk_score,
            risk_level=project.risk_level,
            factors={"simulation": "risk_spike", "intensity": intensity},
            trigger_event="simulation:risk_spike"
        )
        db.add(rh)

        alert = Alert(
            project_id=project.id,
            alert_type=AlertType.ANOMALY_SPIKE,
            severity=AlertSeverity.CRITICAL,
            title="SIMULATION: Sudden Risk Spike",
            message=(
                f"Simulated risk spike for project '{project.name}'. "
                f"Risk injected from {original_score:.1f} to {project.risk_score:.1f}."
            )
        )
        db.add(alert)

    await db.flush()

    # Count all current alerts for this project
    alert_count_res = await db.execute(
        select(func.count()).select_from(Alert).where(Alert.project_id == project_id)
    )
    total_alerts = alert_count_res.scalar()

    await db.commit()

    await log_action(
        db, current_user.id, "simulation_triggered", "project", project_id,
        {"scenario": req.scenario, "intensity": req.intensity, "original_score": original_score}
    )
    await db.commit()

    await publish_event("simulation_triggered", {
        "project_id": project_id,
        "project_name": project.name,
        "scenario": req.scenario,
        "original_score": original_score,
        "new_score": project.risk_score,
        "risk_level": project.risk_level.value,
    })

    return SimulationResponse(
        status="success",
        message=f"Simulated '{req.scenario}' scenario with intensity {intensity:.1f}",
        project_id=project_id,
        scenario=req.scenario,
        original_risk_score=original_score,
        new_risk_score=project.risk_score,
        risk_level=project.risk_level.value,
        triggered_alerts=total_alerts,
        timestamp=datetime.now(timezone.utc)
    )
