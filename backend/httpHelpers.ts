import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../src/app';
import { createTestEnv, profile, TestEnv } from './helpers';

/** Допоміжні функції для HTTP-тестів: усе робиться лише через публічний REST API. */
export interface Api {
  env: TestEnv;
  app: Express;
  bearer(token: string): { Authorization: string };
  mailToken(to: string): Promise<string>;
  registerClient(email?: string, pseudonym?: string): Promise<{ id: string; token: string }>;
  registerPsychologist(email?: string, over?: Record<string, unknown>): Promise<{ id: string; token: string }>;
  admin(): Promise<{ token: string }>;
  verify(psyId: string, adminToken: string): Promise<void>;
  slot(psyToken: string, hoursAhead?: number): Promise<{ id: string }>;
  pay(sessionId: string, type?: 'payment.succeeded' | 'payment.failed'): Promise<request.Response>;
}

export async function createApi(): Promise<Api> {
  const env = createTestEnv();
  await env.c.bootstrap();
  const app = createApp(env.c);
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const mailToken = async (to: string) => {
    await env.c.notifications.processDue();
    const mail = [...env.email.sent].reverse().find((m) => m.to === to && m.body.includes('token='))!;
    return mail.body.split('token=')[1];
  };
  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password }).expect(200)).body.token as string;

  return {
    env, app, bearer, mailToken,
    async registerClient(email = 'owl@example.com', pseudonym = 'Сова') {
      const r = await request(app).post('/api/auth/register/client').send({
        pseudonym, email, password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', isAdultConfirmed: true, consentAccepted: true,
      }).expect(201);
      await request(app).post('/api/auth/confirm-email').send({ token: await mailToken(email) }).expect(204);
      return { id: r.body.id, token: await login(email, 'Passw0rdX') };
    },
    async registerPsychologist(email = 'psy@example.com', over = {}) {
      const r = await request(app).post('/api/auth/register/psychologist').send({
        email, password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', consentAccepted: true, profile: profile(over),
      }).expect(201);
      await request(app).post('/api/auth/confirm-email').send({ token: await mailToken(email) }).expect(204);
      return { id: r.body.id, token: await login(email, 'Passw0rdX') };
    },
    async admin() {
      return { token: await login('admin@test.local', 'Admin12345') };
    },
    async verify(psyId, adminToken) {
      await request(app).post(`/api/admin/psychologists/${psyId}/verify`).set(bearer(adminToken)).expect(204);
    },
    async slot(psyToken, hoursAhead = 48) {
      const start = new Date(env.clock.now().getTime() + hoursAhead * 3_600_000);
      const r = await request(app).post('/api/slots').set(bearer(psyToken))
        .send({ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_000_000).toISOString() }).expect(201);
      return { id: r.body.id };
    },
    async pay(sessionId, type = 'payment.succeeded') {
      const p = (await env.c.repositories.payments.findBySession(sessionId))!;
      return request(app).post('/api/payments/webhook').send(JSON.stringify({ type, providerPaymentId: p.providerPaymentId }));
    },
  };
}
