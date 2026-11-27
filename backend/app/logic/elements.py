"""Element details (docs/02-tochnit.md step 3, "when an element is selected"). Pure functions."""
from __future__ import annotations

from app.logic.boq import ELEC_NO_DESC
from app.logic.facts import ROOM_ASSIGN_FORMULA, computed, fact, file_fact, missing
from app.logic.plan_index import find_element

TYPES = {
    "rooms": ("room", "חלל"),
    "walls": ("wall", "קיר קיים"),
    "partitions": ("partition", "מחיצה"),
    "windows": ("window", "חלון"),
    "doors": ("door", "דלת"),
    "entrance": ("entrance", "כניסה"),
    "furniture": ("furniture", "רהיט"),
    "elec": ("elec", "נקודת חשמל"),
    "syslines": ("sysline", "קו מערכות"),
    "columns": ("column", "עמוד עגול"),
    "posts": ("post", "עמוד מרובע"),
}


def _field(label: str, f: dict) -> dict:
    return {"label": label, "fact": f}


def _room_field(room_id: str | None) -> dict:
    if not room_id:
        return _field("חלל", computed(None, ROOM_ASSIGN_FORMULA, note="לא שויך לחלל"))
    return _field("חלל", computed(room_id, ROOM_ASSIGN_FORMULA))


def _layers() -> dict:
    return _field("הרכב שכבות", missing())


def _fields(coll: str, e: dict) -> list[dict]:
    src = e.get("src")
    if coll == "rooms":
        return [
            _field("שמות", fact(list(e.get("names") or []), "file") if e.get("names")
                   else missing("ללא שם בקובץ")),
            _field("שטח", fact(e["area"], "file", unit="m2", src=src)),
            _field("היקף", fact(e["perim"], "file", unit="m", src=src)),
            _field("מפלס", missing()),
        ]
    if coll == "partitions":
        note = e.get("note")
        h = e.get("height")
        return [
            _field("עובי", file_fact(e.get("thick"), unit="cm", src=src)),
            _field("אורך", computed(e["len"] / 100, "len חלקי 100", unit="m")),
            _field("מילוי גבס בקובץ", file_fact(e.get("gyps"), src=src)),
            _field("הערת מקרא", fact(note["t"], "file", src=note.get("src")) if note and note.get("t")
                   else missing()),
            _field("גובה", _height_fact(h)),
            _layers(),
        ]
    if coll == "walls":
        return [
            _field("שטח היטל", file_fact(e.get("footprint_m2"), unit="m2", src=src)),
            _field("גובה", missing()),
            _layers(),
        ]
    if coll == "doors":
        rooms = list(e.get("rooms") or [])
        fields = [
            _field("רוחב כנף", file_fact(e.get("leaf"), unit="cm", src=src)),
            _field("רוחב משקוף", file_fact(e.get("frame"), unit="cm", src=src)),
            _field("גובה", _height_fact(e.get("height"))),
            _field("חללים מחוברים", computed(rooms, ROOM_ASSIGN_FORMULA) if rooms
                   else computed(None, ROOM_ASSIGN_FORMULA, note="לא שויך לחלל")),
        ]
        if len(rooms) == 1:
            fields.append(_field("צד שני", computed(None, ROOM_ASSIGN_FORMULA, note="צד שני: לא שויך לחלל")))
        return fields
    if coll == "entrance":
        return [_field("רוחב כנף", file_fact(e.get("leaf"), unit="cm", src=src)), _field("גובה", missing())]
    if coll == "windows":
        notes = e.get("notes") or []
        fields = [_field("רוחב", file_fact(e.get("width"), unit="cm", src=src))]
        if notes:
            for n in notes:
                fields.append(_field("הערה", fact(n.get("t"), "file", src=n.get("src"))))
        else:
            fields.append(_field("הערה", missing()))
        fields.append(_room_field(e.get("room")))
        return fields
    if coll == "furniture":
        return [
            _field("שם", fact(e["name"], "file", src=src) if e.get("name") else missing("ללא שם בקובץ")),
            _field("רוחב", file_fact(e.get("w"), unit="cm", src=src)),
            _field("עומק", file_fact(e.get("d"), unit="cm", src=src)),
            _field("גובה", _height_fact(e.get("height"))),
            _room_field(e.get("room")),
        ]
    if coll == "elec":
        H = e.get("H")
        return [
            _field("תיאור", fact(e["desc"], "file", src=e.get("desc_src")) if e.get("desc")
                   else missing(ELEC_NO_DESC)),
            _field("גובה התקנה", fact(H["t"], "file", src=H.get("src")) if H and H.get("t") else missing()),
            _field("קיר נושא", fact(e["host"], "file", src=src) if e.get("host") else missing()),
            _room_field(e.get("room")),
        ]
    if coll == "syslines":
        label = e.get("label") or {}
        return [
            _field("אורך", computed(e["len"] / 100, "len חלקי 100", unit="m")),
            _field("תווית", fact(label["t"], "file", src=label.get("src")) if label.get("t") else missing()),
        ]
    if coll == "columns":
        return [_field("רדיוס", file_fact(e.get("r"), unit="cm", src=src))]
    if coll == "posts":
        return [_field("גובה", missing())]
    return []


def _height_fact(h) -> dict:
    """height is null or {v, src} (doors) / {t, src}; anything else → missing."""
    if not h:
        return missing()
    if isinstance(h, dict):
        v = h.get("v", h.get("t"))
        if v is None:
            return missing()
        return fact(v, "file", unit="cm" if "v" in h else None, src=h.get("src"))
    return fact(h, "file")


def element_details(plan: dict, element_id: str) -> dict | None:
    found = find_element(plan, element_id)
    if not found:
        return None
    coll, e = found
    t, t_he = TYPES[coll]
    return {"id": e["id"], "type": t, "type_he": t_he, "src": e.get("src"), "fields": _fields(coll, e)}
