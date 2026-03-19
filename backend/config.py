from pydantic_settings import BaseSettings
from pydantic import validator
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/rakshak"
    SYNC_DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/rakshak"
    SECRET_KEY: str = "rakshak-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REDIS_URL: str = "redis://localhost:6379"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_BUCKET_NAME: str = "rakshak-evidence"
    AWS_REGION: str = "ap-south-1"
    MAPBOX_TOKEN: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
