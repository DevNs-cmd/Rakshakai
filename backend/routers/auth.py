"""
RAKSHAK — Authentication Router
Login, register, token management with rate limiting
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from database import get_db
from models import User
from schemas import LoginRequest, RegisterRequest, Token, UserOut
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, check_login_rate_limit, clear_login_attempts
)
from audit import log_action
import logging

logger = logging.getLogger("rakshak.routers.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account.
    Note: In production, restrict this to admin-initiated account creation.
    """
    result = await db.execute(select(User).where(User.email == req.email.lower().strip()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email.lower().strip(),
        full_name=req.full_name,
        hashed_password=get_password_hash(req.password),
        role=req.role,
        department=req.department,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await log_action(
        db, user.id, "user_registered", "user", user.id,
        {"email": user.email, "role": user.role.value},
        ip_address=request.client.host if request.client else None
    )

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return JWT access token.
    Rate-limited to prevent brute-force attacks.
    """
    identifier = req.email.lower().strip()
    client_ip = request.client.host if request.client else "unknown"

    # Rate limit check — BEFORE any DB query to prevent timing attacks
    allowed = await check_login_rate_limit(f"{identifier}:{client_ip}")
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Please try again in {settings.LOGIN_LOCKOUT_MINUTES} minutes."
        )

    result = await db.execute(select(User).where(User.email == identifier))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        await log_action(
            db, None, "login_failed", "user", None,
            {"email": identifier, "reason": "invalid_credentials"},
            ip_address=client_ip
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Update last login timestamp
    user.last_login = datetime.now(timezone.utc)

    # Generate token
    token = create_access_token({"sub": user.id, "role": user.role.value})

    await log_action(
        db, user.id, "login_success", "user", user.id,
        {"email": identifier},
        ip_address=client_ip
    )
    await db.commit()

    # Clear rate limit on success
    await clear_login_attempts(f"{identifier}:{client_ip}")

    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return UserOut.model_validate(current_user)


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Logout endpoint — audit trail only.
    JWT tokens are stateless; actual invalidation requires a token blacklist (Redis).
    For now, clients should discard the token on their side.
    """
    await log_action(
        db, current_user.id, "logout", "user", current_user.id,
        {"email": current_user.email},
        ip_address=request.client.host if request.client else None
    )
    await db.commit()
    return {"message": "Logged out successfully. Please discard your token."}


# Import settings for the rate limit message in login
from config import settings
