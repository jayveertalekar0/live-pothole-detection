import logging
from app.core.config import settings

logger = logging.getLogger("pothole-detector")
logger.setLevel(settings.LOG_LEVEL)

# Add a simple console handler if you want (optional)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)