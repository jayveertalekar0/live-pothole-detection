import motor.motor_asyncio
from app.core.config import settings

client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.MONGODB_NAME]

async def init_db():
    # Create indexes
    await db.potholes.create_index([("location", "2dsphere")])
    await db.potholes.create_index("detected_at")
    await db.potholes.create_index("severity")
    print("MongoDB indexes ensured.")