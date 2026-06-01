import base64
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Query
from app.services.detector import detector
from app.models.detection import DetectionResponse, DetectionResult
from app.core.config import settings

router = APIRouter(prefix="/api/v1/detect", tags=["Detection"])

@router.post("/image", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    return_image: bool = Query(False, description="Return base64 annotated image"),
    conf: float = Query(None, description="Confidence threshold override"),
    estimate_depth: bool = Query(False, description="Estimate depth and severity")
):
    # Read image bytes
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if estimate_depth:
        detections, annotated_img, elapsed = detector.detect_with_depth(img, conf=conf)
    else:
        detections, annotated_img, elapsed = detector.detect(img, conf=conf)

    response_data = {
        "detections": [DetectionResult(**d) for d in detections],
        "processing_time_ms": elapsed
    }

    if return_image:
        # Encode annotated image to base64
        ret, buffer = cv2.imencode('.jpg', annotated_img)
        if ret:
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            response_data["image_with_boxes_base64"] = img_base64

    return response_data