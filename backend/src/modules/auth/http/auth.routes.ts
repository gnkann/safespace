import { Router } from 'express';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { AuthService } from '../AuthService';
import { Client } from '../domain/Client';

/** Тонкий HTTP-шар: розбір запиту → виклик сервісу → відповідь. Бізнес-логіки тут немає. */
export function authRoutes(auth: AuthService): Router {
  const r = Router();

  r.post('/register/client', asyncHandler(async (req, res) => {
    const client: Client = await auth.registerClient(req.body);
    res.status(201).json({ id: client.id, pseudonym: client.pseudonym, status: client.status });
  }));

  r.post('/register/psychologist', asyncHandler(async (req, res) => {
    const p = await auth.registerPsychologist(req.body);
    res.status(201).json({ id: p.id, verificationStatus: p.verificationStatus, status: p.status });
  }));

  r.post('/confirm-email', asyncHandler(async (req, res) => {
    await auth.confirmEmail(String(req.body?.token ?? ''));
    res.status(204).end();
  }));

  r.post('/login', asyncHandler(async (req, res) => {
    const { token, user } = await auth.login(req.body?.email, req.body?.password);
    res.json({ token, user: { id: user.id, role: user.role } });
  }));

  return r;
}
