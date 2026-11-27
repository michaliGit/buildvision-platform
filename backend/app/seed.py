"""Load docs/plan-data.json (read-only) into SQLite.

Run:  python -m app.seed
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
PLAN_PATH = Path(os.environ.get("BV_PLAN_PATH", REPO_DIR / "docs" / "plan-data.json"))
DB_PATH = Path(os.environ.get("BV_DB_PATH", BACKEND_DIR / "buildvision.db"))

# Default demo passwords are for local work only. When the system is shared outside
# (tunnel), set BV_PW_CLIENT / BV_PW_CONTRACTOR / BV_PW_DEVELOPER and re-run the seed.
DEMO_USERS = [
    ("client", os.environ.get("BV_PW_CLIENT", "client123"), "client", "לקוח"),
    ("contractor", os.environ.get("BV_PW_CONTRACTOR", "contractor123"), "contractor", "קבלן"),
    ("developer", os.environ.get("BV_PW_DEVELOPER", "developer123"), "developer", "יזם"),
]

PBKDF2_ITERATIONS = 200_000


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, hexdigest = stored.split("$")
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iters))
    return secrets.compare_digest(digest.hex(), hexdigest)


def seed(db_path: Path = DB_PATH, plan_path: Path = PLAN_PATH) -> dict[str, int]:
    with open(plan_path, encoding="utf-8") as f:
        plan = json.load(f)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    try:
        con.executescript(
            """
            DROP TABLE IF EXISTS users;
            DROP TABLE IF EXISTS elements;
            CREATE TABLE users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                display_name TEXT NOT NULL
            );
            CREATE TABLE elements (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT NOT NULL,
                collection TEXT NOT NULL,
                json TEXT NOT NULL
            );
            CREATE INDEX idx_elements_collection ON elements(collection);
            CREATE TABLE IF NOT EXISTS cost_inputs (kind TEXT, key TEXT, value REAL, PRIMARY KEY(kind, key));
            """
        )
        for username, password, role, display in DEMO_USERS:
            con.execute(
                "INSERT INTO users VALUES (?, ?, ?, ?)",
                (username, hash_password(password), role, display),
            )
        counts: dict[str, int] = {}
        for collection, value in plan.items():
            items = value if isinstance(value, list) else [value]
            for i, item in enumerate(items):
                el_id = item.get("id") if isinstance(item, dict) else None
                con.execute(
                    "INSERT INTO elements (id, collection, json) VALUES (?, ?, ?)",
                    (el_id or f"{collection}:{i}", collection, json.dumps(item, ensure_ascii=False)),
                )
            counts[collection] = len(items)
        con.commit()
    finally:
        con.close()
    return counts


if __name__ == "__main__":
    result = seed()
    print(f"Seeded {DB_PATH.name}: users={len(DEMO_USERS)}")
    for k, v in result.items():
        print(f"  {k}: {v}")
