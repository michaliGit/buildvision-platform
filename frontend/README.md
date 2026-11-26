# BuildVision · Frontend

React + TypeScript + Vite, תלת־ממד ב־`three` + `@react-three/fiber`. ממשק בעברית (RTL), ערכת צבעים כהה.

## הרצה

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

הבק צריך לרוץ ב־`http://localhost:8000`. Vite מעביר כל `/api` לשם (proxy ב־`vite.config.ts`).

בדיקת טיפוסים ובנייה: `npm run build`.

## משתמשי דמו
`client / client123` · `contractor / contractor123` · `developer / developer123` (כפתורים מהירים במסך הכניסה).

## מבנה
- `src/api.ts` — לקוח מוקלד לכל הנתיבים ב־`docs/api-contract.md`. הטוקן בזיכרון + `sessionStorage`; `401` מחזיר למסך הכניסה.
- `src/theme.css` — משתני עיצוב ועיצוב כללי.
- `src/components/Viewer3D.tsx` — התלת־ממד: חללים, קירות, מחיצות, חלונות, דלתות, עמודים, ריהוט, חשמל, מערכות; פירוק לשכבות, הסתרה לפי דיסציפלינה, בחירת חלל/אלמנט, תג "הנחה לתצוגה" לגובה הקירות.
- `src/components/DetailsPanel.tsx` — לוח חלל ולוח אלמנט.
- `src/components/BoqPanel.tsx` — כתב כמויות (לא מוצג ללקוח; `403` → "אין הרשאה").
- `src/components/ChatPanel.tsx` — צ'אט.
- `src/components/KindBadge.tsx` — תג סוג נתון (מהקובץ / מחושב / הוזן ידנית / הנחה לתצוגה / אין בקובץ).

## כללים
- כל הנתונים מה־API בלבד; הפרונט לא מחשב כמויות.
- ערך `null` מוצג "אין בקובץ", לעולם לא 0. עיגול מספרים לתצוגה בלבד.
- טקסט מהנתונים לא נכנס ל־HTML גולמי.
