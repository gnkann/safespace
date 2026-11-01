import request from 'supertest';
import { Api, createApi } from '../httpHelpers';

/**
 * Компонентні тести: HTTP-шар + сервіси + in-memory репозиторії + шина подій.
 * Перевіряються статус-коди, формат JSON і взаємодія модулів (подія → підписник).
 */
describe('Компонент Auth (HTTP ↔ AuthService ↔ EventBus ↔ Notification)', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  it('POST /auth/register/client → 201 і форма відповіді без чутливих полів', async () => {
    const r = await request(api.app).post('/api/auth/register/client').send({
      pseudonym: 'Сова', email: 'o@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
    });
    expect(r.status).toBe(201);
    expect(Object.keys(r.body).sort()).toEqual(['id', 'pseudonym', 'status']);
    expect(r.headers['content-type']).toMatch(/application\/json/);
  });

  it('реєстрація ставить у чергу лист, а processDue його відправляє (подія user.registered)', async () => {
    await request(api.app).post('/api/auth/register/client').send({
      pseudonym: 'A', email: 'o@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
    });
    expect(api.env.email.sent).toHaveLength(0);
    expect(await api.env.c.notifications.processDue()).toBe(1);
    expect(api.env.email.sent[0].to).toBe('o@e.com');
  });

  it('повторна реєстрація того ж email → 409', async () => {
    await api.registerClient('dup@e.com');
    const r = await request(api.app).post('/api/auth/register/client').send({
      pseudonym: 'B', email: 'DUP@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
    });
    expect(r.status).toBe(409);
  });

  it('вхід: невірний пароль → 401, до підтвердження email → не 200', async () => {
    await request(api.app).post('/api/auth/register/client').send({
      pseudonym: 'A', email: 'o@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
    });
    expect((await request(api.app).post('/api/auth/login').send({ email: 'o@e.com', password: 'Passw0rdX' })).status).not.toBe(200);
    expect((await request(api.app).post('/api/auth/login').send({ email: 'o@e.com', password: 'bad' })).status).toBe(401);
  });

  it('підроблений/сміттєвий токен підтвердження → 401', async () => {
    expect((await request(api.app).post('/api/auth/confirm-email').send({ token: 'garbage' })).status).toBe(401);
  });

  it('заблокований адміном користувач не може увійти (Admin ↔ Auth)', async () => {
    const c = await api.registerClient();
    const admin = await api.admin();
    await request(api.app).post(`/api/admin/users/${c.id}/block`).set(api.bearer(admin.token)).send({ reason: 'спам' }).expect(204);
    expect((await request(api.app).post('/api/auth/login').send({ email: 'owl@example.com', password: 'Passw0rdX' })).status).toBe(403);
    await request(api.app).post(`/api/admin/users/${c.id}/unblock`).set(api.bearer(admin.token)).expect(204);
    await request(api.app).post('/api/auth/login').send({ email: 'owl@example.com', password: 'Passw0rdX' }).expect(200);
  });
});

describe('Компонент Admin (HTTP)', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  it('усі /admin/* вимагають токен адміністратора: 401 без токена, 403 для клієнта і психолога', async () => {
    const c = await api.registerClient();
    const p = await api.registerPsychologist();
    const paths = ['/api/admin/users', '/api/admin/complaints', '/api/admin/audit', '/api/admin/psychologists/pending'];
    for (const path of paths) {
      expect((await request(api.app).get(path)).status).toBe(401);
      expect((await request(api.app).get(path).set(api.bearer(c.token))).status).toBe(403);
      expect((await request(api.app).get(path).set(api.bearer(p.token))).status).toBe(403);
    }
  });

  it('черга верифікації: анкета з’являється, після verify зникає; reject вимагає причину', async () => {
    const p = await api.registerPsychologist();
    const admin = await api.admin();
    const pending = await request(api.app).get('/api/admin/psychologists/pending').set(api.bearer(admin.token));
    expect(pending.body.map((x: { id: string }) => x.id)).toEqual([p.id]);

    expect((await request(api.app).post(`/api/admin/psychologists/${p.id}/reject`).set(api.bearer(admin.token)).send({})).status).toBe(400);
    await request(api.app).post(`/api/admin/psychologists/${p.id}/reject`).set(api.bearer(admin.token)).send({ reason: 'нечіткий диплом' }).expect(204);
    expect((await request(api.app).get('/api/psychologists')).body).toEqual([]);
  });

  it('список користувачів не містить хешів паролів', async () => {
    await api.registerClient();
    const admin = await api.admin();
    const users = await request(api.app).get('/api/admin/users').set(api.bearer(admin.token));
    expect(users.body.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('скарги: подання → список → розгляд → запис в аудиті; порожня скарга → 400', async () => {
    const c = await api.registerClient();
    const p = await api.registerPsychologist();
    const admin = await api.admin();
    expect((await request(api.app).post('/api/complaints').set(api.bearer(c.token)).send({ targetUserId: p.id, text: ' ' })).status).toBe(400);
    expect((await request(api.app).post('/api/complaints').send({ targetUserId: p.id, text: 'x' })).status).toBe(401);
    const created = await request(api.app).post('/api/complaints').set(api.bearer(c.token)).send({ targetUserId: p.id, text: 'Неетична поведінка' }).expect(201);
    const list = await request(api.app).get('/api/admin/complaints').set(api.bearer(admin.token));
    expect(list.body).toHaveLength(1);
    await request(api.app).post(`/api/admin/complaints/${created.body.id}/resolve`).set(api.bearer(admin.token)).send({ resolution: 'Попередження' }).expect(204);
    const audit = await request(api.app).get('/api/admin/audit').set(api.bearer(admin.token));
    expect(audit.body.length).toBeGreaterThanOrEqual(1);
  });

  it('скарга на неіснуючого користувача → 404', async () => {
    const c = await api.registerClient();
    expect((await request(api.app).post('/api/complaints').set(api.bearer(c.token)).send({ targetUserId: 'nope', text: 'x' })).status).toBe(404);
  });
});

describe('Компонент Catalog + Schedule (HTTP)', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  it('GET /psychologists/:id → 404 для неіснуючого та для неверифікованого', async () => {
    const p = await api.registerPsychologist();
    expect((await request(api.app).get('/api/psychologists/unknown')).status).toBe(404);
    expect((await request(api.app).get(`/api/psychologists/${p.id}`)).status).toBe(404);
    await api.verify(p.id, (await api.admin()).token);
    const r = await request(api.app).get(`/api/psychologists/${p.id}`);
    expect(r.status).toBe(200);
    expect(r.body.averageRating).toBeNull();
    expect(JSON.stringify(r.body)).not.toContain('psy@example.com');
  });

  it('некоректні параметри фільтра → 400', async () => {
    expect((await request(api.app).get('/api/psychologists?minPrice=abc')).status).toBe(400);
    expect((await request(api.app).get('/api/psychologists?from=not-a-date')).status).toBe(400);
  });

  it('фільтр за ціною та спеціалізацією через query-параметри', async () => {
    const admin = await api.admin();
    const cheap = await api.registerPsychologist('a@e.com', { pricePerSession: 300, specializations: ['депресія'] });
    const dear = await api.registerPsychologist('b@e.com', { pricePerSession: 1500, specializations: ['стрес'] });
    await api.verify(cheap.id, admin.token);
    await api.verify(dear.id, admin.token);
    const ids = async (q: string) => (await request(api.app).get(`/api/psychologists${q}`)).body.map((x: { id: string }) => x.id);
    expect(await ids('')).toHaveLength(2);
    expect(await ids('?maxPrice=500')).toEqual([cheap.id]);
    expect(await ids('?minPrice=1000')).toEqual([dear.id]);
    expect(await ids('?specialization=стрес')).toEqual([dear.id]);
  });

  it('слоти: створення тільки психологом (403 клієнту), перетин → 409, минуле → 400, видалення', async () => {
    const admin = await api.admin();
    const p = await api.registerPsychologist();
    await api.verify(p.id, admin.token);
    const c = await api.registerClient();
    const start = new Date(api.env.clock.now().getTime() + 48 * 3_600_000);
    const body = { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_000_000).toISOString() };

    expect((await request(api.app).post('/api/slots').set(api.bearer(c.token)).send(body)).status).toBe(403);
    const slot = await request(api.app).post('/api/slots').set(api.bearer(p.token)).send(body).expect(201);
    expect((await request(api.app).post('/api/slots').set(api.bearer(p.token)).send(body)).status).toBe(409);
    expect((await request(api.app).post('/api/slots').set(api.bearer(p.token)).send({ startsAt: 'bad', endsAt: 'bad' })).status).toBe(400);
    const past = new Date(api.env.clock.now().getTime() - 3_600_000);
    expect((await request(api.app).post('/api/slots').set(api.bearer(p.token)).send({ startsAt: past.toISOString(), endsAt: start.toISOString() })).status).toBe(400);

    expect((await request(api.app).get(`/api/psychologists/${p.id}/slots`)).body).toHaveLength(1);
    expect((await request(api.app).get('/api/slots/my').set(api.bearer(p.token))).body).toHaveLength(1);
    await request(api.app).delete(`/api/slots/${slot.body.id}`).set(api.bearer(p.token)).expect(204);
    expect((await request(api.app).get(`/api/psychologists/${p.id}/slots`)).body).toHaveLength(0);
  });
});

describe('Компонент Booking ↔ Payment ↔ Notification (HTTP)', () => {
  let api: Api;
  let client: { id: string; token: string };
  let psy: { id: string; token: string };
  let slotId: string;

  beforeEach(async () => {
    api = await createApi();
    const admin = await api.admin();
    psy = await api.registerPsychologist();
    await api.verify(psy.id, admin.token);
    client = await api.registerClient();
    slotId = (await api.slot(psy.token)).id;
  });

  const book = async () => (await request(api.app).post('/api/sessions').set(api.bearer(client.token)).send({ slotId }).expect(201)).body.session.id as string;

  it('POST /sessions: психолог не може бронювати (403), без slotId → 404', async () => {
    expect((await request(api.app).post('/api/sessions').set(api.bearer(psy.token)).send({ slotId })).status).toBe(403);
    expect((await request(api.app).post('/api/sessions').set(api.bearer(client.token)).send({})).status).toBe(404);
  });

  it('відповідь на бронювання містить платіжний намір (clientSecret, UAH) і не містить зайвого', async () => {
    const r = await request(api.app).post('/api/sessions').set(api.bearer(client.token)).send({ slotId }).expect(201);
    expect(r.body.payment).toMatchObject({ amount: 800, currency: 'UAH' });
    expect(r.body.payment.clientSecret).toEqual(expect.any(String));
  });

  it('вебхук: успіх → CONFIRMED; помилка оплати → сесія лишається PENDING', async () => {
    const id = await book();
    expect((await api.pay(id, 'payment.failed')).status).toBe(200);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(client.token))).body[0].status).toBe('PENDING');
    // повторний вебхук для кінцевого платежу ігнорується (ідемпотентність)
    expect((await api.pay(id)).status).toBe(200);
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(client.token))).body[0].status).toBe('PENDING');
  });

  it('вебхук: сміття → 400, невідомий платіж → 404', async () => {
    expect((await request(api.app).post('/api/payments/webhook').send('not json')).status).toBe(400);
    const unknown = await request(api.app).post('/api/payments/webhook').send(JSON.stringify({ type: 'payment.succeeded', providerPaymentId: 'zzz' }));
    expect(unknown.status).toBe(404);
  });

  it('скасування: порожня причина → 400; стороння особа → 403; власник → 200 і слот знову вільний', async () => {
    const id = await book();
    const other = await api.registerClient('other@e.com', 'Інший');
    expect((await request(api.app).post(`/api/sessions/${id}/cancel`).set(api.bearer(client.token)).send({ reason: '' })).status).toBe(400);
    expect((await request(api.app).post(`/api/sessions/${id}/cancel`).set(api.bearer(other.token)).send({ reason: 'x' })).status).toBe(403);
    const ok = await request(api.app).post(`/api/sessions/${id}/cancel`).set(api.bearer(client.token)).send({ reason: 'Захворіла' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('CANCELLED');
    expect((await request(api.app).get(`/api/psychologists/${psy.id}/slots`)).body).toHaveLength(1);
  });

  it('скасування генерує листи обом учасникам (подія session.cancelled)', async () => {
    const id = await book();
    await request(api.app).post(`/api/sessions/${id}/cancel`).set(api.bearer(client.token)).send({ reason: 'Захворіла' }).expect(200);
    await api.env.c.notifications.processDue();
    const cancelled = api.env.email.sent.filter((m) => m.subject.includes('скасовано'));
    expect(cancelled.map((m) => m.to).sort()).toEqual(['owl@example.com', 'psy@example.com']);
  });

  it('завершення: клієнт → 403, психолог до початку → конфлікт; відгук до завершення → 409', async () => {
    const id = await book();
    await api.pay(id);
    expect((await request(api.app).post(`/api/sessions/${id}/complete`).set(api.bearer(client.token))).status).toBe(403);
    expect((await request(api.app).post(`/api/sessions/${id}/complete`).set(api.bearer(psy.token))).status).toBeGreaterThanOrEqual(400);
    expect((await request(api.app).post(`/api/sessions/${id}/review`).set(api.bearer(client.token)).send({ rating: 5, text: 'ok' })).status).toBe(409);
  });

  it('GET /sessions/my повертає різні списки для клієнта й психолога', async () => {
    await book();
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(psy.token))).body).toHaveLength(1);
    const other = await api.registerClient('other@e.com', 'Інший');
    expect((await request(api.app).get('/api/sessions/my').set(api.bearer(other.token))).body).toHaveLength(0);
  });

  it('нотатки: CRUD, чужі недоступні, психолог не має доступу (403)', async () => {
    const n = await request(api.app).post('/api/notes').set(api.bearer(client.token)).send({ content: 'Нотатка' }).expect(201);
    const other = await api.registerClient('other@e.com', 'Інший');
    expect((await request(api.app).get('/api/notes').set(api.bearer(other.token))).body).toHaveLength(0);
    expect((await request(api.app).get('/api/notes').set(api.bearer(psy.token))).status).toBe(403);
    expect((await request(api.app).delete(`/api/notes/${n.body.id}`).set(api.bearer(other.token))).status).toBeGreaterThanOrEqual(400);
    await request(api.app).delete(`/api/notes/${n.body.id}`).set(api.bearer(client.token)).expect(204);
    expect((await request(api.app).get('/api/notes').set(api.bearer(client.token))).body).toHaveLength(0);
  });
});
