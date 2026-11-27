"""Prices and loads (docs/01-kamuyot.md step 4). Runs on the temp DB from conftest."""
import pytest

from app.logic.boq import build_boq
from app.logic.costs import apply_costs

KEY = 'architecture|מחיצת גבס 15.0 ס"מ'


def r2(f):
    return None if f["value"] is None else round(f["value"], 2)


def row_of(body, key=KEY):
    return next(r for r in body["rows"] if r["key"] == key)


# ---------------- pure logic

def test_acceptance_case_pure(plan):
    boq = build_boq(plan)
    pct = {"project": {"waste": 10, "overhead": 20, "contingency": 5}}
    costs = apply_costs(boq, {KEY: 100}, pct, "developer", 422.46)
    c = row_of(boq)["cost"]
    assert c["price"] == {"value": 100, "kind": "manual", "unit": "₪", "formula": None, "src": None}
    assert [r2(c[k]) for k in ("direct", "waste", "overhead", "contingency", "total")] == \
        [1272.54, 127.25, 279.96, 83.99, 1763.74]
    assert all(c[k]["kind"] == "computed" for k in ("direct", "waste", "overhead", "contingency", "total"))
    s = costs["summary"]["project"]
    assert r2(s["total"]) == 1763.74
    assert s["rows_without_price"] == len(boq["rows"]) - 1
    assert s["per_m2"]["value"] == pytest.approx(s["total"]["value"] / 422.46)


def test_empty_price_is_null_not_zero(plan):
    boq = build_boq(plan)
    pct = {"project": {"waste": 10, "overhead": 20, "contingency": 5}}
    costs = apply_costs(boq, {}, pct, "developer", 422.46)
    c = row_of(boq)["cost"]
    for k in ("price", "direct", "waste", "overhead", "contingency", "total"):
        assert c[k]["value"] is None and c[k]["kind"] == "missing", k
    s = costs["summary"]["project"]
    assert s["direct"]["value"] is None and s["total"]["value"] is None
    assert s["rows_without_price"] == len(boq["rows"])
    assert s["per_m2"]["value"] is None


def test_empty_percent_nulls_line_and_total(plan):
    boq = build_boq(plan)
    apply_costs(boq, {KEY: 100}, {"project": {"waste": 10, "overhead": 20}}, "developer", 422.46)
    c = row_of(boq)["cost"]
    assert r2(c["overhead"]) == 279.96
    assert c["contingency"]["value"] is None and c["contingency"]["kind"] == "missing"
    assert c["total"]["value"] is None


def test_discipline_override_wins(plan):
    boq = build_boq(plan)
    pct = {"project": {"waste": 10, "overhead": 20, "contingency": 5}, "architecture": {"waste": 50}}
    costs = apply_costs(boq, {KEY: 100}, pct, "developer", 422.46)
    c = row_of(boq)["cost"]
    assert r2(c["waste"]) == round(1272.54 * 0.5, 2)
    assert "דריסה" in c["waste"]["formula"]
    assert "פרויקט" in c["overhead"]["formula"]
    assert costs["percents"]["disciplines"]["architecture"]["waste"]["value"] == 50
    assert costs["percents"]["disciplines"]["architecture"]["overhead"] is None


def test_percent_over_100_warning(plan):
    boq = build_boq(plan)
    costs = apply_costs(boq, {}, {"project": {"waste": 150}}, "developer", 422.46)
    assert costs["percents"]["project"]["waste"]["warning"] == "מעל 100%"
    assert costs["percents"]["project"]["overhead"]["kind"] == "missing"


def test_contractor_pure_has_no_loads(plan):
    boq = build_boq(plan)
    costs = apply_costs(boq, {KEY: 100}, {"project": {"waste": 10}}, "contractor", 422.46)
    c = row_of(boq)["cost"]
    assert set(c) == {"price", "direct"}
    assert "percents" not in costs and set(costs["summary"]["project"]) == {"direct", "rows_without_price"}


# ---------------- API

@pytest.fixture
def reset_costs(client, auth):
    yield
    client.put("/api/costs/price", json={"key": KEY, "price": None}, headers=auth["developer"])
    for f in ("waste", "overhead", "contingency"):
        client.put("/api/costs/percent", json={"scope": "project", "field": f, "value": None},
                   headers=auth["developer"])


def test_api_acceptance_and_roles(client, auth, reset_costs):
    h_c, h_d = auth["contractor"], auth["developer"]
    assert client.put("/api/costs/price", json={"key": KEY, "price": 100}, headers=h_c).json() == {"ok": True}
    for f, v in (("waste", 10), ("overhead", 20), ("contingency", 5)):
        r = client.put("/api/costs/percent", json={"scope": "project", "field": f, "value": v}, headers=h_d)
        assert r.status_code == 200

    dev = client.get("/api/boq", headers=h_d).json()
    c = row_of(dev)["cost"]
    assert [r2(c[k]) for k in ("direct", "waste", "overhead", "contingency", "total")] == \
        [1272.54, 127.25, 279.96, 83.99, 1763.74]
    assert dev["costs"]["formula_note"].startswith("הנחה שלנו, ממתינה לאישור של שרה")
    assert r2(dev["costs"]["summary"]["project"]["total"]) == 1763.74

    con = client.get("/api/boq", headers=h_c).json()
    c = row_of(con)["cost"]
    assert set(c) == {"price", "direct"} and r2(c["direct"]) == 1272.54
    assert "percents" not in con["costs"] and "formula_note" not in con["costs"]
    assert "total" not in con["costs"]["summary"]["project"]
    assert all(set(r["cost"]) == {"price", "direct"} for r in con["rows"])


def test_api_client_forbidden(client, auth):
    h = auth["client"]
    assert client.get("/api/boq", headers=h).status_code == 403
    assert client.put("/api/costs/price", json={"key": KEY, "price": 1}, headers=h).status_code == 403
    assert client.put("/api/costs/percent", json={"scope": "project", "field": "waste", "value": 1},
                      headers=h).status_code == 403


def test_api_contractor_cannot_set_percent(client, auth):
    r = client.put("/api/costs/percent", json={"scope": "project", "field": "waste", "value": 10},
                   headers=auth["contractor"])
    assert r.status_code == 403


def test_api_validation(client, auth):
    h = auth["developer"]
    r = client.put("/api/costs/price", json={"key": KEY, "price": -1}, headers=h)
    assert r.status_code == 400 and r.json()["detail"] == "מחיר שלילי לא מותר"
    assert client.put("/api/costs/price", json={"key": "nope|x", "price": 1}, headers=h).status_code == 404
    assert client.put("/api/costs/percent", json={"scope": "project", "field": "waste", "value": -5},
                      headers=h).status_code == 400
    assert client.put("/api/costs/percent", json={"scope": "mars", "field": "waste", "value": 5},
                      headers=h).status_code == 400
    assert client.put("/api/costs/percent", json={"scope": "project", "field": "tax", "value": 5},
                      headers=h).status_code == 400


def test_api_null_price_deletes(client, auth, reset_costs):
    h = auth["contractor"]
    client.put("/api/costs/price", json={"key": KEY, "price": 100}, headers=h)
    client.put("/api/costs/price", json={"key": KEY, "price": None}, headers=h)
    c = row_of(client.get("/api/boq", headers=h).json())["cost"]
    assert c["price"]["value"] is None and c["direct"]["value"] is None
