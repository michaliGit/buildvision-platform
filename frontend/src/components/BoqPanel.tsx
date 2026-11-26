import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type Boq, type BoqRow, type RoomSummary } from '../api';
import { DISCIPLINES } from './Viewer3D';
import { FactValue, KindBadge, fmtNum, unitHe } from './KindBadge';

interface Props {
  rooms: RoomSummary[];
  onHighlight: (ids: string[]) => void;
  onOpenElement: (id: string) => void;
}

export function BoqPanel({ rooms, onHighlight, onOpenElement }: Props) {
  const [discipline, setDiscipline] = useState('');
  const [room, setRoom] = useState('');
  const [data, setData] = useState<Boq | null>(null);
  const [error, setError] = useState<{ status: number; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setOpen(null);
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
  }, [discipline, room]);

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
    <div>
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

      {loading && !data ? <div className="empty">טוען…</div> : null}
      {error ? <div className="empty error">{error.msg}</div> : null}
      {data && data.rows.length === 0 && data.notes.length === 0 ? <div className="empty">אין שורות לסינון הזה</div> : null}

      {groups.map(([disc, g]) => (
        <div key={disc} className="boq-group">
          <h3>{g.he}</h3>
          <table className="boq">
            <thead>
              <tr>
                <th>פריט</th>
                <th style={{ textAlign: 'end' }}>כמות</th>
                <th>סוג</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map(({ row, idx }) => {
                const q = row.quantity;
                const isOpen = open === idx;
                return (
                  <Fragment key={idx}>
                    <tr
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
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={3} className="boq-detail">
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
          </table>
        </div>
      ))}

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

      {data?.costs ? (
        <div className="note-row">
          <span className="kind kind-missing">עלויות</span>
          <span>{data.costs.status === 'deferred' ? 'עלויות והעמסות: נדחה לסבב הבא' : data.costs.status}</span>
        </div>
      ) : null}
    </div>
  );
}
