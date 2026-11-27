import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import load_plan


@pytest.fixture(scope="session")
def plan():
    return load_plan()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, username):
    r = client.post("/api/auth/login", json={"username": username, "password": f"{username}123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def auth(client):
    return {u: _login(client, u) for u in ("client", "contractor", "developer")}
