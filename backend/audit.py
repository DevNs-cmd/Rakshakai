"""Immutable audit trail logging."""
import hashlib
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog
from typing import Optional

async def log_action(
    db: AsyncSession,
    user_id: Optional[str],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Create an immutable audit log entry with a hash reference."""
    payload = {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    hash_ref = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        hash_reference=hash_ref,
    )
    db.add(log)
    # Don't commit here - let the calling router handle commit
