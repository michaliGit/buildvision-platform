import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type Boq, type BoqRow, type CostField, type CostSummary, type Percents, type Role, type RoomSummary } from '../api';
import { MoneyCell, NumInput, rowsWithoutPrice } from './Costs';
import { DISCIPLINES } from './Viewer3D';
import { FactValue, KindBadge, fmtNum, unitHe } from './KindBadge';

interface Props {
  rooms: RoomSummary[];
  onHighlight: (ids: string[]) => void;
  onOpenElement: (id: string) => void;
  /** jump to BOQ rows (from KPI tiles); nonce makes repeated clicks re-trigger */
  focus?: { items: string[]; ids: string[]; nonce: number } | null;
  role: Role;
  /** called after a price/percent was saved (so other views can refetch) */
  onChanged?: () => void;
}

const PCT_FIELDS: { key: CostField; he: string }[] = [
  { key: 'waste', he: 'פחת' },
  { key: 'overhead', he: 'תקורות' },
  { key: 'contingency', he: 'בלתי צפוי' },
];

function PercentInputs({ percents, scope, inherit, onSave }: { percents: Percents | null | undefined; scope: string; inherit: boolean; onSave: (scope: string, f: CostField, v: number | null) => Promise<unknown> }) {
  return (
    <div className="pct-inputs">
      {PCT_FIELDS.map((f) => {
        const fact = percents?.[f.key] ?? null;
        return (
          <label key={f.key} className="pct-field">
            <span className="muted small">{f.he}</span>
            <NumInput
              label={`${f.he} (${scope === 'project' ? 'פרויקט' : scope})`}
              value={typeof fact?.value === 'number' ? fact.value : null}
              placeholder={inherit ? 'לפי הפרויקט' : '—'}
              suffix="%"
              onSave={(v) => onSave(scope, f.key, v)}
            />
            {fact?.warning ? <span className="warn">{fact.warning}</span> : null}
          </label>
        );
      })}
    </div>
  );
}

function SummaryCells({ s, dev }: { s: CostSummary | undefined; dev: boolean }) {
  return (
    <>
      <td className="qty">
        <MoneyCell fact={s?.direct} compact />
      </td>
      {dev && (
        <>
          <td className="qty"><MoneyCell fact={s?.waste} compact /></td>
          <td className="qty"><MoneyCell fact={s?.overhead} compact /></td>
          <td className="qty"><MoneyCell fact={s?.contingency} compact /></td>
          <td className="qty"><MoneyCell fact={s?.total} compact /></td>
        </>
      )}
    </>
  );
}

function NoPrice({ s }: { s: CostSummary | undefined }) {
  const n = rowsWithoutPrice(s);
  if (n === null) return null;
  return (
    <span className={`chip${n > 0 ? ' chip-warn' : ''}`}>
      <bdi className="num">{n}</bdi> שורות בלי מחיר
    </span>
  );
}

export function BoqPanel({ rooms, onHighlight, onOpenElement, focus, role, onChanged }: Props) {
  const [rev, setRev] = useState(0);
  const showCost = role === 'contractor' || role === 'developer';
  const dev = role === 'developer';
  const colCount = 3 + (showCost ? 2 : 0) + (dev ? 4 : 0);
  const [discipline, setDiscipline] = useState('');
  const [room, setRoom] = useState('');
  const [data, setData] = useState<Boq | null>(null);
  const [error, setError] = useState<{ status: number; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [pending, setPending] = useState<Props['focus']>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focus) return;
    setDiscipline('');
    setRoom('');
    setPending(focus);
  }, [focus]);

  useEffect(() => {
    if (!pending || !data || loading) return;
    const idx = data.rows.findIndex((r) => pending.items.includes(r.item));
    setPending(null);
    if (idx < 0) return;
    setOpen(idx);
    onHighlight(pending.ids);
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, data, loading]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .boq(discipline || undefined, room || undefined)
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        setData(null);
        setError(e instanceof ApiError ? { status: e.status, msg: e.message } : { status: 0, msg: 'שגיאה בטעינה' });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [discipline, room, rev]);

  useEffect(() => setOpen(null), [discipline, room]);

  const afterSave = () => {
    setRev((r) => r + 1);
    onChanged?.();
  };
  const savePrice = (key: string, price: number | null) => api.putPrice(key, price).then(afterSave);
  const savePercent = (scope: string, field: CostField, value: number | null) => api.putPercent(scope, field, value).then(afterSave);
  const costs = data?.costs;

  const groups = useMemo(() => {
    const g = new Map<string, { he: string; rows: { row: BoqRow; idx: number }[] }>();
    (data?.rows ?? []).forEach((row, idx) => {
      if (!g.has(row.discipline)) g.set(row.discipline, { he: row.discipline_he, rows: [] });
      g.get(row.discipline)!.rows.push({ row, idx });
    });
    return [...g.entries()];
  }, [data]);

  if (error?.status === 403) return <div className="forbidden">אין הרשאה</div>;

  function toggle(idx: number, row: BoqRow) {
    if (open === idx) {
      setOpen(null);
      onHighlight([]);
    } else {
      setOpen(idx);
      onHighlight(row.elements.map((e) => e.id));
    }
  }

  return (
    <div ref={rootRef}>
      <div className="filters">
        <select className="input" value={discipline} onChange={(e) => setDiscipline(e.target.value)} aria-label="דיסציפלינה">
          <option value="">כל הדיסציפלינות</option>
          {DISCIPLINES.map((d) => (
            <option key={d.key} value={d.key}>
              {d.he}
            </option>
          ))}
        </select>
        <select className="input" value={room} onChange={(e) => setRoom(e.target.value)} aria-label="חלל">
          <option value="">כל החללים</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.names.length ? r.names.join(' · ') : 'ללא שם בקובץ'}
            </option>
          ))}
        </select>
      </div>

      {dev && costs?.percents ? (
        <div className="card pct-card">
          <strong>אחוזי פרויקט</strong>
          <span className="muted small"> · חלים על כל הדיסציפלינות אם לא הוגדר אחרת</span>
          <PercentInputs percents={costs.percents.project} scope="project" inherit={false} onSave={savePercent} />
        </div>
      ) : null}

      {loading && !data ? <div className="empty">טוען…</div> : null}
      {error ? <div className="empty error">{error.msg}</div> : null}
      {data && data.rows.length === 0 && data.notes.length === 0 ? <div className="empty">אין שורות לסינון הזה</div> : null}

      {groups.map(([disc, g]) => (
        <div key={disc} className="boq-group">
          <div className="boq-group-head">
            <h3>{g.he}</h3>
            {showCost ? <NoPrice s={costs?.summary?.disciplines?.[disc]} /> : null}
          </div>
          {dev && costs?.percents ? (
            <PercentInputs percents={costs.percents.disciplines?.[disc]} scope={disc} inherit onSave={savePercent} />
          ) : null}
          <div className="table-scroll">
          <table className={`boq${showCost ? ' boq-costs' : ''}`}>
            <thead>
              <tr>
                <th>פריט</th>
                <th style={{ textAlign: 'end' }}>כמות</th>
                <th>סוג</th>
                {showCost && (
                  <>
                    <th>מחיר ליחידה</th>
                    <th style={{ textAlign: 'end' }}>עלות ישירה</th>
                  </>
                )}
                {dev && (
                  <>
                    <th style={{ textAlign: 'end' }}>פחת</th>
                    <th style={{ textAlign: 'end' }}>תקורות</th>
                    <th style={{ textAlign: 'end' }}>בלתי צפוי</th>
                    <th style={{ textAlign: 'end' }}>עלות כוללת</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {g.rows.map(({ row, idx }) => {
                const q = row.quantity;
                const isOpen = open === idx;
                return (
                  <Fragment key={idx}>
                    <tr
                      data-idx={idx}
                      className={`boq-row${isOpen ? ' open' : ''}`}
                      onClick={() => toggle(idx, row)}
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(idx, row))}
                      aria-expanded={isOpen}
                    >
                      <td>{row.item}</td>
                      <td className="qty">
                        {q.value === null || q.value === undefined ? (
                          <span className="muted">אין בקובץ</span>
                        ) : (
                          <bdi className="num">
                            {fmtNum(q.value, 2)} {unitHe(q.unit)}
                          </bdi>
                        )}
                      </td>
                      <td>
                        <KindBadge kind={q.value === null ? 'missing' : q.kind} title={q.formula} />
                      </td>
                      {showCost && (
                        <>
                          <td>
                            <NumInput
                              label={`מחיר ליחידה: ${row.item}`}
                              value={typeof row.cost?.price?.value === 'number' ? row.cost.price.value : null}
                              placeholder="—"
                              suffix="₪"
                              disabled={!row.key}
                              onSave={(v) => savePrice(row.key as string, v)}
                            />
                          </td>
                          <td className="qty">
                            <MoneyCell fact={row.cost?.direct} />
                          </td>
                        </>
                      )}
                      {dev && (
                        <>
                          <td className="qty"><MoneyCell fact={row.cost?.waste} compact /></td>
                          <td className="qty"><MoneyCell fact={row.cost?.overhead} compact /></td>
                          <td className="qty"><MoneyCell fact={row.cost?.contingency} compact /></td>
                          <td className="qty"><MoneyCell fact={row.cost?.total} /></td>
                        </>
                      )}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={colCount} className="boq-detail">
                          {q.formula ? (
                            <div style={{ marginBottom: 6 }}>
                              <span className="muted small">נוסחה: </span>
                              {q.formula}
                            </div>
                          ) : null}
                          {row.secondary ? (
                            <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                              <span className="muted small">כמות משנית</span>
                              <FactValue fact={row.secondary} />
                            </div>
                          ) : null}
                          {row.elements.length ? (
                            <table>
                              <tbody>
                                {row.elements.map((el) => (
                                  <tr key={el.id}>
                                    <td>
                                      <button
                                        type="button"
                                        className="linklike"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenElement(el.id);
                                        }}
                                      >
                                        {el.id}
                                      </button>
                                    </td>
                                    <td style={{ textAlign: 'end' }}>
                                      {el.value === null || el.value === undefined ? <span className="muted">אין בקובץ</span> : <bdi className="num">{fmtNum(el.value, 4)}</bdi>}
                                    </td>
                                    <td>{el.src ? <span className="src">{el.src}</span> : <span className="muted small">ללא src</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <span className="muted small">אין רשימת אלמנטים</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {showCost && costs?.summary ? (
              <tfoot>
                <tr className="boq-sum">
                  <td colSpan={4}>סיכום {g.he}</td>
                  <SummaryCells s={costs.summary.disciplines?.[disc]} dev={dev} />
                </tr>
              </tfoot>
            ) : null}
          </table>
          </div>
        </div>
      ))}

      {showCost && costs?.summary ? (
        <div className="card project-sum">
          <div className="boq-group-head">
            <strong>סיכום פרויקט</strong>
            <NoPrice s={costs.summary.project} />
          </div>
          <div className="sum-grid">
            <span className="muted">עלות ישירה</span>
            <MoneyCell fact={costs.summary.project.direct} />
            {dev && (
              <>
                <span className="muted">פחת</span>
                <MoneyCell fact={costs.summary.project.waste} />
                <span className="muted">תקורות</span>
                <MoneyCell fact={costs.summary.project.overhead} />
                <span className="muted">בלתי צפוי</span>
                <MoneyCell fact={costs.summary.project.contingency} />
                <strong>עלות כוללת</strong>
                <MoneyCell fact={costs.summary.project.total} />
                <span className="muted">עלות למ״ר</span>
                <MoneyCell fact={costs.summary.project.per_m2} perM2 />
              </>
            )}
          </div>
          {dev && costs.formula_note ? <p className="formula-note">{costs.formula_note}</p> : null}
        </div>
      ) : null}

      {data && data.notes.length > 0 && (
        <div className="section">
          <h3>הערות</h3>
          {data.notes.map((n, i) => (
            <div key={i} className="note-row">
              <KindBadge kind={n.kind} />
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}

      {data?.costs?.status === 'deferred' && !data.costs.summary ? (
        <div className="note-row">
          <span className="kind kind-missing">עלויות</span>
          <span>{data.costs.status === 'deferred' ? 'עלויות והעמסות: נדחה לסבב הבא' : data.costs.status}</span>
        </div>
      ) : null}
    </div>
  );
}
