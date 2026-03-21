"""
RAKSHAK — High-Performance Caching Layer
Redis-backed caching for national-grade API performance
"""
import json
import logging
from functools import wraps
from typing import Optional, Any, Callable
from datetime import timedelta

from config import settings

logger = logging.getLogger("rakshak.cache")

class CacheManager:
    """Manages Redis-backed caching with TTL and serialization."""

    def __init__(self):
        self.redis = None
        self.is_connected = False

    async def connect(self):
        """Lazy connect to Redis."""
        if self.redis is not None:
            return
        
        try:
            import redis.asyncio as aioredis
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2
            )
            await self.redis.ping()
            self.is_connected = True
            logger.info("✅ Cache Manager: Redis connected")
        except Exception as e:
            logger.warning(f"⚠️ Cache Manager: Redis connection failed: {e}")
            self.redis = None
            self.is_connected = False

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve value from cache."""
        if not self.is_connected or not self.redis:
            return None
        
        try:
            data = await self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Cache get error for {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Store value in cache with TTL."""
        if not self.is_connected or not self.redis:
            return
        
        try:
            await self.redis.set(
                key,
                json.dumps(value),
                ex=ttl_seconds
            )
        except Exception as e:
            logger.warning(f"Cache set error for {key}: {e}")

    async def delete(self, key: str):
        """Remove value from cache."""
        if not self.is_connected or not self.redis:
            return
        
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.warning(f"Cache delete error for {key}: {e}")

    async def clear_pattern(self, pattern: str):
        """Clear all keys matching pattern."""
        if not self.is_connected or not self.redis:
            return
        
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                await self.redis.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache clear_pattern error for {pattern}: {e}")

# Global cache manager
cache = CacheManager()

def cached(key_prefix: str, ttl_seconds: int = 300, ignore_args: list = ["db", "current_user", "_"]):
    """
    Decorator for caching async FastAPI results in Redis.
    Usage: @cached("stats:global", 600, ignore_args=["db", "current_user"])
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not settings.RATE_LIMIT_ENABLED:
                return await func(*args, **kwargs)

            await cache.connect()
            
            # Filter ignore_args
            key_data = {k: str(v) for k, v in kwargs.items() if k not in ignore_args}
            from hashlib import sha256
            arg_hash = sha256(json.dumps(key_data, sort_keys=True).encode()).hexdigest()[:12]
            key = f"rakshak:cache:{key_prefix}:{arg_hash}"
            
            # Try to get from cache
            try:
                cached_val = await cache.get(key)
                if cached_val:
                    return cached_val
            except Exception:
                pass
            
            # Call original function
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                if hasattr(result, "model_dump"):
                    data_to_cache = result.model_dump()
                elif isinstance(result, list) and len(result) > 0 and hasattr(result[0], "model_dump"):
                    data_to_cache = [m.model_dump() for m in result]
                else:
                    data_to_cache = result
                await cache.set(key, data_to_cache, ttl_seconds)
            except Exception:
                pass
                
            return result
        return wrapper
    return decorator

