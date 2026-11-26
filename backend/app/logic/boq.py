"""Bill of quantities (docs/01-kamuyot.md, step 1 rows + step 3 room filter). Pure functions."""
from __future__ import annotations

from collections import OrderedDict

from app.logic.facts import computed

DISCIPLINE_HE = {
    "architecture": "אדריכלות",
    "electrical": "חשמל ותקשורת",
    "systems": "מערכות",
    "furniture": "ריהוט",
    "structure": "קונסטרוקציה",
}
DISCIPLINES = list(DISCIPLINE_HE)

ELEC_NO_DESC = "סמל ללא שורה במקרא"
FURN_NO_NAME = "פריט ריהוט ללא שם בקובץ"


def partition_type(p: dict) -> str:
    if p.get("gyps"):
        return "מחיצת גבס"
    note = p.get("note")
    if note and note.get("t"):
        return note["t"]
    return "מחיצה דקה"


def partition_item(p: dict) -> str:
    return f'{partition_type(p)} {round(p["thick"], 1):.1f} ס"מ'


def _el(e: dict, value) -> dict:
    return {"id": e["id"], "value": value, "src": e.get("src")}


def _row(discipline: str, item: str, quantity: dict, elements: list[dict], secondary: dict | None = None) -> dict:
    return {
        "discipline": discipline,
        "discipline_he": DISCIPLINE_HE[discipline],
        "item": item,
        "quantity": quantity,
        "elements": elements,
        "secondary": secondary,
    }


def _count_row(discipline: str, item: str, els: list[dict], what: str, unit: str = "unit") -> dict:
    return _row(discipline, item,
                computed(len(els), f"ספירת {what}: {len(els)}", unit=unit),
                [_el(e, 1) for e in els])


def _length_row(discipline: str, item: str, els: list[dict], what: str) -> dict:
    total = sum(e["len"] for e in els) / 100
    return _row(discipline, item,
                computed(total, f"סכום len של {len(els)} {what}, חלקי 100", unit="m"),
                [_el(e, e["len"] / 100) for e in els])


def _group(items: list[dict], key) -> "OrderedDict[str, list[dict]]":
    groups: OrderedDict[str, list[dict]] = OrderedDict()
    for it in items:
        groups.setdefault(key(it), []).append(it)
    return groups


def in_room(el: dict, room_id: str) -> bool:
    """Computed room assignment. Doors use `rooms` (list); others `room` ("" = unassigned)."""
    if "rooms" in el:
        return room_id in (el.get("rooms") or [])
    return bool(el.get("room")) and el.get("room") == room_id


def build_boq(plan: dict, discipline: str | None = None, room: str | None = None) -> dict:
    rows: list[dict] = []
    notes: list[dict] = []
    rooms = plan["rooms"]
    if room:
        rooms = [r for r in rooms if r["id"] == room]

    def f(els: list[dict]) -> list[dict]:
        return [e for e in els if in_room(e, room)] if room else list(els)

    # --- architecture
    if rooms:
        total = sum(r["area"] for r in rooms)
        rows.append(_row("architecture", "שטח רצפה נטו",
                         computed(total, f"סכום area של {len(rooms)} חללים", unit="m2"),
                         [{"id": r["id"], "value": r["area"], "src": r.get("src")} for r in rooms]))
    if not room:
        groups = _group(plan["partitions"], partition_item)
        for item in sorted(groups):
            rows.append(_length_row("architecture", item, groups[item], "מחיצות"))
    doors = f(plan["doors"])
    if doors:
        rows.append(_count_row("architecture", "דלת פנים", doors, "דלתות"))
    if not room:
        rows.append(_count_row("architecture", "כניסה", plan["entrance"], "כניסות"))
    windows = f(plan["windows"])
    if windows:
        w_total = sum(w["width"] for w in windows) / 100
        rows.append(_row("architecture", "חלון",
                         computed(len(windows), f"ספירת חלונות: {len(windows)}", unit="unit"),
                         [_el(w, 1) for w in windows],
                         secondary=computed(w_total, f"סכום width של {len(windows)} חלונות, חלקי 100",
                                            unit="m")))
    if not room:
        walls = plan["walls"]
        fp = sum(w["footprint_m2"] for w in walls)
        rows.append(_row("architecture", "קירות קיימים",
                         computed(len(walls), f"ספירת גופי קיר: {len(walls)}", unit="unit"),
                         [_el(w, w["footprint_m2"]) for w in walls],
                         secondary=computed(fp, f"סכום footprint_m2 של {len(walls)} קירות (היטל במבט על)",
                                            unit="m2")))
        notes.append({"discipline": "architecture", "text": "שטח פני קיר: אין בקובץ (אין גובה קיר)",
                      "kind": "missing"})

    # --- electrical
    groups = _group(f(plan["elec"]), lambda e: e.get("desc") or ELEC_NO_DESC)
    for item, els in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        rows.append(_count_row("electrical", item, els, "נקודות", unit="point"))

    # --- systems
    if not room:
        groups = _group(plan["syslines"], lambda s: (s.get("label") or {}).get("t") or "קו מערכות ללא תווית")
        for item in sorted(groups):
            rows.append(_length_row("systems", item, groups[item], "קווים"))

    # --- furniture
    groups = _group(f(plan["furniture"]), lambda x: x.get("name") or FURN_NO_NAME)
    for item, els in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        rows.append(_count_row("furniture", item, els, "פריטים"))

    # --- structure
    if not room:
        rows.append(_count_row("structure", "עמוד עגול", plan["columns"], "עמודים עגולים"))
        rows.append(_count_row("structure", "עמוד מרובע", plan["posts"], "עמודים מרובעים"))
        notes.append({"discipline": "structure", "text": "נתוני שלד: אין בקובץ", "kind": "missing"})

    if room:
        notes.append({"discipline": None, "text": "שיוך לחלל: מחושב", "kind": "computed"})
        notes.append({"discipline": None,
                      "text": "מחיצות, קירות, כניסה, קווי מערכות ועמודים לא משויכים לחלל, ולכן לא מוצגים בסינון לפי חלל",
                      "kind": "computed"})

    if discipline:
        rows = [r for r in rows if r["discipline"] == discipline]
        notes = [n for n in notes if n["discipline"] in (discipline, None)]
    return {"rows": rows, "notes": notes}
