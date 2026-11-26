import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type ElementDetails, type RoomDetails, type CountFact } from '../api';
import { FactValue, KindBadge } from './KindBadge';

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="val">{children}</span>
    </div>
  );
}

function IdList({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  if (!ids.length) return null;
  return (
    <span className="ids">
      {ids.map((id) => (
        <button key={id} type="button" className="linklike" onClick={() => onOpen(id)}>
          {id}
        </button>
      ))}
    </span>
  );
}

function CountRow({ label, fact, onOpen }: { label: string; fact: CountFact | undefined; onOpen: (id: string) => void }) {
  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className="label">{label}</span>
        <FactValue fact={fact} />
      </div>
      {fact ? <IdList ids={fact.ids ?? []} onOpen={onOpen} /> : null}
    </div>
  );
}

function useLoad<T>(id: string | null, loader: (id: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    loader(id)
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        setData(null);
        setError(e instanceof ApiError ? (e.status === 404 ? `${id}: לא נמצא` : e.message) : 'שגיאה בטעינה');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return { data, error, loading };
}

export function RoomPanel({ roomId, onOpenElement }: { roomId: string; onOpenElement: (id: string) => void }) {
  const { data: r, error, loading } = useLoad<RoomDetails>(roomId, api.room);
  if (loading && !r) return <div className="empty">טוען…</div>;
  if (error) return <div className="empty error">{error}</div>;
  if (!r) return null;
  const names = r.names?.value ?? [];
  return (
    <div>
      <h2 className="panel-title">
        <code>{r.id}</code>
        <span>{names.length ? names.join(' · ') : 'ללא שם בקובץ'}</span>
        <KindBadge kind={names.length ? r.names.kind : 'missing'} />
      </h2>

      <div className="section">
        <h3>מידות</h3>
        <div className="rows">
          <Row label="שטח">
            <FactValue fact={r.area} unit="m2" />
          </Row>
          <Row label="היקף">
            <FactValue fact={r.perim} unit="m" />
          </Row>
          <Row label="מפלס">
            <FactValue fact={r.level} />
          </Row>
        </div>
      </div>

      <div className="section">
        <h3>הערות גובה מהתכנית (כמו שהן, לא מפורשות)</h3>
        <div className="rows">
          {r.height_notes.length === 0 ? (
            <Row label="הערות גובה">
              <KindBadge kind="missing" />
            </Row>
          ) : (
            r.height_notes.map((n, i) => (
              <Row key={i} label={<bdi dir="ltr">{n.t}</bdi>}>
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <KindBadge kind={n.kind} />
                  {n.src ? <span className="src">{n.src}</span> : null}
                </span>
              </Row>
            ))
          )}
          <Row label="גובה תקרה: אין בקובץ">
            <FactValue fact={r.ceiling_height} />
          </Row>
        </div>
      </div>

      <div className="section">
        <h3>מה בתוך החלל</h3>
        <div className="rows">
          <CountRow label="רהיטים" fact={r.contents.furniture} onOpen={onOpenElement} />
          <CountRow label="חלונות" fact={r.contents.windows} onOpen={onOpenElement} />
          <CountRow label="דלתות" fact={r.contents.doors} onOpen={onOpenElement} />
          {r.contents.elec_total ? <CountRow label="נקודות חשמל (סה״כ)" fact={r.contents.elec_total} onOpen={onOpenElement} /> : null}
        </div>
      </div>

      <div className="section">
        <h3>נקודות חשמל לפי תיאור</h3>
        <div className="rows">
          {r.contents.elec_by_desc.length === 0 ? (
            <Row label="נקודות חשמל">
              <span className="muted">לא שויכו נקודות לחלל</span>
            </Row>
          ) : (
            r.contents.elec_by_desc.map((e, i) => (
              <div key={i} className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="label">{e.desc ?? 'סמל ללא שורה במקרא'}</span>
                  <FactValue fact={e.count} />
                </div>
                <IdList ids={e.ids} onOpen={onOpenElement} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function ElementPanel({ elementId, onBack, onOpenElement }: { elementId: string; onBack?: () => void; onOpenElement: (id: string) => void }) {
  const { data: el, error, loading } = useLoad<ElementDetails>(elementId, api.element);
  return (
    <div>
      {onBack ? (
        <button type="button" className="btn back" onClick={onBack}>
          → חזרה לחלל
        </button>
      ) : null}
      {loading && !el ? <div className="empty">טוען…</div> : null}
      {error ? <div className="empty error">{error}</div> : null}
      {el ? (
        <>
          <h2 className="panel-title">
            <code>{el.id}</code>
            <span>{el.type_he}</span>
          </h2>
          <div className="section">
            <div className="rows">
              <Row label="מקור (src)">
                {el.src ? <span className="src">{el.src}</span> : <KindBadge kind="missing" />}
              </Row>
              {el.fields.map((f, i) => (
                <Row key={i} label={f.label}>
                  <FactValue fact={f.fact} />
                  {Array.isArray(f.fact.value) && f.fact.value.every((v) => typeof v === 'string' && /^R\d+$/.test(v)) ? (
                    <IdList ids={f.fact.value as string[]} onOpen={onOpenElement} />
                  ) : null}
                </Row>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
