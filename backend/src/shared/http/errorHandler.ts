import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';

/** Єдиний формат помилок API: { error: { code, message, details? } }. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера' } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут не знайдено' } });
}
