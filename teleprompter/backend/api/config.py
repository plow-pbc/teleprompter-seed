"""Configuration management for the teleprompter backend."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Load application settings from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Local recording tool — single shared user, no authentication.
    local_mode: bool = Field(
        True,
        description="Always True for the seed build: shared 'local' user for all connections.",
    )

    # Content API authentication
    content_api_key: str | None = Field(
        None,
        description="API key for POST /api/content endpoint. If not set, endpoint returns 503.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
