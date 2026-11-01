import { NotFoundError } from '../src/shared/errors';
import { createTestEnv, openSlot, psychologist } from './helpers';

describe('CatalogService (FR-02, FR-03)', () => {
  it('не показує неверифікованих психологів і не розкриває їхній профіль', async () => {
    const env = createTestEnv();
    const p = await psychologist(env, { verified: false });
    expect(await env.c.catalog.search()).toHaveLength(0);
    await expect(env.c.catalog.getProfile(p.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('показує верифікованих і не віддає чутливих даних у картці', async () => {
    const env = createTestEnv();
    await psychologist(env);
    const [card] = await env.c.catalog.search();
    expect(card.fullName).toBe('Іваненко Марія Петрівна');
    expect(JSON.stringify(card)).not.toMatch(/email|passwordHash|phone/i);
  });

  it('фільтрує за спеціалізацією та ціною', async () => {
    const env = createTestEnv();
    await psychologist(env, { email: 'a@e.com', profile: { specializations: ['депресія'], pricePerSession: 500 } });
    await psychologist(env, { email: 'b@e.com', profile: { fullName: 'Петренко О.', specializations: ['тривога'], pricePerSession: 1200 } });

    expect((await env.c.catalog.search({ specialization: 'ТРИВОГА' })).map((c) => c.fullName)).toEqual(['Петренко О.']);
    expect(await env.c.catalog.search({ maxPrice: 600 })).toHaveLength(1);
    expect(await env.c.catalog.search({ minPrice: 600, maxPrice: 1000 })).toHaveLength(0);
  });

  it('фільтрує за доступністю у часі', async () => {
    const env = createTestEnv();
    const withSlot = await psychologist(env, { email: 'a@e.com' });
    await psychologist(env, { email: 'b@e.com', profile: { fullName: 'Без слотів' } });
    const slot = await openSlot(env, withSlot.id, 48);

    const found = await env.c.catalog.search({ availableFrom: slot.startsAt, availableTo: slot.endsAt });
    expect(found.map((c) => c.id)).toEqual([withSlot.id]);
    expect(await env.c.catalog.search({ availableFrom: new Date(slot.endsAt.getTime() + 3_600_000) })).toHaveLength(0);
  });

  it('профіль містить середню оцінку (null без відгуків)', async () => {
    const env = createTestEnv();
    const p = await psychologist(env);
    const view = await env.c.catalog.getProfile(p.id);
    expect(view.averageRating).toBeNull();
    expect(view.diplomaCount).toBe(1);
  });
});
