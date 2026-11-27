"""Acceptance numbers from docs/02-tochnit.md step 3."""
import pytest

from app.logic.elements import element_details
from app.logic.rooms import list_rooms, room_details
from tests.test_boq import ROOMS


def field(d, label):
    fs = [f for f in d["fields"] if f["label"] == label]
    assert fs, f"no field {label}"
    return fs[0]["fact"]


@pytest.mark.parametrize("room_id", list(ROOMS))
def test_room_table(plan, room_id):
    area, perim, furn, elec = ROOMS[room_id]
    d = room_details(plan, room_id)
    assert d["area"]["value"] == pytest.approx(area, abs=0.005) and d["area"]["kind"] == "file"
    assert d["perim"]["value"] == pytest.approx(perim, abs=0.005)
    assert d["contents"]["furniture"]["value"] == furn
    assert sum(x["count"]["value"] for x in d["contents"]["elec_by_desc"]) == elec
    assert d["contents"]["furniture"]["kind"] == "computed"
    assert d["level"] == {"value": None, "kind": "missing", "unit": None, "formula": None, "src": None,
                          "note": "אין בקובץ"}


def test_room_names(plan):
    names = {r["id"]: r["names"] for r in list_rooms(plan)}
    assert names["R1"] == [] and names["R8"] == []
    assert names["R7"] == ["מנכל"]
    assert set(names["R2"]) == {"הנהח", "קבלה", "המתנה", "מטבחון"}


def test_r1_height_notes_and_windows(plan):
    d = room_details(plan, "R1")
    assert sorted(n["t"] for n in d["height_notes"]) == ["H=2.48", "H=2.48", "H=2.90"]
    assert all(n["kind"] == "file" and n["src"] for n in d["height_notes"])
    assert d["ceiling_height"]["value"] is None and d["ceiling_height"]["kind"] == "missing"
    assert d["contents"]["windows"]["value"] == 14
    assert room_details(plan, "R3")["contents"]["windows"]["value"] == 2
    assert room_details(plan, "R7")["contents"]["windows"]["value"] == 2


def test_missing_room(plan):
    assert room_details(plan, "R99") is None


def test_p1(plan):
    d = element_details(plan, "P1")
    assert d["type"] == "partition" and d["type_he"] == "מחיצה"
    assert round(field(d, "עובי")["value"], 2) == 21.91
    assert round(field(d, "אורך")["value"], 2) == 6.82
    assert field(d, "מילוי גבס בקובץ")["value"] is True
    assert field(d, "גובה")["kind"] == "missing" and field(d, "גובה")["value"] is None
    assert field(d, "הרכב שכבות")["kind"] == "missing"


def test_d1(plan):
    d = element_details(plan, "D1")
    assert field(d, "רוחב כנף")["value"] == 80
    assert field(d, "רוחב משקוף")["value"] == 90
    h = field(d, "גובה")
    assert h["value"] == 210 and h["kind"] == "file" and h["src"]
    rooms = field(d, "חללים מחוברים")
    assert sorted(rooms["value"]) == ["R2", "R7"] and rooms["kind"] == "computed"


def test_d4(plan):
    d = element_details(plan, "D4")
    assert field(d, "גובה")["kind"] == "missing" and field(d, "גובה")["value"] is None
    assert field(d, "חללים מחוברים")["value"] == ["R2"]
    assert field(d, "צד שני")["note"] == "צד שני: לא שויך לחלל"


def test_wn1(plan):
    d = element_details(plan, "WN1")
    assert field(d, "רוחב")["value"] == pytest.approx(99.6, abs=0.05)
    notes = [f["fact"]["value"] for f in d["fields"] if f["label"] == "הערה"]
    assert sorted(notes) == ["O.K.=1.00", "U.K.=1.00"]
    assert field(d, "חלל")["kind"] == "computed"


def test_unknown_element(plan):
    assert element_details(plan, "X1") is None


def test_furniture_missing_name_never_zero(plan):
    unnamed = next(f for f in plan["furniture"] if not f["name"])
    d = element_details(plan, unnamed["id"])
    assert field(d, "שם")["kind"] == "missing" and field(d, "שם")["value"] is None
    assert field(d, "גובה")["value"] is None
