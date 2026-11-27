import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, getToken, ROLE_HE, setToken, setUnauthorizedHandler, type Boq, type Plan, type RoomSummary, type User } from './api';
import { Login } from './components/Login';
import { Viewer3D } from './components/Viewer3D';
import { ElementPanel, RoomPanel } from './components/DetailsPanel';
import { BoqPanel } from './components/BoqPanel';
import { ChatPanel } from './components/ChatPanel';
import { BoqSummary, Overview, RoomCards } from './components/RoleViews';
import { About } from './components/About';
import { ROLE_CONFIG, type Kpi, type Tab } from './roles';

const isRoomId = (id: string) => /^R\d+$/.test(id);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!getToken()) return;
    api
      .me()
      .then((me) => setUser({ username: me.username, role: me.role, display_name: me.display_name }))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="login-wrap muted">טוען…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return <Workspace user={user} onLogout={logout} />;
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const cfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.client;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [boqAll, setBoqAll] = useState<Boq | null>(null);
  const [boqError, setBoqError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(cfg.defaultTab);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [boqFocus, setBoqFocus] = useState<{ items: string[]; ids: string[]; nonce: number } | null>(null);
  const hasTab = (t: Tab) => cfg.tabs.some((x) => x.key === t);
  const canBoq = hasTab('boq');
  const [boqRev, setBoqRev] = useState(0);
  const refreshBoq = useCallback(() => setBoqRev((r) => r + 1), []);

  useEffect(() => {
    api
      .plan()
      .then(setPlan)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'שגיאה בטעינת התכנית'));
    api
      .rooms()
      .then(setRooms)
      .catch(() => setRooms([]));
    if (canBoq) {
      api
        .boq()
        .then(setBoqAll)
        .catch((e) => setBoqError(e instanceof ApiError ? (e.status === 403 ? 'אין הרשאה' : e.message) : 'שגיאה בטעינת הכמויות'));
    }
  }, [canBoq, boqRev]);

  const highlight = useMemo(() => new Set(highlightIds), [highlightIds]);

  const selectRoom = useCallback((id: string | null) => {
    setSelectedRoom(id);
    setSelectedElement(null);
    if (id === null) setHighlightIds([]);
    else setTab('space');
  }, []);

  const openElement = useCallback((id: string) => {
    if (isRoomId(id)) {
      setSelectedRoom(id);
      setSelectedElement(null);
    } else {
      setSelectedElement(id);
    }
    setTab('space');
  }, []);

  const jumpToKpi = useCallback((k: Kpi) => {
    if (!k.items.length) return;
    setBoqFocus({ items: k.items, ids: k.ids, nonce: Date.now() });
    setTab('boq');
  }, []);

  const spaceView = selectedElement ? (
    <ElementPanel elementId={selectedElement} onBack={selectedRoom ? () => setSelectedElement(null) : undefined} onOpenElement={openElement} />
  ) : selectedRoom ? (
    <div>
      <button type="button" className="btn back" onClick={() => selectRoom(null)}>
        → {user.role === 'client' ? 'כל החללים' : 'ניקוי בחירה'}
      </button>
      <RoomPanel roomId={selectedRoom} onOpenElement={openElement} />
    </div>
  ) : user.role === 'client' ? (
    <RoomCards rooms={rooms} selected={selectedRoom} onSelect={selectRoom} />
  ) : (
    <div className="empty">
      לחצו על חלל בתלת־ממד כדי לראות את הנתונים שלו.
      {rooms.length > 0 && (
        <div className="ids" style={{ justifyContent: 'center', marginTop: 12 }}>
          {rooms.map((r) => (
            <button key={r.id} type="button" className="btn" onClick={() => selectRoom(r.id)}>
              {r.id} · {r.names.length ? r.names.join(' · ') : 'ללא שם בקובץ'}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="app" data-role={user.role}>
      <header className="header">
        <div className="header-brand">
          <div className="logo">
            Build<span>Vision</span>
          </div>
          <span className="header-sub">{cfg.subtitle}</span>
        </div>
        <div className="header-right">
          <span className="header-sees muted small">רואה: {cfg.sees}</span>
          <span className={`user-pill role-${user.role}`}>
            <span className="dot">{(ROLE_HE[user.role] ?? user.display_name).slice(0, 1)}</span>
            <span>{user.display_name}</span>
            <span className="role-name">{ROLE_HE[user.role] ?? user.role}</span>
          </span>
          <button type="button" className="btn" onClick={onLogout}>
            יציאה
          </button>
        </div>
      </header>

      <main className={`main main-${user.role}`}>
        {plan ? (
          <Viewer3D
            plan={plan}
            selectedRoom={selectedRoom}
            selectedElement={selectedElement}
            highlight={highlight}
            onRoom={selectRoom}
            onElement={openElement}
            accent={cfg.accent}
          />
        ) : (
          <div className="viewer-wrap" style={{ display: 'grid', placeItems: 'center' }}>
            <span className={loadError ? 'error' : 'muted'}>{loadError ?? 'טוען תכנית…'}</span>
          </div>
        )}

        <aside className={cfg.panelClass}>
          <nav className="tabs" role="tablist">
            {cfg.tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="panel-body">
            {tab === 'overview' && hasTab('overview') && <Overview boq={boqAll} rooms={rooms} boqError={boqError} onKpi={jumpToKpi} />}
            {tab === 'space' && spaceView}
            {tab === 'about' && <About role={user.role} />}
            {/* BOQ and chat stay mounted so their state survives tab switches */}
            {canBoq && (
              <div hidden={tab !== 'boq'}>
                {user.role === 'contractor' && <BoqSummary boq={boqAll} onKpi={jumpToKpi} />}
                <BoqPanel rooms={rooms} onHighlight={setHighlightIds} onOpenElement={openElement} focus={boqFocus} role={user.role} onChanged={refreshBoq} />
              </div>
            )}
            <div hidden={tab !== 'chat'} style={{ height: '100%' }}>
              <ChatPanel onHighlight={setHighlightIds} onOpenElement={openElement} suggestions={cfg.chatSuggestions} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
