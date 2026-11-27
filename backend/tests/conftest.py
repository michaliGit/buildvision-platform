import os
import tempfile
from pathlib import Path

# Tests use their own temporary DB (seeded automatically), never backend/buildvision.db.
_TMP = Path(tempfile.mkdtemp(prefix="bv-test-"))
os.environ["BV_DB_PATH"] = str(_TMP / "test.db")
for _v in ("BV_PW_CLIENT", "BV_PW_CONTRACTOR", "BV_PW_DEVELOPER", "BV_USER_CLIENT", "BV_USER_CONTRACTOR", "BV_USER_DEVELOPER"):
    os.environ.pop(_v, None)

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
