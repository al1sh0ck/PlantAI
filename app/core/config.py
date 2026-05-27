from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PlantAI"
    VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://plantai:plantai@postgres:5432/plantai_db"

    # JWT
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000", "*"]

    # ML
    MODEL_PATH: str = "models/plantai_efficientnet_b0.pth"
    CLASS_NAMES_PATH: str = "models/class_names.json"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
