import request from 'supertest';
import { performance } from 'node:perf_hooks';
import { Api, createApi } from '../httpHelpers';
import { profile } from '../helpers';
import { Role } from '../../src/shared/domain/enums';

/**
 * Валідація нефункціональних вимог. Пороги навмисно м’які (CI-середовище),
 * але достатні, щоб виявити регресії порядку величин.
 */
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];

describe('NFR-02: цілісність бронювання під конкурентним навантаженням', () => {
  it('20 клієнтів одночасно бронюють один слот → рівно 1 успіх, 19 конфліктів', async () => {
    const api = await createApi();
    const admin = await api.admin();
    const psy = await api.registerPsychologist();
    await api.verify(psy.id, admin.token);
    const slot = await api.slot(psy.token);
    const clients = await Promise.all(Array.from({ length: 20 }, (_, i) => api.registerClient(`c${i}@e.com`, `К${i}`)));

    const results = await Promise.all(
      clients.map((c) => request(api.app).post('/api/sessions').set(api.bearer(c.token)).send({ slotId: slot.id })),
    );
    const codes = results.map((r) => r.status);
    expect(codes.filter((s) => s === 201)).toHaveLength(1);
    expect(codes.filter((s) => s === 409)).toHaveLength(19);
    expect(await api.env.c.repositories.payments.findBySession(results.find((r) => r.status === 201)!.body.session.id)).toBeTruthy();
  });
});

describe('Продуктивність (NFR: час відгуку)', () => {
  it('каталог із 150 психологів: p95 пошуку < 200 мс, відповідь < 100 КБ', async () => {
    const api = await createApi();
    const admin = await api.admin();
    for (let i = 0; i < 150; i++) {
      const p = await api.env.c.auth.registerPsychologist({
        email: `p${i}@e.com`, password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', consentAccepted: true,
        profile: profile({ fullName: `Психолог ${i}`, pricePerSession: 300 + i * 10, specializations: i % 2 ? ['стрес'] : ['тривога'] }),
      });
      await api.env.c.auth.confirmEmail(api.env.c.tokens.signEmailConfirmationToken(p.id));
      await api.env.c.admin.verifyPsychologist('admin-id', p.id);
      await api.env.c.schedule.createSlot(p.id, new Date(api.env.clock.now().getTime() + 48 * 3_600_000), new Date(api.env.clock.now().getTime() + 49 * 3_600_000));
    }
    void admin;
    const times: number[] = [];
    let size = 0;
    for (let i = 0; i < 40; i++) {
      const t = performance.now();
      const r = await request(api.app).get('/api/psychologists?specialization=стрес&maxPrice=1500');
      times.push(performance.now() - t);
      size = Buffer.byteLength(JSON.stringify(r.body));
      expect(r.status).toBe(200);
    }
    console.info(`[NFR] каталог: p95=${p95(times).toFixed(1)} мс, розмір=${(size / 1024).toFixed(1)} КБ`);
    expect(p95(times)).toBeLessThan(200);
    expect(size).toBeLessThan(100 * 1024);
  });

  it('health-check: p95 < 50 мс', async () => {
    const api = await createApi();
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t = performance.now();
      await request(api.app).get('/api/health').expect(200);
      times.push(performance.now() - t);
    }
    console.info(`[NFR] /health: p95=${p95(times).toFixed(1)} мс`);
    expect(p95(times)).toBeLessThan(50);
  });
});

describe('NFR-03/04: безпека та конфіденційність', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  it('HTTP-заголовки безпеки (helmet), приховано x-powered-by', async () => {
    const r = await request(api.app).get('/api/health');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.headers['x-frame-options']).toBeDefined();
  });

  it('жодна відповідь API не містить хешів паролів чи email клієнта у публічних даних', async () => {
    const c = await api.registerClient();
    const psy = await api.registerPsychologist();
    await api.verify(psy.id, (await api.admin()).token);
    const slot = await api.slot(psy.token);
    const sessionId = (await request(api.app).post('/api/sessions').set(api.bearer(c.token)).send({ slotId: slot.id })).body.session.id;
    const bodies = [
      (await request(api.app).get('/api/psychologists')).body,
      (await request(api.app).get(`/api/psychologists/${psy.id}`)).body,
      (await request(api.app).get('/api/sessions/my').set(api.bearer(psy.token))).body,
      (await request(api.app).get('/api/sessions/my').set(api.bearer(c.token))).body,
    ];
    for (const b of bodies) expect(JSON.stringify(b)).not.toMatch(/passwordHash|\$2[aby]\$|owl@example\.com/);
    expect(sessionId).toBeTruthy();
  });

  it('токен, підписаний чужим ключем, та токен з іншою роллю → 401', async () => {
    const { JwtTokenService } = await import('../../src/shared/security/TokenService');
    const forged = new JwtTokenService('z'.repeat(32)).signAccessToken({ userId: 'x', role: Role.ADMIN });
    expect((await request(api.app).get('/api/admin/users').set(api.bearer(forged))).status).toBe(401);
    expect((await request(api.app).get('/api/admin/users').set('Authorization', 'Basic abc')).status).toBe(401);
  });

  it('SQL/XSS-подібні рядки не ламають систему: зберігаються як текст, API не падає', async () => {
    const c = await api.registerClient();
    const payload = `'; DROP TABLE users; --<script>alert(1)</script>`;
    const r = await request(api.app).post('/api/notes').set(api.bearer(c.token)).send({ content: payload }).expect(201);
    expect(r.body.content).toBe(payload);
    expect((await request(api.app).get('/api/psychologists?specialization=' + encodeURIComponent(payload))).status).toBe(200);
  });

  it('нотатки у сховищі зашифровані (NFR-03)', async () => {
    const c = await api.registerClient();
    await request(api.app).post('/api/notes').set(api.bearer(c.token)).send({ content: 'Секретна думка' }).expect(201);
    const raw = await api.env.c.repositories.notes.findByClient(c.id);
    expect(JSON.stringify(raw)).not.toContain('Секретна');
  });
});

describe('Надійність API: обробка некоректного вводу', () => {
  let api: Api;
  beforeEach(async () => { api = await createApi(); });

  it('синтаксично невалідний JSON → 4xx (а не 500)', async () => {
    const r = await request(api.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it('надто велике тіло (>1 МБ) → 413, а не 500', async () => {
    const r = await request(api.app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x'.repeat(1_200_000) });
    expect(r.status).toBe(413);
  });

  it('тіло запиту з null/масивом не призводить до 500', async () => {
    for (const body of ['null', '[]', '"str"']) {
      const r = await request(api.app).post('/api/auth/login').set('Content-Type', 'application/json').send(body);
      expect(r.status).toBeLessThan(500);
    }
  });
});
