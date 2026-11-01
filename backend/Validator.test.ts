import { Validator } from '../../src/modules/auth/validators';
import { ValidationError } from '../../src/shared/errors';

const run = (fn: (v: Validator) => Validator) => {
  try {
    fn(new Validator()).throwIfInvalid();
    return null;
  } catch (e) {
    return (e as ValidationError).details as Record<string, string>;
  }
};

describe('Validator (юніт, FR-01.1)', () => {
  it.each(['a@b.com', ' user.name+tag@mail.example.org '])('приймає коректний email %p', (email) => {
    expect(run((v) => v.email(email))).toBeNull();
  });

  it.each(['', 'plain', 'a@b', 'a b@c.com', '@c.com', 'a@b.c', 42, undefined, null])('відхиляє некоректний email %p', (email) => {
    expect(run((v) => v.email(email))).toHaveProperty('email');
  });

  it.each([
    ['Passw0rdX', 'Passw0rdX', true],
    ['Пароль123', 'Пароль123', true],
    ['short1A', 'short1A', false], // < 8 символів
    ['onlyletters', 'onlyletters', false], // без цифр
    ['12345678', '12345678', false], // без літер
    ['Passw0rdX', 'Passw0rdY', false], // не збігаються
  ])('пароль %p / підтвердження %p → валідний: %p', (pwd, confirm, ok) => {
    const errors = run((v) => v.password(pwd, confirm));
    expect(errors === null).toBe(ok);
  });

  it('nonEmpty відхиляє порожній рядок і рядок із пробілів', () => {
    expect(run((v) => v.nonEmpty('  ', 'name'))).toHaveProperty('name');
    expect(run((v) => v.nonEmpty('x', 'name'))).toBeNull();
  });

  it('накопичує всі помилки, а не лише першу', () => {
    const errors = run((v) => v.email('bad').nonEmpty('', 'pseudonym').password('1', '2'));
    expect(Object.keys(errors ?? {}).sort()).toEqual(['email', 'password', 'passwordConfirm', 'pseudonym']);
  });
});
