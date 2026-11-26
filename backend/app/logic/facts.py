"""Fact helpers: every user-facing value carries its data kind (see docs/api-contract.md)."""
from __future__ import annotations

from typing import Any


def fact(value: Any, kind: str, unit: str | None = None, formula: str | None = None,
         src: str | None = None, note: str | None = None) -> dict:
    f = {"value": value, "kind": kind, "unit": unit, "formula": formula, "src": src}
    if note is not None:
        f["note"] = note
    return f


def file_fact(value: Any, unit: str | None = None, src: str | None = None) -> dict:
    """A value read directly from plan-data.json. None becomes a `missing` Fact (never 0)."""
    if value is None:
        return missing()
    return fact(value, "file", unit=unit, src=src)


def computed(value: Any, formula: str, unit: str | None = None, note: str | None = None) -> dict:
    return fact(value, "computed", unit=unit, formula=formula, note=note)


def missing(note: str = "אין בקובץ") -> dict:
    return fact(None, "missing", note=note)


ROOM_ASSIGN_FORMULA = "שיוך לחלל לפי מיקום האלמנט (מחושב, לא נתון מהקובץ)"
