import { Role, SessionStatus, SlotStatus } from '../src/shared/domain/enums';
import { ConflictError, ForbiddenError, ValidationError } from '../src/shared/errors';
import { actor, activeClient, createTestEnv, openSlot, psychologist, TestEnv } from './helpers';

async function setup() {
  const env = createTestEnv();
  const psy = await psychologist(env);
  const client = await activeClient(env);
  const slot = await openSlot(env, psy.id);
  return { env, psy, client, slot };
}

/** Імітує вебхук провайдера про успішну оплату. */
const pay = (env: TestEnv, providerPaymentId: string, type = 'payment.succeeded') =>
  env.c.payments.handleWebhook(JSON.stringify({ type, providerPaymentId }), undefined);

describe('Сценарій бронювання (лаб. 2, рис. 3)', () => {
  it('бронювання створює PENDING-сесію, резервує слот і повертає платіжний намір', async () => {
    const { env, client, slot, psy } = await setup();
    const { session, payment } = await env.c.booking.bookSession(client.id, slot.id);

    expect(session.status).toBe(SessionStatus.PENDING);
    expect(payment.amount).toBe(psy.profile.pricePerSession);
    expect(payment.clientSecret).toBeTruthy();
    expect(slot.status).toBe(SlotStatus.BOOKED);
    expect(session.paymentDeadline.getTime() - env.clock.now().getTime()).toBe(15 * 60_000);
  });

  it('унеможливлює подвійне бронювання одного слота (NFR-02)', async () => {
    const { env, client, slot } = await setup();
    const other = await activeClient(env, { email: 'other@example.com', pseudonym: 'Лис' });
    // Дві одночасні спроби — рівно одна має успіти.
    const results = await Promise.allSettled([env.c.booking.bookSession(client.id, slot.id), env.c.booking.bookSession(other.id, slot.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it('не дозволяє бронювати слот неверифікованого психолога або в минулому', async () => {
    const env = createTestEnv();
    const psy = await psychologist(env, { verified: false });
    const client = await activeClient(env);
    const slot = await openSlot(env, psy.id, 2);
    await expect(env.c.booking.bookSession(client.id, slot.id)).rejects.toThrow();

    await env.c.admin.verifyPsychologist('admin-id', psy.id);
    env.clock.advanceMinutes(3 * 60);
    await expect(env.c.booking.bookSession(client.id, slot.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it('успішна оплата (вебхук) → CONFIRMED + листи клієнту й психологу + нагадування', async () => {
    const { env, client, slot } = await setup();
    const { session, payment } = await env.c.booking.bookSession(client.id, slot.id);
    await env.c.notifications.processDue();           // лист підтвердження email
    env.email.sent.length = 0;

    await pay(env, (await providerId(env, session.id)));
    expect(session.status).toBe(SessionStatus.CONFIRMED);
    expect(payment.paymentId).toBeTruthy();

    await env.c.notifications.processDue();
    const subjects = env.email.sent.map((m) => m.subject);
    expect(subjects.filter((s) => s === 'Сесію підтверджено')).toHaveLength(2);
    expect(subjects).not.toContain('Нагадування про сесію'); // ще зарано (за 24 год до початку)

    env.clock.advanceMinutes(24 * 60 + 1);            // 48 год до сесії → через добу + 1 хв
    await env.c.notifications.processDue();
    expect(env.email.sent.map((m) => m.subject).filter((s) => s === 'Нагадування про сесію')).toHaveLength(2);
  });

  it('повторний вебхук ідемпотентний', async () => {
    const { env, client, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    const id = await providerId(env, session.id);
    await pay(env, id);
    await expect(pay(env, id)).resolves.toBeUndefined();
    expect(session.status).toBe(SessionStatus.CONFIRMED);
  });

  it('неоплачена сесія спливає за 15 хв і звільняє слот', async () => {
    const { env, client, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);

    env.clock.advanceMinutes(14);
    expect(await env.c.booking.expireOverdue()).toBe(0);
    env.clock.advanceMinutes(1);
    expect(await env.c.booking.expireOverdue()).toBe(1);

    expect(session.status).toBe(SessionStatus.EXPIRED);
    expect(slot.status).toBe(SlotStatus.OPEN);
  });

  it('оплата після спливу часу не підтверджує сесію (але вебхук не падає)', async () => {
    const { env, client, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    env.clock.advanceMinutes(16);
    await env.c.booking.expireOverdue();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await pay(env, await providerId(env, session.id));
    expect(session.status).toBe(SessionStatus.EXPIRED);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('скасування: потрібна причина, слот звільняється, сторонній користувач не може скасувати', async () => {
    const { env, client, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    const stranger = await activeClient(env, { email: 'x@example.com', pseudonym: 'Чужий' });

    await expect(env.c.booking.cancel(session.id, actor(stranger.id, Role.CLIENT), 'хочу')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(env.c.booking.cancel(session.id, actor(client.id, Role.CLIENT), '')).rejects.toBeInstanceOf(ValidationError);

    await env.c.booking.cancel(session.id, actor(client.id, Role.CLIENT), 'Змінились плани');
    expect(session.status).toBe(SessionStatus.CANCELLED);
    expect(slot.status).toBe(SlotStatus.OPEN);
  });

  it('після скасування оплатити не можна (стан залишається CANCELLED)', async () => {
    const { env, client, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    await env.c.booking.cancel(session.id, actor(client.id, Role.CLIENT), 'x');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await pay(env, await providerId(env, session.id));
    expect(session.status).toBe(SessionStatus.CANCELLED);
  });

  it('психолог завершує сесію лише після початку; клієнт — не може', async () => {
    const { env, client, psy, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    await pay(env, await providerId(env, session.id));

    await expect(env.c.booking.complete(session.id, actor(client.id, Role.CLIENT))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(env.c.booking.complete(session.id, actor(psy.id, Role.PSYCHOLOGIST))).rejects.toBeInstanceOf(ValidationError);

    env.clock.set(new Date(slot.startsAt.getTime() + 60 * 60_000));
    await env.c.booking.complete(session.id, actor(psy.id, Role.PSYCHOLOGIST));
    expect(session.status).toBe(SessionStatus.COMPLETED);
  });

  it('відгук — лише після завершення сесії, один на сесію, автор — за псевдонімом', async () => {
    const { env, client, psy, slot } = await setup();
    const { session } = await env.c.booking.bookSession(client.id, slot.id);
    await pay(env, await providerId(env, session.id));
    await expect(env.c.reviews.leaveReview(client.id, session.id, 5, 'Дякую')).rejects.toBeInstanceOf(ConflictError);

    env.clock.set(new Date(slot.startsAt.getTime() + 60 * 60_000));
    await env.c.booking.complete(session.id, actor(psy.id, Role.PSYCHOLOGIST));
    await env.c.reviews.leaveReview(client.id, session.id, 5, 'Дякую');
    await expect(env.c.reviews.leaveReview(client.id, session.id, 4, 'ще')).rejects.toBeInstanceOf(ConflictError);

    const profile = await env.c.catalog.getProfile(psy.id);
    expect(profile.averageRating).toBe(5);
    expect(profile.reviews[0].authorPseudonym).toBe('Сова');
  });

});

/** Знаходить providerPaymentId платежу сесії через публічний API платіжного модуля. */
async function providerId(env: TestEnv, sessionId: string): Promise<string> {
  const payment = await env.c.repositories.payments.findBySession(sessionId);
  return payment!.providerPaymentId;
}
