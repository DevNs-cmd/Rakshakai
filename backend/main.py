"""
RAKSHAK — Autonomous Governance Integrity System
FastAPI Backend - Main Application

National-grade infrastructure monitoring with:
- PostgreSQL + PostGIS for geospatial integrity
- Redis Pub/Sub for real-time updates
- Weighted Risk scoring engine
- Immutable audit trails
- Background periodic risk recalculation + alert sweep
"""
import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import os

from config import settings, constants
from database import initialize_database, close_db, db_health_check
from realtime import manager, try_redis_pubsub
from routers import auth, projects, evidence, contractors, dashboard
from seed import seed_database

# ── Logging Configuration ────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('rakshak.log', encoding='utf-8') if settings.is_production else logging.NullHandler()
    ]
)
logger = logging.getLogger("rakshak")


# ── Request Logging Middleware ───────────────────────────────────────────────
async def log_requests(request: Request, call_next):
    """Log all requests for audit purposes."""
    start_time = datetime.now(timezone.utc)
    response = await call_next(request)
    duration = (datetime.now(timezone.utc) - start_time).total_seconds()

    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s - "
        f"{request.client.host if request.client else 'unknown'}"
    )
    return response


# ── Error Handlers ───────────────────────────────────────────────────────────
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed messages."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": errors
        }
    )


# ── Background Tasks ─────────────────────────────────────────────────────────
async def periodic_risk_recalculation():
    """
    Background task: recalculate risk for ALL active projects every N hours.
    This is the scheduled sweep — ensures no project goes stale.
    """
    from database import async_session
    from sqlalchemy import select
    from models import Project, ProjectStatus
    from routers.projects import _recalculate_risk

    interval_seconds = settings.RISK_RECALC_INTERVAL_HOURS * 3600
    logger.info(f"[TIME] Periodic risk recalculation scheduled every {settings.RISK_RECALC_INTERVAL_HOURS}h")

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info("[RECALC] Running scheduled risk recalculation...")

            async with async_session() as db:
                result = await db.execute(
                    select(Project).where(Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.DELAYED]))
                )
                active_projects = result.scalars().all()
                count = 0

                for project in active_projects:
                    try:
                        await _recalculate_risk(project, db, trigger="scheduled_sweep")
                        count += 1
                    except Exception as e:
                        logger.error(f"Risk recalc failed for project {project.id}: {e}")

                await db.commit()
                logger.info(f"[OK] Scheduled risk recalculation complete: {count} projects updated")

        except asyncio.CancelledError:
            logger.info("Periodic risk task cancelled")
            break
        except Exception as e:
            logger.error(f"Periodic risk recalculation error: {e}")
            await asyncio.sleep(60)  # Back off on error


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("[START] RAKSHAK starting up...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug: {settings.DEBUG}")

    # Initialize database
    try:
        await initialize_database()
        logger.info("[OK] Database initialized")
    except Exception as e:
        logger.error(f"[ERROR] Database initialization failed: {e}")
        raise

    # Seed initial data (only if empty)
    try:
        await seed_database()
        logger.info("[OK] Database seeded")
    except Exception as e:
        logger.warning(f"[WARN] Database seeding warning: {e}")

    # Create uploads directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info(f"[OK] Upload directory ready: {settings.UPLOAD_DIR}")

    # Start Redis pub/sub listener
    redis_task = asyncio.create_task(try_redis_pubsub())

    # Start periodic risk recalculation background task
    risk_task = asyncio.create_task(periodic_risk_recalculation())

    logger.info("[OK] RAKSHAK is live!")
    logger.info("=" * 50)

    yield

    # Shutdown — cancel background tasks gracefully
    for task in [redis_task, risk_task]:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    await close_db()
    logger.info("[STOP] RAKSHAK shut down")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="RAKSHAK API",
    description="""
    Autonomous Governance Integrity System

    National-grade infrastructure monitoring with real-time risk assessment,
    evidence verification with PostGIS location validation, and immutable audit trails.

    ## Key Features
    - **Projects**: Infrastructure project management with PostGIS geospatial support
    - **Evidence**: GPS-verified photo/video upload with SHA-256 integrity
    - **Risk Engine**: Multi-factor risk scoring with explainability
    - **Alerts**: Automated anomaly detection via background sweep + event triggers
    - **Dashboard**: National-level integrity scoring
    - **Real-time**: WebSocket push updates via Redis Pub/Sub
    """,
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=settings.CORS_MAX_AGE
)

if settings.is_production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*.gov.in", "*.nic.in", "localhost"])

# Request logging
app.middleware("http")(log_requests)

# Exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# ── Static Files ─────────────────────────────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(evidence.router)
app.include_router(contractors.router)
app.include_router(dashboard.router)


# ── WebSocket Endpoints ───────────────────────────────────────────────────────
@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str = "global"):
    """
    WebSocket endpoint for real-time updates.
    Clients connect here and receive push events without polling.
    Supported rooms: 'global', 'alerts', 'risk', 'map', project IDs.
    """
    await manager.connect(websocket, room)
    try:
        while True:
            # Receive any message from client (heartbeat/ping)
            data = await websocket.receive_text()
            # Respond to keep-alive pings only — don't echo full data
            await websocket.send_json({
                "type": "pong",
                "room": room,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        logger.debug(f"WebSocket disconnected from room: {room}")
    except Exception as e:
        logger.warning(f"WebSocket error in room {room}: {e}")
        manager.disconnect(websocket, room)


@app.websocket("/ws")
async def websocket_global(websocket: WebSocket):
    """Global WebSocket endpoint — receives all system events."""
    await manager.connect(websocket, "global")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                "type": "pong",
                "room": "global",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, "global")
        logger.debug("WebSocket disconnected from global room")
    except Exception as e:
        logger.warning(f"WebSocket global error: {e}")
        manager.disconnect(websocket, "global")


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    """Service health check endpoint."""
    db_status = await db_health_check()

    return {
        "status": "healthy" if db_status.get("status") == "healthy" else "degraded",
        "service": "RAKSHAK API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "websocket_connections": len(manager.all_connections),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health/detailed", tags=["Health"])
async def health_detailed():
    """Detailed health check with all component statuses."""
    db_status = await db_health_check()

    # Check Redis
    redis_status = "unknown"
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"degraded: {str(e)}"

    return {
        "status": "healthy" if db_status.get("status") == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "database": db_status,
            "redis": redis_status,
            "websockets": {
                "active_connections": len(manager.all_connections),
                "rooms": len(manager.active_connections)
            }
        }
    }


# ── Root Endpoint ───────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "RAKSHAK — Autonomous Governance Integrity System",
        "version": "1.0.0",
        "description": "National-grade infrastructure monitoring and integrity verification",
        "docs": "/docs" if settings.is_development else None,
        "health": "/health",
        "environment": settings.ENVIRONMENT,
        "status": "operational"
    }


# ── Startup Banner ───────────────────────────────────────────────────────────
logger.info("""
+----------------------------------------------------------+
|                                                          |
|   RAKSHAK - Autonomous Governance Integrity System       |
|   National-Grade Infrastructure Monitoring               |
|                                                          |
+----------------------------------------------------------+
""")
