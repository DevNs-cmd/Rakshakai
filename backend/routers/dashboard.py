"""
RAKSHAK — Dashboard Router
National-level statistics, integrity scoring, alert management, and audit logs
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, text
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from database import get_db, db_health_check
from models import (
    Project, Alert, AuditLog, RiskHistory, ProjectStatus, RiskLevel,
    AlertType, AlertSeverity, User, Contractor
)
from schemas import (
    DashboardStats, AlertOut, AlertUpdate, AuditLogOut,
    IntegrityScoreResponse, SimulateFailureRequest, SystemHealth
)
from auth import get_current_user, require_admin
from risk_engine import risk_engine
from realtime import publish_event, manager
from audit import log_action
from config import settings
from cache import cached

import logging

logger = logging.getLogger("rakshak.dashboard")
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
@cached("dashboard:stats", ttl_seconds=300)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get national-level dashboard statistics.
    Aggregates data across ALL projects for high-level monitoring.
    All values are computed live from the database — no mock data.
    """
    now = datetime.now(timezone.utc)

    # ── Project counts ─────────────────────────────────────────────────────
    total_res = await db.execute(select(func.count()).select_from(Project))
    total_projects = total_res.scalar() or 0

    active_res = await db.execute(
        select(func.count()).select_from(Project).where(Project.status == ProjectStatus.ACTIVE)
    )
    active_projects = active_res.scalar() or 0

    # ── Risk distribution (from DB, not computed) ─────────────────────────
    high_risk_res = await db.execute(
        select(func.count()).select_from(Project).where(Project.risk_level == RiskLevel.RED)
    )
    high_risk = high_risk_res.scalar() or 0

    medium_risk_res = await db.execute(
        select(func.count()).select_from(Project).where(Project.risk_level == RiskLevel.YELLOW)
    )
    medium_risk = medium_risk_res.scalar() or 0

    delayed_res = await db.execute(
        select(func.count()).select_from(Project).where(Project.status == ProjectStatus.DELAYED)
    )
    delayed_projects = delayed_res.scalar() or 0

    # ── Financial metrics ─────────────────────────────────────────────────
    budget_res = await db.execute(select(func.sum(Project.budget)).select_from(Project))
    total_budget = float(budget_res.scalar() or 0)

    spent_res = await db.execute(select(func.sum(Project.spent_amount)).select_from(Project))
    total_spent = float(spent_res.scalar() or 0)

    budget_util = (total_spent / total_budget * 100) if total_budget > 0 else 0.0

    # ── Progress metrics ──────────────────────────────────────────────────
    progress_res = await db.execute(
        select(func.avg(Project.progress_percent)).select_from(Project)
    )
    avg_progress = float(progress_res.scalar() or 0)
    avg_delay_percent = max(0.0, 100.0 - avg_progress)

    # ── Integrity and risk scores ─────────────────────────────────────────
    risk_scores_res = await db.execute(select(Project.risk_score).select_from(Project))
    all_scores = [s for s in risk_scores_res.scalars() if s is not None]
    national_metrics = risk_engine.compute_national_risk(all_scores)

    # ── Alert counts ──────────────────────────────────────────────────────
    recent_alerts_res = await db.execute(
        select(func.count()).select_from(Alert)
        .where(Alert.created_at >= now - timedelta(hours=24))
    )
    recent_alerts = recent_alerts_res.scalar() or 0

    unread_alerts_res = await db.execute(
        select(func.count()).select_from(Alert).where(Alert.is_read == False)
    )
    unread_alerts = unread_alerts_res.scalar() or 0

    # ── Contractor count ──────────────────────────────────────────────────
    contractor_res = await db.execute(select(func.count()).select_from(Contractor))
    total_contractors = contractor_res.scalar() or 0

    return DashboardStats(
        total_projects=total_projects,
        active_projects=active_projects,
        high_risk_projects=high_risk,
        medium_risk_projects=medium_risk,
        delayed_projects=delayed_projects,
        avg_delay_percent=round(avg_delay_percent, 2),
        total_budget=total_budget,
        total_spent=total_spent,
        budget_utilization=round(budget_util, 2),
        integrity_score=round(national_metrics["integrity_score"], 2),
        national_risk_score=round(national_metrics["national_score"], 2),
        risk_distribution=national_metrics["risk_distribution"],
        recent_alerts=recent_alerts,
        unread_alerts=unread_alerts,
        total_contractors=total_contractors,
    )


@router.get("/integrity-score", response_model=IntegrityScoreResponse)
@cached("dashboard:integrity", ttl_seconds=600)
async def get_integrity_score(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get the national integrity score.
    This is the key metric for overall governance health.
    Aggregates live project risk scores into a single index.
    """
    result = await db.execute(select(Project.id, Project.risk_score, Project.name).select_from(Project))
    rows = result.all()
    scores = [r.risk_score for r in rows if r.risk_score is not None]

    metrics = risk_engine.compute_national_risk(scores)

    # Top risky projects
    top_risk = sorted(rows, key=lambda r: r.risk_score or 0, reverse=True)[:5]
    top_risk_projects = [
        {"id": r.id, "name": r.name, "risk_score": round(r.risk_score or 0, 2)}
        for r in top_risk
    ]

    return IntegrityScoreResponse(
        integrity_score=round(metrics["integrity_score"], 2),
        national_risk_score=round(metrics["national_score"], 2),
        avg_project_risk=metrics["avg_project_risk"],
        max_project_risk=metrics["max_project_risk"],
        risk_distribution=metrics["risk_distribution"],
        project_count=metrics["project_count"],
        high_risk_percentage=metrics["high_risk_percentage"],
        top_risk_projects=top_risk_projects,
        last_updated=datetime.now(timezone.utc)
    )


@router.get("/alerts", response_model=List[AlertOut])
async def get_all_alerts(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    unresolved_only: bool = Query(False),
    severity: Optional[AlertSeverity] = Query(None),
    alert_type: Optional[AlertType] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get system-wide alerts with filtering. Endpoint: GET /alerts"""
    query = (
        select(Alert, Project.name.label('project_name'))
        .outerjoin(Project, Alert.project_id == Project.id)
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )

    if unread_only:
        query = query.where(Alert.is_read == False)
    if unresolved_only:
        query = query.where(Alert.is_resolved == False)
    if severity:
        query = query.where(Alert.severity == severity)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)

    result = await db.execute(query)

    alerts = []
    for row in result.all():
        alert, project_name = row
        alert_data = AlertOut.model_validate(alert)
        alert_data.project_name = project_name
        alerts.append(alert_data)

    return alerts


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: str,
    update: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update alert status (mark as read/resolved)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if update.is_read is not None:
        alert.is_read = update.is_read

    if update.is_resolved is not None:
        alert.is_resolved = update.is_resolved
        if alert.is_resolved:
            alert.resolved_by = current_user.id
            alert.resolved_at = datetime.now(timezone.utc)
            alert.resolution_notes = update.resolution_notes

    await log_action(
        db, current_user.id, "update_alert", "alert", alert_id,
        {"is_read": alert.is_read, "is_resolved": alert.is_resolved}
    )
    await db.commit()
    await db.refresh(alert)

    return AlertOut.model_validate(alert)


@router.get("/audit-logs", response_model=List[AuditLogOut])
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get audit logs with filtering.
    Critical for compliance and transparency under RTI and CAG requirements.
    """
    query = (
        select(AuditLog, User.email.label('user_email'))
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    result = await db.execute(query)

    logs = []
    for row in result.all():
        log, user_email = row
        log_data = AuditLogOut.model_validate(log)
        log_data.user_email = user_email
        logs.append(log_data)

    return logs


@router.post("/simulate-system-failure")
async def simulate_system_failure(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Simulate a system-wide failure for testing (admin only).
    Injects risk spikes across multiple projects and broadcasts real-time alerts.
    """
    from models import RiskHistory

    # Get up to 5 random active/delayed projects
    result = await db.execute(
        select(Project)
        .where(Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.DELAYED]))
        .limit(5)
    )
    projects = result.scalars().all()

    if not projects:
        raise HTTPException(status_code=400, detail="No active projects to simulate failure on")

    impacted = []
    for project in projects:
        old_score = project.risk_score or 0.0
        new_score = min(100.0, old_score + 30.0)
        project.risk_score = new_score
        project.risk_level = RiskLevel.RED if new_score >= 70 else RiskLevel.YELLOW

        # Persist risk history
        rh = RiskHistory(
            project_id=project.id,
            risk_score=new_score,
            risk_level=project.risk_level,
            factors={"simulation": "system_failure"},
            trigger_event="system_simulation"
        )
        db.add(rh)

        # Create critical alert
        alert = Alert(
            project_id=project.id,
            alert_type=AlertType.ANOMALY_SPIKE,
            severity=AlertSeverity.CRITICAL,
            title="SIMULATION: System-Wide Critical Anomaly",
            message=(
                f"System failure simulation triggered by {current_user.full_name}. "
                f"Risk score changed: {old_score:.1f} → {new_score:.1f}."
            ),
            is_read=False
        )
        db.add(alert)
        impacted.append({"id": project.id, "name": project.name, "old_score": old_score, "new_score": new_score})

    await db.flush()

    await log_action(
        db, current_user.id, "simulate_system_failure", "system", "global",
        {"impacted_count": len(impacted), "projects": [p["name"] for p in impacted]}
    )
    await db.commit()

    await publish_event("system_simulation", {
        "message": f"System failure simulated by {current_user.full_name}",
        "impacted_count": len(impacted),
        "impacted_projects": impacted,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    return {
        "status": "success",
        "message": f"Simulated system failure affecting {len(impacted)} projects",
        "impacted_projects": impacted,
        "initiated_by": current_user.full_name,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health", response_model=SystemHealth)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get system health status for all components."""
    components = {}

    # Database health
    try:
        db_status = await db_health_check()
        components["database"] = db_status
    except Exception as e:
        components["database"] = {"status": "error", "error": str(e)}

    # Redis health
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        components["redis"] = {"status": "healthy"}
    except Exception as e:
        components["redis"] = {"status": "degraded", "error": str(e)}

    # WebSocket connections
    ws_stats = manager.get_stats()
    components["websockets"] = {
        "status": "healthy",
        "active_connections": ws_stats["total_connections"],
        "active_rooms": ws_stats["active_rooms"],
        "rooms": ws_stats["rooms"],
    }

    # Overall status
    overall = "healthy"
    for comp_name, comp in components.items():
        if isinstance(comp, dict) and comp.get("status") not in ("healthy",):
            overall = "degraded"
            break

    return SystemHealth(
        status=overall,
        components=components,
        timestamp=datetime.now(timezone.utc)
    )


@router.get("/risk-trends")
async def get_risk_trends(
    days: int = Query(30, ge=7, le=90, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """
    Get national risk trends over time (aggregated from risk_history table).
    Returns daily average risk scores and distribution.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date_trunc('day', RiskHistory.calculated_at).label('day'),
            func.avg(RiskHistory.risk_score).label('avg_score'),
            func.max(RiskHistory.risk_score).label('max_score'),
            func.min(RiskHistory.risk_score).label('min_score'),
            func.count().label('calc_count'),
        )
        .where(RiskHistory.calculated_at >= cutoff)
        .group_by(func.date_trunc('day', RiskHistory.calculated_at))
        .order_by(func.date_trunc('day', RiskHistory.calculated_at))
    )

    trends = []
    for row in result.all():
        trends.append({
            "day": row.day.isoformat() if row.day else None,
            "avg_risk_score": round(float(row.avg_score or 0), 2),
            "max_risk_score": round(float(row.max_score or 0), 2),
            "min_risk_score": round(float(row.min_score or 0), 2),
            "calculations": row.calc_count,
        })

    return {
        "period_days": days,
        "data_points": len(trends),
        "trends": trends,
    }
