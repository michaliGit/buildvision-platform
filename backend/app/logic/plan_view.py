"""Raw geometry for the 3D viewer (GET /api/plan). Pure function."""
from __future__ import annotations

from app.logic.facts import missing

BOUNDS = {"minX": 485.3, "maxX": 4342.9, "minY": 641.0, "maxY": 2296.0}
DISPLAY_WALL_HEIGHT_CM = 300


def _pick(items: list[dict], *keys: str) -> list[dict]:
    return [{k: it.get(k) for k in keys} for it in items]


def plan_geometry(plan: dict) -> dict:
    return {
        "bounds": dict(BOUNDS),
        "display_wall_height_cm": {
            "value": DISPLAY_WALL_HEIGHT_CM,
            "kind": "display_assumption",
            "note": "אין בקובץ גובה קירות. גובה תצוגה בלבד, לא נכנס לחישוב",
        },
        "levels": missing(),
        "rooms": _pick(plan["rooms"], "id", "names", "poly", "holes"),
        "walls": _pick(plan["walls"], "id", "pts"),
        "partitions": _pick(plan["partitions"], "id", "bb", "gyps"),
        "windows": _pick(plan["windows"], "id", "bb"),
        "doors": _pick(plan["doors"], "id", "a", "b", "hinge", "open"),
        "entrance": _pick(plan["entrance"], "id", "a", "b"),
        "furniture": _pick(plan["furniture"], "id", "poly"),
        "elec": _pick(plan["elec"], "id", "p"),
        "syslines": _pick(plan["syslines"], "id", "pts"),
        "columns": _pick(plan["columns"], "id", "c", "r"),
        "posts": _pick(plan["posts"], "id", "bb"),
        "labels": _pick(plan["labels"], "t", "c", "room"),
    }
