"""
RAKSHAK — National-Grade Configuration
All settings validated with strict defaults for production
"""
import os
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, PostgresDsn, RedisDsn


class Settings(BaseSettings):
    """Production-grade application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # Allow extra env vars
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "RAKSHAK"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "production"  # development, staging, production
    DEBUG: bool = False

    # ── Security ─────────────────────────────────────────────────────────────────
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Shorter for national security
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 30

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rakshak"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/rakshak"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600

    # ── Redis ───────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # ── External Services ───────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_BUCKET: str = "rakshak-evidence"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = "rakshak-evidence"
    AWS_REGION: str = "ap-south-1"
    AWS_ENDPOINT_URL: Optional[str] = None  # For MinIO/S3-compatible

    MAPBOX_TOKEN: str = ""

    # ── File Upload ─────────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 100
    UPLOAD_CHUNK_SIZE: int = 1024 * 1024  # 1MB chunks
    ALLOWED_EVIDENCE_TYPES: str = "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,application/pdf"
    UPLOAD_STORAGE: str = "local"  # local, s3, supabase
    UPLOAD_DIR: str = "uploads"

    # ── Evidence Verification ────────────────────────────────────────────────────
    EVIDENCE_MAX_DISTANCE_METERS: float = 1000.0
    EVIDENCE_MIN_INTERVAL_DAYS: int = 1
    EVIDENCE_DUPLICATE_CHECK: bool = True

    # ── Risk Engine ─────────────────────────────────────────────────────────────
    RISK_RECALC_INTERVAL_HOURS: int = 6
    RISK_EVIDENCE_GAP_DAYS: int = 14
    RISK_HIGH_THRESHOLD: float = 70.0
    RISK_MEDIUM_THRESHOLD: float = 40.0

    # ── Alerting ─────────────────────────────────────────────────────────────────
    ALERT_EVIDENCE_GAP_DAYS: int = 14
    ALERT_DEADLINE_DAYS: int = 30
    ALERT_DEADLINE_PROGRESS_THRESHOLD: float = 70.0
    ALERT_SPIKE_THRESHOLD: float = 15.0

    # ── CORS ────────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_MAX_AGE: int = 600

    # ── Logging ──────────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json, text
    ENABLE_ACCESS_LOG: bool = True

    # ── Rate Limiting ────────────────────────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    @field_validator("CORS_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        """Validate CORS origins format."""
        if not v:
            return "http://localhost:3000"
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_file_types(self) -> List[str]:
        """Return allowed file types as a list."""
        return [t.strip() for t in self.ALLOWED_EVIDENCE_TYPES.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT.lower() == "development"


# Global settings instance
settings = Settings()


# ── Constants ─────────────────────────────────────────────────────────────────
class Constants:
    """System constants."""

    # Evidence
    MAX_UPLOAD_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Risk Levels
    RISK_HIGH = 70.0
    RISK_MEDIUM = 40.0

    # Timeouts
    DB_QUERY_TIMEOUT = 30
    EXTERNAL_API_TIMEOUT = 10

    # Geo
    EARTH_RADIUS_METERS = 6371000
    DEFAULT_PROJECT_RADIUS = 500.0  # meters


constants = Constants()
