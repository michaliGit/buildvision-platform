# חוזה API · סבב 1

החוזה בין `backend/` (FastAPI) ל־`frontend/` (React). שני הצדדים נבנים מולו במקביל. שינוי בחוזה = שינוי בקובץ הזה קודם.

- הבק רץ ב־`http://localhost:8000`, כל הנתיבים תחת `/api`.
- הפרונט (Vite, `http://localhost:5173`) מעביר `/api` לבק דרך proxy. אין CORS בפרודקשן; בפיתוח מותר `localhost:5173`.
- כל נתיב חוץ מ־`/api/auth/login` ו־`/api/health` דורש `Authorization: Bearer <token>`. בלי טוקן תקף: `401`.
- טקסט עברי ב־UTF-8. קואורדינטות ואורכים בס"מ כמו בקובץ. שטחים במ"ר.

## Fact: ערך עם סוג נתון

כל ערך שמוצג למשתמש ומקורו בנתונים מגיע כ־Fact:

```json
{ "value": 12.7254, "kind": "computed", "unit": "m", "formula": "סכום len של 3 מחיצות, חלקי 100", "src": null }
```

| `kind` | תווית במסך | מתי |
|---|---|---|
| `file` | מהקובץ | נקרא ישירות מ־`plan-data.json`. `src` מלא כשיש. |
| `computed` | מחושב | סכום, ספירה, המרת יחידות, שיוך לחלל. `formula` חובה. |
| `manual` | הוזן ידנית | מחיר/אחוז שמשתמש הקליד (לא בסבב 1). |
| `display_assumption` | הנחה לתצוגה | ערך לתצוגה בלבד, למשל גובה קיר בתלת־ממד. לעולם לא בחישוב. |
| `missing` | אין בקובץ | הנתון לא קיים. `value` הוא `null`. |

`value` שאינו ידוע הוא `null`, לעולם לא `0`.

## תפקידים ומשתמשי דמו

| username | password | role | שם תצוגה |
|---|---|---|---|
| `client` | `client123` | `client` | לקוח |
| `contractor` | `contractor123` | `contractor` | קבלן |
| `developer` | `developer123` | `developer` | יזם |

| יכולת | client | contractor | developer |
|---|---|---|---|
| גאומטריה, חללים, אלמנטים | ✓ | ✓ | ✓ |
| כתב כמויות (`/api/boq`) | `403` | ✓ | ✓ |
| עלויות והעמסות | — | — | ✓ (בסבב 1: `deferred`) |
| צ'אט על כמויות | עונה "אין הרשאה" | ✓ | ✓ |

האכיפה בשרת. הפרונט רק מסתיר מה שהשרת ממילא לא מחזיר.

## נתיבים

### `GET /api/health` → `{ "ok": true }`

### `POST /api/auth/login`
בקשה: `{ "username": "client", "password": "client123" }`
תשובה `200`: `{ "token": "...", "user": { "username": "client", "role": "client", "display_name": "לקוח" } }`
שגוי: `401` `{ "detail": "שם משתמש או סיסמה שגויים" }`

### `GET /api/me` → `{ "username", "role", "display_name", "permissions": { "boq": bool, "costs": bool } }`

### `GET /api/plan`
כל מה שהתלת־ממד צריך. גאומטריה גולמית (מספרים, בלי Fact), לכל התפקידים.
```json
{
  "bounds": { "minX": 485.3, "maxX": 4342.9, "minY": 641.0, "maxY": 2296.0 },
  "display_wall_height_cm": { "value": 300, "kind": "display_assumption", "note": "אין בקובץ גובה קירות. גובה תצוגה בלבד, לא נכנס לחישוב" },
  "levels": { "value": null, "kind": "missing" },
  "rooms":      [{ "id", "names": [str], "poly": [[x,y]], "holes": [[[x,y]]] }],
  "walls":      [{ "id", "pts": [[x,y]] }],
  "partitions": [{ "id", "bb": [[x,y],[x,y]], "gyps": bool }],
  "windows":    [{ "id", "bb": [[x,y],[x,y]] }],
  "doors":      [{ "id", "a", "b", "hinge", "open" }],
  "entrance":   [{ "id", "a", "b" }],
  "furniture":  [{ "id", "poly": [[x,y]] }],
  "elec":       [{ "id", "p": [x,y] }],
  "syslines":   [{ "id", "pts": [[x,y]] }],
  "columns":    [{ "id", "c": [x,y], "r" }],
  "posts":      [{ "id", "bb": [[x,y],[x,y]] }],
  "labels":     [{ "t", "c": [x,y], "room" }]
}
```
דיסציפלינה של כל שכבה (לפירוק ולהסתרה): `rooms, walls, partitions, windows, doors, entrance` → `architecture` · `elec` → `electrical` · `syslines` → `systems` · `furniture` → `furniture` · `columns, posts` → `structure`.

### `GET /api/rooms` → `[{ "id", "names": [str], "area": Fact, "perim": Fact }]`

### `GET /api/rooms/{id}`
```json
{
  "id": "R7",
  "names": { "value": ["מנכל"], "kind": "file" },
  "area": Fact, "perim": Fact,
  "height_notes": [{ "t": "H=2.90", "src": "...", "kind": "file" }],
  "ceiling_height": { "value": null, "kind": "missing", "note": "גובה תקרה: אין בקובץ כנתון מפורש" },
  "level": { "value": null, "kind": "missing" },
  "contents": {
    "furniture": { "value": 1, "kind": "computed", "formula": "...", "ids": ["F.."] },
    "elec_by_desc": [{ "desc": "שקע ..." | null, "count": Fact, "ids": [..] }],
    "windows": { "value": 2, "kind": "computed", "ids": [..] },
    "doors":   { "value": 1, "kind": "computed", "ids": [..] }
  }
}
```
`desc: null` מוצג "סמל ללא שורה במקרא". חלל לא קיים: `404`.

### `GET /api/elements/{id}`
`{ "id", "type": "partition", "type_he": "מחיצה", "src": "...", "fields": [{ "label": "עובי", "fact": Fact }] }`
השדות לכל סוג לפי `docs/02-tochnit.md` שלב 3 ("כשנבחר אלמנט"). לא קיים: `404`.

### `GET /api/boq?discipline=&room=`
`client` → `403`. שני הפרמטרים אופציונליים.
```json
{
  "rows": [{
    "discipline": "architecture", "discipline_he": "אדריכלות",
    "item": "מחיצת גבס 15.0 ס\"מ",
    "quantity": Fact,
    "elements": [{ "id": "P3", "value": 4.2418, "src": "DWG ..." }],
    "secondary": Fact | null
  }],
  "notes": [{ "discipline": "structure", "text": "נתוני שלד: אין בקובץ", "kind": "missing" }],
  "costs": { "status": "deferred" } 
}
```
`totals` (תמיד): `partitions_length` (בלי סינון חלל) ו־`elec_points`, כ־Fact עם `ids`. אריחי הסיכום בפרונט מציגים אותם כמו שהם; הפרונט לא מחשב סכומים.
`costs` מופיע רק ל־`developer`. הכמות המדויקת ב־`value`; העיגול בתצוגה בלבד. חוקי השורות: `docs/01-kamuyot.md` שלב 1. סינון לפי חלל: `docs/01-kamuyot.md` שלב 3.

### `POST /api/chat`
בקשה: `{ "message": "מה השטח של חדר המנכל?" }`
```json
{
  "intent": "room_area",
  "confidence": 0.91,
  "answer": "שטח R7 (מנכל): 13.41 מ\"ר",
  "facts": [Fact],
  "element_ids": ["R7"],
  "status": "ok" | "unknown" | "forbidden" | "missing"
}
```
כוונות: `room_area` · `room_contents` · `element_info` · `boq_quantity` · `missing_data` · ומתחת לסף ביטחון `unknown` ("לא הבנתי, אפשר לשאול על…"). `boq_quantity` ל־`client` → `status: "forbidden"`.
