import { useEffect, useRef, type ReactNode } from 'react';
import type { Role } from '../api';

/* ---------- tiny inline icons (stroke = currentColor) ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICONS: Record<string, ReactNode> = {
  file: (<><path d="M6 3h8l4 4v14H6z" {...P} /><path d="M14 3v4h4" {...P} /><path d="M9 13h6M9 16h4" {...P} /></>),
  ruler: (<><rect x="3" y="9" width="18" height="6" rx="1" {...P} /><path d="M7 9v3M11 9v3M15 9v3M19 9v2" {...P} /></>),
  sheet: (<><rect x="4" y="4" width="16" height="16" rx="1.5" {...P} /><path d="M4 9h16M4 14h16M10 4v16" {...P} /></>),
  mail: (<><rect x="3" y="6" width="18" height="12" rx="1.5" {...P} /><path d="M3 7l9 6 9-6" {...P} /></>),
  warn: (<><path d="M12 4l9 16H3z" {...P} /><path d="M12 10v4M12 17v.5" {...P} /></>),
  data: (<><ellipse cx="12" cy="6" rx="7" ry="2.5" {...P} /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" {...P} /></>),
  cube: (<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" {...P} /><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9" {...P} /></>),
  list: (<><path d="M9 6h11M9 12h11M9 18h11" {...P} /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" {...P} strokeWidth={2.6} /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="1.5" {...P} /><path d="M8 11V8a4 4 0 018 0v3" {...P} /></>),
  chat: (<><path d="M4 5h16v11H9l-5 4z" {...P} /><path d="M8 10h8M8 13h5" {...P} /></>),
  coin: (<><circle cx="12" cy="12" r="8" {...P} /><path d="M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4M12 7.5v1.5M12 15v1.5" {...P} /></>),
  layers: (<><path d="M12 4l9 4.5-9 4.5-9-4.5z" {...P} /><path d="M3 13l9 4.5 9-4.5" {...P} /></>),
  panel: (<><rect x="3" y="4" width="18" height="16" rx="1.5" {...P} /><path d="M14 4v16M16.5 8h2M16.5 11h2M16.5 14h2" {...P} /></>),
  question: (<><circle cx="12" cy="12" r="8.5" {...P} /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 16.5v.5" {...P} /></>),
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const WITHOUT = [
  { icon: 'file', t: 'קובץ DWG מהאדריכל' },
  { icon: 'ruler', t: 'הדפסה ומדידה ידנית' },
  { icon: 'sheet', t: 'העתקה לאקסל' },
  { icon: 'mail', t: 'מיילים בין יזם, קבלן ולקוח' },
  { icon: 'warn', t: 'טעויות, אין מקור למספר, כל אחד רואה הכול או כלום' },
];
const WITH = [
  { icon: 'file', t: 'קובץ התכנית' },
  { icon: 'data', t: 'נתונים אוטומטיים עם מקור לכל מספר' },
  { icon: 'cube', t: 'תלת־ממד' },
  { icon: 'list', t: 'כתב כמויות ועלויות' },
  { icon: 'lock', t: 'הרשאות לפי תפקיד' },
  { icon: 'chat', t: "צ'אט שעונה מהנתונים" },
];

type R = Role;
const FEATURES: { icon: string; title: string; text: string; roles: R[] }[] = [
  { icon: 'layers', title: 'תלת־ממד ופירוק לשכבות', text: 'סיבוב, זום, הפרדה בין אדריכלות, חשמל, מערכות, ריהוט וקונסטרוקציה.', roles: ['client', 'contractor', 'developer'] },
  { icon: 'panel', title: 'לוח נתונים לחלל ולאלמנט', text: 'שטח, היקף, מה בתוך החלל, ולכל אלמנט המקור שלו בקובץ.', roles: ['client', 'contractor', 'developer'] },
  { icon: 'list', title: 'כתב כמויות עם מקור', text: 'כל כמות נפתחת לאלמנטים שמהם חושבה, עם נוסחה.', roles: ['contractor', 'developer'] },
  { icon: 'coin', title: 'מחירים והעמסות', text: 'הקבלן מזין מחירים; היזם מוסיף פחת, תקורות ובלתי צפוי.', roles: ['contractor', 'developer'] },
  { icon: 'lock', title: 'הרשאות לפי תפקיד', text: 'כל תפקיד מקבל מהשרת רק את מה שמותר לו לראות.', roles: ['client', 'contractor', 'developer'] },
  { icon: 'chat', title: "צ'אט", text: 'שאלות בעברית על שטחים, תכולה, אלמנטים וכמויות.', roles: ['client', 'contractor', 'developer'] },
  { icon: 'question', title: '"אין בקובץ" במקום ניחוש', text: 'נתון חסר מוצג כחסר. אף מספר לא מומצא.', roles: ['client', 'contractor', 'developer'] },
];

const ROLE_HE: Record<R, string> = { client: 'לקוח', contractor: 'קבלן', developer: 'יזם' };

const NOW: Record<R, string[]> = {
  client: [
    'לחצו על חלל בתלת־ממד או ברשימת "החללים שלי" כדי לראות שטח ותכולה.',
    'הזיזו את "פירוק לשכבות" כדי לראות חשמל, מערכות וריהוט בנפרד.',
    'לחצו על מזהה (למשל דלת או חלון) כדי לראות את פרטיו ואת המקור בקובץ.',
    "שאלו בצ'אט: \"מה השטח של חדר המנכל?\"",
  ],
  contractor: [
    'פתחו את לשונית הכמויות ולחצו על שורה כדי לראות את האלמנטים שלה בתלת־ממד.',
    'הזינו מחיר ליחידה בכל שורה; העלות הישירה מתעדכנת מהשרת.',
    'סננו לפי דיסציפלינה או לפי חלל.',
    "שאלו בצ'אט: \"כמה מטר מחיצות גבס?\"",
  ],
  developer: [
    'בלשונית "סקירה": אריחי סיכום ועלות כוללת של הפרויקט.',
    'הגדירו אחוזי פחת, תקורות ובלתי צפוי לפרויקט, ועקיפה לכל דיסציפלינה.',
    'בדקו כמה שורות עדיין בלי מחיר לפני שמסתמכים על הסכום.',
    "שאלו בצ'אט על כמויות, חללים ונתונים חסרים.",
  ],
};

function Flow({ steps, bad }: { steps: { icon: string; t: string }[]; bad?: boolean }) {
  return (
    <ol className={`flow${bad ? ' flow-bad' : ''}`}>
      {steps.map((s, i) => (
        <li key={i} className="flow-step">
          <span className="flow-icon">
            <Icon name={s.icon} />
          </span>
          <span>{s.t}</span>
        </li>
      ))}
    </ol>
  );
}

export function About({ role }: { role: Role | null }) {
  return (
    <div className="about">
      <h2 className="panel-title">אודות BuildVision</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        תכנית בניין אחת, מקור אחד לכל מספר — ותצוגה שמתאימה לכל תפקיד.
      </p>

      <div className="compare">
        <div className="compare-col">
          <h3 className="compare-h bad">בלי BuildVision</h3>
          <Flow steps={WITHOUT} bad />
        </div>
        <div className="compare-col">
          <h3 className="compare-h good">עם BuildVision</h3>
          <Flow steps={WITH} />
        </div>
      </div>

      {role ? (
        <div className="card now-box">
          <strong>מה אפשר לעשות עכשיו · {ROLE_HE[role]}</strong>
          <ul>
            {NOW[role].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3 className="about-sub">מה יש במערכת</h3>
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature">
            <span className="flow-icon">
              <Icon name={f.icon} />
            </span>
            <strong>{f.title}</strong>
            <span className="muted small">{f.text}</span>
            <span className="feature-roles">
              {(['client', 'contractor', 'developer'] as R[]).map((r) => (
                <span key={r} className={`role-chip role-${r}${f.roles.includes(r) ? '' : ' off'}${role === r ? ' me' : ''}`}>
                  {ROLE_HE[r]}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="אודות הפרויקט" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="btn modal-close" onClick={onClose} aria-label="סגירה">
          ✕
        </button>
        <About role={null} />
      </div>
    </div>
  );
}
