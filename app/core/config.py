from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    SKYHIGH_BASE_URL: str = "https://your-gw-ip:443/mwg/config/v1"
    SKYHIGH_USERNAME: str = "admin"
    SKYHIGH_PASSWORD: str = "password"
    VERIFY_SSL: bool = False
    
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Skyhigh Proxy Policy Parser"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
