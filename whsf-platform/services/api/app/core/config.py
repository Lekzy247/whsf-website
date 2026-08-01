from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="WHSF_",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    service_name: str = "api"
    version: str = "0.1.0"
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://whsf:change-me@localhost:5432/whsf"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: tuple[str, ...] = ("http://localhost:3000", "http://localhost:3001")

    @field_validator("environment")
    @classmethod
    def known_environment(cls, value: str) -> str:
        allowed = {"development", "test", "staging", "production"}
        if value not in allowed:
            raise ValueError(f"environment must be one of {sorted(allowed)}")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
