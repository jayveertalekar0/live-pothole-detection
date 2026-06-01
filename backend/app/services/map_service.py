import math
import httpx
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId
from app.db.database import db
from app.models.pothole import PotholeCreate, PotholeResponse

ROAD_HEALTH_CACHE = {}

def clear_road_health_cache():
    ROAD_HEALTH_CACHE.clear()

async def broadcast_pothole(doc: dict):
    """Safely broadcast a pothole via WebSocket if the manager is available."""
    try:
        from app.api.routes.websocket import manager
        pothole_resp = doc_to_response(doc)
        pothole_dict = pothole_resp.model_dump() if hasattr(pothole_resp, "model_dump") else pothole_resp.dict()
        await manager.broadcast(pothole_dict)
    except ImportError:
        pass
    except Exception as e:
        print(f"Broadcast error: {e}")

async def create_pothole(payload: PotholeCreate) -> PotholeResponse:
    """Store a new pothole detection, merging with an existing one if within 5m and temporal window."""
    now = datetime.utcnow()

    # ---------- polygon estimation (if mask/bbox supplied) ----------
    polygon = payload.polygon
    if not polygon and payload.mask and payload.bbox:
        try:
            x1, y1 = payload.bbox["x1"], payload.bbox["y1"]
            x2, y2 = payload.bbox["x2"], payload.bbox["y2"]
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            w_pixels = max(1.0, x2 - x1)
            h_pixels = max(1.0, y2 - y1)

            width_cm = payload.width_cm or (math.sqrt(payload.area_cm2) if payload.area_cm2 else 30.0)
            length_cm = payload.length_cm or (math.sqrt(payload.area_cm2) if payload.area_cm2 else 30.0)

            lat_rad = math.radians(payload.latitude)
            cos_lat = math.cos(lat_rad) or 1.0

            cm_to_lat = 1.0 / 11111100.0
            cm_to_lng = 1.0 / (11111100.0 * cos_lat)

            x_scale = (width_cm / w_pixels) * cm_to_lng
            y_scale = (length_cm / h_pixels) * cm_to_lat

            poly_pts = []
            step = max(1, len(payload.mask) // 20)
            for pt in payload.mask[::step]:
                px, py = pt["x"], pt["y"]
                lng_offset = (px - cx) * x_scale
                lat_offset = (cy - py) * y_scale
                poly_pts.append([payload.latitude + lat_offset, payload.longitude + lng_offset])
            if poly_pts:
                polygon = poly_pts
        except Exception:
            pass

    # ---------- deduplication query ----------
    seconds_window = 30 if not payload.image_url else 7 * 24 * 3600
    time_threshold = now - timedelta(seconds=seconds_window)

    query = {
        "location": {
            "$nearSphere": {
                "$geometry": {"type": "Point", "coordinates": [payload.longitude, payload.latitude]},
                "$maxDistance": 5
            }
        },
        "detected_at": {"$gte": time_threshold},
        "repair_status": {"$ne": "fixed"}
    }

    existing = await db.potholes.find_one(query)

    if existing:
        # ----- merge existing -----
        new_report_count = existing.get("report_count", existing.get("detection_count", 1)) + 1
        update_data = {
            "detected_at": now,
            "detection_count": new_report_count,
            "report_count": new_report_count,
            "last_seen": now
        }

        # severity history
        sev_history = existing.get("severity_history") or []
        if not sev_history:
            sev_history.append({
                "timestamp": existing.get("first_seen", existing.get("detected_at", now - timedelta(seconds=1))),
                "severity": existing.get("severity", payload.severity)
            })
        sev_history.append({"timestamp": now, "severity": payload.severity})
        update_data["severity_history"] = sev_history

        new_conf = payload.confidence or 0.0
        old_conf = existing.get("confidence") or 0.0
        if new_conf > old_conf:
            update_data.update({
                "confidence": payload.confidence,
                "severity": payload.severity,
                "depth_cm": payload.depth_cm if payload.depth_cm is not None else existing.get("depth_cm"),
                "width_cm": payload.width_cm if payload.width_cm is not None else existing.get("width_cm"),
                "length_cm": payload.length_cm if payload.length_cm is not None else existing.get("length_cm"),
                "area_cm2": payload.area_cm2 if payload.area_cm2 is not None else existing.get("area_cm2"),
            })
            if polygon:
                update_data["polygon"] = polygon

        await db.potholes.update_one({"_id": existing["_id"]}, {"$set": update_data})
        doc = await db.potholes.find_one({"_id": existing["_id"]})

        clear_road_health_cache()
        await broadcast_pothole(doc)
        return doc_to_response(doc)

    # ---------- create new pothole ----------
    doc = payload.dict()
    doc["location"] = {"type": "Point", "coordinates": [payload.longitude, payload.latitude]}
    doc["detected_at"] = now
    doc["repair_status"] = "reported"
    doc["detection_count"] = 1
    doc["report_count"] = 1
    doc["first_seen"] = now
    doc["last_seen"] = now
    doc["status_history"] = [{"status": "reported", "timestamp": now}]
    doc["severity_history"] = [{"timestamp": now, "severity": payload.severity}]
    if polygon:
        doc["polygon"] = polygon

    result = await db.potholes.insert_one(doc)
    doc["_id"] = result.inserted_id

    clear_road_health_cache()
    await broadcast_pothole(doc)
    return doc_to_response(doc)


async def get_potholes_nearby(lat: float, lon: float, radius_km: float, min_severity: str) -> list[PotholeResponse]:
    """Find potholes within a radius (in km) of a GPS point, filtered by severity."""
    radius_m = radius_km * 1000

    sev_rank = {"Low": 1, "Moderate": 2, "Dangerous": 3, "Critical": 4}
    min_rank = sev_rank.get(min_severity, 1)

    query = {
        "location": {
            "$nearSphere": {
                "$geometry": {"type": "Point", "coordinates": [lon, lat]},
                "$maxDistance": radius_m
            }
        },
        "repair_status": {"$ne": "fixed"},
        "$expr": {
            "$gte": [
                {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$severity", "Low"]}, "then": 1},
                            {"case": {"$eq": ["$severity", "Moderate"]}, "then": 2},
                            {"case": {"$eq": ["$severity", "Dangerous"]}, "then": 3},
                            {"case": {"$eq": ["$severity", "Critical"]}, "then": 4}
                        ],
                        "default": 0
                    }
                },
                min_rank
            ]
        }
    }

    cursor = db.potholes.find(query).sort("detected_at", -1)
    results = []
    async for doc in cursor:
        results.append(doc_to_response(doc))
    return results


async def get_all_potholes(min_severity: str = "Low", limit: int = 10000) -> list[PotholeResponse]:
    """Return all potholes (up to `limit`) without spatial filtering."""
    sev_rank = {"Low": 1, "Moderate": 2, "Dangerous": 3, "Critical": 4}
    min_rank = sev_rank.get(min_severity, 1)

    query = {
        "repair_status": {"$ne": "fixed"},
        "$expr": {
            "$gte": [
                {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$severity", "Low"]}, "then": 1},
                            {"case": {"$eq": ["$severity", "Moderate"]}, "then": 2},
                            {"case": {"$eq": ["$severity", "Dangerous"]}, "then": 3},
                            {"case": {"$eq": ["$severity", "Critical"]}, "then": 4}
                        ],
                        "default": 0
                    }
                },
                min_rank
            ]
        }
    }

    cursor = db.potholes.find(query).sort("detected_at", -1).limit(limit)
    results = []
    async for doc in cursor:
        results.append(doc_to_response(doc))
    return results


async def get_road_health_grid(
    min_lat: float, max_lat: float,
    min_lng: float, max_lng: float,
    grid_size_km: float = 0.5
) -> list[dict]:
    """Return GeoJSON features for road health cells, cached for 5 minutes."""
    cache_key = (min_lat, max_lat, min_lng, max_lng, grid_size_km)
    now = datetime.utcnow()
    if cache_key in ROAD_HEALTH_CACHE:
        cells, timestamp = ROAD_HEALTH_CACHE[cache_key]
        if now - timestamp < timedelta(minutes=5):
            return cells

    mid_lat = (min_lat + max_lat) / 2
    lat_step = grid_size_km / 111.0
    lng_step = grid_size_km / (111.0 * math.cos(math.radians(mid_lat)))

    pipeline = [
        {
            "$match": {
                "location": {
                    "$geoWithin": {
                        "$box": [[min_lng, min_lat], [max_lng, max_lat]]
                    }
                },
                "repair_status": {"$ne": "fixed"}
            }
        },
        {
            "$group": {
                "_id": {
                    "lat_bin": {"$floor": {"$divide": ["$latitude", lat_step]}},
                    "lng_bin": {"$floor": {"$divide": ["$longitude", lng_step]}}
                },
                "count": {"$sum": 1},
                "avg_severity": {
                    "$avg": {
                        "$switch": {
                            "branches": [
                                {"case": {"$eq": ["$severity", "Low"]}, "then": 1},
                                {"case": {"$eq": ["$severity", "Moderate"]}, "then": 2},
                                {"case": {"$eq": ["$severity", "Dangerous"]}, "then": 3},
                                {"case": {"$eq": ["$severity", "Critical"]}, "then": 4}
                            ],
                            "default": 1
                        }
                    }
                },
                "avg_depth": {"$avg": "$depth_cm"}
            }
        }
    ]

    cells = []
    async for doc in db.potholes.aggregate(pipeline):
        lat_center = (doc["_id"]["lat_bin"] + 0.5) * lat_step
        lng_center = (doc["_id"]["lng_bin"] + 0.5) * lng_step
        half_lat = lat_step / 2
        half_lng = lng_step / 2

        severity_penalty = doc["avg_severity"] * 10
        count_penalty = min(doc["count"] * 5, 50)
        depth_penalty = min((doc["avg_depth"] or 0) * 2, 20)
        score = max(0, 100 - severity_penalty - count_penalty - depth_penalty)

        if score < 30:
            color = "#ef4444"
        elif score < 60:
            color = "#f97316"
        elif score < 80:
            color = "#eab308"
        else:
            color = "#22c55e"

        cells.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lng_center - half_lng, lat_center - half_lat],
                    [lng_center + half_lng, lat_center - half_lat],
                    [lng_center + half_lng, lat_center + half_lat],
                    [lng_center - half_lng, lat_center + half_lat],
                    [lng_center - half_lng, lat_center - half_lat]
                ]]
            },
            "properties": {
                "score": round(score, 1),
                "count": doc["count"],
                "color": color,
                "avg_severity": round(doc["avg_severity"], 2),
                "avg_depth": round(doc["avg_depth"] or 0, 1)
            }
        })

    ROAD_HEALTH_CACHE[cache_key] = (cells, now)
    return cells


async def get_route_risk(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float
) -> dict:
    """Fetch a driving route from OSRM and analyse pothole danger along it."""
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?overview=full&geometries=geojson"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()

    if not data.get("routes"):
        raise ValueError("No route found between the given coordinates")

    route_geometry = data["routes"][0]["geometry"]
    coords = route_geometry["coordinates"]

    total_risk = 0
    critical_segments = []

    for i in range(0, len(coords), 10):
        lng, lat = coords[i]
        query = {
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": 50
                }
            },
            "repair_status": {"$ne": "fixed"}
        }
        nearby = await db.potholes.find(query).to_list(length=10)

        if nearby:
            sev_sum = sum(
                {"Low": 1, "Moderate": 2, "Dangerous": 3, "Critical": 4}.get(p["severity"], 1)
                for p in nearby
            )
            total_risk += sev_sum

            if any(p["severity"] in ("Dangerous", "Critical") for p in nearby):
                critical_segments.append({
                    "lat": lat,
                    "lng": lng,
                    "potholes": len(nearby),
                    "max_severity": max(p["severity"] for p in nearby)
                })

    if total_risk > 30:
        risk_level = "Critical"
    elif total_risk > 15:
        risk_level = "Dangerous"
    elif total_risk > 5:
        risk_level = "Moderate"
    else:
        risk_level = "Low"

    return {
        "total_risk_score": total_risk,
        "risk_level": risk_level,
        "critical_segments": critical_segments,
        "route_geometry": route_geometry,
        "distance_km": data["routes"][0]["distance"] / 1000
    }


def doc_to_response(doc) -> PotholeResponse:
    """Convert a MongoDB document to a PotholeResponse object."""
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return PotholeResponse(**doc)


async def update_pothole_status(pothole_id: str, status: str) -> Optional[PotholeResponse]:
    """Update a pothole's repair status and status history, clear cache, broadcast, and return response."""
    valid_statuses = ["Reported", "Verified", "In Progress", "Repaired", "Reappeared"]
    if status not in valid_statuses:
        raise ValueError("Invalid status")

    now = datetime.utcnow()
    existing = await db.potholes.find_one({"_id": ObjectId(pothole_id)})
    if not existing:
        return None

    status_history = existing.get("status_history") or []
    if not status_history:
        status_history.append({
            "status": existing.get("repair_status", "reported"),
            "timestamp": existing.get("first_seen", existing.get("detected_at", now - timedelta(seconds=1)))
        })
    status_history.append({"status": status, "timestamp": now})

    update_data = {
        "repair_status": status,
        "status_history": status_history
    }

    await db.potholes.update_one({"_id": ObjectId(pothole_id)}, {"$set": update_data})
    doc = await db.potholes.find_one({"_id": ObjectId(pothole_id)})

    clear_road_health_cache()
    await broadcast_pothole(doc)
    return doc_to_response(doc)