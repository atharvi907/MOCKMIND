from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")

    app_name: str = "MockMind API"
    environment: str = "development"
    mongo_url: str
    db_name: str = "mockmind"
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = Field(default=1440, ge=5, le=43200)
    cors_origins: list[str] | str = ["http://localhost:3000"]
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    max_upload_bytes: int = 5 * 1024 * 1024

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value):
        return [item.strip() for item in value.split(",") if item.strip()] if isinstance(value, str) else value


@lru_cache
def get_settings() -> Settings:
    return Settings()
