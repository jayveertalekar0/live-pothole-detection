import time
import cv2
import numpy as np
from ultralytics import YOLO
from app.core.config import settings
from app.core.logging import logger
from app.services.depth_estimator import depth_estimator

class PotholeDetector:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        logger.info(f"Loading model from {settings.MODEL_PATH} on {settings.DEVICE}")
        self.model = YOLO(settings.MODEL_PATH)
        self.model.to(settings.DEVICE)
        # Warm-up
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.model(dummy, verbose=False)

    def detect(self, image: np.ndarray, conf: float = None) -> tuple[list, np.ndarray, float]:
        start = time.time()
        c = conf if conf is not None else settings.CONFIDENCE_THRESHOLD
        results = self.model(
            image,
            conf=c,
            iou=settings.IOU_THRESHOLD,
            imgsz=settings.IMAGE_SIZE,
            verbose=False
        )[0]

        detections = []
        if results.masks is not None:
            for box, mask, cls, conf_val in zip(
                results.boxes.xyxy.cpu().numpy(),
                results.masks.xy,
                results.boxes.cls.cpu().numpy(),
                results.boxes.conf.cpu().numpy()
            ):
                detections.append({
                    "class_id": int(cls),
                    "class_name": self.model.names[int(cls)],
                    "confidence": float(conf_val),
                    "bbox": {
                        "x1": float(box[0]), "y1": float(box[1]),
                        "x2": float(box[2]), "y2": float(box[3])
                    },
                    "mask": [{"x": pt[0], "y": pt[1]} for pt in mask]
                })

        annotated = results.plot()
        elapsed = (time.time() - start) * 1000
        logger.info(f"Detected {len(detections)} pothole(s) in {elapsed:.1f}ms")
        return detections, annotated, elapsed

    def detect_with_depth(self, image: np.ndarray, conf: float = None) -> tuple[list, np.ndarray, float]:
        start = time.time()

        basic_dets, annotated, _ = self.detect(image, conf=conf)

        if not basic_dets:
            elapsed = (time.time() - start) * 1000
            return [], annotated, elapsed

        depth_map = depth_estimator.estimate_depth(image)

        enriched = []
        for det in basic_dets:
            mask_pts = det.get("mask")
            if not mask_pts or len(mask_pts) < 3:
                continue

            poly = np.array([[p["x"], p["y"]] for p in mask_pts], dtype=np.int32)
            mask = np.zeros(image.shape[:2], dtype=np.uint8)
            cv2.fillPoly(mask, [poly], 255)

            # Median depth inside pothole
            pothole_depths = depth_map[mask > 0]
            if len(pothole_depths) == 0:
                continue
            median_pothole_depth = np.median(pothole_depths)

            # Wider border for road plane (more robust)
            kernel = np.ones((7, 7), np.uint8)
            dilated = cv2.dilate(mask, kernel, iterations=4)
            border = cv2.subtract(dilated, mask)
            road_depths = depth_map[border > 0]
            if len(road_depths) == 0:
                road_depths = depth_map[mask == 0]
            if len(road_depths) == 0:
                continue
            median_road_depth = np.median(road_depths)

            # Depth in cm (clamped to realistic range)
            raw_depth_cm = max(0, (median_road_depth - median_pothole_depth) * 100)
            depth_cm = max(0.1, min(raw_depth_cm, 15.0))

            # Pixel‑to‑cm scale (rough – calibrate later)
            x1, y1, x2, y2 = det["bbox"]["x1"], det["bbox"]["y1"], det["bbox"]["x2"], det["bbox"]["y2"]
            pixel_width = x2 - x1
            pixel_height = y2 - y1
            cm_per_pixel = 0.5
            width_cm = pixel_width * cm_per_pixel
            length_cm = pixel_height * cm_per_pixel
            area_cm2 = width_cm * length_cm

            # Filter tiny potholes (noise)
            if area_cm2 < 50:
                continue

            # Severity
            if depth_cm < 2:
                severity = "Low"
            elif depth_cm < 5:
                severity = "Moderate"
            elif depth_cm < 10:
                severity = "Dangerous"
            else:
                severity = "Critical"

            det["depth_cm"] = round(depth_cm, 1)
            det["width_cm"] = round(width_cm, 1)
            det["length_cm"] = round(length_cm, 1)
            det["area_cm2"] = round(area_cm2, 1)
            det["severity"] = severity
            enriched.append(det)

        elapsed = (time.time() - start) * 1000
        logger.info(f"Depth estimation applied to {len(enriched)} pothole(s) in {elapsed:.1f}ms")
        return enriched, annotated, elapsed

detector = PotholeDetector()