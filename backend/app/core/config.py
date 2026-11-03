import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "PETRAILS Actuarial Intelligence API"
    API_VERSION: str = "2.4.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # MongoDB Atlas Configuration
    MONGODB_URI: str = Field(
        default="mongodb+srv://petrails_admin:PetrailsAtlas2026@cluster0.mongodb.net/?retryWrites=true&w=majority",
        description="MongoDB Atlas connection URI"
    )
    MONGODB_DATABASE: str = Field(
        default="petrails_db",
        description="MongoDB database name"
    )
    DATABASE_NAME: Optional[str] = None
    
    # Security & JWT Configuration
    JWT_SECRET_KEY: str = "petrails-super-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Testing flag
    TESTING: bool = False
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

    @property
    def database_name(self) -> str:
        return self.DATABASE_NAME or self.MONGODB_DATABASE or "petrails_db"
    
    @property
    def is_atlas(self) -> bool:
        return "mongodb+srv://" in self.MONGODB_URI or "mongodb.net" in self.MONGODB_URI
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

