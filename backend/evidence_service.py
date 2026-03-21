"""
RAKSHAK — Evidence Verification Service
PostGIS-enabled location verification with strict integrity checks
"""
import hashlib
import io
import os
import uuid
import aiofiles
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from fastapi import UploadFile, HTTPException
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

logger = logging.getLogger("rakshak.evidence")

# Try to import EXIF libraries
try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL not available, EXIF extraction limited")

try:
    import exifread
    EXIFREAD_AVAILABLE = True
except ImportError:
    EXIFREAD_AVAILABLE = False


class EvidenceVerificationError(Exception):
    """Custom exception for evidence verification failures."""
    pass


def sha256_hash_bytes(data: bytes) -> str:
    """Compute SHA-256 hash of file bytes."""
    return hashlib.sha256(data).hexdigest()


def _convert_dms_to_decimal(degrees: Any, minutes: Any, seconds: Any, ref: str) -> float:
    """Convert DMS coordinates to decimal degrees."""
    try:
        # Handle both tuple and individual values
        if hasattr(degrees, 'num'):
            d = float(degrees.num) / float(degrees.den)
            m = float(minutes.num) / float(minutes.den)
            s = float(seconds.num) / float(seconds.den)
        else:
            d = float(degrees)
            m = float(minutes)
            s = float(seconds)

        decimal = d + m / 60 + s / 3600
        if ref in ('S', 'W'):
            decimal = -decimal
        return round(decimal, 6)
    except Exception as e:
        logger.warning(f"DMS conversion failed: {e}")
        return None


def extract_exif_metadata(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extract GPS and timestamp metadata from image EXIF.
    Tries multiple libraries for maximum compatibility.
    """
    result = {
        "latitude": None,
        "longitude": None,
        "timestamp": None,
        "has_gps": False,
        "device_make": None,
        "device_model": None,
    }

    # Try exifread first (more reliable for GPS)
    if EXIFREAD_AVAILABLE:
        try:
            img_io = io.BytesIO(image_bytes)
            tags = exifread.process_file(img_io, details=False, strict=True)

            # Extract GPS
            lat_tag = tags.get('GPS GPSLatitude')
            lat_ref = tags.get('GPS GPSLatitudeRef')
            lon_tag = tags.get('GPS GPSLongitude')
            lon_ref = tags.get('GPS GPSLongitudeRef')

            if lat_tag and lon_tag and lat_ref and lon_ref:
                lat = _convert_dms_to_decimal(
                    lat_tag.values[0], lat_tag.values[1], lat_tag.values[2],
                    str(lat_ref)
                )
                lon = _convert_dms_to_decimal(
                    lon_tag.values[0], lon_tag.values[1], lon_tag.values[2],
                    str(lon_ref)
                )
                if lat is not None and lon is not None:
                    result["latitude"] = lat
                    result["longitude"] = lon
                    result["has_gps"] = True
                    logger.debug(f"GPS extracted via exifread: {lat}, {lon}")

            # Extract timestamp
            dt_tag = tags.get('EXIF DateTimeOriginal') or tags.get('Image DateTime')
            if dt_tag:
                try:
                    dt_str = str(dt_tag)
                    result["timestamp"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                except ValueError:
                    pass

            # Device info
            make_tag = tags.get('Image Make')
            model_tag = tags.get('Image Model')
            if make_tag:
                result["device_make"] = str(make_tag).strip()
            if model_tag:
                result["device_model"] = str(model_tag).strip()

        except Exception as e:
            logger.debug(f"exifread extraction failed: {e}")

    # Fallback to PIL if GPS not found
    if not result["has_gps"] and PIL_AVAILABLE:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            exif_data = img._getexif() or {}

            gps_info = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "GPSInfo":
                    for gps_tag_id, gps_val in value.items():
                        gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                        gps_info[gps_tag] = gps_val

            if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
                lat_ref = gps_info.get("GPSLatitudeRef", "N")
                lon_ref = gps_info.get("GPSLongitudeRef", "E")

                def to_decimal(coords, ref):
                    d = float(coords[0])
                    m = float(coords[1])
                    s = float(coords[2])
                    dec = d + m / 60 + s / 3600
                    if ref in ('S', 'W'):
                        dec = -dec
                    return round(dec, 6)

                result["latitude"] = to_decimal(gps_info["GPSLatitude"], lat_ref)
                result["longitude"] = to_decimal(gps_info["GPSLongitude"], lon_ref)
                result["has_gps"] = True
                logger.debug(f"GPS extracted via PIL: {result['latitude']}, {result['longitude']}")

        except Exception as e:
            logger.debug(f"PIL extraction failed: {e}")

    return result


async def validate_location_postgis(
    db: AsyncSession,
    evidence_lat: float,
    evidence_lon: float,
    project_id: str,
    max_distance_meters: float
) -> Tuple[bool, float, str]:
    """
    Validate evidence location using PostGIS ST_DWithin.
    Returns: (is_valid, distance_meters, method)
    """
    try:
        # PostGIS query for distance calculation
        query = text("""
            SELECT
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(:ev_lon, :ev_lat), 4326)::geography,
                    geog_point
                ) as distance,
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(:ev_lon, :ev_lat), 4326)::geography,
                    geog_point,
                    :max_dist
                ) as is_within
            FROM projects
            WHERE id = :project_id
        """)

        result = await db.execute(query, {
            "ev_lat": evidence_lat,
            "ev_lon": evidence_lon,
            "project_id": project_id,
            "max_dist": max_distance_meters
        })
        row = result.fetchone()

        if not row:
            logger.error(f"Project {project_id} not found for location validation")
            return False, float('inf'), "error"

        distance = float(row.distance or 0)
        is_within = bool(row.is_within)

        logger.info(f"PostGIS validation: distance={distance:.2f}m, within={is_within}")
        return is_within, round(distance, 2), "postgis"

    except Exception as e:
        logger.error(f"PostGIS validation failed: {e}")
        # Fallback to haversine
        return None, None, "postgis_failed"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Fallback distance calculation using Haversine formula.
    Used when PostGIS is unavailable.
    """
    import math
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return round(R * c, 2)


async def validate_location_fallback(
    evidence_lat: float,
    evidence_lon: float,
    project_lat: float,
    project_lon: float,
    max_distance_meters: float
) -> Tuple[bool, float, str]:
    """Fallback location validation using Haversine formula."""
    distance = haversine_distance(evidence_lat, evidence_lon, project_lat, project_lon)
    is_valid = distance <= max_distance_meters
    return is_valid, distance, "haversine"


async def store_evidence(file_bytes: bytes, filename: str, project_id: str) -> str:
    """
    Store evidence based on configured strategy (local or S3).
    Returns the file URL or key.
    """
    from config import settings
    
    # Generate unique filename with original extension
    ext = os.path.splitext(filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    path_prefix = f"{project_id[:2]}/{project_id}/{unique_name}"
    
    if settings.UPLOAD_STORAGE == "s3":
        try:
            # Initialize S3 client
            s3_config = Config(
                region_name=settings.AWS_REGION,
                signature_version='s3v4'
            )
            s3 = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_ENDPOINT_URL,
                config=s3_config
            )
            
            # Record content type
            from mimetypes import guess_type
            content_type, _ = guess_type(filename)
            
            # Upload to S3
            s3.put_object(
                Bucket=settings.AWS_BUCKET_NAME,
                Key=path_prefix,
                Body=file_bytes,
                ContentType=content_type or 'application/octet-stream'
            )
            
            # Return the key (will generate signed URL for viewing)
            return path_prefix
            
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            # Fallback to local if configured or raise
            if settings.ENVIRONMENT != "production":
                logger.warning("S3 failed, falling back to local for development")
            else:
                raise EvidenceVerificationError(f"Cloud storage failure: {e}")
                
    # Default: Local storage
    upload_dir = os.path.join(settings.UPLOAD_DIR, project_id[:2], project_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    filepath = os.path.join(upload_dir, unique_name)
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(file_bytes)
    
    return f"/uploads/{path_prefix}"


def get_signed_url(file_url: str, expires_in: int = 3600) -> str:
    """
    Generate a signed URL for viewing evidence.
    For local storage, returns the URL as is.
    For S3, generates a temporary presigned URL.
    """
    from config import settings
    
    if not file_url:
        return ""
        
    if settings.UPLOAD_STORAGE == "s3" and not file_url.startswith("/"):
        try:
            s3 = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_ENDPOINT_URL,
                region_name=settings.AWS_REGION
            )
            
            url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_BUCKET_NAME,
                    'Key': file_url
                },
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            return file_url
            
    return file_url


async def check_duplicate_hash(db: AsyncSession, file_hash: str) -> Optional[Dict[str, Any]]:
    """Check if file hash already exists in database."""
    from sqlalchemy import select
    from models import Evidence

    result = await db.execute(
        select(Evidence).where(Evidence.sha256_hash == file_hash)
    )
    existing = result.scalar_one_or_none()

    if existing:
        return {
            "exists": True,
            "evidence_id": existing.id,
            "project_id": existing.project_id,
            "uploaded_at": existing.created_at,
        }
    return None


async def process_evidence_upload(
    db: AsyncSession,
    file: UploadFile,
    project_id: str,
    project_lat: float,
    project_lon: float,
    radius_meters: float,
    uploaded_by: str,
    milestone_id: Optional[str] = None,
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Full evidence processing pipeline with PostGIS validation.

    Steps:
    1. Read and validate file size
    2. Compute SHA-256 hash
    3. Check for duplicates
    4. Extract EXIF metadata
    5. Validate location (PostGIS primary, Haversine fallback)
    6. Store file
    7. Return structured result
    """
    from config import settings, constants

    # 1. Read file
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Validate file size
    if file_size > constants.MAX_UPLOAD_SIZE:
        raise EvidenceVerificationError(
            f"File too large: {file_size} bytes (max: {constants.MAX_UPLOAD_SIZE})"
        )

    if file_size == 0:
        raise EvidenceVerificationError("Empty file uploaded")

    # 2. Compute hash
    file_hash = sha256_hash_bytes(file_bytes)

    # 3. Check duplicates
    if settings.EVIDENCE_DUPLICATE_CHECK:
        duplicate = await check_duplicate_hash(db, file_hash)
        if duplicate:
            raise EvidenceVerificationError(
                f"Duplicate file detected. Original upload: {duplicate['evidence_id']}"
            )

    # 4. Extract metadata
    content_type = file.content_type or "application/octet-stream"
    is_image = content_type.startswith("image/") or file.filename.lower().endswith(
        (".jpg", ".jpeg", ".png", ".heic", ".webp")
    )

    exif_data = {
        "latitude": None,
        "longitude": None,
        "timestamp": None,
        "has_gps": False,
        "device_make": None,
        "device_model": None,
    }

    if is_image:
        exif_data = extract_exif_metadata(file_bytes)

    # 5. Location validation
    location_verified = False
    distance_m = None
    verification_method = None

    if exif_data["has_gps"] and exif_data["latitude"] and exif_data["longitude"]:
        # Try PostGIS first
        postgis_result = await validate_location_postgis(
            db, exif_data["latitude"], exif_data["longitude"],
            project_id, radius_meters
        )

        if postgis_result[0] is not None:  # PostGIS worked
            location_verified, distance_m, verification_method = postgis_result
        else:
            # Fallback to Haversine
            location_verified, distance_m, verification_method = await validate_location_fallback(
                exif_data["latitude"], exif_data["longitude"],
                project_lat, project_lon, radius_meters
            )
    else:
        verification_method = "no_gps"

    # 6. Determine validity
    is_valid = True
    rejection_reason = None

    if not exif_data["has_gps"]:
        is_valid = False
        rejection_reason = "No GPS metadata found in file. Evidence must include location data."
    elif not location_verified:
        is_valid = False
        rejection_reason = (
            f"Location verification failed. File location is {distance_m:.0f}m from project site "
            f"(max allowed: {radius_meters:.0f}m). Evidence must be captured within project boundary."
        )

    # 7. Store evidence
    file_url = await store_evidence(file_bytes, file.filename, project_id)

    return {
        "file_url": file_url,
        "sha256_hash": file_hash,
        "file_size": file_size,
        "content_type": content_type,
        "exif_latitude": exif_data.get("latitude"),
        "exif_longitude": exif_data.get("longitude"),
        "exif_timestamp": exif_data.get("timestamp"),
        "exif_device_make": exif_data.get("device_make"),
        "exif_device_model": exif_data.get("device_model"),
        "location_verified": location_verified,
        "verification_distance_m": distance_m,
        "verification_method": verification_method,
        "has_gps": exif_data.get("has_gps", False),
        "is_valid": is_valid,
        "rejection_reason": rejection_reason,
    }


async def validate_evidence_batch(
    db: AsyncSession,
    evidence_ids: list[str]
) -> Dict[str, Any]:
    """
    Batch re-validate evidence (for admin operations).
    Re-checks location using current project boundaries.
    """
    from sqlalchemy import select
    from models import Evidence, Project

    results = {
        "processed": 0,
        "revalidated": 0,
        "invalidated": 0,
        "errors": []
    }

    for ev_id in evidence_ids:
        try:
            result = await db.execute(
                select(Evidence, Project).join(Project).where(Evidence.id == ev_id)
            )
            row = result.first()

            if not row:
                results["errors"].append(f"Evidence {ev_id}: not found")
                continue

            evidence, project = row

            if not evidence.exif_latitude:
                results["errors"].append(f"Evidence {ev_id}: no GPS data")
                continue

            # Re-validate with current project settings
            is_valid, distance_m, method = await validate_location_postgis(
                db, evidence.exif_latitude, evidence.exif_longitude,
                project.id, project.radius_meters
            )

            if is_valid is None:
                # Fallback
                is_valid, distance_m, method = await validate_location_fallback(
                    evidence.exif_latitude, evidence.exif_longitude,
                    project.latitude, project.longitude, project.radius_meters
                )

            evidence.location_verified = is_valid
            evidence.verification_distance_m = distance_m
            evidence.verification_method = method

            if not is_valid:
                evidence.is_valid = False
                evidence.rejection_reason = f"Re-validation failed: {distance_m:.0f}m from site"
                results["invalidated"] += 1
            else:
                results["revalidated"] += 1

            results["processed"] += 1

        except Exception as e:
            results["errors"].append(f"Evidence {ev_id}: {str(e)}")

    await db.commit()
    return results
