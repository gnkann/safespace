import { AccountStatus } from '../src/shared/domain/enums';
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../src/shared/errors';
import { activeClient, clientDto, createTestEnv, profile } from './helpers';

describe('AuthService (FR-01)', () => {
  it('реєструє клієнта, зберігає хеш (не пароль) і час згоди', async () => {
    const env = createTestEnv();
    const client = await env.c.auth.registerClient(clientDto() as never);
    expect(client.status).toBe(AccountStatus.UNVERIFIED_EMAIL);
    expect(client.passwordHash).not.toContain('Passw0rdX');
    expect(client.consentAcceptedAt).toEqual(env.clock.now());
  });

  it('надсилає лист із посиланням підтвердження', async () => {
    const env = createTestEnv();
    await env.c.auth.registerClient(clientDto() as never);
    await env.c.notifications.processDue();
    expect(env.email.sent).toHaveLength(1);
    expect(env.email.sent[0].body).toContain('confirm-email?token=');
  });

  it('збирає всі помилки валідації одразу (FR-01.1)', async () => {
    const env = createTestEnv();
    const err = await env.c.auth
      .registerClient(clientDto({ email: 'bad', passwordConfirm: 'other', isAdultConfirmed: false, consentAccepted: false, pseudonym: '' }) as never)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.details)).toEqual(expect.arrayContaining(['email', 'passwordConfirm', 'isAdultConfirmed', 'consentAccepted', 'pseudonym']));
  });

  it('забороняє дублікат email незалежно від регістру', async () => {
    const env = createTestEnv();
    await env.c.auth.registerClient(clientDto() as never);
    await expect(env.c.auth.registerClient(clientDto({ email: 'OWL@example.com' }) as never)).rejects.toBeInstanceOf(ConflictError);
  });

  it('не дає увійти до підтвердження email, після — дає токен', async () => {
    const env = createTestEnv();
    const client = await env.c.auth.registerClient(clientDto() as never);
    await expect(env.c.auth.login('owl@example.com', 'Passw0rdX')).rejects.toBeInstanceOf(ForbiddenError);
    await env.c.auth.confirmEmail(env.c.tokens.signEmailConfirmationToken(client.id));
    const { token } = await env.c.auth.login('owl@example.com', 'Passw0rdX');
    expect(env.c.tokens.verifyAccessToken(token)).toEqual({ userId: client.id, role: 'CLIENT' });
  });

  it('однакова помилка для неіснуючого email та хибного пароля', async () => {
    const env = createTestEnv();
    await activeClient(env);
    const a = await env.c.auth.login('nobody@example.com', 'x').catch((e) => e);
    const b = await env.c.auth.login('owl@example.com', 'wrong').catch((e) => e);
    expect(a).toBeInstanceOf(UnauthorizedError);
    expect(b.message).toBe(a.message);
  });

  it('заблокований користувач не може увійти', async () => {
    const env = createTestEnv();
    const client = await activeClient(env);
    await env.c.admin.blockUser('admin-id', client.id);
    await expect(env.c.auth.login('owl@example.com', 'Passw0rdX')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('психолог: потрібен диплом, а bio — до 1000 символів (FR-01.2)', async () => {
    const env = createTestEnv();
    const err = await env.c.auth
      .registerPsychologist({ email: 'p@e.com', password: 'Passw0rdX', passwordConfirm: 'Passw0rdX', consentAccepted: true, profile: profile({ diplomaFileKeys: [], bio: 'x'.repeat(1001) }) })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.details)).toEqual(expect.arrayContaining(['profile.diplomaFileKeys', 'profile.bio']));
  });
});
