import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.detection import router as detection_router
from app.api.routes.video import router as video_router
from app.api.routes.live import router as live_router
from app.api.routes.map import router as map_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.websocket import router as websocket_router
from app.core.config import settings
from app.db.database import init_db

# Read allowed origins from environment variable
origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allow_origins = [origin.strip() for origin in origins_str.split(",")]

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url=None
)

# CORS – uses the dynamic list from the environment variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(detection_router)
app.include_router(video_router)
app.include_router(live_router)
app.include_router(map_router)
app.include_router(analytics_router)
app.include_router(websocket_router)

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/health")
async def health():
    return {"status": "ok"}