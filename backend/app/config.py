"""SynergyHub configuration via environment variables."""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/synergyhub"
    port: int = 8000
    frontend_dist: str = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
    environment: str = "development"

    # Google Calendar (service account with domain-wide delegation)
    google_service_account_json: str = ""  # Path to JSON key file OR raw JSON string
    google_impersonate_email: str = "support@peoplesdoctor.com"
    google_calendar_enabled: bool = False

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")


settings = Settings()
