"""
RAKSHAK — Autonomous Governance Integrity System
FastAPI Backend - Main Application
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os

from config import settings
from database import create_tables
from realtime import manager, try_redis_pubsub
from routers import auth, projects, evidence, contractors, dashboard
from seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rakshak")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 RAKSHAK starting up...")
    
    # Create tables
    try:
        await create_tables()
        logger.info("✅ Database tables ready")
    except Exception as e:
        logger.warning(f"⚠️ DB setup warning: {e}")
    
    # Seed initial data
    try:
        await seed_database()
        logger.info("✅ Database seeded")
    except Exception as e:
        logger.warning(f"⚠️ Seed warning: {e}")
    
    # Start Redis pub/sub listener in the background
    redis_task = asyncio.create_task(try_redis_pubsub())
    
    # Create uploads directory
    os.makedirs("uploads", exist_ok=True)
    
    logger.info("✅ RAKSHAK is live!")
    
    yield
    
    redis_task.cancel()
    logger.info("🔻 RAKSHAK shutting down")


app = FastAPI(
    title="RAKSHAK API",
    description="Autonomous Governance Integrity System - Real-time Infrastructure Monitoring",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(evidence.router)
app.include_router(contractors.router)
app.include_router(dashboard.router)


# ── WebSocket Endpoint ─────────────────────────────────────────────────────────
@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str = "global"):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back with room info
            await websocket.send_json({"type": "ping", "room": room})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        logger.info(f"WebSocket disconnected from room: {room}")

@app.websocket("/ws")
async def websocket_global(websocket: WebSocket):
    await manager.connect(websocket, "global")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "global")


# ── Health Check ───────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "RAKSHAK API",
        "version": "1.0.0",
        "connections": len(manager.all_connections),
    }

@app.get("/")
async def root():
    return {"message": "RAKSHAK — Autonomous Governance Integrity System", "docs": "/docs"}
