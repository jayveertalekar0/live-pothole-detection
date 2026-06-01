from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class PotholeCreate(BaseModel):
    latitude: float
    longitude: float
    severity: str
    depth_cm: Optional[float] = None
    width_cm: Optional[float] = None
    length_cm: Optional[float] = None
    area_cm2: Optional[float] = None
    confidence: Optional[float] = None
    image_url: Optional[str] = None
    reported_by: Optional[str] = None
    mask: Optional[List[Dict[str, float]]] = None
    bbox: Optional[Dict[str, float]] = None
    polygon: Optional[List[List[float]]] = None

class PotholeResponse(PotholeCreate):
    id: str
    geometry: Optional[dict] = None   # GeoJSON Point
    detected_at: datetime
    repair_status: str = "reported"
    detection_count: Optional[int] = 1
    status_history: Optional[List[Dict[str, Any]]] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    report_count: Optional[int] = None
    severity_history: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True  # for compatibility with Pydantic v2