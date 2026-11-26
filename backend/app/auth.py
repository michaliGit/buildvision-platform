"""JWT auth + role permissions. Enforcement happens here, on the server."""
from __future__ import annotations

import os
import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.seed import verify_password
from app.store import get_user

JWT_SECRET = os.environ.get("BV_JWT_SECRET", "dev-secret-change-me-buildvision-platform")
JWT_ALG = "HS256"
TOKEN_TTL_SECONDS = 8 * 3600

PERMISSIONS = {
    "client": {"boq": False, "costs": False},
    "contractor": {"boq": True, "costs": False},
    "developer": {"boq": True, "costs": True},
}

_bearer = HTTPBearer(auto_error=False)


def authenticate(username: str, password: str) -> dict | None:
    user = get_user(username)
    if not user or not verify_password(password, user["password_hash"]):
        return None
    return {"username": user["username"], "role": user["role"], "display_name": user["display_name"]}


def create_token(user: dict) -> str:
    now = int(time.time())
    payload = {"sub": user["username"], "role": user["role"], "name": user["display_name"],
               "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "נדרשת התחברות",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "טוקן לא תקף",
                            headers={"WWW-Authenticate": "Bearer"})
    role = payload.get("role")
    if role not in PERMISSIONS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "טוקן לא תקף")
    return {"username": payload["sub"], "role": role, "display_name": payload.get("name", "")}


def require_permission(perm: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if not PERMISSIONS[user["role"]].get(perm):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "אין הרשאה")
        return user
    return dep
