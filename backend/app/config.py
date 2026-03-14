"""SynergyHub configuration via environment variables."""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/synergyhub"
    port: int = 8000
    frontend_dist: str = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
    environment: str = "development"

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


settings = Settings()
