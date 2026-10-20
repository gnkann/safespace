import { ConflictError, ForbiddenError, ValidationError } from '../src/shared/errors';
import { SlotStatus } from '../src/shared/domain/enums';
import { activeClient, createTestEnv, openSlot, psychologist } from './helpers';

describe('ScheduleService (FR-07)', () => {
  it('створює слот, відхиляє минуле та перетин', async () => {
    const env = createTestEnv();
    const psy = await psychologist(env);
    const slot = await openSlot(env, psy.id);

    await expect(env.c.schedule.createSlot(psy.id, new Date('2020-01-01T10:00:00Z'), new Date('2020-01-01T11:00:00Z'))).rejects.toBeInstanceOf(ValidationError);
    await expect(env.c.schedule.createSlot(psy.id, new Date(slot.startsAt.getTime() + 10 * 60_000), new Date(slot.endsAt.getTime() + 10 * 60_000))).rejects.toBeInstanceOf(ConflictError);
    await expect(env.c.schedule.createSlot(psy.id, slot.endsAt, new Date(slot.endsAt.getTime() - 1))).rejects.toBeInstanceOf(ValidationError);
  });

  it('закрити слот може лише власник; закритий слот не видно клієнтам', async () => {
    const env = createTestEnv();
    const a = await psychologist(env, { email: 'a@e.com' });
    const b = await psychologist(env, { email: 'b@e.com' });
    const slot = await openSlot(env, a.id);

    await expect(env.c.schedule.closeSlot(b.id, slot.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await env.c.schedule.listOpenPublic(a.id)).toHaveLength(1);
    await env.c.schedule.closeSlot(a.id, slot.id);
    expect(slot.status).toBe(SlotStatus.CLOSED);
    expect(await env.c.schedule.listOpenPublic(a.id)).toHaveLength(0);
  });

  it('заброньований слот закрити не можна', async () => {
    const env = createTestEnv();
    const psy = await psychologist(env);
    const client = await activeClient(env);
    const slot = await openSlot(env, psy.id);
    await env.c.booking.bookSession(client.id, slot.id);
    await expect(env.c.schedule.closeSlot(psy.id, slot.id)).rejects.toBeInstanceOf(ConflictError);
  });
});
