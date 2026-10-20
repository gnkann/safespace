import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/services';
import type { PsychologistCard } from '../api/types';

/** FR-02: каталог із фільтрами за спеціалізацією та ціною (фільтр за часом — наступна ітерація UI). */
export default function Catalog() {
  const [items, setItems] = useState<PsychologistCard[]>([]);
  const [specialization, setSpecialization] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    catalogApi.search({ specialization, maxPrice }).then(setItems).finally(() => setLoading(false));
  }, [specialization, maxPrice]);

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Каталог психологів</h1>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label>Спеціалізація
          <input className="input mt-1" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="тривога, стрес…" />
        </label>
        <label>Макс. ціна, грн
          <input className="input mt-1" type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </label>
      </div>
      {loading ? <p>Завантаження…</p> : items.length === 0 ? <p>Нікого не знайдено.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.id} className="card">
              <h2 className="text-lg font-semibold">{p.fullName}</h2>
              <p>{p.specializations.join(', ')}</p>
              <p className="text-sm text-slate-700">Досвід: {p.experienceYears} р. · {p.pricePerSession} грн / {p.sessionDurationMin} хв</p>
              <Link className="btn-secondary mt-3" to={`/psychologists/${p.id}`}>Профіль</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
