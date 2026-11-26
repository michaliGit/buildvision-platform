"""Read plan data from SQLite into memory (once)."""
from __future__ import annotations

import json
import sqlite3
from functools import lru_cache
from pathlib import Path

from app import seed as seed_mod

LIST_COLLECTIONS_SINGLE = {"meta"}  # stored as one row, returned as dict


def _connect(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        seed_mod.seed(db_path)
    return sqlite3.connect(db_path)


@lru_cache(maxsize=1)
def load_plan(db_path: Path | None = None) -> dict:
    db_path = db_path or seed_mod.DB_PATH
    con = _connect(db_path)
    try:
        rows = con.execute("SELECT collection, json FROM elements ORDER BY seq").fetchall()
    finally:
        con.close()
    plan: dict = {}
    for collection, raw in rows:
        item = json.loads(raw)
        if collection in LIST_COLLECTIONS_SINGLE:
            plan[collection] = item
        else:
            plan.setdefault(collection, []).append(item)
    return plan


def get_user(username: str, db_path: Path | None = None) -> dict | None:
    db_path = db_path or seed_mod.DB_PATH
    con = _connect(db_path)
    try:
        row = con.execute(
            "SELECT username, password_hash, role, display_name FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    finally:
        con.close()
    if not row:
        return None
    return {"username": row[0], "password_hash": row[1], "role": row[2], "display_name": row[3]}
