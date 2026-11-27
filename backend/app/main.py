"""BuildVision API (see docs/api-contract.md)."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import PERMISSIONS, authenticate, create_token, current_user, require_permission
from app.chat.service import answer as chat_answer
from app.chat.service import ensure_model
from app.logic.boq import DISCIPLINES, build_boq
from app.logic.elements import element_details
from app.logic.plan_view import plan_geometry
from app.logic.plan_index import room_by_id
from app.logic.rooms import list_rooms, room_details
from app.store import load_plan


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_plan()
    ensure_model()
    yield


app = FastAPI(title="BuildVision API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginIn(BaseModel):
    username: str
    password: str


class ChatIn(BaseModel):
    message: str


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/auth/login")
def login(body: LoginIn):
    user = authenticate(body.username, body.password)
    if not user:
        raise HTTPException(401, "שם משתמש או סיסמה שגויים")
    return {"token": create_token(user), "user": user}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return {**user, "permissions": PERMISSIONS[user["role"]]}


@app.get("/api/plan")
def get_plan(user: dict = Depends(current_user)):
    return plan_geometry(load_plan())


@app.get("/api/rooms")
def get_rooms(user: dict = Depends(current_user)):
    return list_rooms(load_plan())


@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, user: dict = Depends(current_user)):
    d = room_details(load_plan(), room_id)
    if d is None:
        raise HTTPException(404, "חלל לא נמצא")
    return d


@app.get("/api/elements/{element_id}")
def get_element(element_id: str, user: dict = Depends(current_user)):
    d = element_details(load_plan(), element_id)
    if d is None:
        raise HTTPException(404, "אלמנט לא נמצא")
    return d


@app.get("/api/boq")
def get_boq(discipline: str | None = Query(None), room: str | None = Query(None),
            user: dict = Depends(require_permission("boq"))):
    plan = load_plan()
    discipline = discipline or None
    room = room or None
    if discipline and discipline not in DISCIPLINES:
        raise HTTPException(400, f"דיסציפלינה לא מוכרת: {discipline}")
    if room and room_by_id(plan, room) is None:
        raise HTTPException(404, "חלל לא נמצא")
    result = build_boq(plan, discipline=discipline, room=room)
    if PERMISSIONS[user["role"]]["costs"]:
        result["costs"] = {"status": "deferred"}
    return result


@app.post("/api/chat")
def chat(body: ChatIn, user: dict = Depends(current_user)):
    return chat_answer(load_plan(), body.message, user["role"])
