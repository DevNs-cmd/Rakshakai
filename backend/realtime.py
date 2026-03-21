"""
RAKSHAK — Real-time System
WebSocket + Redis Pub/Sub for live updates and event broadcasting
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any, List
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
import time

from config import settings

logger = logging.getLogger("rakshak.realtime")


class ConnectionManager:
    """
    WebSocket connection manager with room-based broadcasting.
    Handles connection lifecycle and message delivery.
    """

    def __init__(self):
        # room_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> room_id mapping for cleanup
        self.socket_rooms: Dict[WebSocket, Set[str]] = {}
        # All active connections
        self.all_connections: Set[WebSocket] = set()
        # Connection metadata
        self.connection_meta: Dict[WebSocket, Dict] = {}

    async def connect(self, websocket: WebSocket, room: str = "global"):
        """
        Accept a new WebSocket connection and register it to a room.
        """
        await websocket.accept()

        # Register in room
        if room not in self.active_connections:
            self.active_connections[room] = set()
        self.active_connections[room].add(websocket)

        # Track reverse mapping
        if websocket not in self.socket_rooms:
            self.socket_rooms[websocket] = set()
        self.socket_rooms[websocket].add(room)

        # Add to global connections
        self.all_connections.add(websocket)

        # Store metadata
        self.connection_meta[websocket] = {
            "connected_at": datetime.now(timezone.utc),
            "rooms": {room},
            "message_count": 0
        }

        logger.info(f"WebSocket connected: room={room}, total_connections={len(self.all_connections)}")

        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "room": room,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_connections": len(self.all_connections)
        })

    def disconnect(self, websocket: WebSocket, room: Optional[str] = None):
        """
        Disconnect WebSocket from specific room or all rooms.
        """
        if room:
            # Disconnect from specific room
            if room in self.active_connections:
                self.active_connections[room].discard(websocket)
                if not self.active_connections[room]:
                    del self.active_connections[room]

            if websocket in self.socket_rooms:
                self.socket_rooms[websocket].discard(room)
                if not self.socket_rooms[websocket]:
                    self._cleanup_socket(websocket)
        else:
            # Disconnect from all rooms
            if websocket in self.socket_rooms:
                rooms = list(self.socket_rooms[websocket])
                for r in rooms:
                    self.active_connections[r].discard(websocket)
                    if not self.active_connections[r]:
                        del self.active_connections[r]
                del self.socket_rooms[websocket]
            self._cleanup_socket(websocket)

        logger.debug(f"WebSocket disconnected: room={room}")

    def _cleanup_socket(self, websocket: WebSocket):
        """Clean up socket from all tracking structures."""
        self.all_connections.discard(websocket)
        if websocket in self.connection_meta:
            del self.connection_meta[websocket]

    async def broadcast_to_room(self, room: str, message: dict) -> int:
        """
        Broadcast message to all connections in a room.
        Returns number of successful sends.
        """
        if room not in self.active_connections:
            return 0

        dead_sockets = set()
        sent_count = 0

        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.now(timezone.utc).isoformat()

        for ws in list(self.active_connections[room]):
            try:
                await ws.send_json(message)
                sent_count += 1

                # Update metadata
                if ws in self.connection_meta:
                    self.connection_meta[ws]["message_count"] += 1
                    self.connection_meta[ws]["last_activity"] = datetime.now(timezone.utc)

            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                dead_sockets.add(ws)

        # Clean up dead sockets
        for ws in dead_sockets:
            self.disconnect(ws, room)

        return sent_count

    async def broadcast_all(self, message: dict) -> int:
        """
        Broadcast message to all connected WebSockets.
        Returns number of successful sends.
        """
        if "timestamp" not in message:
            message["timestamp"] = datetime.now(timezone.utc).isoformat()

        dead_sockets = set()
        sent_count = 0

        for ws in list(self.all_connections):
            try:
                await ws.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.debug(f"Failed to broadcast: {e}")
                dead_sockets.add(ws)

        # Clean up dead sockets
        for ws in dead_sockets:
            self.disconnect(ws)

        return sent_count

    async def send_to_socket(self, websocket: WebSocket, message: dict) -> bool:
        """Send message to specific WebSocket."""
        try:
            if "timestamp" not in message:
                message["timestamp"] = datetime.now(timezone.utc).isoformat()

            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.warning(f"Failed to send to specific socket: {e}")
            self.disconnect(websocket)
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": len(self.all_connections),
            "active_rooms": len(self.active_connections),
            "rooms": {room: len(sockets) for room, sockets in self.active_connections.items()},
            "connection_meta": {
                "avg_message_count": sum(
                    m.get("message_count", 0) for m in self.connection_meta.values()
                ) / len(self.connection_meta) if self.connection_meta else 0
            }
        }


# Global connection manager instance
manager = ConnectionManager()


# ── Redis Integration ─────────────────────────────────────────────────────────

class RedisEventBus:
    """
    Redis-based event bus for distributed deployments.
    Falls back to direct WebSocket broadcast if Redis unavailable.
    """

    def __init__(self):
        self.redis = None
        self.is_connected = False

    async def connect(self) -> bool:
        """Try to connect to Redis."""
        try:
            import redis.asyncio as aioredis
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )
            await self.redis.ping()
            self.is_connected = True
            logger.info("✅ Redis connected")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {e}")
            self.is_connected = False
            return False

    async def disconnect(self):
        """Close Redis connection."""
        if self.redis:
            await self.redis.aclose()
            self.is_connected = False
            logger.info("🔻 Redis disconnected")

    async def publish(self, channel: str, message: dict) -> int:
        """Publish message to Redis channel."""
        if not self.is_connected:
            return 0

        try:
            return await self.redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.warning(f"Redis publish failed: {e}")
            self.is_connected = False
            return 0

    async def subscribe(self, channel: str) -> Optional[Any]:
        """Subscribe to Redis channel."""
        if not self.is_connected:
            return None

        try:
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(channel)
            return pubsub
        except Exception as e:
            logger.warning(f"Redis subscribe failed: {e}")
            return None


# Global Redis event bus
redis_bus = RedisEventBus()


async def try_redis_pubsub():
    """
    Background task to connect to Redis and relay messages.
    Runs continuously, reconnecting if connection drops.
    """
    while True:
        try:
            if not redis_bus.is_connected:
                await redis_bus.connect()
                if not redis_bus.is_connected:
                    await asyncio.sleep(10)
                    continue

            pubsub = await redis_bus.subscribe("rakshak:events")
            if not pubsub:
                await asyncio.sleep(5)
                continue

            logger.info("🔄 Redis pub/sub listener started")

            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        # Broadcast to all WebSocket connections
                        await manager.broadcast_all(data)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON from Redis: {e}")
                    except Exception as e:
                        logger.error(f"Error processing Redis message: {e}")

        except asyncio.CancelledError:
            logger.info("Redis pub/sub task cancelled")
            await redis_bus.disconnect()
            break
        except Exception as e:
            logger.error(f"Redis pub/sub error: {e}")
            redis_bus.is_connected = False
            await asyncio.sleep(5)


async def publish_event(event_type: str, payload: dict, use_redis: bool = True) -> int:
    """
    Publish event to the event bus.
    Tries Redis first, falls back to direct WebSocket broadcast.

    Args:
        event_type: Type of event (e.g., "evidence_uploaded", "risk_updated")
        payload: Event payload data
        use_redis: Whether to try Redis (default True)

    Returns:
        Number of clients that received the message
    """
    message = {
        "type": event_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Try Redis first
    if use_redis and redis_bus.is_connected:
        try:
            redis_clients = await redis_bus.publish("rakshak:events", message)
            if redis_clients > 0:
                # Redis will broadcast to other instances
                # Still broadcast locally
                return await manager.broadcast_all(message)
        except Exception as e:
            logger.debug(f"Redis publish failed, using fallback: {e}")

    # Fallback: direct WebSocket broadcast
    return await manager.broadcast_all(message)


async def notify_project_update(project_id: str, update_type: str, data: dict):
    """Helper to notify about project-specific updates."""
    await publish_event("project_update", {
        "project_id": project_id,
        "update_type": update_type,
        "data": data
    })


async def notify_risk_change(project_id: str, old_score: float, new_score: float, level: str):
    """Helper to notify about risk score changes."""
    await publish_event("risk_updated", {
        "project_id": project_id,
        "old_score": old_score,
        "new_score": new_score,
        "level": level,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


async def notify_new_alert(alert_id: str, project_id: str, alert_type: str, severity: str):
    """Helper to notify about new alerts."""
    await publish_event("alert_created", {
        "alert_id": alert_id,
        "project_id": project_id,
        "alert_type": alert_type,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
