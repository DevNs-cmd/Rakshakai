"""
RAKSHAK — National-Grade Database Layer
PostgreSQL + PostGIS with connection pooling and resilience
"""
import os
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
    AsyncEngine
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import text

logger = logging.getLogger("rakshak.db")

# ── Configuration ─────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/rakshak"
)

# Fix for Render/Heroku which provide postgres:// or postgresql:// 
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

SYNC_DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/rakshak"
)

# ── Engine Creation ───────────────────────────────────────────────────────────
# NullPool is NOT compatible with pool_size; use QueuePool (default) for production.
connect_args = {}
if "asyncpg" in DATABASE_URL:
    connect_args = {
        "command_timeout": 60,
        "server_settings": {
            "application_name": "rakshak_backend",
            "jit": "off",                     # More stable for mixed-query workloads
        },
    }

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,                # Avoid leaking SQL in production logs
    pool_size=20,              # National-grade: handle many concurrent users
    max_overflow=30,           # Burst capacity
    pool_pre_ping=True,        # CRITICAL: Verify connections before use
    pool_recycle=3600,         # Recycle connections after 1 hour
    pool_timeout=30,           # Wait up to 30s for connection
    connect_args=connect_args,
)

# ── Base and Session Factory ───────────────────────────────────────────────────
Base = declarative_base()

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,  # Performance: manual flush control
)

# ── Database Operations ───────────────────────────────────────────────────────

async def init_postgis() -> None:
    """Initialize PostGIS extension."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))  # For fuzzy text search
        logger.info("✅ PostGIS extensions initialized")


async def create_tables() -> None:
    """Create all tables with PostGIS support."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created")


async def create_spatial_indexes() -> None:
    """
    Create GIST spatial indexes separately — these CANNOT be created by SQLAlchemy
    ORM automatically when spatial_index=False is set on Geography columns.
    Also creates any additional composite indexes not expressible in __table_args__.
    """
    index_statements = [
        # PostGIS spatial indexes (GIST) — CRITICAL for geo queries
        "CREATE INDEX IF NOT EXISTS idx_projects_location ON projects USING GIST (geog_point)",
        "CREATE INDEX IF NOT EXISTS idx_evidence_geo     ON evidence  USING GIST (geog_point)",

        # Partial index: only incomplete milestones need deadline monitoring
        "CREATE INDEX IF NOT EXISTS idx_milestones_pending_due ON milestones (due_date) WHERE NOT is_completed",

        # Risk history — most recent first per project
        "CREATE INDEX IF NOT EXISTS idx_risk_history_recent ON risk_history (project_id, calculated_at DESC)",

        # Alerts — unresolved and recent
        "CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (created_at DESC) WHERE NOT is_resolved",
    ]

    async with engine.begin() as conn:
        for stmt in index_statements:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                logger.warning(f"Spatial index creation warning (may already exist): {e}")
    logger.info("✅ Spatial and performance indexes created")


async def verify_postgis() -> bool:
    """Verify PostGIS is properly installed."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT PostGIS_Version()"))
            version = result.scalar()
            if version:
                logger.info(f"✅ PostGIS version: {version}")
                return True
        return False
    except Exception as e:
        logger.error(f"PostGIS verification failed: {e}")
        return False


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions."""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for database sessions outside of FastAPI dependencies."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_db() -> None:
    """Gracefully close all database connections."""
    await engine.dispose()
    logger.info("🔻 Database connections closed")


async def db_health_check() -> dict:
    """Database health check for monitoring."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            await result.fetchone()

            # Check connection pool stats
            pool = engine.pool
            return {
                "status": "healthy",
                "database": "postgresql+postgis",
                "pool_size": pool.size() if hasattr(pool, 'size') else None,
                "pool_checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else None,
                "pool_checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else None,
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }


async def initialize_database():
    """Full database initialization sequence."""
    try:
        await init_postgis()
        await create_tables()
        await create_spatial_indexes()

        if await verify_postgis():
            logger.info("✅ Database initialization complete")
            return True
        else:
            logger.error("❌ PostGIS verification failed")
            return False
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
