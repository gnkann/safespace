import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Role } from '../domain/enums';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { TokenService } from '../security/TokenService';

/** Перевіряє JWT із заголовка Authorization: Bearer <token> (FR-01). */
export const authenticate =
  (tokens: TokenService): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError());
    try {
      req.auth = tokens.verifyAccessToken(header.slice(7));
      next();
    } catch (e) {
      next(e);
    }
  };

/** Рольова авторизація маршрутів. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(new UnauthorizedError());
    if (!roles.includes(req.auth.role)) return next(new ForbiddenError());
    next();
  };

/** Повертає автентифікованого користувача або кидає 401 (для використання в контролерах). */
export function requireAuth(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}
