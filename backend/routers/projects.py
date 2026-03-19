from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone
from database import get_db
from models import User, Project, Milestone, RiskHistory, ProjectOfficer, Alert, AlertType
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, ProjectMapOut,
    MilestoneCreate, MilestoneOut, MilestoneUpdate,
    RiskResponse, RiskHistoryOut, AlertOut, AuditLogOut, SimulateFailureRequest
)
from auth import get_current_user, require_admin, require_admin_or_officer
from risk_engine import risk_engine
from realtime import publish_event
from audit import log_action
import uuid

router = APIRouter(prefix="/projects", tags=["Projects"])

async def _recalculate_risk(project: Project, db: AsyncSession) -> None:
    """Recalculate and persist risk score for a project."""
    now = datetime.now(timezone.utc)
    
    # Evidence stats
    from models import Evidence
    ev_result = await db.execute(
        select(Evidence).where(Evidence.project_id == project.id, Evidence.is_valid == True)
    )
    evidences = ev_result.scalars().all()
    evidence_count = len(evidences)
    
    project_age_days = max((now - project.start_date.replace(tzinfo=timezone.utc)).days, 1)
    
    last_evidence_days = project_age_days  # default: no uploads at all
    if evidences:
        latest = max(e.created_at for e in evidences)
        last_evidence_days = (now - latest.replace(tzinfo=timezone.utc)).days
    
    # Milestone stats
    ms_result = await db.execute(select(Milestone).where(Milestone.project_id == project.id))
    milestones = ms_result.scalars().all()
    total_ms = len(milestones)
    completed_ms = sum(1 for m in milestones if m.is_completed)
    overdue_ms = sum(1 for m in milestones if not m.is_completed and m.due_date.replace(tzinfo=timezone.utc) < now)
    
    # Contractor stats
    contractor_risk = 0.0
    contractor_delay = 0.0
    if project.contractor_id:
        from models import Contractor
        c_result = await db.execute(select(Contractor).where(Contractor.id == project.contractor_id))
        contractor = c_result.scalar_one_or_none()
        if contractor:
            contractor_risk = contractor.risk_score
            contractor_delay = contractor.avg_delay_days
    
    score, level, factors = risk_engine.compute_risk(
        start_date=project.start_date.replace(tzinfo=timezone.utc),
        deadline=project.deadline.replace(tzinfo=timezone.utc),
        progress_percent=project.progress_percent,
        last_evidence_days=last_evidence_days,
        evidence_count=evidence_count,
        project_age_days=project_age_days,
        budget=project.budget,
        spent=project.spent_amount,
        total_milestones=total_ms,
        completed_milestones=completed_ms,
        overdue_milestones=overdue_ms,
        contractor_risk=contractor_risk,
        contractor_avg_delay=contractor_delay,
    )
    
    old_score = project.risk_score
    project.risk_score = score
    project.risk_level = level
    
    # Persist risk history
    rh = RiskHistory(
        project_id=project.id,
        risk_score=score,
        risk_level=level,
        factors=factors.model_dump(),
    )
    db.add(rh)
    
    # Generate alerts if needed
    if last_evidence_days > 14:
        alert = Alert(
            project_id=project.id,
            alert_type=AlertType.NO_EVIDENCE,
            title=f"No evidence uploaded for {last_evidence_days} days",
            message=f"Project '{project.name}' has not received any evidence for {last_evidence_days} days. Immediate action required.",
            severity="high" if last_evidence_days > 21 else "medium",
        )
        db.add(alert)
    
    deadline_tz = project.deadline.replace(tzinfo=timezone.utc)
    days_to_deadline = (deadline_tz - now).days
    if days_to_deadline <= 30 and project.progress_percent < 70:
        alert = Alert(
            project_id=project.id,
            alert_type=AlertType.DEADLINE_RISK,
            title=f"Deadline risk: {days_to_deadline} days remaining, {project.progress_percent}% complete",
            message=f"Project '{project.name}' is at risk of missing its deadline.",
            severity="high" if days_to_deadline <= 7 else "medium",
        )
        db.add(alert)
    
    # Spike alert
    if score - old_score > 15:
        alert = Alert(
            project_id=project.id,
            alert_type=AlertType.ANOMALY_SPIKE,
            title=f"Risk score spike: {old_score:.1f} → {score:.1f}",
            message=f"Project '{project.name}' experienced a sudden risk score increase.",
            severity="high",
        )
        db.add(alert)
    
    await db.flush()
    
    # Broadcast
    await publish_event("risk_update", {
        "project_id": project.id,
        "project_name": project.name,
        "risk_score": score,
        "risk_level": level.value,
        "latitude": project.latitude,
        "longitude": project.longitude,
    })


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/map", response_model=List[ProjectMapOut])
async def get_projects_map(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Returns lightweight project data for map rendering."""
    result = await db.execute(select(Project))
    return [ProjectMapOut.model_validate(p) for p in result.scalars()]

@router.get("/", response_model=List[ProjectOut])
async def list_projects(
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    query = select(Project).options(
        selectinload(Project.contractor),
        selectinload(Project.milestones),
    )
    if status:
        query = query.where(Project.status == status)
    if risk_level:
        query = query.where(Project.risk_level == risk_level)
    if state:
        query = query.where(Project.state.ilike(f"%{state}%"))
    
    result = await db.execute(query)
    return [ProjectOut.model_validate(p) for p in result.scalars()]

@router.post("/", response_model=ProjectOut)
async def create_project(
    req: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    project = Project(
        **req.model_dump(),
        created_by=current_user.id,
    )
    db.add(project)
    await db.flush()
    await _recalculate_risk(project, db)
    await db.commit()
    await db.refresh(project)
    
    await log_action(db, current_user.id, "create_project", "project", project.id, {"name": project.name})
    await publish_event("project_created", {"project_id": project.id, "name": project.name})
    
    result = await db.execute(
        select(Project).where(Project.id == project.id)
        .options(selectinload(Project.contractor), selectinload(Project.milestones))
    )
    return ProjectOut.model_validate(result.scalar_one())

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(
        select(Project).where(Project.id == project_id)
        .options(selectinload(Project.contractor), selectinload(Project.milestones))
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
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    await _recalculate_risk(project, db)
    await db.commit()
    await log_action(db, current_user.id, "update_project", "project", project_id, update_data)
    
    result = await db.execute(
        select(Project).where(Project.id == project_id)
        .options(selectinload(Project.contractor), selectinload(Project.milestones))
    )
    return ProjectOut.model_validate(result.scalar_one())

@router.get("/{project_id}/risk", response_model=RiskResponse)
async def get_project_risk(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await _recalculate_risk(project, db)
    await db.commit()
    
    # Get latest risk history for factors
    rh_result = await db.execute(
        select(RiskHistory)
        .where(RiskHistory.project_id == project_id)
        .order_by(RiskHistory.calculated_at.desc())
        .limit(1)
    )
    rh = rh_result.scalar_one_or_none()
    
    from schemas import RiskFactors
    factors = RiskFactors(**(rh.factors if rh and rh.factors else {
        "timeline_score": 0,
        "evidence_frequency_score": 0,
        "budget_utilization_score": 0,
        "milestone_completion_score": 0,
        "contractor_history_score": 0,
    }))
    
    return RiskResponse(
        project_id=project_id,
        risk_score=project.risk_score,
        risk_level=project.risk_level,
        factors=factors,
        calculated_at=datetime.now(timezone.utc),
    )

@router.get("/{project_id}/risk/history", response_model=List[RiskHistoryOut])
async def get_risk_history(
    project_id: str,
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(
        select(RiskHistory)
        .where(RiskHistory.project_id == project_id)
        .order_by(RiskHistory.calculated_at.desc())
        .limit(limit)
    )
    return [RiskHistoryOut.model_validate(r) for r in result.scalars()]

@router.post("/{project_id}/milestones", response_model=MilestoneOut)
async def create_milestone(
    project_id: str,
    req: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")
    
    ms = Milestone(project_id=project_id, **req.model_dump())
    db.add(ms)
    await db.commit()
    await db.refresh(ms)
    await log_action(db, current_user.id, "create_milestone", "milestone", ms.id, {"title": ms.title})
    return MilestoneOut.model_validate(ms)

@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    project_id: str,
    milestone_id: str,
    req: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id, Milestone.project_id == project_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(ms, k, v)
    
    await db.flush()
    
    # Update project progress based on milestones
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one()
    
    all_ms_result = await db.execute(select(Milestone).where(Milestone.project_id == project_id))
    all_ms = all_ms_result.scalars().all()
    if all_ms:
        total_weight = sum(m.weight_percent for m in all_ms)
        completed_weight = sum(m.weight_percent for m in all_ms if m.is_completed)
        project.progress_percent = round((completed_weight / total_weight) * 100, 2) if total_weight else 0
    
    await _recalculate_risk(project, db)
    await db.commit()
    await db.refresh(ms)
    return MilestoneOut.model_validate(ms)

@router.get("/{project_id}/alerts", response_model=List[AlertOut])
async def get_project_alerts(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(
        select(Alert).where(Alert.project_id == project_id).order_by(Alert.created_at.desc()).limit(50)
    )
    return [AlertOut.model_validate(a) for a in result.scalars()]

@router.post("/{project_id}/simulate-failure")
async def simulate_failure(
    project_id: str,
    req: SimulateFailureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Demo: Simulate a failure scenario and trigger risk spike."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    original_score = project.risk_score
    
    if req.scenario == "no_evidence":
        project.progress_percent = max(0, project.progress_percent - 20)
    elif req.scenario == "budget_overrun":
        project.spent_amount = project.budget * 1.4
    elif req.scenario == "missed_milestones":
        project.progress_percent = max(0, project.progress_percent - 30)
    elif req.scenario == "contractor_failure":
        project.progress_percent = max(0, project.progress_percent - 25)
    
    await _recalculate_risk(project, db)
    await db.commit()
    
    await publish_event("simulation_failure", {
        "project_id": project_id,
        "scenario": req.scenario,
        "original_score": original_score,
        "new_score": project.risk_score,
    })
    
    return {
        "message": f"Failure simulated: {req.scenario}",
        "original_risk_score": original_score,
        "new_risk_score": project.risk_score,
        "risk_level": project.risk_level.value,
    }

@router.post("/{project_id}/assign-officer")
async def assign_officer(
    project_id: str,
    officer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = await db.execute(
        select(ProjectOfficer).where(
            ProjectOfficer.project_id == project_id,
            ProjectOfficer.officer_id == officer_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Officer already assigned")
    
    po = ProjectOfficer(project_id=project_id, officer_id=officer_id)
    db.add(po)
    await db.commit()
    await log_action(db, current_user.id, "assign_officer", "project", project_id, {"officer_id": officer_id})
    return {"message": "Officer assigned successfully"}
