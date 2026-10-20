import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import { api } from '../api/http';
import { catalogApi, sessionApi } from '../api/services';
import type { PsychologistCard, Slot } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Profile = PsychologistCard & { bio?: string; averageRating: number | null; reviews: Array<{ rating: number; text: string; authorPseudonym: string }> };

/** FR-03 (профіль) та FR-04 (вибір слота й бронювання). Оплата (FR-06) — наступна ітерація: тут лише створюється платіжний намір. */
export default function PsychologistProfile() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>(`/psychologists/${id}`).then(setProfile).catch(() => setProfile(null));
    catalogApi.slots(id).then(setSlots).catch(() => setSlots([]));
  }, [id]);

  async function book(slotId: string) {
    try {
      await sessionApi.book(slotId);
      setMessage('Слот заброньовано. Оплатіть сесію протягом 15 хвилин.');
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Не вдалося забронювати');
    }
  }

  if (!profile) return <p>Профіль не знайдено.</p>;
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold">{profile.fullName}</h1>
      <p>{profile.bio}</p>
      <p>Середня оцінка: {profile.averageRating ?? 'ще немає відгуків'}</p>
      <section>
        <h2 className="text-xl font-semibold">Вільний час</h2>
        {slots.length === 0 ? <p>Немає вільних слотів.</p> : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => (
              <li key={s.id}>
                <button className="btn-secondary" disabled={user?.role !== 'CLIENT'} onClick={() => book(s.id)}>
                  {new Date(s.startsAt).toLocaleString('uk-UA')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!user && <p className="mt-2 text-sm">Увійдіть як клієнт, щоб забронювати сесію.</p>}
        {message && <p role="status" className="mt-2">{message}</p>}
      </section>
    </article>
  );
}
