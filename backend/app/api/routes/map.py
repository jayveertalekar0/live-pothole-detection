from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from app.models.pothole import PotholeCreate, PotholeResponse
from app.services.map_service import (
    create_pothole,
    get_potholes_nearby,
    get_all_potholes,
    get_road_health_grid,
    get_route_risk,
    update_pothole_status
)

class StatusUpdate(BaseModel):
    repair_status: str

router = APIRouter(prefix="/api/v1/map", tags=["Map"])

@router.post("/pothole", response_model=PotholeResponse)
async def report_pothole(payload: PotholeCreate):
    """Store a GPS-tagged pothole detection into MongoDB."""
    return await create_pothole(payload)

@router.get("/nearby", response_model=list[PotholeResponse])
async def nearby_potholes(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(5.0),
    min_severity: str = Query("Low")
):
    """Get potholes within a radius of a GPS point."""
    return await get_potholes_nearby(lat, lon, radius_km, min_severity)

@router.get("/all", response_model=list[PotholeResponse])
async def all_potholes(
    min_severity: str = Query("Low"),
    limit: int = Query(10000)
):
    """Return all potholes (up to `limit`) without spatial filtering."""
    return await get_all_potholes(min_severity, limit)

@router.get("/road-health")
async def road_health_grid(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lng: float = Query(...),
    grid_size_km: float = Query(0.5)
):
    """Return a GeoJSON FeatureCollection of road‑health cells."""
    cells = await get_road_health_grid(min_lat, max_lat, min_lng, max_lng, grid_size_km)
    return {"type": "FeatureCollection", "features": cells}

@router.get("/route-risk")
async def route_risk(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...)
):
    """Analyse pothole danger along a driving route."""
    return await get_route_risk(origin_lat, origin_lng, dest_lat, dest_lng)

@router.patch("/pothole/{id}", response_model=PotholeResponse)
async def patch_pothole_status(id: str, payload: StatusUpdate):
    """Update a pothole's repair status and status history."""
    try:
        updated = await update_pothole_status(id, payload.repair_status)
        if not updated:
            raise HTTPException(status_code=404, detail="Pothole not found")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))