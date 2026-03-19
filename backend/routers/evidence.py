from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from database import get_db
from models import User, Project, Evidence
from schemas import EvidenceOut
from auth import get_current_user, require_admin_or_officer
from evidence_service import process_evidence_upload
from audit import log_action
from realtime import publish_event

router = APIRouter(prefix="/evidence", tags=["Evidence"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "video/mp4", "video/quicktime", "application/pdf"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@router.post("/upload", response_model=EvidenceOut)
async def upload_evidence(
    project_id: str = Form(...),
    milestone_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")
    
    # Get project
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Process file
    file_data = await process_evidence_upload(
        file=file,
        project_lat=project.latitude,
        project_lon=project.longitude,
        project_id=project_id,
        radius_meters=project.radius_meters,
    )
    
    if file_data["file_size"] > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    
    # Check duplicate hash
    hash_check = await db.execute(
        select(Evidence).where(Evidence.sha256_hash == file_data["sha256_hash"])
    )
    if hash_check.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Duplicate file: this evidence has already been uploaded")
    
    # Determine validity
    is_valid = True
    rejection_reason = None
    
    if not file_data["has_gps"]:
        is_valid = False
        rejection_reason = "No GPS metadata found in file"
    elif not file_data["location_verified"]:
        is_valid = False
        rejection_reason = f"GPS location mismatch: file was {file_data['verification_distance_m']}m from project site (max {project.radius_meters}m)"
    
    evidence = Evidence(
        project_id=project_id,
        milestone_id=milestone_id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_type=file.content_type,
        file_size=file_data["file_size"],
        file_url=file_data["file_url"],
        sha256_hash=file_data["sha256_hash"],
        exif_latitude=file_data["exif_latitude"],
        exif_longitude=file_data["exif_longitude"],
        exif_timestamp=file_data["exif_timestamp"],
        location_verified=file_data["location_verified"],
        verification_distance_m=file_data["verification_distance_m"],
        notes=notes,
        is_valid=is_valid,
        rejection_reason=rejection_reason,
    )
    
    db.add(evidence)
    await db.flush()
    
    # Trigger risk recalculation
    from routers.projects import _recalculate_risk
    await _recalculate_risk(project, db)
    
    await db.commit()
    await db.refresh(evidence)
    
    await log_action(
        db, current_user.id, "upload_evidence", "evidence", evidence.id,
        {"project_id": project_id, "file_name": file.filename, "is_valid": is_valid, "hash": file_data["sha256_hash"]}
    )
    
    await publish_event("evidence_uploaded", {
        "project_id": project_id,
        "evidence_id": evidence.id,
        "is_valid": is_valid,
        "location_verified": file_data["location_verified"],
    })
    
    return EvidenceOut.model_validate(evidence)

@router.get("/project/{project_id}", response_model=List[EvidenceOut])
async def get_project_evidence(
    project_id: str,
    valid_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    query = select(Evidence).where(Evidence.project_id == project_id).order_by(Evidence.created_at.desc())
    if valid_only:
        query = query.where(Evidence.is_valid == True)
    
    result = await db.execute(query)
    return [EvidenceOut.model_validate(e) for e in result.scalars()]

@router.get("/{evidence_id}", response_model=EvidenceOut)
async def get_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return EvidenceOut.model_validate(ev)
