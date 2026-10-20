import { useEffect, useState } from 'react';
import { api } from '../api/http';
import { sessionApi } from '../api/services';
import type { Session, Slot } from '../api/types';

/** FR-07, FR-08: розклад і сесії психолога. Форми створення слотів і підтвердження — наступна ітерація. */
export default function PsychologistCabinet() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api<Slot[]>('/slots/my').then(setSlots);
    sessionApi.mine().then(setSessions);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Кабінет психолога</h1>
      <section><h2 className="text-xl font-semibold">Мій розклад</h2>
        <ul className="mt-2 space-y-1">{slots.map((s) => <li key={s.id}>{new Date(s.startsAt).toLocaleString('uk-UA')} — {s.status}</li>)}</ul>
      </section>
      <section><h2 className="text-xl font-semibold">Сесії</h2>
        <ul className="mt-2 space-y-1">{sessions.map((s) => <li key={s.id}>{new Date(s.startsAt).toLocaleString('uk-UA')} — {s.status}</li>)}</ul>
      </section>
    </div>
  );
}
