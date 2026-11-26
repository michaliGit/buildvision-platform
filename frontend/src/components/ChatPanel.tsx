import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type ChatReply } from '../api';
import { FactValue } from './KindBadge';

type Msg = { id: number; from: 'user'; text: string } | { id: number; from: 'bot'; reply: ChatReply } | { id: number; from: 'error'; text: string };

const STATUS: Record<ChatReply['status'], { he: string; color: string }> = {
  ok: { he: 'נענה', color: 'var(--success)' },
  unknown: { he: 'לא הובן', color: 'var(--warning)' },
  forbidden: { he: 'אין הרשאה', color: 'var(--danger)' },
  missing: { he: 'אין בקובץ', color: 'var(--slate)' },
};

const SUGGESTIONS = ['מה השטח של חדר המנכל?', 'מה יש בחדר R3?', 'מה זה P1?', 'כמה מטר מחיצות גבס יש?', 'מה גובה התקרה?'];

export function ChatPanel({ onHighlight, onOpenElement }: { onHighlight: (ids: string[]) => void; onOpenElement: (id: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText('');
    setMsgs((x) => [...x, { id: nextId.current++, from: 'user', text: m }]);
    setBusy(true);
    try {
      const reply = await api.chat(m);
      setMsgs((x) => [...x, { id: nextId.current++, from: 'bot', reply }]);
      onHighlight(reply.element_ids ?? []);
    } catch (e) {
      setMsgs((x) => [...x, { id: nextId.current++, from: 'error', text: e instanceof ApiError ? e.message : 'שגיאה' }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} aria-live="polite">
        {msgs.length === 0 && (
          <div>
            <p className="muted">שאלו על התכנית: שטחים, תכולת חללים, אלמנטים, כמויות ונתונים חסרים.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="btn" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => {
          if (m.from === 'user') return <div key={m.id} className="msg user">{m.text}</div>;
          if (m.from === 'error') return <div key={m.id} className="msg bot status-forbidden error">{m.text}</div>;
          const r = m.reply;
          const st = STATUS[r.status] ?? STATUS.unknown;
          return (
            <div key={m.id} className={`msg bot status-${r.status}`}>
              <div>{r.answer}</div>
              {r.facts?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, alignItems: 'flex-start' }}>
                  {r.facts.map((f, i) => (
                    <FactValue key={i} fact={f} />
                  ))}
                </div>
              ) : null}
              {r.element_ids?.length ? (
                <div className="ids">
                  {r.element_ids.map((id) => (
                    <button key={id} type="button" className="linklike" onClick={() => onOpenElement(id)}>
                      {id}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="meta">
                <span className="status-dot" style={{ background: st.color }} />
                <span>{st.he}</span>
                <span>·</span>
                <span dir="ltr">{r.intent}</span>
                <span>·</span>
                <span>
                  ביטחון <bdi className="num">{Math.round((r.confidence ?? 0) * 100)}%</bdi>
                </span>
              </div>
            </div>
          );
        })}
        {busy && <div className="msg bot muted">חושב…</div>}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="שאלה על התכנית…" aria-label="שאלה" />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>
          שליחה
        </button>
      </form>
    </div>
  );
}
