import { useState, type FormEvent } from 'react';
import { api, ApiError, setToken, type User } from '../api';

const DEMO = [
  { username: 'client', password: 'client123', label: 'לקוח', initial: 'ל', desc: 'תלת־ממד, חללים, שטחים ואלמנטים' },
  { username: 'contractor', password: 'contractor123', label: 'קבלן', initial: 'ק', desc: 'כל מה שהלקוח רואה + כתב כמויות' },
  { username: 'developer', password: 'developer123', label: 'יזם', initial: 'י', desc: 'הכול, כולל עלויות (בסבב 1: נדחה)' },
] as const;

/** Shared mode (external link): role cards only fill the username; the password must be typed. */
const SHARED = import.meta.env.VITE_SHARED_MODE === '1';

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <div className="login-card">
        <div className="logo" style={{ fontSize: 14, marginBottom: 12 }}>
          Build<span>Vision</span>
        </div>
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
  );
}
