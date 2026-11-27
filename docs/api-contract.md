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

## עלויות (מחירים והעמסות, `docs/01-kamuyot.md` שלב 4)

הנוסחה (הנחה שלנו, ממתינה לאישור של שרה), תמיד על הכמות המדויקת (`quantity.value`), עיגול בתצוגה בלבד:
`ישירה = כמות × מחיר` · `פחת = ישירה × פחת%` · `תקורות = (ישירה + פחת) × תקורות%` · `בלתי צפוי = (ישירה + פחת + תקורות) × בלתי צפוי%` · `כוללת = סכום ארבעתם`.
קלט ריק ← כל ערך שתלוי בו `{ "value": null, "kind": "missing", "note": ... }`, לעולם לא `0` (אחוז חסר מאפס את השורה שלו, את השורות שאחריה בשרשרת ואת הכוללת).
אחוז אפקטיבי לשורה = דריסת הדיסציפלינה אם קיימת, אחרת אחוז הפרויקט.

| | client | contractor | developer |
|---|---|---|---|
| `/api/boq` | `403` | `key` + `cost.price`, `cost.direct`, סיכום ישירה | הכול: העמסות, כוללת, אחוזים, עלות למ"ר |
| `PUT /api/costs/price` | `403` | ✓ | ✓ |
| `PUT /api/costs/percent` | `403` | `403` | ✓ |

### תוספות ל־`GET /api/boq`
כל שורה מקבלת `"key": "{discipline}|{item}"` (למשל `architecture|מחיצת גבס 15.0 ס"מ`) ו־`cost`:
```json
"cost": {
  "price":  { "value": 100, "kind": "manual", "unit": "₪" },            // או missing ("אין מחיר")
  "direct": { "value": 1272.54, "kind": "computed", "unit": "₪", "formula": "כמות 12.7254 × מחיר 100" },
  // developer בלבד:
  "waste": Fact, "overhead": Fact, "contingency": Fact,   // formula כולל את האחוז ואם הוא "דריסה לדיסציפלינה" או "אחוז ברמת הפרויקט"
  "total": Fact
}
```
`costs` (מחליף את `{"status":"deferred"}`):
```json
// contractor
{ "summary": { "project": { "direct": Fact, "rows_without_price": int },
               "disciplines": { "architecture": { "direct": Fact, "rows_without_price": int }, ... } } }
// developer
{ "percents": {
    "project": { "waste": Fact, "overhead": Fact, "contingency": Fact },          // kind manual (unit "%") או missing
    "disciplines": { "architecture": { "waste": Fact | null, "overhead": null, "contingency": null }, ... }  // null = אין דריסה
  },
  "summary": {
    "project": { "direct", "waste", "overhead", "contingency", "total": Fact, "rows_without_price": int, "per_m2": Fact },
    "disciplines": { "<id>": { "direct", "waste", "overhead", "contingency", "total": Fact, "rows_without_price": int } }
  },
  "formula_note": "הנחה שלנו, ממתינה לאישור של שרה: ..." }
```
- שורות בלי מחיר לא נכנסות לסכומים; `rows_without_price` סופר אותן. אין אף שורה עם מחיר ← הסכום `missing`.
- סכום שבו לשורה עם מחיר חסר אחוז ← `missing` ("חסר אחוז").
- הסיכומים מחושבים על השורות שהוחזרו (אחרי סינון `discipline`/`room`). `disciplines` כולל רק דיסציפלינות שיש להן שורות.
- `per_m2` = כוללת הפרויקט חלקי שטח רצפה נטו (סכום `area` של כל החללים, 422.46), `unit: "₪/m2"`.
- אחוז מעל 100 מותר; ה־Fact שלו מקבל `"warning": "מעל 100%"`.

### `PUT /api/costs/price`
בקשה: `{ "key": "architecture|מחיצת גבס 15.0 ס\"מ", "price": 100 }` · `price: null` מוחק. תשובה: `{ "ok": true }`.
מחיר שלילי: `400` `"מחיר שלילי לא מותר"` · `key` לא קיים: `404`.

### `PUT /api/costs/percent`
בקשה: `{ "scope": "project" | "architecture" | "electrical" | "systems" | "furniture" | "structure", "field": "waste" | "overhead" | "contingency", "value": 10 }` (באחוזים: 10 = 10%) · `value: null` מוחק (בדיסציפלינה: מבטל דריסה). תשובה: `{ "ok": true }`.
שלילי או `scope`/`field` לא מוכרים: `400`.

הערכים נשמרים בטבלה `cost_inputs(kind, key, value)` ב־SQLite. `seed` לא מוחק אותה.
