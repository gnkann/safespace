import { ValidationError } from '../../shared/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Невеликий накопичувач помилок валідації: повертає всі проблеми одразу, а не по одній. */
export class Validator {
  private readonly errors: Record<string, string> = {};

  require(cond: boolean, field: string, message: string): this {
    if (!cond) this.errors[field] = message;
    return this;
  }

  email(value: unknown, field = 'email'): this {
    return this.require(typeof value === 'string' && EMAIL_RE.test(value.trim()), field, 'Некоректний email');
  }

  password(value: unknown, confirm: unknown): this {
    this.require(
      typeof value === 'string' && value.length >= 8 && /[A-Za-zА-Яа-яІіЇїЄє]/.test(value) && /\d/.test(value),
      'password',
      'Пароль: щонайменше 8 символів, літери та цифри',
    );
    return this.require(value === confirm, 'passwordConfirm', 'Паролі не збігаються');
  }

  nonEmpty(value: unknown, field: string, message = "Обов'язкове поле"): this {
    return this.require(typeof value === 'string' && value.trim().length > 0, field, message);
  }

  throwIfInvalid(): void {
    if (Object.keys(this.errors).length > 0) {
      throw new ValidationError('Помилка валідації даних', this.errors);
    }
  }
}
