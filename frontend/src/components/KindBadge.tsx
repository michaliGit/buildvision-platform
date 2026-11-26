import type { Fact, Kind } from '../api';

export const KIND_LABEL: Record<Kind, string> = {
  file: 'מהקובץ',
  computed: 'מחושב',
  manual: 'הוזן ידנית',
  display_assumption: 'הנחה לתצוגה',
  missing: 'אין בקובץ',
};

export function KindBadge({ kind, title }: { kind: Kind; title?: string | null }) {
  const label = KIND_LABEL[kind] ?? kind;
  return (
    <span className={`kind kind-${kind}`} title={title ?? undefined}>
      {label}
    </span>
  );
}

const UNIT_HE: Record<string, string> = {
  m: 'מ׳',
  m2: 'מ"ר',
  'm²': 'מ"ר',
  cm: 'ס"מ',
  count: 'יח׳',
  unit: 'יח׳',
  pcs: 'יח׳',
  point: 'נק׳',
};

export function unitHe(u?: string | null): string {
  if (!u) return '';
  return UNIT_HE[u] ?? u;
}

/** Display rounding only; the exact value stays in the data. */
export function fmtNum(v: number, digits = 2): string {
  return Number.isInteger(v) ? String(v) : v.toLocaleString('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatValue(value: unknown, unit?: string | null): string {
  if (value === null || value === undefined) return 'אין בקובץ';
  if (typeof value === 'number') return `${fmtNum(value)}${unit ? ' ' + unitHe(unit) : ''}`;
  if (typeof value === 'boolean') return value ? 'כן' : 'לא';
  if (Array.isArray(value)) return value.length ? value.join(' · ') : 'ללא שם בקובץ';
  return `${String(value)}${unit ? ' ' + unitHe(unit) : ''}`;
}

/** Value + unit in <bdi>, plus the kind badge. null → "אין בקובץ", never 0. */
export function FactValue({ fact, unit, showFormula = true }: { fact: Fact | null | undefined; unit?: string; showFormula?: boolean }) {
  if (!fact) {
    return <KindBadge kind="missing" />;
  }
  const noValue = fact.value === null || fact.value === undefined;
  // a null value with a non-missing kind (e.g. computed + note "לא שויך לחלל") keeps its kind and shows the note as the value
  const isMissing = fact.kind === 'missing' || (noValue && !fact.note);
  const tip = [fact.formula, fact.src, fact.note].filter(Boolean).join(' · ') || undefined;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {isMissing ? null : noValue ? <span>{fact.note}</span> : <bdi className="num">{formatValue(fact.value, fact.unit ?? unit)}</bdi>}
        <KindBadge kind={isMissing ? 'missing' : fact.kind} title={tip} />
      </span>
      {showFormula && fact.kind === 'computed' && fact.formula ? <span className="formula">{fact.formula}</span> : null}
      {fact.src ? <span className="src">{fact.src}</span> : null}
      {fact.note && !(noValue && !isMissing) ? <span className="formula">{fact.note}</span> : null}
    </span>
  );
}
