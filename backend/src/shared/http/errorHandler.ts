import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';

/** Єдиний формат помилок API: { error: { code, message, details? } }. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Помилки body-parser (некоректний JSON, завелике тіло) — це помилки клієнта (4xx), а не збій сервера.
  const e = err as { type?: string };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Тіло запиту не є коректним JSON' } });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Тіло запиту завелике' } });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера' } });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут не знайдено' } });
}
