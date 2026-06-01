import cv2
import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from app.services.detector import detector
from app.core.logging import logger

router = APIRouter(prefix="/api/v1/live", tags=["Live"])

def generate_frames(source=0, conf=0.2):
    """Yield JPEG frames with real‑time detection overlays. Falls back to a black frame if camera cannot open."""
    cap = cv2.VideoCapture(source)
    camera_ok = cap.isOpened()
    if not camera_ok:
        logger.warning(f"Camera source {source} not available – sending fallback frames.")
        black = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(black, "No camera", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        while True:
            ret, jpeg = cv2.imencode('.jpg', black)
            if not ret:
                continue
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n\r\n')

    frame_count = 0
    detect_every = 3
    last_detections = []

    while True:
        success, frame = cap.read()
        if not success:
            break

        frame_count += 1
        display_frame = cv2.resize(frame, (640, 480))

        if frame_count % detect_every == 0:
            try:
                detections, _, _ = detector.detect_with_depth(display_frame, conf=conf)
                last_detections = detections
            except Exception as e:
                logger.error(f"Error during live detection: {e}")
                last_detections = []

        if last_detections:
            mask_overlay = display_frame.copy()
            for idx, det in enumerate(last_detections):
                pts = det.get("mask")
                if pts and len(pts) > 2:
                    poly = np.array([[p["x"], p["y"]] for p in pts], dtype=np.int32)
                    cv2.fillPoly(mask_overlay, [poly], (255, 0, 0))
                    cv2.polylines(display_frame, [poly], isClosed=True, color=(255, 0, 0), thickness=2)

                x1, y1 = int(det["bbox"]["x1"]), int(det["bbox"]["y1"])
                x2, y2 = int(det["bbox"]["x2"]), int(det["bbox"]["y2"])
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

                confidence = det['confidence']
                depth_str = f" Depth:{det.get('depth_cm', '?')}cm" if det.get('depth_cm') is not None else ""
                severity_str = f" Sev:{det.get('severity', '?')}" if det.get('severity') is not None else ""
                label = f"Pothole {idx+1} ({confidence:.2f}){depth_str}{severity_str}"
                cv2.putText(display_frame, label, (x1, max(y1 - 10, 15)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 2)

            alpha = 0.25
            cv2.addWeighted(mask_overlay, alpha, display_frame, 1 - alpha, 0, display_frame)

        ret, jpeg = cv2.imencode('.jpg', display_frame)
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n\r\n')

    cap.release()

@router.get("/webcam")
async def live_webcam(
    source: int = Query(0),
    conf: float = Query(0.2)
):
    return StreamingResponse(
        generate_frames(source, conf),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )