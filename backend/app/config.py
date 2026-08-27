from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "demo"
    log_level: str = "INFO"
    llm_provider: str = "mock"
    llm_model: str = "mock-structured-model"
    database_url: str = "postgresql+psycopg://crossborder:crossborder@localhost/crossborder"
    redis_url: str = "redis://localhost:6379/0"
    amazon_provider: str = "mock"
    sp_api_region: str = "eu"
    sp_api_marketplace_id: str = "A1F83G8C2ARO7P"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
