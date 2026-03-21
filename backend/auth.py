"""
RAKSHAK — Authentication Module
JWT-based authentication with role-based access control and Redis-backed rate limiting
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from database import get_db
from models import User, UserRole
from schemas import TokenData
from config import settings

logger = logging.getLogger("rakshak.auth")

# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Slower = more secure
)

# Bearer token security
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token with longer expiry."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[Dict]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.debug(f"Token decode failed: {e}")
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    Raises 401 if token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise credentials_exception

    # Validate token type
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user ensuring they are active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(*roles: UserRole):
    """
    Decorator factory for role-based access control.
    Usage: @router.get("/admin-only", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            logger.warning(
                f"Access denied: user {current_user.id} with role {current_user.role.value} "
                f"attempted access requiring {[r.value for r in roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}"
            )
        return current_user
    return role_checker


# Predefined role requirements
require_admin = require_role(UserRole.ADMIN)
require_admin_or_officer = require_role(UserRole.ADMIN, UserRole.OFFICER)
require_auditor = require_role(UserRole.ADMIN, UserRole.AUDITOR)


# ── Rate Limiting (Redis-backed for multi-worker safety) ─────────────────────
_login_attempts_local: Dict[str, list] = {}


async def check_login_rate_limit(
    identifier: str,
    max_attempts: Optional[int] = None,
    window_minutes: Optional[int] = None
) -> bool:
    """
    Check if login attempts are within rate limits.
    Returns True if allowed, False if rate limited.

    Uses Redis when available (safe for multi-worker deployments).
    Falls back to in-process dict if Redis is unavailable.
    """
    max_attempts = max_attempts or settings.MAX_LOGIN_ATTEMPTS
    window_minutes = window_minutes or settings.LOGIN_LOCKOUT_MINUTES

    # Try Redis-backed rate limiting first (multi-worker safe)
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        key = f"rakshak:login_attempts:{identifier}"

        # INCR + TTL in a pipeline for atomicity
        async with r.pipeline() as pipe:
            await pipe.incr(key)
            await pipe.expire(key, window_minutes * 60)
            results = await pipe.execute()

        attempt_count = results[0]
        await r.aclose()

        if attempt_count > max_attempts:
            logger.warning(f"Rate limit exceeded (Redis) for: {identifier} ({attempt_count} attempts)")
            return False
        return True

    except Exception:
        # Fallback: in-memory (single-worker only — safe for dev/docker single instance)
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=window_minutes)
        attempts = _login_attempts_local.get(identifier, [])
        recent_attempts = [t for t in attempts if t > window_start]
        _login_attempts_local[identifier] = recent_attempts

        if len(recent_attempts) >= max_attempts:
            logger.warning(f"Rate limit exceeded (local) for: {identifier}")
            return False

        recent_attempts.append(now)
        return True


async def clear_login_attempts(identifier: str):
    """Clear login attempts after successful login."""
    # Clear from Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.delete(f"rakshak:login_attempts:{identifier}")
        await r.aclose()
    except Exception:
        pass
    # Clear from local fallback
    _login_attempts_local.pop(identifier, None)
