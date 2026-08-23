from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./placement.db"
    
    # Scheduler Weights (Configurable)
    WEIGHT_SCHEDULED: int = 10000
    WEIGHT_PRIORITY: int = 1000
    WEIGHT_WAIT_TIME: int = -1
    
    # Replanning Penalties
    PENALTY_TIME: int = 1000
    PENALTY_ROOM: int = 500
    PENALTY_PANEL: int = 500
    PENALTY_DAY: int = 2000
    PENALTY_CANCEL: int = 5000

    class Config:
        env_file = ".env"

settings = Settings()
