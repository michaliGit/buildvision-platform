"""Manual cost inputs (prices, percents) in SQLite table cost_inputs. Never wiped by seed."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from app import seed as seed_mod

SCHEMA = "CREATE TABLE IF NOT EXISTS cost_inputs (kind TEXT, key TEXT, value REAL, PRIMARY KEY(kind, key))"


def _db(db_path: Path | None) -> sqlite3.Connection:
    con = sqlite3.connect(db_path or seed_mod.DB_PATH)
    con.execute(SCHEMA)
    return con


def ensure_table(db_path: Path | None = None) -> None:
    con = _db(db_path)
    con.commit()
    con.close()


def get_prices(db_path: Path | None = None) -> dict[str, float]:
    con = _db(db_path)
    try:
        return dict(con.execute("SELECT key, value FROM cost_inputs WHERE kind='price'").fetchall())
    finally:
        con.close()


def get_percents(db_path: Path | None = None) -> dict[str, dict[str, float]]:
    """{scope: {field: value}}"""
    con = _db(db_path)
    try:
        rows = con.execute("SELECT key, value FROM cost_inputs WHERE kind='percent'").fetchall()
    finally:
        con.close()
    out: dict[str, dict[str, float]] = {}
    for key, value in rows:
        scope, field = key.split(".", 1)
        out.setdefault(scope, {})[field] = value
    return out


def set_value(kind: str, key: str, value: float | None, db_path: Path | None = None) -> None:
    con = _db(db_path)
    try:
        if value is None:
            con.execute("DELETE FROM cost_inputs WHERE kind=? AND key=?", (kind, key))
        else:
            con.execute("INSERT OR REPLACE INTO cost_inputs (kind, key, value) VALUES (?, ?, ?)", (kind, key, value))
        con.commit()
    finally:
        con.close()
