"""
RAKSHAK — Evidence Router
PostGIS-enabled evidence upload with strict verification
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from database import get_db
from models import User, Project, Evidence, Milestone, Alert, AlertType, AlertSeverity
from schemas import EvidenceOut, EvidenceUploadResponse
from auth import get_current_user, require_admin, require_admin_or_officer
from evidence_service import process_evidence_upload, EvidenceVerificationError, validate_evidence_batch
from audit import log_action
from realtime import publish_event
from config import settings

import logging

logger = logging.getLogger("rakshak.evidence")
router = APIRouter(prefix="/evidence", tags=["Evidence"])

# Upload limits — resolved from config at module load time
ALLOWED_TYPES = settings.allowed_file_types
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post("/upload", response_model=EvidenceUploadResponse)
async def upload_evidence(
    request: Request,
    project_id: str = Form(...),
    milestone_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    """
    Upload and verify evidence with PostGIS location validation.

    Pipeline:
    1. Validate file type and size
    2. Compute SHA-256 hash for integrity
    3. Check for duplicate uploads
    4. Extract EXIF GPS metadata
    5. Validate location against project boundary (PostGIS → Haversine fallback)
    6. Store file locally (or S3/Supabase based on config)
    7. Create evidence record
    8. Trigger risk recalculation
    9. Broadcast real-time event
    """
    # ── 1. File type validation ────────────────────────────────────────────
    content_type = file.content_type or ""
    if ALLOWED_TYPES and content_type not in ALLOWED_TYPES:
        # Also allow by filename extension as fallback
        ext = (file.filename or "").lower().rsplit(".", 1)[-1]
        if f"image/{ext}" not in ALLOWED_TYPES and f"video/{ext}" not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{content_type}' not allowed. Allowed: {', '.join(ALLOWED_TYPES)}"
            )

    # ── 2. Get project with verification ──────────────────────────────────
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status == "suspended":
        raise HTTPException(status_code=400, detail="Cannot upload evidence for a suspended project")

    # ── 3. Validate milestone if provided ─────────────────────────────────
    if milestone_id:
        m_result = await db.execute(
            select(Milestone).where(
                Milestone.id == milestone_id,
                Milestone.project_id == project_id
            )
        )
        if not m_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Milestone not found or does not belong to this project")

    # ── 4. Process evidence (hash + EXIF + location + storage) ───────────
    try:
        file_data = await process_evidence_upload(
            db=db,
            file=file,
            project_id=project_id,
            project_lat=project.latitude,
            project_lon=project.longitude,
            radius_meters=project.radius_meters,
            uploaded_by=current_user.id,
            milestone_id=milestone_id,
            notes=notes
        )
    except EvidenceVerificationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Evidence processing failed for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Evidence processing failed. Please try again.")

    # ── 5. Final size guard (after read) ─────────────────────────────────
    if file_data["file_size"] > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    # ── 6. Create evidence record ─────────────────────────────────────────
    evidence = Evidence(
        project_id=project_id,
        milestone_id=milestone_id,
        uploaded_by=current_user.id,
        file_name=file.filename or "unnamed",
        file_type=file_data.get("content_type"),
        file_size=file_data["file_size"],
        file_url=file_data["file_url"],
        sha256_hash=file_data["sha256_hash"],
        exif_latitude=file_data["exif_latitude"],
        exif_longitude=file_data["exif_longitude"],
        exif_timestamp=file_data["exif_timestamp"],
        location_verified=file_data["location_verified"] or False,
        verification_distance_m=file_data["verification_distance_m"],
        verification_method=file_data["verification_method"],
        notes=notes,
        is_valid=file_data["is_valid"],
        rejection_reason=file_data["rejection_reason"],
    )

    # Set PostGIS geometry point if GPS data available
    if evidence.exif_latitude and evidence.exif_longitude:
        evidence.geog_point = f"SRID=4326;POINT({evidence.exif_longitude} {evidence.exif_latitude})"

    db.add(evidence)
    await db.flush()

    # ── 7. Trigger risk recalculation ─────────────────────────────────────
    from routers.projects import _recalculate_risk
    await _recalculate_risk(project, db, trigger="evidence_uploaded", persist_history=True)

    await db.commit()
    await db.refresh(evidence)

    # ── 8. Audit log ──────────────────────────────────────────────────────
    await log_action(
        db, current_user.id, "upload_evidence", "evidence", evidence.id,
        {
            "project_id": project_id,
            "milestone_id": milestone_id,
            "file_name": file.filename,
            "file_size": file_data["file_size"],
            "is_valid": file_data["is_valid"],
            "sha256_hash": file_data["sha256_hash"],
            "location_verified": file_data["location_verified"],
            "distance_m": file_data["verification_distance_m"],
        },
        ip_address=request.client.host if request.client else None
    )

    # ── 9. Location violation alert ───────────────────────────────────────
    if not file_data["is_valid"] and not file_data.get("location_verified"):
        dist = file_data.get("verification_distance_m")
        alert = Alert(
            project_id=project_id,
            alert_type=AlertType.LOCATION_VIOLATION,
            severity=AlertSeverity.HIGH,
            title="Evidence Location Verification Failed",
            message=(
                f"Evidence uploaded by {current_user.full_name} was rejected. "
                f"Location was {dist:.0f}m from project site (required: within {project.radius_meters:.0f}m). "
                f"File: {file.filename}"
            )
        )
        db.add(alert)

    await db.commit()

    # ── 10. Broadcast event ───────────────────────────────────────────────
    await publish_event("evidence_uploaded", {
        "project_id": project_id,
        "evidence_id": evidence.id,
        "is_valid": file_data["is_valid"],
        "location_verified": file_data["location_verified"],
        "distance_m": file_data["verification_distance_m"],
        "uploader": current_user.full_name,
        "file_name": file.filename,
    })

    logger.info(
        f"Evidence uploaded: {evidence.id} for project {project_id} — "
        f"valid: {file_data['is_valid']}, location_verified: {file_data['location_verified']}"
    )

    return EvidenceUploadResponse.model_validate(evidence)


@router.get("/project/{project_id}", response_model=List[EvidenceOut])
async def get_project_evidence(
    project_id: str,
    valid_only: bool = Query(False, description="Only return verified evidence"),
    include_invalid: bool = Query(False, description="Include rejected evidence"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get evidence for a project with filtering and pagination."""
    # Verify project exists
    p_res = await db.execute(select(Project).where(Project.id == project_id))
    if not p_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    query = (
        select(Evidence)
        .where(Evidence.project_id == project_id)
        .order_by(Evidence.created_at.desc())
    )

    if valid_only:
        query = query.where(Evidence.is_valid == True)
    elif not include_invalid:
        # Default: only valid evidence
        query = query.where(Evidence.is_valid == True)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return [EvidenceOut.model_validate(ev) for ev in result.scalars()]


@router.get("/{evidence_id}", response_model=EvidenceOut)
async def get_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get a single evidence record by ID."""
    result = await db.execute(
        select(Evidence)
        .where(Evidence.id == evidence_id)
        .options(selectinload(Evidence.uploader))
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return EvidenceOut.model_validate(ev)


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_officer)
):
    """Delete an evidence record (admin can delete any; officer only their own uploads)."""
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Authorization: admin can delete any; otherwise must be original uploader
    if current_user.role.value != "admin" and evidence.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this evidence")

    project_id = evidence.project_id
    file_name = evidence.file_name

    await db.delete(evidence)
    await db.flush()

    await log_action(
        db, current_user.id, "delete_evidence", "evidence", evidence_id,
        {"project_id": project_id, "file_name": file_name}
    )

    # Recalculate risk after evidence removal
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    project = p_result.scalar_one_or_none()
    if project:
        from routers.projects import _recalculate_risk
        await _recalculate_risk(project, db, trigger="evidence_deleted", persist_history=True)

    await db.commit()
    return None


@router.post("/validate-batch")
async def batch_validate_evidence(
    evidence_ids: List[str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Admin: Re-validate evidence batch with current project boundaries."""
    if not evidence_ids:
        raise HTTPException(status_code=400, detail="No evidence IDs provided")
    if len(evidence_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 evidence items per batch")

    results = await validate_evidence_batch(db, evidence_ids)
    await db.commit()

    await log_action(
        db, current_user.id, "batch_validate_evidence", "evidence", None,
        {"count": len(evidence_ids), "results": results}
    )
    await db.commit()

    return results


@router.get("/stats/{project_id}")
async def get_evidence_stats(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    """Get evidence statistics for a project."""
    # Verify project exists
    p_result = await db.execute(select(Project).where(Project.id == project_id))
    if not p_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Total
    total_res = await db.execute(
        select(func.count()).select_from(Evidence).where(Evidence.project_id == project_id)
    )
    total = total_res.scalar() or 0

    # Valid
    valid_res = await db.execute(
        select(func.count()).select_from(Evidence)
        .where(Evidence.project_id == project_id, Evidence.is_valid == True)
    )
    valid = valid_res.scalar() or 0

    # Invalid
    invalid = total - valid

    # Recent (last 30 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    recent_res = await db.execute(
        select(func.count()).select_from(Evidence)
        .where(
            Evidence.project_id == project_id,
            Evidence.is_valid == True,
            Evidence.created_at >= cutoff
        )
    )
    recent = recent_res.scalar() or 0

    # Location verification rate
    loc_verified_res = await db.execute(
        select(func.count()).select_from(Evidence)
        .where(Evidence.project_id == project_id, Evidence.location_verified == True)
    )
    loc_verified = loc_verified_res.scalar() or 0

    # Last upload date
    last_res = await db.execute(
        select(Evidence.created_at)
        .where(Evidence.project_id == project_id, Evidence.is_valid == True)
        .order_by(Evidence.created_at.desc())
        .limit(1)
    )
    last_upload = last_res.scalar()

    days_since_last = None
    if last_upload:
        last_aware = last_upload.replace(tzinfo=timezone.utc) if last_upload.tzinfo is None else last_upload
        days_since_last = (datetime.now(timezone.utc) - last_aware).days

    return {
        "project_id": project_id,
        "total_evidence": total,
        "valid_evidence": valid,
        "invalid_evidence": invalid,
        "recent_uploads_30d": recent,
        "location_verified": loc_verified,
        "verification_rate": round(valid / total * 100, 2) if total > 0 else 0.0,
        "location_verification_rate": round(loc_verified / total * 100, 2) if total > 0 else 0.0,
        "last_upload_date": last_upload,
        "days_since_last_upload": days_since_last,
    }
