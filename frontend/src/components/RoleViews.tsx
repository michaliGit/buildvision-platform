import type { Boq, RoomSummary } from '../api';
import { boqKpis, disciplineCounts, type Kpi } from '../roles';
import { FactValue, KindBadge, fmtNum, unitHe } from './KindBadge';
import { MoneyCell, rowsWithoutPrice } from './Costs';

/* ---------- client: "החללים שלי" ---------- */
export function RoomCards({ rooms, selected, onSelect }: { rooms: RoomSummary[]; selected: string | null; onSelect: (id: string) => void }) {
  if (!rooms.length) return <div className="empty">אין חללים להצגה</div>;
  return (
    <div>
      <h2 className="panel-title">החללים שלי</h2>
      <p className="muted small" style={{ marginTop: -6 }}>בחרו חלל כדי לראות אותו בתלת־ממד ואת מה שבתוכו.</p>
      <div className="room-cards">
        {rooms.map((r) => (
          <button key={r.id} type="button" className={`room-card${selected === r.id ? ' sel' : ''}`} onClick={() => onSelect(r.id)}>
            <span className="room-card-top">
              <strong>{r.names.length ? r.names.join(' · ') : 'ללא שם בקובץ'}</strong>
              <code>{r.id}</code>
            </span>
            <span className="room-card-area">
              <FactValue fact={r.area} unit="m2" showFormula={false} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiValue({ k }: { k: Kpi }) {
  const v = k.fact.value;
  return (
    <>
      <span className="kpi-value">
        {v === null || v === undefined ? <span className="muted">אין בקובץ</span> : <bdi className="num">{fmtNum(v as number, 2)} {unitHe(k.fact.unit)}</bdi>}
      </span>
      <KindBadge kind={v === null || v === undefined ? 'missing' : k.fact.kind} title={k.fact.formula} />
    </>
  );
}

/* ---------- contractor: summary strip above the BOQ ---------- */
export function BoqSummary({ boq, onKpi }: { boq: Boq | null; onKpi: (k: Kpi) => void }) {
  if (!boq) return null;
  const counts = disciplineCounts(boq);
  const kpis = boqKpis(boq).filter((k) => ['area', 'partitions', 'elec'].includes(k.key));
  return (
    <div className="summary">
      <div className="summary-kpis">
        {kpis.map((k) => (
          <button key={k.key} type="button" className="kpi small-kpi" onClick={() => onKpi(k)} disabled={!k.items.length}>
            <span className="kpi-label">{k.label}</span>
            <KpiValue k={k} />
          </button>
        ))}
      </div>
      <div className="summary-disc">
        {counts.map((c) => (
          <span key={c.discipline} className="chip">
            {c.he} <bdi className="num">{c.count}</bdi> שורות
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- developer: overview ---------- */
const PERMS: { what: string; client: boolean; contractor: boolean; developer: boolean }[] = [
  { what: 'תלת־ממד, חללים, שטחים, אלמנטים', client: true, contractor: true, developer: true },
  { what: 'כתב כמויות', client: false, contractor: true, developer: true },
  { what: 'מחירי קבלן', client: false, contractor: true, developer: true },
  { what: 'העמסות ועלות כוללת', client: false, contractor: false, developer: true },
];

export function Overview({ boq, rooms, boqError, onKpi }: { boq: Boq | null; rooms: RoomSummary[]; boqError: string | null; onKpi: (k: Kpi) => void }) {
  const kpis = boqKpis(boq);
  return (
    <div>
      <h2 className="panel-title">סקירת פרויקט</h2>
      {boqError ? <div className="empty error">{boqError}</div> : null}
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">חללים</span>
          <span className="kpi-value">
            <bdi className="num">{rooms.length}</bdi>
          </span>
          <KindBadge kind="computed" title="ספירת החללים שהחזיר /api/rooms" />
        </div>
        {kpis.map((k) => (
          <button key={k.key} type="button" className="kpi" onClick={() => onKpi(k)} disabled={!k.items.length} title={k.fact.formula ?? undefined}>
            <span className="kpi-label">{k.label}</span>
            <KpiValue k={k} />
          </button>
        ))}
      </div>

      {boq?.costs?.summary ? (
        <div className="card cost-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong>עלויות והעמסות · פרויקט</strong>
            {(() => {
              const n = rowsWithoutPrice(boq.costs.summary.project);
              return n === null ? null : (
                <span className={`chip${n > 0 ? ' chip-warn' : ''}`}>
                  <bdi className="num">{n}</bdi> שורות בלי מחיר
                </span>
              );
            })()}
          </div>
          <div className="sum-grid" style={{ marginTop: 10 }}>
            <strong>עלות כוללת</strong>
            <MoneyCell fact={boq.costs.summary.project.total} />
            <span className="muted">עלות למ״ר</span>
            <MoneyCell fact={boq.costs.summary.project.per_m2} perM2 />
            <span className="muted">עלות ישירה</span>
            <MoneyCell fact={boq.costs.summary.project.direct} />
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>מחירים ואחוזים מוזנים ידנית בלשונית הכמויות · אין מחירים בקובץ</p>
          {boq.costs.formula_note ? <p className="formula-note">{boq.costs.formula_note}</p> : null}
        </div>
      ) : (
        <div className="card deferred">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong>עלויות והעמסות</strong>
            <KindBadge kind="missing" />
          </div>
          <p className="muted" style={{ margin: '6px 0 0' }}>אין נתוני עלויות מהשרת · הזנה ידנית בלבד, אין מחירים בקובץ</p>
        </div>
      )}

      <div className="section" style={{ marginTop: 16 }}>
        <h3>מי רואה מה</h3>
        <table className="boq perms">
          <thead>
            <tr>
              <th />
              <th>לקוח</th>
              <th>קבלן</th>
              <th>יזם</th>
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.what}>
                <td>{p.what}</td>
                {[p.client, p.contractor, p.developer].map((ok, i) => (
                  <td key={i} className={ok ? 'yes' : 'no'} aria-label={ok ? 'כן' : 'לא'}>
                    {ok ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">ההרשאות נאכפות בשרת.</p>
      </div>
    </div>
  );
}
