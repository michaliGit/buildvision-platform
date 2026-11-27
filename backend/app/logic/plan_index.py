"""Lookup helpers over the plan dict."""
from __future__ import annotations

ID_COLLECTIONS = [
    "rooms", "walls", "partitions", "windows", "doors", "entrance",
    "furniture", "elec", "syslines", "columns", "posts",
]


def find_element(plan: dict, element_id: str) -> tuple[str, dict] | None:
    for coll in ID_COLLECTIONS:
        for el in plan.get(coll, []):
            if el.get("id") == element_id:
                return coll, el
    return None


def room_by_id(plan: dict, room_id: str) -> dict | None:
    for r in plan.get("rooms", []):
        if r["id"] == room_id:
            return r
    return None


def room_label(room: dict) -> str:
    names = room.get("names") or []
    return " · ".join(names) if names else "ללא שם בקובץ"
