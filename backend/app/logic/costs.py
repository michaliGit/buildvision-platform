"""Prices and loads (docs/01-kamuyot.md step 4). Pure functions.

Formula (our assumption, awaiting Sarah's approval):
    direct      = quantity × price
    waste       = direct × waste%
    overhead    = (direct + waste) × overhead%
    contingency = (direct + waste + overhead) × contingency%
    total       = direct + waste + overhead + contingency
Always on the EXACT quantity. An empty input never becomes 0: every value that depends on it is null (missing).
"""
from __future__ import annotations

from app.logic.boq import DISCIPLINE_HE, DISCIPLINES
from app.logic.facts import computed, fact, missing

CURRENCY = "₪"
PERCENT_FIELDS = ("waste", "overhead", "contingency")
PERCENT_HE = {"waste": "פחת", "overhead": "תקורות", "contingency": "בלתי צפוי"}
LOAD_LINES = ("waste", "overhead", "contingency", "total")
PERCENT_SCOPES = ("project", *DISCIPLINES)
FORMULA_NOTE = (
    "הנחה שלנו, ממתינה לאישור של שרה: עלות ישירה = כמות × מחיר ליחידה · "
    "פחת = עלות ישירה × אחוז פחת · תקורות = (עלות ישירה + פחת) × אחוז תקורות · "
    "בלתי צפוי = (עלות ישירה + פחת + תקורות) × אחוז בלתי צפוי · "
    "עלות כוללת = עלות ישירה + פחת + תקורות + בלתי צפוי. "
    "החישוב על הכמות המדויקת; עיגול בתצוגה בלבד."
)


def row_key(row: dict) -> str:
    return f"{row['discipline']}|{row['item']}"


def percent_fact(value: float | None) -> dict:
    if value is None:
        return missing()
    f = fact(value, "manual", unit="%")
    if value > 100:
        f["warning"] = "מעל 100%"
    return f


def effective_percent(percents: dict, discipline: str, field: str) -> tuple[float | None, str | None]:
    """Discipline override if set, else project value. Returns (value, 'discipline'|'project'|None)."""
    v = (percents.get(discipline) or {}).get(field)
    if v is not None:
        return v, "discipline"
    v = (percents.get("project") or {}).get(field)
    if v is not None:
        return v, "project"
    return None, None


def _money(value: float | None, formula: str, note_if_missing: str) -> dict:
    if value is None:
        return missing(note_if_missing)
    return computed(value, formula, unit=CURRENCY)


def row_cost(quantity: float, price: float | None, discipline: str, percents: dict,
             include_loads: bool) -> dict:
    price_f = missing("אין מחיר") if price is None else fact(price, "manual", unit=CURRENCY)
    direct = None if price is None else quantity * price
    out = {
        "price": price_f,
        "direct": _money(direct, f"כמות {quantity} × מחיר {price}", "אין מחיר"),
    }
    if not include_loads:
        return out

    base = direct
    values: dict[str, float | None] = {}
    for field in PERCENT_FIELDS:
        pct, source = effective_percent(percents, discipline, field)
        line = None if base is None or pct is None else base * pct / 100
        values[field] = line
        if base is None:
            out[field] = missing("אין מחיר")
        elif pct is None:
            out[field] = missing(f"אין אחוז {PERCENT_HE[field]}")
        else:
            where = (f"דריסה לדיסציפלינה {DISCIPLINE_HE[discipline]}" if source == "discipline"
                     else "אחוז ברמת הפרויקט")
            out[field] = computed(line, f"{base} × {pct}% ({PERCENT_HE[field]}, {where})", unit=CURRENCY)
        base = None if base is None or line is None else base + line
    out["total"] = _money(base, "עלות ישירה + פחת + תקורות + בלתי צפוי",
                          "אין מחיר" if direct is None else "חסר אחוז")
    return out


def _sum_line(rows: list[dict], line: str) -> dict:
    priced = [r for r in rows if r["cost"]["price"]["value"] is not None]
    if not priced:
        return missing("אין שורות עם מחיר")
    vals = [r["cost"][line]["value"] for r in priced]
    if any(v is None for v in vals):
        return missing("חסר אחוז")
    return computed(sum(vals), f"סכום {len(priced)} שורות עם מחיר", unit=CURRENCY)


def _summary(rows: list[dict], include_loads: bool) -> dict:
    s = {"direct": _sum_line(rows, "direct"),
         "rows_without_price": sum(1 for r in rows if r["cost"]["price"]["value"] is None)}
    if include_loads:
        for line in LOAD_LINES:
            s[line] = _sum_line(rows, line)
    return s


def apply_costs(boq: dict, prices: dict[str, float], percents: dict, role: str, net_area: float) -> dict:
    """Adds `key` + `cost` to each row (contractor/developer) and returns the `costs` block."""
    include_loads = role == "developer"
    for r in boq["rows"]:
        r["key"] = row_key(r)
        r["cost"] = row_cost(r["quantity"]["value"], prices.get(r["key"]), r["discipline"], percents, include_loads)

    disciplines = {d: _summary([r for r in boq["rows"] if r["discipline"] == d], include_loads)
                   for d in DISCIPLINES if any(r["discipline"] == d for r in boq["rows"])}
    project = _summary(boq["rows"], include_loads)
    if not include_loads:
        return {"summary": {"project": project, "disciplines": disciplines}}

    total = project["total"]["value"]
    project["per_m2"] = (missing("אין עלות כוללת") if total is None
                         else computed(total / net_area, f"עלות כוללת חלקי שטח רצפה נטו {net_area} מ\"ר",
                                       unit=f"{CURRENCY}/m2"))
    return {
        "percents": {
            "project": {f: percent_fact((percents.get("project") or {}).get(f)) for f in PERCENT_FIELDS},
            "disciplines": {
                d: {f: (percent_fact(v) if (v := (percents.get(d) or {}).get(f)) is not None else None)
                    for f in PERCENT_FIELDS}
                for d in DISCIPLINES
            },
        },
        "summary": {"project": project, "disciplines": disciplines},
        "formula_note": FORMULA_NOTE,
    }
