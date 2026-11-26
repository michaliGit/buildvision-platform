import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, getToken, ROLE_HE, setToken, setUnauthorizedHandler, type Plan, type RoomSummary, type User } from './api';
import { Login } from './components/Login';
import { Viewer3D } from './components/Viewer3D';
import { ElementPanel, RoomPanel } from './components/DetailsPanel';
import { BoqPanel } from './components/BoqPanel';
import { ChatPanel } from './components/ChatPanel';

type Tab = 'space' | 'boq' | 'chat';
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
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('space');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const canBoq = user.role !== 'client';

  useEffect(() => {
    api
      .plan()
      .then(setPlan)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'שגיאה בטעינת התכנית'));
    api
      .rooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

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

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          Build<span>Vision</span>
        </div>
        <div className="header-right">
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

      <main className="main">
        {plan ? (
          <Viewer3D
            plan={plan}
            selectedRoom={selectedRoom}
            selectedElement={selectedElement}
            highlight={highlight}
            onRoom={selectRoom}
            onElement={openElement}
          />
        ) : (
          <div className="viewer-wrap" style={{ display: 'grid', placeItems: 'center' }}>
            <span className={loadError ? 'error' : 'muted'}>{loadError ?? 'טוען תכנית…'}</span>
          </div>
        )}

        <aside className="panel">
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'space'} className={`tab${tab === 'space' ? ' active' : ''}`} onClick={() => setTab('space')}>
              חלל
            </button>
            {canBoq && (
              <button role="tab" aria-selected={tab === 'boq'} className={`tab${tab === 'boq' ? ' active' : ''}`} onClick={() => setTab('boq')}>
                כתב כמויות
              </button>
            )}
            <button role="tab" aria-selected={tab === 'chat'} className={`tab${tab === 'chat' ? ' active' : ''}`} onClick={() => setTab('chat')}>
              צ'אט
            </button>
          </nav>
          <div className="panel-body">
            {tab === 'space' &&
              (selectedElement ? (
                <ElementPanel
                  elementId={selectedElement}
                  onBack={selectedRoom ? () => setSelectedElement(null) : undefined}
                  onOpenElement={openElement}
                />
              ) : selectedRoom ? (
                <RoomPanel roomId={selectedRoom} onOpenElement={openElement} />
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
              ))}
            {/* BOQ and chat stay mounted so their state survives tab switches */}
            {canBoq && (
              <div hidden={tab !== 'boq'}>
                <BoqPanel rooms={rooms} onHighlight={setHighlightIds} onOpenElement={openElement} />
              </div>
            )}
            <div hidden={tab !== 'chat'} style={{ height: '100%' }}>
              <ChatPanel onHighlight={setHighlightIds} onOpenElement={openElement} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
