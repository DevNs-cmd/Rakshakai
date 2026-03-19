from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Project, Alert, AuditLog, RiskHistory
from schemas import DashboardStats, AlertOut, AuditLogOut
from auth import get_current_user
from typing import List

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    # Total projects
    total_result = await db.execute(select(func.count()).select_from(Project))
    total_projects = total_result.scalar() or 0
    
    # Active projects
    active_result = await db.execute(select(func.count()).select_from(Project).where(Project.status == "active"))
    active_projects = active_result.scalar() or 0
    
    # High risk
    high_risk_result = await db.execute(select(func.count()).select_from(Project).where(Project.risk_level == "red"))
    high_risk_projects = high_risk_result.scalar() or 0
    
    # Delayed
    delayed_result = await db.execute(select(func.count()).select_from(Project).where(Project.status == "delayed"))
    delayed_projects = delayed_result.scalar() or 0
    
    # Budget
    budget_result = await db.execute(select(func.sum(Project.budget)).select_from(Project))
    total_budget = float(budget_result.scalar() or 0)
    
    # Avg delay % (progress gap for delayed projects)
    progress_result = await db.execute(select(func.avg(Project.progress_percent)).select_from(Project))
    avg_progress = float(progress_result.scalar() or 0)
    avg_delay_percent = max(0, 100 - avg_progress)
    
    # Risk scores
    risk_result = await db.execute(select(func.avg(Project.risk_score)).select_from(Project))
    national_risk_score = float(risk_result.scalar() or 0)
    integrity_score = max(0, 100 - national_risk_score)
    
    return DashboardStats(
        total_projects=total_projects,
        active_projects=active_projects,
        high_risk_projects=high_risk_projects,
        delayed_projects=delayed_projects,
        avg_delay_percent=round(avg_delay_percent, 2),
        total_budget=total_budget,
        integrity_score=round(integrity_score, 2),
        national_risk_score=round(national_risk_score, 2),
    )

@router.get("/alerts", response_model=List[AlertOut])
async def get_all_alerts(
    limit: int = 20,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    query = select(Alert).order_by(Alert.created_at.desc()).limit(limit)
    if unread_only:
        query = query.where(Alert.is_read == False)
    result = await db.execute(query)
    return [AlertOut.model_validate(a) for a in result.scalars()]

@router.get("/audit-logs", response_model=List[AuditLogOut])
async def get_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return [AuditLogOut.model_validate(log) for log in result.scalars()]

@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        alert.is_read = True
        await db.commit()
    return {"message": "Alert marked as read"}
