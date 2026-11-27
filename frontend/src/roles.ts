import type { Boq, BoqRow, Fact, Role } from './api';

export type Tab = 'overview' | 'boq' | 'space' | 'chat' | 'about';

export interface RoleConfig {
  accent: string;
  subtitle: string;
  sees: string; // same wording as the login cards
  tabs: { key: Tab; label: string }[];
  defaultTab: Tab;
  panelClass: string;
  chatSuggestions: string[];
}

export const ROLE_CONFIG: Record<Role, RoleConfig> = {
  client: {
    accent: '#22d3ee',
    subtitle: 'צפייה בתכנית',
    sees: 'תלת־ממד, חללים, שטחים ואלמנטים',
    tabs: [
      { key: 'space', label: 'חללים' },
      { key: 'chat', label: "צ'אט" },
      { key: 'about', label: 'אודות' },
    ],
    defaultTab: 'space',
    panelClass: 'panel narrow',
    chatSuggestions: ['מה השטח של חדר המנכל?', 'מה יש בחדר R3?', 'ספר לי על D1', 'מה גובה התקרה?', 'מה חסר בקובץ?'],
  },
  contractor: {
    accent: '#fbbf24',
    subtitle: 'גיליון עבודה',
    sees: 'כל מה שהלקוח רואה + כתב כמויות ומחירים',
    tabs: [
      { key: 'boq', label: 'כמויות' },
      { key: 'space', label: 'חלל' },
      { key: 'chat', label: "צ'אט" },
      { key: 'about', label: 'אודות' },
    ],
    defaultTab: 'boq',
    panelClass: 'panel wide',
    chatSuggestions: ['כמה מטר מחיצות גבס?', 'כמה דלתות יש?', 'כמה חלונות יש?', 'כמה נקודות חשמל יש?', 'ספר לי על P1'],
  },
  developer: {
    accent: '#8b5cf6',
    subtitle: 'סקירת פרויקט',
    sees: 'הכול, כולל עלויות והעמסות',
    tabs: [
      { key: 'overview', label: 'סקירה' },
      { key: 'boq', label: 'כמויות' },
      { key: 'space', label: 'חלל' },
      { key: 'chat', label: "צ'אט" },
      { key: 'about', label: 'אודות' },
    ],
    defaultTab: 'overview',
    panelClass: 'panel wide',
    chatSuggestions: ['מה השטח של חדר המנכל?', 'כמה מטר מחיצות גבס?', 'כמה נקודות חשמל יש?', 'מה חסר בקובץ?'],
  },
};

/** A key quantity taken from BOQ rows. Never invented: no matching rows → value null ("אין בקובץ"). */
export interface Kpi {
  key: string;
  label: string;
  fact: Fact<number>;
  items: string[]; // BOQ row items it comes from (to jump to)
  ids: string[]; // element ids (to highlight)
}

function fromRows(key: string, label: string, rows: BoqRow[], unit: string, what: string): Kpi {
  const ids = rows.flatMap((r) => r.elements.map((e) => e.id));
  const items = rows.map((r) => r.item);
  if (rows.length === 0) return { key, label, fact: { value: null, kind: 'missing', unit }, items, ids };
  if (rows.length === 1) return { key, label, fact: rows[0].quantity, items, ids };
  const vals = rows.map((r) => r.quantity.value);
  if (vals.some((v) => v === null || v === undefined)) {
    return { key, label, fact: { value: null, kind: 'missing', unit, note: 'חלק מהשורות בלי ערך' }, items, ids };
  }
  const sum = (vals as number[]).reduce((a, b) => a + b, 0);
  return {
    key,
    label,
    fact: { value: sum, kind: 'computed', unit, formula: `סכום ${rows.length} שורות ${what} בכתב הכמויות`, src: null },
    items,
    ids,
  };
}

/** A total computed by the server (`boq.totals`). The browser only displays it. */
function fromTotal(key: string, label: string, boq: Boq | null, totalKey: string, unit: string, rows: BoqRow[]): Kpi {
  const t = boq?.totals?.[totalKey];
  const items = rows.map((r) => r.item);
  if (!t) return { key, label, fact: { value: null, kind: 'missing', unit }, items, ids: [] };
  return { key, label, fact: t, items, ids: t.ids ?? [] };
}

export function boqKpis(boq: Boq | null): Kpi[] {
  const rows = boq?.rows ?? [];
  const arch = rows.filter((r) => r.discipline === 'architecture');
  const partitionRows = arch.filter((r) => r.elements.some((e) => e.id.startsWith('P')));
  return [
    fromRows('area', 'שטח רצפה נטו', arch.filter((r) => r.item === 'שטח רצפה נטו'), 'm2', 'שטח'),
    fromTotal('partitions', 'אורך מחיצות', boq, 'partitions_length', 'm', partitionRows),
    fromRows('doors', 'דלתות פנים', arch.filter((r) => r.item === 'דלת פנים'), 'unit', 'דלתות'),
    fromRows('windows', 'חלונות', arch.filter((r) => r.item === 'חלון'), 'unit', 'חלונות'),
    fromTotal('elec', 'נקודות חשמל', boq, 'elec_points', 'point', rows.filter((r) => r.discipline === 'electrical')),
  ];
}

export function disciplineCounts(boq: Boq | null): { discipline: string; he: string; count: number }[] {
  const m = new Map<string, { he: string; count: number }>();
  for (const r of boq?.rows ?? []) {
    const e = m.get(r.discipline) ?? { he: r.discipline_he, count: 0 };
    e.count++;
    m.set(r.discipline, e);
  }
  return [...m.entries()].map(([discipline, v]) => ({ discipline, ...v }));
}
