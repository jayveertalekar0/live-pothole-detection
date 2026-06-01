import os                          # ← added, was missing
import cv2
import numpy as np
import time
from collections import deque
from app.services.detector import detector
from app.core.config import settings
from app.core.logging import logger

# ------------------------------------------------------------
#  Simple Centroid Tracker (unchanged)
# ------------------------------------------------------------
class PotholeTracker:
    def __init__(self, max_disappeared=10, smooth_frames=6):
        self.next_id = 1
        self.objects = {}               # id -> (centroid, bbox, mask)
        self.disappeared = {}
        self.max_disappeared = max_disappeared
        self.history = {}               # id -> deque of recent detection dicts
        self.smooth_frames = smooth_frames
        self.depth_ema = {}             # id -> EMA of depth (float)
        self.alpha = 0.1                # heavy smoothing (was 0.3)

    def update(self, detections):
        if not detections:
            for oid in list(self.objects.keys()):
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self.objects.pop(oid, None)
                    self.disappeared.pop(oid, None)
                    self.history.pop(oid, None)
                    self.depth_ema.pop(oid, None)
            return []

        current_centroids = []
        for d in detections:
            x1, y1, x2, y2 = d["bbox"]["x1"], d["bbox"]["y1"], d["bbox"]["x2"], d["bbox"]["y2"]
            current_centroids.append(((x1+x2)//2, (y1+y2)//2))

        if not self.objects:
            for i, d in enumerate(detections):
                self.objects[self.next_id] = (current_centroids[i], d["bbox"], d["mask"])
                self.disappeared[self.next_id] = 0
                self.history[self.next_id] = deque(maxlen=self.smooth_frames)
                self.history[self.next_id].append(d)
                self.depth_ema[self.next_id] = d.get("depth_cm", 0)
                self.next_id += 1
            return list(self.objects.keys())

        object_ids = list(self.objects.keys())
        object_centroids = [self.objects[oid][0] for oid in object_ids]

        used_col = set()
        used_det = set()
        for i, (cx, cy) in enumerate(current_centroids):
            dists = [np.sqrt((cx-ox)**2 + (cy-oy)**2) for (ox, oy) in object_centroids]
            j = np.argmin(dists)
            if dists[j] < 100 and j not in used_col:
                oid = object_ids[j]
                self.objects[oid] = (current_centroids[i], detections[i]["bbox"], detections[i]["mask"])
                self.disappeared[oid] = 0
                if oid not in self.history:
                    self.history[oid] = deque(maxlen=self.smooth_frames)
                self.history[oid].append(detections[i])
                new_depth = detections[i].get("depth_cm", 0)
                if oid in self.depth_ema:
                    self.depth_ema[oid] = self.alpha * new_depth + (1 - self.alpha) * self.depth_ema[oid]
                else:
                    self.depth_ema[oid] = new_depth
                used_col.add(j)
                used_det.add(i)

        for oid in object_ids:
            if oid not in [object_ids[j] for j in used_col]:
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self.objects.pop(oid, None)
                    self.disappeared.pop(oid, None)
                    self.history.pop(oid, None)
                    self.depth_ema.pop(oid, None)

        for i, d in enumerate(detections):
            if i not in used_det:
                self.objects[self.next_id] = (current_centroids[i], d["bbox"], d["mask"])
                self.disappeared[self.next_id] = 0
                self.history[self.next_id] = deque(maxlen=self.smooth_frames)
                self.history[self.next_id].append(d)
                self.depth_ema[self.next_id] = d.get("depth_cm", 0)
                self.next_id += 1

        return list(self.objects.keys())

    def get_assigned_id(self, detection):
        for oid, (_, bbox, _) in self.objects.items():
            if (bbox["x1"] == detection["bbox"]["x1"] and
                bbox["y1"] == detection["bbox"]["y1"] and
                bbox["x2"] == detection["bbox"]["x2"] and
                bbox["y2"] == detection["bbox"]["y2"]):
                return oid
        return None

    def get_smoothed_detection(self, oid):
        if oid not in self.history or len(self.history[oid]) == 0:
            return None, None, None, None, None

        history = self.history[oid]
        first_mask = history[0].get("mask")
        if first_mask and len(first_mask) >= 3:
            same_len = all(len(d.get("mask", [])) == len(first_mask) for d in history)
            if same_len:
                smooth_mask = []
                for k in range(len(first_mask)):
                    avg_x = np.mean([d["mask"][k]["x"] for d in history])
                    avg_y = np.mean([d["mask"][k]["y"] for d in history])
                    smooth_mask.append({"x": avg_x, "y": avg_y})
            else:
                smooth_mask = first_mask
        else:
            smooth_mask = None

        if oid in self.depth_ema and self.depth_ema[oid] is not None:
            smooth_depth = self.depth_ema[oid]
        else:
            depth_vals = [d.get("depth_cm") for d in history if d.get("depth_cm") is not None]
            smooth_depth = np.mean(depth_vals) if depth_vals else None

        sev_vals = [d.get("severity") for d in history if d.get("severity") is not None]
        if sev_vals:
            from collections import Counter
            smooth_sev = Counter(sev_vals).most_common(1)[0][0]
        else:
            smooth_sev = None

        width_vals = [d.get("width_cm") for d in history if d.get("width_cm") is not None]
        length_vals = [d.get("length_cm") for d in history if d.get("length_cm") is not None]
        smooth_width = np.mean(width_vals) if width_vals else None
        smooth_length = np.mean(length_vals) if length_vals else None

        return smooth_mask, smooth_depth, smooth_sev, smooth_width, smooth_length

# ------------------------------------------------------------
#  Merge overlapping detections (IoU)
# ------------------------------------------------------------
def box_iou(boxA, boxB):
    xa = max(boxA["x1"], boxB["x1"])
    ya = max(boxA["y1"], boxB["y1"])
    xb = min(boxA["x2"], boxB["x2"])
    yb = min(boxA["y2"], boxB["y2"])
    interW = max(0, xb - xa)
    interH = max(0, yb - ya)
    inter = interW * interH
    areaA = (boxA["x2"]-boxA["x1"]) * (boxA["y2"]-boxA["y1"])
    areaB = (boxB["x2"]-boxB["x1"]) * (boxB["y2"]-boxB["y1"])
    return inter / (areaA + areaB - inter + 1e-6)

def merge_overlapping(detections, iou_thr=0.5, min_area_cm2=50):
    detections = [d for d in detections if d.get("area_cm2", 0) >= min_area_cm2]
    if len(detections) < 2:
        return detections
    dets = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    keep = []
    suppressed = set()
    for i, di in enumerate(dets):
        if i in suppressed:
            continue
        keep.append(di)
        for j in range(i+1, len(dets)):
            if j in suppressed:
                continue
            if box_iou(di["bbox"], dets[j]["bbox"]) >= iou_thr:
                suppressed.add(j)
    return keep

# ------------------------------------------------------------
#  Drawing: smoothed mask + centre number + depth/severity
# ------------------------------------------------------------
def draw_detections(frame, detections, tracker):
    tracker.update(detections)
    mask_layer = frame.copy()
    for det in detections:
        oid = tracker.get_assigned_id(det)
        if oid is None:
            continue

        smooth_mask, smooth_depth, smooth_sev, smooth_w, smooth_l = tracker.get_smoothed_detection(oid)
        pts = smooth_mask if smooth_mask else det.get("mask")

        if pts and len(pts) > 2:
            poly = np.array([[p["x"], p["y"]] for p in pts], dtype=np.int32)
            cv2.fillPoly(mask_layer, [poly], (255, 0, 0))
            cv2.polylines(frame, [poly], isClosed=True, color=(255, 0, 0), thickness=2)

        x1, y1, x2, y2 = det["bbox"]["x1"], det["bbox"]["y1"], det["bbox"]["x2"], det["bbox"]["y2"]
        cx, cy = int((x1+x2)/2), int((y1+y2)/2)
        label = f"Pothole {oid}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (cx-tw//2-5, cy-th//2-5), (cx+tw//2+5, cy+th//2+5), (0,0,0), -1)
        cv2.putText(frame, label, (cx-tw//2, cy+th//2), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2, cv2.LINE_AA)

        depth_val = smooth_depth if smooth_depth is not None else det.get("depth_cm")
        sev_val = smooth_sev if smooth_sev is not None else det.get("severity")
        if depth_val is not None:
            depth_str = f"Depth: {depth_val:.1f}cm" if isinstance(depth_val, (int, float)) else f"Depth: {depth_val}"
            sev_str = f"Sev: {sev_val}"
            (dw, dh), _ = cv2.getTextSize(depth_str, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            (sw, sh), _ = cv2.getTextSize(sev_str, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)

            base_y = cy + th//2 + 5
            cv2.rectangle(frame, (cx-dw//2-5, base_y), (cx+dw//2+5, base_y+dh+4), (0,0,0), -1)
            cv2.putText(frame, depth_str, (cx-dw//2, base_y+dh+2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 2)

            base_y2 = base_y + dh + 8
            cv2.rectangle(frame, (cx-sw//2-5, base_y2), (cx+sw//2+5, base_y2+sh+4), (0,0,0), -1)
            cv2.putText(frame, sev_str, (cx-sw//2, base_y2+sh+2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 2)

    alpha = 0.25
    cv2.addWeighted(mask_layer, alpha, frame, 1-alpha, 0, frame)
    return frame

# ------------------------------------------------------------
#  Main video processing function (updated: codec fallback + return values)
# ------------------------------------------------------------
def process_video(input_path, output_path, conf=None, iou=None, imgsz=None, skip=None):
    conf = conf or settings.CONFIDENCE_THRESHOLD
    iou = iou or settings.IOU_THRESHOLD
    imgsz = imgsz or settings.IMAGE_SIZE
    skip = skip or settings.VIDEO_FRAME_SKIP
    merge_iou = 0.4

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Codec try-list: (codec_str, extension, mime_type)
    codecs = [
        ('VP80', 'webm', 'video/webm'),
        ('avc1', 'mp4',  'video/mp4'),
        ('mp4v', 'mp4',  'video/mp4'),
    ]

    out = None
    final_output_path = None
    media_type = None

    # Strip any extension from output_path to dynamically apply the correct one
    base_out, _ = os.path.splitext(output_path)

    for codec_str, ext, mime in codecs:
        current_path = f"{base_out}.{ext}"
        try:
            fourcc = cv2.VideoWriter_fourcc(*codec_str)
            test_out = cv2.VideoWriter(current_path, fourcc, fps, (w, h))
            if test_out.isOpened():
                out = test_out
                final_output_path = current_path
                media_type = mime
                logger.info(f"Successfully initialized VideoWriter with codec={codec_str}, extension={ext}, mime={mime}")
                break
            else:
                test_out.release()
                if os.path.exists(current_path):
                    os.unlink(current_path)
        except Exception as e:
            logger.warning(f"Codec {codec_str} failed to initialize: {e}")
            if os.path.exists(current_path):
                try:
                    os.unlink(current_path)
                except Exception:
                    pass

    if out is None:
        cap.release()
        raise ValueError("Could not open VideoWriter with any of the fallback codecs.")

    tracker = PotholeTracker(max_disappeared=15, smooth_frames=8)
    frame_count = pothole_frames = 0
    prev_time = time.time()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            now = time.time()
            elap = now - prev_time
            fps_disp = 1.0 / elap if elap > 0 else 0
            prev_time = now

            if frame_count % skip != 0:
                cv2.putText(frame, f"FPS: {fps_disp:.1f}", (10,30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)
                out.write(frame)
                continue

            raw_detections, _, _ = detector.detect_with_depth(frame)
            merged = merge_overlapping(raw_detections, merge_iou, min_area_cm2=50)

            if merged:
                pothole_frames += 1
                frame = draw_detections(frame, merged, tracker)

            cv2.putText(frame, f"FPS: {fps_disp:.1f}", (10,30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2, cv2.LINE_AA)
            out.write(frame)
    finally:
        cap.release()
        out.release()

    logger.info(f"Processed {frame_count} frames, {pothole_frames} with potholes.")
    return frame_count, pothole_frames, final_output_path, media_type