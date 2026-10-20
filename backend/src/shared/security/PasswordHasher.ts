import bcrypt from 'bcryptjs';

/** Паролі не шифруються, а хешуються bcrypt із сіллю (NFR-03). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 10) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
