import { AesGcmEncryptor } from '../src/shared/security/Encryptor';
import { JwtTokenService } from '../src/shared/security/TokenService';
import { UnauthorizedError } from '../src/shared/errors';
import { Role } from '../src/shared/domain/enums';
import { loadConfig } from '../src/config/env';
import { activeClient, createTestEnv } from './helpers';

const KEY = 'ab'.repeat(32);

describe('Шифрування AES-256-GCM (NFR-03)', () => {
  it('шифрує та розшифровує; шифртекст не містить відкритого тексту і щоразу різний', () => {
    const enc = new AesGcmEncryptor(KEY);
    const a = enc.encrypt('Мені було важко заснути');
    const b = enc.encrypt('Мені було важко заснути');
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64').toString('utf8')).not.toContain('заснути');
    expect(enc.decrypt(a)).toBe('Мені було важко заснути');
  });

  it('виявляє підміну даних (автентифікований режим)', () => {
    const enc = new AesGcmEncryptor(KEY);
    const raw = Buffer.from(enc.encrypt('secret'), 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(() => enc.decrypt(raw.toString('base64'))).toThrow();
  });

  it('відхиляє ключ неправильної довжини', () => {
    expect(() => new AesGcmEncryptor('abcd')).toThrow();
  });
});

describe('Особисті нотатки (FR-09, NFR-04)', () => {
  it('зберігаються зашифрованими й доступні лише власнику', async () => {
    const env = createTestEnv();
    const a = await activeClient(env);
    const b = await activeClient(env, { email: 'b@example.com', pseudonym: 'Інший' });

    const note = await env.c.cabinet.addNote(a.id, 'Сьогодні було тривожно');
    expect((await env.c.cabinet.listNotes(a.id))[0].content).toBe('Сьогодні було тривожно');
    expect(await env.c.cabinet.listNotes(b.id)).toHaveLength(0);
    await expect(env.c.cabinet.deleteNote(b.id, note.id)).rejects.toThrow();

    const stored = await env.c.repositories.notes.findByClient(a.id);
    expect(stored[0].encryptedContent).not.toContain('тривожно');
  });
});

describe('JWT', () => {
  const svc = new JwtTokenService('s'.repeat(32));

  it('підписує й перевіряє access-токен', () => {
    expect(svc.verifyAccessToken(svc.signAccessToken({ userId: 'u1', role: Role.CLIENT }))).toEqual({ userId: 'u1', role: Role.CLIENT });
  });

  it('токен підтвердження email не можна використати як access-токен і навпаки', () => {
    expect(() => svc.verifyAccessToken(svc.signEmailConfirmationToken('u1'))).toThrow(UnauthorizedError);
    expect(() => svc.verifyEmailConfirmationToken(svc.signAccessToken({ userId: 'u1', role: Role.CLIENT }))).toThrow(UnauthorizedError);
  });

  it('відхиляє підроблений токен', () => {
    const forged = new JwtTokenService('x'.repeat(32)).signAccessToken({ userId: 'u1', role: Role.ADMIN });
    expect(() => svc.verifyAccessToken(forged)).toThrow(UnauthorizedError);
  });
});

describe('Конфігурація', () => {
  it('у production відхиляє тестові ключі та короткий JWT_SECRET', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'dev-only-secret-dev-only-secret-0000', ENCRYPTION_KEY: KEY })).toThrow();
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'p'.repeat(40), ENCRYPTION_KEY: KEY })).not.toThrow();
  });
});
