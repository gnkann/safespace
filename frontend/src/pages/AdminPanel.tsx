import { useEffect, useState } from 'react';
import { api } from '../api/http';

interface Pending { id: string; email: string; profile: { fullName: string; diplomaFileKeys: string[] } }

/** FR-10: черга верифікації анкет психологів. Модерація скарг і керування користувачами (FR-11, FR-12) — наступна ітерація UI. */
export default function AdminPanel() {
  const [pending, setPending] = useState<Pending[]>([]);
  const load = () => api<Pending[]>('/admin/psychologists/pending').then(setPending);
  useEffect(() => { void load(); }, []);

  async function verify(id: string) {
    await api(`/admin/psychologists/${id}/verify`, { method: 'POST' });
    await load();
  }

  return (
    <section>
      <h1 className="mb-3 text-2xl font-bold">Анкети на перевірці</h1>
      {pending.length === 0 ? <p>Черга порожня.</p> : (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li key={p.id} className="card flex items-center justify-between gap-2">
              <span>{p.profile.fullName} · дипломів: {p.profile.diplomaFileKeys.length}</span>
              <button className="btn-primary" onClick={() => verify(p.id)}>Підтвердити</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
