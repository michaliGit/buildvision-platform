import { useEffect, useState } from 'react';
import { ApiError, type CostSummary, type Fact } from '../api';
import { KindBadge } from './KindBadge';

export function fmtMoney(v: number): string {
  return `₪ ${v.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number): string {
  return `${v.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
}

/** "12,5" / "12.5" → 12.5 · "" → null · invalid → NaN */
export function parseNum(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  return Number(t);
}

/** Money Fact: null → "—" + missing badge, never "0 ₪". */
export function MoneyCell({ fact, compact = false, perM2 = false }: { fact: Fact<number> | null | undefined; compact?: boolean; perM2?: boolean }) {
  const v = fact?.value;
  const empty = v === null || v === undefined;
  const tip = [fact?.formula, fact?.note].filter(Boolean).join(' · ') || undefined;
  return (
    <span className="money" title={tip}>
      {empty ? <span className="muted">—</span> : <bdi className="num">{fmtMoney(v as number)}{perM2 || fact?.unit === '₪/m2' ? ' / מ״ר' : ''}</bdi>}
      {!compact || empty ? <KindBadge kind={empty ? 'missing' : (fact?.kind ?? 'missing')} title={tip} /> : null}
      {fact?.warning ? <span className="warn">{fact.warning}</span> : null}
    </span>
  );
}

export function rowsWithoutPrice(s: CostSummary | undefined): number | null {
  const r = s?.rows_without_price;
  if (r === undefined || r === null) return null;
  if (typeof r === 'number') return r;
  return typeof r.value === 'number' ? r.value : null;
}

/** Inline numeric editor. Saves on Enter/blur; server errors (e.g. 400 negative) are shown inline. */
export function NumInput({
  value,
  onSave,
  placeholder,
  suffix,
  label,
  disabled,
}: {
  value: number | null | undefined;
  onSave: (v: number | null) => Promise<unknown>;
  placeholder?: string;
  suffix?: string;
  label: string;
  disabled?: boolean;
}) {
  const initial = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(initial), [initial]);

  async function commit() {
    const v = parseNum(text);
    if (v !== null && Number.isNaN(v)) {
      setErr('מספר לא תקין');
      return;
    }
    if ((v ?? null) === (value ?? null)) {
      setErr(null);
      return;
    }
    setBusy(true);
    try {
      await onSave(v);
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'שמירה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="num-input" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <span className="num-input-box">
        <input
          className={`input${err ? ' invalid' : ''}`}
          inputMode="decimal"
          dir="ltr"
          aria-label={label}
          aria-invalid={!!err}
          placeholder={placeholder}
          value={text}
          disabled={disabled || busy}
          onChange={(e) => {
            setText(e.target.value);
            setErr(null);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(initial);
              setErr(null);
            }
          }}
        />
        {suffix ? <span className="muted small">{suffix}</span> : null}
      </span>
      {err ? <span className="error small" role="alert">{err}</span> : null}
    </span>
  );
}
