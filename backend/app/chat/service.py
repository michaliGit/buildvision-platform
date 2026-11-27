"""Chat: trained intent classifier + entity extraction + answers built only from data (Facts)."""
from __future__ import annotations

import re
from functools import lru_cache

import joblib

from app.chat.train import MODEL_PATH, train
from app.logic.boq import build_boq
from app.logic.elements import element_details
from app.logic.facts import missing
from app.logic.plan_index import room_by_id, room_label
from app.logic.rooms import area_fact, perim_fact, room_contents

CONFIDENCE_THRESHOLD = 0.45
UNIT_HE = {"m": "מ׳", "m2": 'מ"ר', "cm": 'ס"מ', "unit": "יח׳", "point": "נקודות"}
HELP = ('לא הבנתי, אפשר לשאול על: שטח של חלל ("מה השטח של חדר המנכל?"), מה יש בחלל, '
        'פרטי אלמנט ("ספר לי על P1"), כמויות ("כמה מטר מחיצות גבס?"), או מה חסר בקובץ.')
ID_RE = re.compile(r"(?<![A-Za-z])(WN|EN|PS|R|P|D|F|E|S|C|W)(\d+)(?![A-Za-z0-9])", re.IGNORECASE)


def ensure_model() -> None:
    if not MODEL_PATH.exists():
        train(verbose=False)
    _model.cache_clear()


@lru_cache(maxsize=1)
def _model():
    if not MODEL_PATH.exists():
        train(verbose=False)
    return joblib.load(MODEL_PATH)


def classify(message: str) -> tuple[str, float]:
    model = _model()
    proba = model.predict_proba([message])[0]
    best = int(proba.argmax())
    intent, conf = str(model.classes_[best]), float(proba[best])
    if conf < CONFIDENCE_THRESHOLD:
        return "unknown", conf
    return intent, conf


# ---------------- entities

def extract_ids(message: str) -> list[str]:
    out = []
    for prefix, num in ID_RE.findall(message):
        i = f"{prefix.upper()}{num}"
        if i not in out:
            out.append(i)
    return out


def extract_rooms(plan: dict, message: str) -> list[str]:
    """Rooms whose file name appears in the message (Hebrew prefixes like ה/ב/ל are tolerated by substring).

    A multi-word name ("ישיבות עתידי") also matches on any of its words of 3+ letters,
    so "חדר הישיבות" finds it. Exact full-name matches win over word matches.
    """
    full, partial = [], []
    for r in plan["rooms"]:
        names = [n for n in (r.get("names") or []) if n]
        if any(n in message for n in names):
            full.append(r["id"])
        elif any(w in message for n in names for w in n.split() if len(w) >= 3):
            partial.append(r["id"])
    return full or partial


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:,.2f}".rstrip("0").rstrip(".") if v != int(v) else f"{int(v)}"
    return str(v)


def _fact_text(f: dict) -> str:
    if f["kind"] == "missing" or f["value"] is None:
        return f.get("note") or "אין בקובץ"
    v = f["value"]
    if isinstance(v, bool):
        return "כן" if v else "לא"
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    unit = UNIT_HE.get(f.get("unit") or "", "")
    return f"{_fmt(v)} {unit}".strip()


def _resp(intent, conf, answer, facts=None, ids=None, status="ok") -> dict:
    return {"intent": intent, "confidence": round(conf, 3), "answer": answer,
            "facts": facts or [], "element_ids": ids or [], "status": status}


# ---------------- intents

def _rooms_in(plan, message, ids) -> list[str]:
    rooms = [i for i in ids if i.startswith("R") and room_by_id(plan, i)]
    for r in extract_rooms(plan, message):
        if r not in rooms:
            rooms.append(r)
    return rooms


def _ask_room(plan, intent, conf) -> dict:
    names = "; ".join(f"{r['id']} ({room_label(r)})" for r in plan["rooms"])
    return _resp(intent, conf, f"לא זיהיתי חלל בשאלה. החללים בקובץ: {names}", status="unknown")


def _room_area(plan, message, ids, conf) -> dict:
    rooms = _rooms_in(plan, message, ids)
    if not rooms:
        return _ask_room(plan, "room_area", conf)
    lines, facts = [], []
    for rid in rooms:
        r = room_by_id(plan, rid)
        a, p = area_fact(r), perim_fact(r)
        facts += [a, p]
        lines.append(f"שטח {rid} ({room_label(r)}): {_fmt(r['area'])} מ\"ר, היקף {_fmt(r['perim'])} מ׳ (מהקובץ)")
    return _resp("room_area", conf, "\n".join(lines), facts, rooms)


def _room_contents(plan, message, ids, conf) -> dict:
    rooms = _rooms_in(plan, message, ids)
    if not rooms:
        return _ask_room(plan, "room_contents", conf)
    lines, facts, el_ids = [], [], []
    for rid in rooms:
        r = room_by_id(plan, rid)
        c = room_contents(plan, rid)
        elec = "; ".join(f"{d['desc'] or 'סמל ללא שורה במקרא'}: {d['count']['value']}" for d in c["elec_by_desc"])
        lines.append(
            f"{rid} ({room_label(r)}), שיוך מחושב: רהיטים {c['furniture']['value']}, "
            f"נקודות חשמל {c['elec_total']['value']}" + (f" ({elec})" if elec else "") +
            f", חלונות {c['windows']['value']}"
            + (f" ({', '.join(c['windows']['ids'])})" if c['windows']['ids'] else "") +
            f", דלתות {c['doors']['value']}" + (f" ({', '.join(c['doors']['ids'])})" if c['doors']['ids'] else ""))
        facts += [c["furniture"], c["elec_total"], c["windows"], c["doors"]]
        el_ids += [rid] + c["furniture"]["ids"] + c["elec_total"]["ids"] + c["windows"]["ids"] + c["doors"]["ids"]
    return _resp("room_contents", conf, "\n".join(lines), facts, el_ids)


def _element_info(plan, message, ids, conf) -> dict:
    if not ids:
        rooms = extract_rooms(plan, message)
        if rooms:
            return _room_contents(plan, message, rooms, conf) | {"intent": "element_info"}
        return _resp("element_info", conf, "לא זיהיתי מזהה אלמנט (למשל P1, D1, WN1, E5).", status="unknown")
    lines, facts, found, status = [], [], [], "ok"
    for i in ids:
        d = element_details(plan, i)
        if d is None:
            lines.append(f"{i}: לא נמצא בקובץ")
            status = "missing"
            continue
        found.append(i)
        parts = [f"{fl['label']}: {_fact_text(fl['fact'])}" for fl in d["fields"]]
        facts += [fl["fact"] for fl in d["fields"]]
        lines.append(f"{d['type_he']} {i}: " + " · ".join(parts) + f" (מקור: {d['src']})")
    if found:
        status = "ok"
    return _resp("element_info", conf, "\n".join(lines), facts, found, status)


BOQ_KEYWORDS = [
    ("זכוכית", lambda r: "זכוכית" in r["item"]),
    ("גבס", lambda r: "גבס" in r["item"]),
    ("מחיצ", lambda r: bool(r["elements"]) and re.fullmatch(r"P\d+", r["elements"][0]["id"]) is not None),
    ("דלת", lambda r: r["item"] == "דלת פנים"),
    ("דלתות", lambda r: r["item"] == "דלת פנים"),
    ("כניסה", lambda r: r["item"] == "כניסה"),
    ("חלון", lambda r: r["item"] == "חלון"),
    ("קיר", lambda r: r["item"] == "קירות קיימים"),
    ("חשמל", lambda r: r["discipline"] == "electrical"),
    ("שקע", lambda r: "שקע" in r["item"]),
    ("מערכות", lambda r: r["discipline"] == "systems"),
    ("ריהוט", lambda r: r["discipline"] == "furniture"),
    ("רהיט", lambda r: r["discipline"] == "furniture"),
    ("עמוד", lambda r: r["discipline"] == "structure"),
    ("אדריכל", lambda r: r["discipline"] == "architecture"),
    ("שטח", lambda r: r["item"] == "שטח רצפה נטו"),
]


def _boq_quantity(plan, message, ids, conf, role) -> dict:
    if role == "client":
        return _resp("boq_quantity", conf, "אין הרשאה: כמויות זמינות לקבלן וליזם בלבד.", status="forbidden")
    rooms = _rooms_in(plan, message, ids)
    room = rooms[0] if rooms else None
    rows = build_boq(plan, room=room)["rows"]
    matched = []
    for kw, pred in BOQ_KEYWORDS:
        if kw in message:
            matched = [r for r in rows if pred(r)]
            if matched:
                break
    scope = f" בחלל {room} (שיוך מחושב)" if room else ""
    if not matched:
        by_disc: dict[str, int] = {}
        for r in rows:
            by_disc[r["discipline_he"]] = by_disc.get(r["discipline_he"], 0) + 1
        summary = ", ".join(f"{k}: {v} סעיפים" for k, v in by_disc.items())
        return _resp("boq_quantity", conf,
                     f"כתב הכמויות{scope} כולל {summary}. אפשר לשאול על סעיף מסוים, למשל מחיצות גבס, חלונות או חשמל.")
    lines, facts, el_ids = [], [], []
    for r in matched:
        q = r["quantity"]
        line = f"{r['item']}: {_fact_text(q)}"
        if r["secondary"]:
            line += f" ({_fact_text(r['secondary'])})"
        lines.append(line + f" · {q['formula']}")
        facts.append(q)
        el_ids += [e["id"] for e in r["elements"]]
    units = {r["quantity"]["unit"] for r in matched}
    if len(matched) > 1 and len(units) == 1:
        total = sum(r["quantity"]["value"] for r in matched)
        lines.append(f"סה\"כ: {_fmt(total)} {UNIT_HE.get(units.pop(), '')} (סכום {len(matched)} סעיפים, מחושב)")
    return _resp("boq_quantity", conf, f"כמויות{scope}:\n" + "\n".join(lines), facts, el_ids)


GLOBAL_MISSING = [
    ("גובה קירות", "אין בקובץ גובה קירות; בתלת־ממד מוצג גובה תצוגה בלבד"),
    ("גובה תקרה", "אין בקובץ כנתון מפורש (יש הערות H= מהסקר, לא מפורשות כגובה תקרה)"),
    ("מפלסים", "אין בקובץ: קומה אחת"),
    ("נתוני שלד", "אין בקובץ: בטון, זיון, תבניות"),
    ("הרכב שכבות קיר", "אין בקובץ"),
    ("מחירים ועלויות", "אין בקובץ: מוזנים ידנית"),
    ("שטח פני קיר", "אין בקובץ (אין גובה קיר)"),
]


def _missing_data(plan, message, ids, conf) -> dict:
    lines, facts, found = [], [], []
    for i in ids:
        d = element_details(plan, i)
        if d is None:
            lines.append(f"{i}: לא נמצא בקובץ")
            continue
        miss = [fl for fl in d["fields"] if fl["fact"]["kind"] == "missing"]
        found.append(i)
        facts += [fl["fact"] for fl in miss]
        lines.append(f"{d['type_he']} {i}: " + (", ".join(fl["label"] for fl in miss) + " · אין בקובץ"
                                               if miss else "אין שדות חסרים"))
    if not lines:
        for label, text in GLOBAL_MISSING:
            lines.append(f"{label}: {text}")
            facts.append(missing(f"{label}: {text}"))
    return _resp("missing_data", conf, "נתונים שאין בקובץ:\n" + "\n".join(lines), facts, found, status="missing")


def answer(plan: dict, message: str, role: str) -> dict:
    message = (message or "").strip()
    if not message:
        return _resp("unknown", 0.0, HELP, status="unknown")
    intent, conf = classify(message)
    ids = extract_ids(message)
    if intent == "room_area":
        return _room_area(plan, message, ids, conf)
    if intent == "room_contents":
        return _room_contents(plan, message, ids, conf)
    if intent == "element_info":
        return _element_info(plan, message, ids, conf)
    if intent == "boq_quantity":
        return _boq_quantity(plan, message, ids, conf, role)
    if intent == "missing_data":
        return _missing_data(plan, message, ids, conf)
    return _resp("unknown", conf, HELP, status="unknown")
