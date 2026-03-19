"""
WebSocket + Redis pub/sub manager for real-time updates
"""
import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}  # room_id -> set of sockets
        self.all_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, room: str = "global"):
        await websocket.accept()
        self.all_connections.add(websocket)
        if room not in self.active_connections:
            self.active_connections[room] = set()
        self.active_connections[room].add(websocket)
        logger.info(f"WebSocket connected to room: {room}")
    
    def disconnect(self, websocket: WebSocket, room: str = "global"):
        self.all_connections.discard(websocket)
        if room in self.active_connections:
            self.active_connections[room].discard(websocket)
    
    async def broadcast_to_room(self, room: str, message: dict):
        if room in self.active_connections:
            dead = set()
            for ws in self.active_connections[room]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[room].discard(ws)
                self.all_connections.discard(ws)
    
    async def broadcast_all(self, message: dict):
        dead = set()
        for ws in self.all_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.all_connections.discard(ws)

manager = ConnectionManager()


async def try_redis_pubsub():
    """Try to connect to Redis and subscribe to events."""
    try:
        import redis.asyncio as aioredis
        from config import settings
        
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe("rakshak:events")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await manager.broadcast_all(data)
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        logger.warning(f"Redis not available, WebSocket operates in standalone mode: {e}")


async def publish_event(event_type: str, payload: dict):
    """Publish event to Redis or directly broadcast if Redis unavailable."""
    message = {"type": event_type, "payload": payload}
    
    try:
        import redis.asyncio as aioredis
        from config import settings
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.publish("rakshak:events", json.dumps(message))
        await r.aclose()
    except Exception:
        # Direct broadcast fallback
        await manager.broadcast_all(message)
