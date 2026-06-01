from pydantic import BaseModel
from typing import List, Optional

class BBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class MaskPoint(BaseModel):
    x: float
    y: float

class DetectionResult(BaseModel):
    class_id: int
    class_name: str          # e.g. "pothole"
    confidence: float
    bbox: BBox
    mask: Optional[List[MaskPoint]] = None   # polygon points
    depth_cm: Optional[float] = None
    width_cm: Optional[float] = None
    length_cm: Optional[float] = None
    area_cm2: Optional[float] = None
    severity: Optional[str] = None

class DetectionResponse(BaseModel):
    detections: List[DetectionResult]
    image_with_boxes_base64: Optional[str] = None  # optional annotated image
    processing_time_ms: float