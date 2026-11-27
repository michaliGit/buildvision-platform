# BuildVision backend (FastAPI)

Implements `docs/api-contract.md`. Data comes only from `docs/plan-data.json` (read-only), loaded into SQLite by a seed script.

## Run

From `backend/` (Windows, Git Bash; on PowerShell use `.venv\Scripts\...`):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m app.seed          # creates buildvision.db (users + elements)
.venv/Scripts/python -m app.chat.train    # trains the chat classifier, prints accuracy, saves model.joblib
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
.venv/Scripts/python -m pytest
```

Because the repo path contains Hebrew characters, set `PYTHONUTF8=1` if pip or Python print encoding errors.
The server seeds the DB and trains the model by itself if they are missing.

Demo users: `client/client123`, `contractor/contractor123`, `developer/developer123`.
JWT secret: env `BV_JWT_SECRET` (dev default inside `app/auth.py`).

## Layout

```
app/main.py           routes (thin) + CORS for http://localhost:5173
app/auth.py           JWT (HS256) + role permissions, enforced on the server
app/seed.py           plan-data.json -> SQLite (users with pbkdf2 hashes, elements(id, collection, json))
app/store.py          loads the DB into memory once
app/logic/            pure functions, no FastAPI: boq.py, rooms.py, elements.py, plan_view.py, facts.py
app/chat/             training_data.jsonl, textclf.py (TF-IDF char n-grams + logistic regression),
                      train.py (stratified split, accuracy, report, save), service.py (intent + entities + answers)
tests/                acceptance numbers from docs/01-kamuyot.md and docs/02-tochnit.md + API tests
```

Units in `Fact.unit`: `m`, `m2`, `cm`, `unit`, `point`.
