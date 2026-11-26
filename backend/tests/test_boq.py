"""Acceptance numbers from docs/01-kamuyot.md step 1 and step 3."""
import re

import pytest

from app.logic.boq import build_boq


def rows_by(boq, discipline):
    return [r for r in boq["rows"] if r["discipline"] == discipline]


def row(boq, item):
    matches = [r for r in boq["rows"] if r["item"] == item]
    assert len(matches) == 1, f"row {item!r}: {len(matches)} matches"
    return matches[0]


@pytest.fixture(scope="module")
def boq(plan):
    return build_boq(plan)


def test_floor_area(boq):
    r = row(boq, "שטח רצפה נטו")
    assert round(r["quantity"]["value"], 2) == 422.46
    assert len(r["elements"]) == 8
    assert r["quantity"]["kind"] == "computed" and r["quantity"]["formula"]


PARTITIONS = [
    ('חיפוי קיר בגבס 7.4 ס"מ', 3.70, 1),
    ('מחיצה אקוסטית 4.7 ס"מ', 1.68, 1),
    ('מחיצה אקוסטית 5.1 ס"מ', 2.52, 2),
    ('מחיצה דקה 10.0 ס"מ', 3.68, 1),
    ('מחיצה דקה 4.6 ס"מ', 1.11, 1),
    ('מחיצת גבס 10.0 ס"מ', 14.25, 6),
    ('מחיצת גבס 10.3 ס"מ', 0.20, 1),
    ('מחיצת גבס 10.4 ס"מ', 0.27, 1),
    ('מחיצת גבס 15.0 ס"מ', 12.73, 3),
    ('מחיצת גבס 21.9 ס"מ', 12.07, 2),
    ('מחיצת גבס 24.9 ס"מ', 2.27, 1),
    ('מחיצת גבס 3.6 ס"מ', 0.15, 1),
    ('קיר זכוכית 5.0 ס"מ', 4.76, 2),
]


def partition_rows(boq):
    return [r for r in boq["rows"] if r["elements"] and re.fullmatch(r"P\d+", r["elements"][0]["id"])]


def test_partitions_total(boq):
    prs = partition_rows(boq)
    assert len(prs) == 13
    assert round(sum(r["quantity"]["value"] for r in prs), 2) == 59.39
    assert sum(len(r["elements"]) for r in prs) == 23


@pytest.mark.parametrize("item,meters,count", PARTITIONS)
def test_partition_row(boq, item, meters, count):
    r = row(boq, item)
    assert round(r["quantity"]["value"], 2) == meters
    assert len(r["elements"]) == count
    assert r["quantity"]["unit"] == "m"


def test_gypsum_15_exact_and_sources(boq):
    r = row(boq, 'מחיצת גבס 15.0 ס"מ')
    assert round(r["quantity"]["value"], 4) == 12.7254
    assert all(e["src"].startswith("DWG") for e in r["elements"])
    assert r["quantity"]["formula"] == "סכום len של 3 מחיצות, חלקי 100"


def test_doors_entrance_windows(boq):
    assert row(boq, "דלת פנים")["quantity"]["value"] == 6
    assert row(boq, "כניסה")["quantity"]["value"] == 1
    w = row(boq, "חלון")
    assert w["quantity"]["value"] == 18
    assert round(w["secondary"]["value"], 2) == 17.93


def test_walls(boq):
    w = row(boq, "קירות קיימים")
    assert w["quantity"]["value"] == 33
    assert round(w["secondary"]["value"], 2) == 19.71
    assert any("שטח פני קיר" in n["text"] and n["kind"] == "missing" for n in boq["notes"])


ELEC = [
    ("סמל ללא שורה במקרא", 27),
    ("שקע A16 חד פאזי בודד/ כפול", 25),
    ("שקע A16 חד פאזי מוגן מים בודד/ כפול", 6),
    ("הכנה לאינטרקום כולל מצלמה ומפסק פתיחה", 3),
    ("נקודת מאור על הקיר", 3),
    ("הכנה לשקע לתקשורת מחשבים RJ-54", 2),
]


def test_electrical(boq):
    rows = rows_by(boq, "electrical")
    assert sum(r["quantity"]["value"] for r in rows) == 66
    assert {r["item"]: r["quantity"]["value"] for r in rows} == dict(ELEC)


def test_systems(boq):
    rows = rows_by(boq, "systems")
    assert sum(len(r["elements"]) for r in rows) == 14
    assert round(sum(r["quantity"]["value"] for r in rows), 2) == 132.87


def test_furniture(boq):
    rows = rows_by(boq, "furniture")
    assert sum(r["quantity"]["value"] for r in rows) == 26
    assert row(boq, "פריט ריהוט ללא שם בקובץ")["quantity"]["value"] == 23


def test_structure(boq):
    assert row(boq, "עמוד עגול")["quantity"]["value"] == 5
    assert row(boq, "עמוד מרובע")["quantity"]["value"] == 1
    assert any(n["text"] == "נתוני שלד: אין בקובץ" for n in boq["notes"])


def test_discipline_filter(plan):
    b = build_boq(plan, discipline="electrical")
    assert b["rows"] and all(r["discipline"] == "electrical" for r in b["rows"])


ROOMS = {  # id: (area, perim, furniture, elec)
    "R1": (259.13, 92.86, 0, 0),
    "R2": (43.26, 52.32, 7, 17),
    "R3": (41.89, 41.52, 9, 20),
    "R4": (25.32, 23.54, 4, 9),
    "R5": (21.67, 19.20, 3, 11),
    "R6": (15.67, 21.53, 2, 2),
    "R7": (13.41, 14.66, 1, 7),
    "R8": (2.11, 6.81, 0, 0),
}


@pytest.mark.parametrize("room_id", list(ROOMS))
def test_room_filter(plan, room_id):
    area, _, furn, elec = ROOMS[room_id]
    b = build_boq(plan, room=room_id)
    assert round(row(b, "שטח רצפה נטו")["quantity"]["value"], 2) == area
    assert sum(r["quantity"]["value"] for r in rows_by(b, "furniture")) == furn
    assert sum(r["quantity"]["value"] for r in rows_by(b, "electrical")) == elec
    assert not rows_by(b, "systems") and not rows_by(b, "structure")
    assert not partition_rows(b)
    assert any("שיוך לחלל: מחושב" == n["text"] for n in b["notes"])


def test_room_filter_windows(plan):
    assert row(build_boq(plan, room="R1"), "חלון")["quantity"]["value"] == 14
    assert row(build_boq(plan, room="R7"), "חלון")["quantity"]["value"] == 2
