import request from 'supertest';
import { Api, createApi } from '../httpHelpers';

/**
 * Системні тести: повні користувацькі сценарії крізь увесь стек (HTTP → сервіси → події → сповіщення),
 * як їх виконував би кінцевий користувач. Єдиний «шов» — керований годинник.
 */
describe('Системні сценарії', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  async function setup() {
    const admin = await api.admin();
    const psy = await api.registerPsychologist();
    await api.verify(psy.id, admin.token);
    const client = await api.registerClient();
    const slot = await api.slot(psy.token);
    return { admin, psy, client, slot };
  }
  const book = async (token: string, slotId: string) =>
    (await request(api.app).post('/api/sessions').set(api.bearer(token)).send({ slotId }).expect(201)).body.session.id as string;

  it('СЦ-1. Повний життєвий цикл: бронювання → оплата → сесія → завершення → відгук → рейтинг у каталозі', async () => {
    const { psy, client, slot } = await setup();
    const id = await book(client.token, slot.id);
    await api.pay(id);

    // час проходить до початку сесії
    api.env.clock.advanceMinutes(48 * 60 + 5);
    const done = await request(api.app).post(`/api/sessions/${id}/complete`).set(api.bearer(psy.token));
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('COMPLETED');

    await request(api.app).post(`/api/sessions/${id}/review`).set(api.bearer(client.token)).send({ rating: 5, text: 'Дуже допомогло' }).expect(201);
    const profile = (await request(api.app).get(`/api/psychologists/${psy.id}`)).body;
    expect(profile.averageRating).toBe(5);
    expect(profile.reviews[0]).toMatchObject({ authorPseudonym: 'Сова', rating: 5 });
    expect(JSON.stringify(profile)).not.toContain('owl@example.com');
  });

  it('СЦ-2. Клієнт не оплатив за 15 хв: сесія спливає, слот знову доступний іншому клієнту', async () => {
    const { psy, client, slot } = await setup();
    const other = await api.registerClient('second@example.com', 'Лис');
    await book(client.token, slot.id);
    expect((await request(api.app).post('/api/sessions').set(api.bearer(other.token)).send({ slotId: slot.id })).status).toBe(409);

    api.env.clock.advanceMinutes(16);
    expect(await api.env.c.booking.expireOverdue()).toBe(1);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(client.token))).body[0].status).toBe('EXPIRED');
    expect((await request(api.app).get(`/api/psychologists/${psy.id}/slots`)).body).toHaveLength(1);

    const second = await book(other.token, slot.id);
    await api.pay(second);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(other.token))).body[0].status).toBe('CONFIRMED');
  });

  it('СЦ-3. Психолог скасовує підтверджену сесію: клієнт отримує лист із причиною, слот звільняється', async () => {
    const { psy, client, slot } = await setup();
    const id = await book(client.token, slot.id);
    await api.pay(id);
    await request(api.app).post(`/api/sessions/${id}/cancel`).set(api.bearer(psy.token)).send({ reason: 'Хвороба психолога' }).expect(200);
    await api.env.c.notifications.processDue();
    const mail = api.env.email.sent.find((m) => m.to === 'owl@example.com' && m.subject.includes('скасовано'));
    expect(mail?.body).toContain('Хвороба психолога');
    expect((await request(api.app).get(`/api/psychologists/${psy.id}/slots`)).body).toHaveLength(1);
  });

  it('СЦ-4. Нагадування за 24 год: надсилається лише коли настає час', async () => {
    const { client, slot } = await setup();
    const id = await book(client.token, slot.id);
    await api.pay(id);
    await api.env.c.notifications.processDue();
    const countReminders = () => api.env.email.sent.filter((m) => m.subject.includes('Нагадування')).length;
    expect(countReminders()).toBe(0);
    api.env.clock.advanceMinutes(24 * 60 + 1); // до початку лишилось < 24 год
    await api.env.c.notifications.processDue();
    expect(countReminders()).toBe(2); // клієнту й психологу
    await api.env.c.notifications.processDue();
    expect(countReminders()).toBe(2); // повторно не надсилається
  });

  it('СЦ-5. Модерація: скарга → блокування психолога → вхід неможливий → аудит фіксує дії адміна', async () => {
    const { admin, psy, client } = await setup();
    const c = await request(api.app).post('/api/complaints').set(api.bearer(client.token)).send({ targetUserId: psy.id, text: 'Грубість' }).expect(201);
    await request(api.app).post(`/api/admin/complaints/${c.body.id}/resolve`).set(api.bearer(admin.token)).send({ resolution: 'Блокування' }).expect(204);
    await request(api.app).post(`/api/admin/users/${psy.id}/block`).set(api.bearer(admin.token)).send({ reason: 'За скаргою' }).expect(204);
    expect((await request(api.app).post('/api/auth/login').send({ email: 'psy@example.com', password: 'Passw0rdX' })).status).toBe(403);

    const audit = (await request(api.app).get('/api/admin/audit').set(api.bearer(admin.token))).body as Array<{ action: string; adminId: string }>;
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['PSYCHOLOGIST_VERIFIED', 'USER_BLOCKED']));
    expect(new Set(audit.map((a) => a.adminId)).size).toBe(1);
  });

  it('СЦ-6. Ізоляція даних: клієнт бачить лише власні сесії та нотатки, психолог — лише власні сесії', async () => {
    const { psy, client, slot } = await setup();
    const other = await api.registerClient('second@example.com', 'Лис');
    const otherPsy = await api.registerPsychologist('psy2@example.com');
    await book(client.token, slot.id);
    await request(api.app).post('/api/notes').set(api.bearer(client.token)).send({ content: 'приватне' }).expect(201);

    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(other.token))).body).toEqual([]);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(otherPsy.token))).body).toEqual([]);
    expect((await request(api.app).get('/api/notes').set(api.bearer(other.token))).body).toEqual([]);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(psy.token))).body).toHaveLength(1);
  });

  it('СЦ-7. Відхилена анкета: психолога немає в каталозі, слотів не видно, бронювання неможливе', async () => {
    const admin = await api.admin();
    const psy = await api.registerPsychologist();
    const client = await api.registerClient();
    const slot = await api.slot(psy.token);
    await request(api.app).post(`/api/admin/psychologists/${psy.id}/reject`).set(api.bearer(admin.token)).send({ reason: 'Немає диплома' }).expect(204);
    expect((await request(api.app).get('/api/psychologists')).body).toEqual([]);
    expect((await request(api.app).get(`/api/psychologists/${psy.id}/slots`)).status).toBe(404);
    expect((await request(api.app).post('/api/sessions').set(api.bearer(client.token)).send({ slotId: slot.id })).status).toBe(404);
  });
});
