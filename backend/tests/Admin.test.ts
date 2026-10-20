import { AccountStatus, ComplaintStatus, VerificationStatus } from '../src/shared/domain/enums';
import { ConflictError, ValidationError } from '../src/shared/errors';
import { activeClient, createTestEnv, psychologist } from './helpers';

describe('AdminService (FR-10–FR-12, NFR-08)', () => {
  it('верифікація змінює статус і потрапляє в журнал аудиту', async () => {
    const env = createTestEnv();
    const p = await psychologist(env, { verified: false });
    expect(await env.c.admin.listPendingPsychologists()).toHaveLength(1);

    await env.c.admin.verifyPsychologist('adm-1', p.id);
    expect(p.verificationStatus).toBe(VerificationStatus.VERIFIED);
    expect(await env.c.admin.listPendingPsychologists()).toHaveLength(0);

    const log = await env.c.admin.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ adminId: 'adm-1', action: 'PSYCHOLOGIST_VERIFIED', targetId: p.id });
  });

  it('відхилення вимагає причини; відхилений психолог не публічний', async () => {
    const env = createTestEnv();
    const p = await psychologist(env, { verified: false });
    await expect(env.c.admin.rejectPsychologist('adm', p.id, ' ')).rejects.toBeInstanceOf(ValidationError);
    await env.c.admin.rejectPsychologist('adm', p.id, 'Нечитабельний диплом');
    expect(p.isPublic).toBe(false);
  });

  it('повторна верифікація тієї ж анкети — конфлікт', async () => {
    const env = createTestEnv();
    const p = await psychologist(env);
    await expect(env.c.admin.verifyPsychologist('adm', p.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it('редагування диплома повертає анкету на повторну перевірку', async () => {
    const env = createTestEnv();
    const p = await psychologist(env);
    p.updateProfile({ diplomaFileKeys: ['new.pdf'] });
    expect(p.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(p.isPublic).toBe(false);
  });

  it('блокування/розблокування логуються; адміна заблокувати не можна', async () => {
    const env = createTestEnv();
    const client = await activeClient(env);
    await env.c.admin.blockUser('adm', client.id, 'спам');
    expect(client.status).toBe(AccountStatus.BLOCKED);
    await env.c.admin.unblockUser('adm', client.id);
    expect(client.status).toBe(AccountStatus.ACTIVE);
    expect((await env.c.admin.getAuditLog()).map((e) => e.action)).toEqual(['USER_BLOCKED', 'USER_UNBLOCKED']);

    const admin = (await env.c.admin.listUsers()).find((u) => u.role === 'ADMIN');
    expect(admin).toBeUndefined(); // bootstrap() ще не викликався
    await env.c.bootstrap();
    const seeded = (await env.c.admin.listUsers()).find((u) => u.role === 'ADMIN')!;
    await expect(env.c.admin.blockUser('adm', seeded.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it('скарги: подання клієнтом → розгляд адміном із записом в аудит', async () => {
    const env = createTestEnv();
    const client = await activeClient(env);
    const p = await psychologist(env);
    const c = await env.c.admin.submitComplaint(client.id, p.id, 'Неетична поведінка');
    expect(c.status).toBe(ComplaintStatus.OPEN);
    await env.c.admin.resolveComplaint('adm', c.id, 'Попередження');
    expect(c.status).toBe(ComplaintStatus.RESOLVED);
    await expect(env.c.admin.resolveComplaint('adm', c.id, 'ще раз')).rejects.toBeInstanceOf(ConflictError);
  });
});
