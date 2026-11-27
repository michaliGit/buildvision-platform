import { useState, type FormEvent } from 'react';
import { api, ApiError, setToken, type User } from '../api';
import { AboutModal } from './About';

const DEMO = [
  { username: 'client', password: 'client123', label: 'לקוח', initial: 'ל', desc: 'תלת־ממד, חללים, שטחים ואלמנטים' },
  { username: 'contractor', password: 'contractor123', label: 'קבלן', initial: 'ק', desc: 'כל מה שהלקוח רואה + כתב כמויות ומחירים' },
  { username: 'developer', password: 'developer123', label: 'יזם', initial: 'י', desc: 'הכול, כולל עלויות והעמסות' },
] as const;

/** Shared mode (external link): role cards only fill the username; the password must be typed. */
const SHARED = import.meta.env.VITE_SHARED_MODE === '1';

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  async function doLogin(u: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(u, p);
      setToken(res.token);
      onLogin(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה בהתחברות');
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (username && password) void doLogin(username, password);
  }

  return (
    <div className="login-wrap">
      <div className="login-split">
      <section className="hero">
        <div className="logo hero-logo">
          Build<span>Vision</span>
        </div>
        <p className="hero-pitch">תכנית הבניין שלכם בתלת־ממד — עם כמויות, עלויות ותשובות, ומקור לכל מספר.</p>
        <ul className="hero-bullets">
          <li>כל מספר מוביל לאלמנט ולמקור שלו בקובץ</li>
          <li>כל תפקיד רואה רק את מה שמותר לו</li>
          <li>נתון חסר מוצג "אין בקובץ" — בלי ניחושים</li>
        </ul>
        <PlanArt />
        <button type="button" className="btn about-btn" onClick={() => setAboutOpen(true)}>
          אודות הפרויקט
        </button>
      </section>
      <div className="login-card">
        <h1>כניסה למערכת</h1>
        <p className="muted" style={{ margin: 0 }}>
          {SHARED ? 'בחרו תפקיד והזינו את הסיסמה שקיבלתם.' : 'בחרו משתמש דמו, או הזינו שם משתמש וסיסמה.'}
        </p>
        <div className="role-cards">
          {DEMO.map((d) => (
            <button
              key={d.username}
              type="button"
              className={`role-card role-${d.username}${SHARED && username === d.username ? ' sel' : ''}`}
              disabled={busy}
              aria-pressed={SHARED ? username === d.username : undefined}
              onClick={() => {
                if (SHARED) {
                  setUsername(d.username);
                  document.getElementById('login-password')?.focus();
                } else void doLogin(d.username, d.password);
              }}
            >
              <span className="role-initial">{d.initial}</span>
              <strong>{d.label}</strong>
              <span className="muted small">{d.desc}</span>
            </button>
          ))}
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            שם משתמש
            <input className="input" dir="ltr" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            סיסמה
            <input id="login-password" className="input" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !username || !password} style={{ height: 38 }}>
            כניסה
          </button>
        </form>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <p className="muted small" style={{ margin: '16px 0 0', textAlign: 'center' }}>
          <a href="/explainer.html" target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
            איך נבנתה המערכת ובאילו מיומנויות AI
          </a>
        </p>
      </div>
      </div>
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

/** Decorative, plan-like line drawing (not real plan data). */
function PlanArt() {
  return (
    <svg className="plan-art" viewBox="0 0 320 150" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        <rect x="6" y="6" width="308" height="138" rx="3" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="1.4" />
        <path d="M120 6v58M120 92v52M6 78h80M110 78h76M186 6v138M186 60h128M250 60v84" stroke="#9fb3c8" strokeOpacity="0.45" strokeWidth="1" />
        <path d="M86 78a24 24 0 0 1 24-24" stroke="#fbbf24" strokeOpacity="0.7" strokeWidth="1" />
        <path d="M120 64a22 22 0 0 1 22 22" stroke="#fbbf24" strokeOpacity="0.5" strokeWidth="1" />
        <path d="M20 120h80M200 100h40M270 30h30" stroke="#8b5cf6" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="150" cy="30" r="2.5" fill="#fde047" fillOpacity="0.7" />
        <circle cx="230" cy="120" r="2.5" fill="#fde047" fillOpacity="0.7" />
        <circle cx="60" cy="40" r="2.5" fill="#fde047" fillOpacity="0.7" />
        <circle cx="186" cy="60" r="4" stroke="#94a3b8" strokeOpacity="0.7" />
      </g>
    </svg>
  );
}
