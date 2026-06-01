from fastapi import APIRouter, Query
from app.services import analytics_service

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

@router.get("/summary")
async def summary():
    return await analytics_service.get_summary()

@router.get("/severity-distribution")
async def severity_distribution():
    return await analytics_service.get_severity_distribution()

@router.get("/daily-detections")
async def daily_detections(days: int = Query(30)):
    return await analytics_service.get_daily_detections(days)