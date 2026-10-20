import { FormEvent, useEffect, useState } from 'react';
import { notesApi, sessionApi } from '../api/services';
import type { Note, Session } from '../api/types';

/** FR-09: історія сесій та особисті нотатки (на сервері шифруються AES-256-GCM). */
export default function ClientCabinet() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    sessionApi.mine().then(setSessions);
    notesApi.list().then(setNotes);
  }, []);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const n = await notesApi.add(text);
    setNotes([n, ...notes]);
    setText('');
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-2 text-2xl font-bold">Мої сесії</h1>
        {sessions.length === 0 ? <p>Сесій поки немає.</p> : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="card">{new Date(s.startsAt).toLocaleString('uk-UA')} — {s.status}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">Особисті нотатки</h2>
        <form onSubmit={addNote} className="mb-3 flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Нова нотатка" />
          <button className="btn-primary" type="submit">Додати</button>
        </form>
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card flex items-start justify-between gap-2">
              <span>{n.content}</span>
              <button className="btn-secondary" onClick={() => notesApi.remove(n.id).then(() => setNotes(notes.filter((x) => x.id !== n.id)))}>Видалити</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
