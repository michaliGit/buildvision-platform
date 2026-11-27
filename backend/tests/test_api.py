"""API tests via TestClient: auth, role enforcement, chat."""


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_login_bad_password(client):
    r = client.post("/api/auth/login", json={"username": "client", "password": "nope"})
    assert r.status_code == 401
    assert r.json()["detail"] == "שם משתמש או סיסמה שגויים"


def test_login_ok(client):
    r = client.post("/api/auth/login", json={"username": "contractor", "password": "contractor123"})
    assert r.status_code == 200
    body = r.json()
    assert body["token"] and body["user"] == {"username": "contractor", "role": "contractor",
                                               "display_name": "קבלן"}


def test_401_without_token(client):
    for path in ("/api/me", "/api/plan", "/api/rooms", "/api/rooms/R7", "/api/elements/P1", "/api/boq"):
        assert client.get(path).status_code == 401, path
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_me_permissions(client, auth):
    assert client.get("/api/me", headers=auth["client"]).json()["permissions"] == {"boq": False, "costs": False}
    assert client.get("/api/me", headers=auth["developer"]).json()["permissions"] == {"boq": True, "costs": True}


def test_boq_roles(client, auth):
    assert client.get("/api/boq", headers=auth["client"]).status_code == 403
    r = client.get("/api/boq", headers=auth["contractor"])
    assert r.status_code == 200
    assert "percents" not in r.json()["costs"]
    r = client.get("/api/boq", headers=auth["developer"])
    assert "percents" in r.json()["costs"] and "formula_note" in r.json()["costs"]


def test_boq_room_filter_api(client, auth):
    r = client.get("/api/boq?room=R7&discipline=architecture", headers=auth["contractor"])
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert {x["item"] for x in rows} == {"שטח רצפה נטו", "דלת פנים", "חלון"}
    assert client.get("/api/boq?room=R99", headers=auth["contractor"]).status_code == 404


def test_plan_and_rooms(client, auth):
    p = client.get("/api/plan", headers=auth["client"]).json()
    assert p["display_wall_height_cm"]["kind"] == "display_assumption"
    assert p["levels"]["value"] is None and p["levels"]["kind"] == "missing"
    assert len(p["rooms"]) == 8 and len(p["elec"]) == 66 and len(p["syslines"]) == 14
    rooms = client.get("/api/rooms", headers=auth["client"]).json()
    assert len(rooms) == 8
    assert client.get("/api/rooms/R99", headers=auth["client"]).status_code == 404
    assert client.get("/api/elements/ZZ9", headers=auth["client"]).status_code == 404
    assert client.get("/api/elements/D1", headers=auth["client"]).json()["type"] == "door"


def test_chat_room_area(client, auth):
    r = client.post("/api/chat", json={"message": "מה השטח של חדר המנכל?"}, headers=auth["client"]).json()
    assert r["intent"] == "room_area" and r["status"] == "ok"
    assert "13.41" in r["answer"]
    assert r["element_ids"] == ["R7"]
    assert r["facts"][0]["value"] == 13.41 and r["facts"][0]["kind"] == "file"


def test_chat_quantity_forbidden_for_client(client, auth):
    msg = {"message": "כמה מטר מחיצות גבס יש בפרויקט?"}
    r = client.post("/api/chat", json=msg, headers=auth["client"]).json()
    assert r["intent"] == "boq_quantity" and r["status"] == "forbidden"
    assert r["facts"] == [] and r["element_ids"] == []
    r = client.post("/api/chat", json=msg, headers=auth["contractor"]).json()
    assert r["status"] == "ok" and "12.73" in r["answer"]


def test_chat_element_info(client, auth):
    r = client.post("/api/chat", json={"message": "ספר לי על D4"}, headers=auth["client"]).json()
    assert r["intent"] == "element_info" and r["element_ids"] == ["D4"]
    assert "אין בקובץ" in r["answer"]


def test_chat_unknown(client, auth):
    r = client.post("/api/chat", json={"message": "xyz qwerty"}, headers=auth["client"]).json()
    assert r["intent"] == "unknown" and r["status"] == "unknown"
