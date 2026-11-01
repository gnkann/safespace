import request from 'supertest';
import { createApp } from '../src/app';
import { createTestEnv, profile } from './helpers';

/** Наскрізний сценарій через HTTP: реєстрація → верифікація → каталог → бронювання → оплата → кабінет. */
describe('REST API — наскрізний сценарій MVP', () => {
  it('проходить повний шлях клієнта', async () => {
    const env = createTestEnv();
    await env.c.bootstrap();
    const app = createApp(env.c);
    const tokenFromMail = async (to: string) => {
      await env.c.notifications.processDue();
      const mail = [...env.email.sent].reverse().find((m) => m.to === to)!;
      return mail.body.split('token=')[1];
    };

    expect((await request(app).get('/api/health')).body.status).toBe('ok');

    // Реєстрація психолога + підтвердження email
    const reg = await request(app).post('/api/auth/register/psychologist').send({
      email: 'psy@example.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', consentAccepted: true, profile: profile(),
    });
    expect(reg.status).toBe(201);
    expect(reg.body.verificationStatus).toBe('PENDING');
    await request(app).post('/api/auth/confirm-email').send({ token: await tokenFromMail('psy@example.com') }).expect(204);
    const psyLogin = await request(app).post('/api/auth/login').send({ email: 'psy@example.com', password: 'Passw0rdX' }).expect(200);
    const psyAuth = { Authorization: `Bearer ${psyLogin.body.token}` };

    // До верифікації психолога немає в каталозі
    expect((await request(app).get('/api/psychologists')).body).toEqual([]);

    // Адмін верифікує
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin12345' }).expect(200);
    const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
    await request(app).post(`/api/admin/psychologists/${reg.body.id}/verify`).set(adminAuth).expect(204);
    expect((await request(app).get('/api/admin/audit').set(adminAuth)).body).toHaveLength(1);

    // Психолог додає слот
    const start = new Date(env.clock.now().getTime() + 48 * 3_600_000);
    const slot = await request(app).post('/api/slots').set(psyAuth)
      .send({ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_000_000).toISOString() }).expect(201);

    // Клієнт реєструється й шукає
    await request(app).post('/api/auth/register/client').send({
      pseudonym: 'Сова', email: 'owl@example.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
    }).expect(201);
    await request(app).post('/api/auth/confirm-email').send({ token: await tokenFromMail('owl@example.com') }).expect(204);
    const cLogin = await request(app).post('/api/auth/login').send({ email: 'owl@example.com', password: 'Passw0rdX' });
    const cAuth = { Authorization: `Bearer ${cLogin.body.token}` };

    const catalog = await request(app).get('/api/psychologists?specialization=тривога&maxPrice=1000');
    expect(catalog.body).toHaveLength(1);
    expect(JSON.stringify(catalog.body)).not.toContain('psy@example.com');
    expect((await request(app).get(`/api/psychologists/${reg.body.id}/slots`)).body).toHaveLength(1);

    // Бронювання та оплата
    const booked = await request(app).post('/api/sessions').set(cAuth).send({ slotId: slot.body.id }).expect(201);
    expect(booked.body.session.status).toBe('PENDING');
    await request(app).post('/api/sessions').set(cAuth).send({ slotId: slot.body.id }).expect(409);

    const providerPaymentId = (await env.c.repositories.payments.findBySession(booked.body.session.id))!.providerPaymentId;
    await request(app).post('/api/payments/webhook').send(JSON.stringify({ type: 'payment.succeeded', providerPaymentId })).expect(200);
    const mine = await request(app).get('/api/sessions/my').set(cAuth);
    expect(mine.body[0].status).toBe('CONFIRMED');

    // Нотатки
    await request(app).post('/api/notes').set(cAuth).send({ content: 'Після сесії стало легше' }).expect(201);
    expect((await request(app).get('/api/notes').set(cAuth)).body[0].content).toBe('Після сесії стало легше');
  });

  it('захищає маршрути: 401 без токена, 403 для чужої ролі, єдиний формат помилок', async () => {
    const env = createTestEnv();
    const app = createApp(env.c);
    const noAuth = await request(app).get('/api/sessions/my');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('UNAUTHORIZED');

    await env.c.bootstrap();
    await request(app).post('/api/auth/register/client').send({ pseudonym: 'A', email: 'a@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true });
    await env.c.notifications.processDue();
    const token = env.email.sent[0].body.split('token=')[1];
    await request(app).post('/api/auth/confirm-email').send({ token });
    const login = await request(app).post('/api/auth/login').send({ email: 'a@e.com', password: 'Passw0rdX' });

    const forbidden = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${login.body.token}`);
    expect(forbidden.status).toBe(403);

    const invalid = await request(app).post('/api/auth/register/client').send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    expect((await request(app).get('/api/nope')).status).toBe(404);
  });
});
