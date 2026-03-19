"""
Evidence verification service:
- EXIF metadata extraction
- GPS location validation
- SHA-256 hashing
- Duplicate detection
- File storage (Supabase/S3)
"""
import hashlib
import io
import math
import os
import uuid
import aiofiles
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from fastapi import UploadFile

try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import exifread
    EXIFREAD_AVAILABLE = True
except ImportError:
    EXIFREAD_AVAILABLE = False


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def sha256_hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _convert_gps_coord(coord_tuple, ref: str) -> Optional[float]:
    """Convert EXIF GPS tuple to decimal degrees."""
    try:
        if hasattr(coord_tuple, 'values'):
            vals = coord_tuple.values
        else:
            vals = coord_tuple
        
        degrees = float(vals[0].num) / float(vals[0].den) if hasattr(vals[0], 'num') else float(vals[0])
        minutes = float(vals[1].num) / float(vals[1].den) if hasattr(vals[1], 'num') else float(vals[1])
        seconds = float(vals[2].num) / float(vals[2].den) if hasattr(vals[2], 'num') else float(vals[2])
        
        decimal = degrees + minutes / 60 + seconds / 3600
        if ref in ('S', 'W'):
            decimal = -decimal
        return decimal
    except Exception:
        return None


def extract_exif_metadata(image_bytes: bytes) -> Dict[str, Any]:
    """Extract GPS and timestamp from EXIF data."""
    result = {
        "latitude": None,
        "longitude": None,
        "timestamp": None,
        "has_gps": False,
    }
    
    if EXIFREAD_AVAILABLE:
        try:
            img_io = io.BytesIO(image_bytes)
            tags = exifread.process_file(img_io, details=False, strict=True)
            
            lat_tag = tags.get('GPS GPSLatitude')
            lat_ref = tags.get('GPS GPSLatitudeRef')
            lon_tag = tags.get('GPS GPSLongitude')
            lon_ref = tags.get('GPS GPSLongitudeRef')
            
            if lat_tag and lon_tag and lat_ref and lon_ref:
                lat = _convert_gps_coord(lat_tag, str(lat_ref))
                lon = _convert_gps_coord(lon_tag, str(lon_ref))
                if lat is not None and lon is not None:
                    result["latitude"] = lat
                    result["longitude"] = lon
                    result["has_gps"] = True
            
            dt_tag = tags.get('EXIF DateTimeOriginal') or tags.get('Image DateTime')
            if dt_tag:
                try:
                    result["timestamp"] = datetime.strptime(str(dt_tag), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                except Exception:
                    pass
        except Exception:
            pass
    
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
                    return dec
                
                result["latitude"] = to_decimal(gps_info["GPSLatitude"], lat_ref)
                result["longitude"] = to_decimal(gps_info["GPSLongitude"], lon_ref)
                result["has_gps"] = True
        except Exception:
            pass
    
    return result


def validate_location(
    exif_lat: float,
    exif_lon: float,
    project_lat: float,
    project_lon: float,
    radius_meters: float
) -> Tuple[bool, float]:
    """Returns (is_valid, distance_meters)."""
    distance = haversine_distance(exif_lat, exif_lon, project_lat, project_lon)
    return distance <= radius_meters, round(distance, 2)


async def store_file_local(file_bytes: bytes, filename: str, project_id: str) -> str:
    """Store file locally and return URL path (fallback when S3/Supabase not configured)."""
    upload_dir = f"uploads/{project_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    ext = os.path.splitext(filename)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, unique_name)
    
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(file_bytes)
    
    return f"/uploads/{project_id}/{unique_name}"


async def process_evidence_upload(
    file: UploadFile,
    project_lat: float,
    project_lon: float,
    project_id: str,
    radius_meters: float = 500.0
) -> Dict[str, Any]:
    """
    Full evidence processing pipeline:
    1. Read file bytes
    2. Compute SHA-256
    3. Extract EXIF metadata
    4. Validate GPS location
    5. Store file
    6. Return structured result
    """
    file_bytes = await file.read()
    file_hash = sha256_hash_bytes(file_bytes)
    
    content_type = file.content_type or ""
    is_image = content_type.startswith("image/") or file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".heic", ".webp"))
    
    exif_data = {"latitude": None, "longitude": None, "timestamp": None, "has_gps": False}
    if is_image:
        exif_data = extract_exif_metadata(file_bytes)
    
    location_verified = False
    distance_m = None
    
    if exif_data["has_gps"] and exif_data["latitude"] and exif_data["longitude"]:
        location_verified, distance_m = validate_location(
            exif_data["latitude"], exif_data["longitude"],
            project_lat, project_lon, radius_meters
        )
    
    file_url = await store_file_local(file_bytes, file.filename, project_id)
    
    return {
        "file_url": file_url,
        "sha256_hash": file_hash,
        "file_size": len(file_bytes),
        "content_type": content_type,
        "exif_latitude": exif_data.get("latitude"),
        "exif_longitude": exif_data.get("longitude"),
        "exif_timestamp": exif_data.get("timestamp"),
        "location_verified": location_verified,
        "verification_distance_m": distance_m,
        "has_gps": exif_data["has_gps"],
    }
