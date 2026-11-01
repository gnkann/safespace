import { FakeClock, SystemClock } from '../../src/shared/time/Clock';
import { BcryptPasswordHasher } from '../../src/shared/security/PasswordHasher';
import { Payment } from '../../src/modules/payment/domain/Payment';
import { FakePaymentGateway } from '../../src/modules/payment/infrastructure/FakePaymentGateway';
import { PaymentStatus } from '../../src/shared/domain/enums';
import { InvalidStateTransitionError, ValidationError, NotFoundError, ConflictError, ForbiddenError, UnauthorizedError } from '../../src/shared/errors';
import { InMemoryEventBus } from '../../src/shared/events/EventBus';

describe('Clock (юніт)', () => {
  it('FakeClock: advanceMinutes та set змінюють час, now() повертає копію', () => {
    const c = new FakeClock(new Date('2026-01-01T10:00:00Z'));
    c.advanceMinutes(15);
    expect(c.now().toISOString()).toBe('2026-01-01T10:15:00.000Z');
    const copy = c.now();
    copy.setFullYear(2000);
    expect(c.now().getUTCFullYear()).toBe(2026);
    c.set(new Date('2027-05-05T00:00:00Z'));
    expect(c.now().toISOString()).toBe('2027-05-05T00:00:00.000Z');
  });

  it('SystemClock повертає поточний час', () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('BcryptPasswordHasher (юніт, NFR-03)', () => {
  const h = new BcryptPasswordHasher(4);
  it('хешує з сіллю: однакові паролі → різні хеші; compare працює', async () => {
    const a = await h.hash('Passw0rdX');
    const b = await h.hash('Passw0rdX');
    expect(a).not.toBe(b);
    expect(a).not.toContain('Passw0rdX');
    expect(await h.compare('Passw0rdX', a)).toBe(true);
    expect(await h.compare('wrong', a)).toBe(false);
  });
});

describe('Payment (юніт)', () => {
  const make = () => new Payment('p1', 's1', 800, 'UAH', 'pi_1', new Date());
  it('PENDING → SUCCEEDED / FAILED', () => {
    const ok = make(); ok.markSucceeded();
    expect(ok.status).toBe(PaymentStatus.SUCCEEDED);
    const bad = make(); bad.markFailed();
    expect(bad.status).toBe(PaymentStatus.FAILED);
  });
  it('кінцевий стан змінити не можна', () => {
    const p = make(); p.markSucceeded();
    expect(() => p.markFailed()).toThrow(InvalidStateTransitionError);
    expect(() => p.markSucceeded()).toThrow(InvalidStateTransitionError);
  });
});

describe('FakePaymentGateway (юніт)', () => {
  const g = new FakePaymentGateway();
  it('створює унікальні наміри', async () => {
    const a = await g.createPaymentIntent({ amount: 1, currency: 'UAH', metadata: {} });
    const b = await g.createPaymentIntent({ amount: 1, currency: 'UAH', metadata: {} });
    expect(a.providerPaymentId).not.toBe(b.providerPaymentId);
  });
  it('парсить коректний вебхук', () => {
    expect(g.parseWebhook(JSON.stringify({ type: 'payment.failed', providerPaymentId: 'x' }))).toEqual({ type: 'payment.failed', providerPaymentId: 'x' });
  });
  it.each(['not json', '{}', JSON.stringify({ type: 'other', providerPaymentId: 'x' }), JSON.stringify({ type: 'payment.succeeded' })])(
    'відхиляє некоректний вебхук %p', (body) => {
      expect(() => g.parseWebhook(body)).toThrow(ValidationError);
    });
});

describe('Помилки застосунку (юніт)', () => {
  it('мають коректні HTTP-статуси та коди', () => {
    expect([new ValidationError('x'), new UnauthorizedError(), new ForbiddenError(), new NotFoundError('X'), new ConflictError('x')].map((e) => e.status))
      .toEqual([400, 401, 403, 404, 409]);
    expect(new NotFoundError('Слот').message).toBe('Слот не знайдено');
  });
});

describe('EventBus (юніт)', () => {
  it('доставляє подію всім підписникам', async () => {
    const bus = new InMemoryEventBus();
    const got: unknown[] = [];
    bus.subscribe('session.expired', async (e) => { got.push(e); });
    bus.subscribe('session.expired', async (e) => { got.push(e); });
    await bus.publish('session.expired', { sessionId: 's1' });
    expect(got).toHaveLength(2);
  });
});
