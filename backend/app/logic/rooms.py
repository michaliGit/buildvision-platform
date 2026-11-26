"""Room list + room details (docs/02-tochnit.md step 3, "when a room is selected"). Pure functions."""
from __future__ import annotations

from collections import OrderedDict

from app.logic.boq import ELEC_NO_DESC, in_room
from app.logic.facts import ROOM_ASSIGN_FORMULA, computed, fact, missing
from app.logic.plan_index import room_by_id


def area_fact(room: dict) -> dict:
    return fact(room["area"], "file", unit="m2", src=room.get("src"))


def perim_fact(room: dict) -> dict:
    return fact(room["perim"], "file", unit="m", src=room.get("src"))


def list_rooms(plan: dict) -> list[dict]:
    return [{"id": r["id"], "names": list(r.get("names") or []), "area": area_fact(r), "perim": perim_fact(r)}
            for r in plan["rooms"]]


def height_notes(plan: dict, room_id: str) -> list[dict]:
    """survey_notes that start with 'H=' and are assigned to the room, as-is (not interpreted)."""
    return [{"t": n["t"], "src": n.get("src"), "kind": "file"}
            for n in plan.get("survey_notes", [])
            if n.get("room") == room_id and str(n.get("t", "")).startswith("H=")]


def _ids_fact(els: list[dict], what: str) -> dict:
    f = computed(len(els), f"ספירת {what} ששויכו לחלל ({ROOM_ASSIGN_FORMULA})", unit="unit")
    f["ids"] = [e["id"] for e in els]
    return f


def room_contents(plan: dict, room_id: str) -> dict:
    furniture = [x for x in plan["furniture"] if in_room(x, room_id)]
    elec = [x for x in plan["elec"] if in_room(x, room_id)]
    windows = [x for x in plan["windows"] if in_room(x, room_id)]
    doors = [x for x in plan["doors"] if in_room(x, room_id)]

    groups: OrderedDict[str | None, list[dict]] = OrderedDict()
    for e in elec:
        groups.setdefault(e.get("desc") or None, []).append(e)
    elec_by_desc = []
    for desc, els in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0] or "")):
        label = desc if desc is not None else ELEC_NO_DESC
        elec_by_desc.append({
            "desc": desc,
            "count": computed(len(els), f"ספירת נקודות חשמל '{label}' ששויכו לחלל", unit="point"),
            "ids": [e["id"] for e in els],
        })
    return {
        "furniture": _ids_fact(furniture, "רהיטים"),
        "elec_total": _ids_fact(elec, "נקודות חשמל"),
        "elec_by_desc": elec_by_desc,
        "windows": _ids_fact(windows, "חלונות"),
        "doors": _ids_fact(doors, "דלתות (שדה rooms כולל את החלל)"),
    }


def room_details(plan: dict, room_id: str) -> dict | None:
    room = room_by_id(plan, room_id)
    if room is None:
        return None
    return {
        "id": room["id"],
        "names": {"value": list(room.get("names") or []), "kind": "file"},
        "area": area_fact(room),
        "perim": perim_fact(room),
        "height_notes": height_notes(plan, room_id),
        "ceiling_height": missing("גובה תקרה: אין בקובץ כנתון מפורש"),
        "level": missing(),
        "contents": room_contents(plan, room_id),
    }
