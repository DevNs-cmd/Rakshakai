"""
RAKSHAK — Contractors Router
Contractor management with performance analytics
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from database import get_db
from models import User, Project, Contractor, ProjectStatus
from schemas import ContractorCreate, ContractorOut, ContractorUpdate
from auth import get_current_user, require_admin
from audit import log_action
from realtime import publish_event

import logging

logger = logging.getLogger("rakshak.contractors")
router = APIRouter(prefix="/contractors", tags=["Contractors"])


@router.get("/", response_model=List[ContractorOut])
async def list_contractors(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    max_risk_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = Query(None, description="Search by name or registration number"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """List contractors with filtering and search."""
    query = select(Contractor).offset(skip).limit(limit)

    if min_risk_score is not None:
        query = query.where(Contractor.risk_score >= min_risk_score)
    if max_risk_score is not None:
        query = query.where(Contractor.risk_score <= max_risk_score)
    if search:
        query = query.where(
            or_(
                Contractor.name.ilike(f"%{search}%"),
                Contractor.registration_no.ilike(f"%{search}%")
            )
        )

    result = await db.execute(query)
    return [ContractorOut.model_validate(c) for c in result.scalars()]


@router.post("/", response_model=ContractorOut, status_code=status.HTTP_201_CREATED)
async def create_contractor(
    req: ContractorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new contractor (admin only)."""
    # Check for duplicate registration number
    if req.registration_no:
        existing = await db.execute(
            select(Contractor).where(Contractor.registration_no == req.registration_no)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Contractor with this registration number already exists"
            )

    contractor = Contractor(**req.model_dump())
    db.add(contractor)
    await db.flush()

    await log_action(
        db, current_user.id, "create_contractor", "contractor", contractor.id,
        {"name": contractor.name, "registration_no": contractor.registration_no}
    )
    await db.commit()
    await db.refresh(contractor)

    await publish_event("contractor_created", {
        "contractor_id": contractor.id,
        "name": contractor.name
    })

    return ContractorOut.model_validate(contractor)


@router.get("/{contractor_id}", response_model=ContractorOut)
async def get_contractor(
    contractor_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get contractor details."""
    result = await db.execute(
        select(Contractor)
        .where(Contractor.id == contractor_id)
    )
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    return ContractorOut.model_validate(contractor)


@router.patch("/{contractor_id}", response_model=ContractorOut)
async def update_contractor(
    contractor_id: str,
    req: ContractorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update contractor information (admin only)."""
    result = await db.execute(select(Contractor).where(Contractor.id == contractor_id))
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(contractor, key, value)

    await log_action(
        db, current_user.id, "update_contractor", "contractor", contractor_id,
        update_data
    )
    await db.commit()
    await db.refresh(contractor)

    return ContractorOut.model_validate(contractor)


@router.get("/{contractor_id}/stats")
async def get_contractor_stats(
    contractor_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get detailed statistics for a contractor aggregated from their projects."""
    from sqlalchemy import case

    # Verify contractor exists
    con_res = await db.execute(select(Contractor).where(Contractor.id == contractor_id))
    contractor = con_res.scalar_one_or_none()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    # Get project statistics from real DB data
    stats_result = await db.execute(
        select(
            func.count().label('total_projects'),
            func.sum(
                case((Project.status == ProjectStatus.COMPLETED, 1), else_=0)
            ).label('completed'),
            func.sum(
                case((Project.status == ProjectStatus.DELAYED, 1), else_=0)
            ).label('delayed'),
            func.sum(
                case((Project.status == ProjectStatus.ACTIVE, 1), else_=0)
            ).label('active'),
            func.avg(Project.risk_score).label('avg_project_risk'),
            func.max(Project.risk_score).label('max_project_risk'),
            func.sum(Project.budget).label('total_budget'),
            func.sum(Project.spent_amount).label('total_spent'),
            func.avg(Project.progress_percent).label('avg_progress'),
        )
        .select_from(Project)
        .where(Project.contractor_id == contractor_id)
    )
    row = stats_result.first()

    total_projects = row.total_projects or 0
    total_budget = float(row.total_budget or 0)
    total_spent = float(row.total_spent or 0)

    return {
        "contractor_id": contractor_id,
        "contractor_name": contractor.name,
        "registration_no": contractor.registration_no,
        "total_projects": total_projects,
        "completed_projects": int(row.completed or 0),
        "delayed_projects": int(row.delayed or 0),
        "active_projects": int(row.active or 0),
        "average_project_risk": round(float(row.avg_project_risk or 0), 2),
        "max_project_risk": round(float(row.max_project_risk or 0), 2),
        "average_progress": round(float(row.avg_progress or 0), 2),
        "total_budget": total_budget,
        "total_spent": total_spent,
        "budget_utilization": round(total_spent / total_budget * 100, 2) if total_budget > 0 else 0.0,
        "stored_failure_rate": round(contractor.failure_rate * 100, 2),
        "stored_risk_score": contractor.risk_score,
        "avg_delay_days": contractor.avg_delay_days,
    }


@router.delete("/{contractor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contractor(
    contractor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a contractor (admin only, only if no active projects)."""
    result = await db.execute(
        select(Contractor).where(Contractor.id == contractor_id)
    )
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    # Check for active projects
    active_res = await db.execute(
        select(func.count()).select_from(Project)
        .where(
            Project.contractor_id == contractor_id,
            Project.status == ProjectStatus.ACTIVE
        )
    )
    active_count = active_res.scalar() or 0

    if active_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete contractor with {active_count} active projects. Reassign or complete them first."
        )

    contractor_name = contractor.name
    await db.delete(contractor)

    await log_action(
        db, current_user.id, "delete_contractor", "contractor", contractor_id,
        {"name": contractor_name}
    )
    await db.commit()

    return None