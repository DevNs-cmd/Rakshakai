from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from database import get_db
from models import User, Project, Contractor, ProjectOfficer
from schemas import ContractorCreate, ContractorOut, UserOut
from auth import get_current_user, require_admin
import uuid

router = APIRouter(prefix="/contractors", tags=["Contractors"])

@router.get("/", response_model=List[ContractorOut])
async def list_contractors(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Contractor))
    return [ContractorOut.model_validate(c) for c in result.scalars()]

@router.post("/", response_model=ContractorOut)
async def create_contractor(
    req: ContractorCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin)
):
    contractor = Contractor(**req.model_dump())
    db.add(contractor)
    await db.commit()
    await db.refresh(contractor)
    return ContractorOut.model_validate(contractor)

@router.get("/{contractor_id}", response_model=ContractorOut)
async def get_contractor(contractor_id: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Contractor).where(Contractor.id == contractor_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return ContractorOut.model_validate(c)
