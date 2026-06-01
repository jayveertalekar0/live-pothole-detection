from app.db.database import db
from datetime import datetime, timedelta

async def get_summary():
    """Return total potholes, critical count, repair rate."""
    total = await db.potholes.count_documents({})
    critical = await db.potholes.count_documents({"severity": "Critical"})
    repaired = await db.potholes.count_documents({"repair_status": "fixed"})
    repair_rate = round(repaired / total, 2) if total else 0
    return {
        "total_potholes": total,
        "critical_count": critical,
        "repair_rate": repair_rate,
        "days_active": 30  # can be made dynamic
    }

async def get_severity_distribution():
    """Return counts per severity level."""
    pipeline = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cursor = db.potholes.aggregate(pipeline)
    result = {}
    async for doc in cursor:
        result[doc["_id"]] = doc["count"]
    return result

async def get_daily_detections(days: int = 30):
    """Time‑series of potholes per day for the last `days` days."""
    since = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"detected_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$detected_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    cursor = db.potholes.aggregate(pipeline)
    result = []
    async for doc in cursor:
        result.append({"date": doc["_id"], "count": doc["count"]})
    return result