from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Pothole Detection API"
    VERSION: str = "0.1.0"
    MODEL_PATH: str = "models/pothole_full_best.pt"
    CONFIDENCE_THRESHOLD: float = 0.15
    IOU_THRESHOLD: float = 0.6
    MERGE_IOU_THRESHOLD: float = 0.7
    DEVICE: str = "cpu"
    IMAGE_SIZE: int = 320          # lowered for speed
    VIDEO_FRAME_SKIP: int = 5     # process every 3rd frame
    LOG_LEVEL: str = "INFO"
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_NAME: str = "pothole_db"
    class Config:
        env_file = ".env"

settings = Settings()