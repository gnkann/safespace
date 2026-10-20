import jwt from 'jsonwebtoken';
import { Role } from '../domain/enums';
import { UnauthorizedError } from '../errors';

export interface AuthPayload {
  userId: string;
  role: Role;
}

/** Абстракція над JWT: сервіси залежать від інтерфейсу, а не від бібліотеки (DIP). */
export interface TokenService {
  signAccessToken(payload: AuthPayload): string;
  verifyAccessToken(token: string): AuthPayload;
  signEmailConfirmationToken(userId: string): string;
  verifyEmailConfirmationToken(token: string): string;
}

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly accessExpiresIn: string = '1h',
  ) {}

  signAccessToken(payload: AuthPayload): string {
    return jwt.sign({ ...payload, typ: 'access' }, this.secret, { expiresIn: this.accessExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  verifyAccessToken(token: string): AuthPayload {
    const decoded = this.verify(token);
    if (decoded.typ !== 'access') throw new UnauthorizedError('Некоректний тип токена');
    return { userId: String(decoded.userId), role: decoded.role as Role };
  }

  signEmailConfirmationToken(userId: string): string {
    return jwt.sign({ userId, typ: 'email' }, this.secret, { expiresIn: '24h' });
  }

  verifyEmailConfirmationToken(token: string): string {
    const decoded = this.verify(token);
    if (decoded.typ !== 'email') throw new UnauthorizedError('Некоректний тип токена');
    return String(decoded.userId);
  }

  private verify(token: string): jwt.JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'string') throw new Error('bad payload');
      return decoded;
    } catch {
      throw new UnauthorizedError('Токен недійсний або прострочений');
    }
  }
}
