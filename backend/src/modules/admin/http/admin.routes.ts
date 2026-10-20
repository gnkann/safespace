import { Router } from 'express';
import { Role } from '../../../shared/domain/enums';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireAuth, requireRole } from '../../../shared/http/authMiddleware';
import { TokenService } from '../../../shared/security/TokenService';
import { AdminService } from '../AdminService';

/** Адмін-API (FR-10–FR-12, NFR-08) та подання скарг клієнтами. */
export function adminRoutes(admin: AdminService, tokens: TokenService): { admin: Router; complaints: Router } {
  const auth = authenticate(tokens);
  const onlyAdmin = requireRole(Role.ADMIN);

  const a = Router();
  a.use(auth, onlyAdmin);

  a.get('/psychologists/pending', asyncHandler(async (_req, res) => {
    const list = await admin.listPendingPsychologists();
    res.json(list.map((p) => ({ id: p.id, email: p.email, verificationStatus: p.verificationStatus, profile: p.profile })));
  }));
  a.post('/psychologists/:id/verify', asyncHandler(async (req, res) => {
    await admin.verifyPsychologist(requireAuth(req).userId, req.params.id);
    res.status(204).end();
  }));
  a.post('/psychologists/:id/reject', asyncHandler(async (req, res) => {
    await admin.rejectPsychologist(requireAuth(req).userId, req.params.id, String(req.body?.reason ?? ''));
    res.status(204).end();
  }));

  a.get('/users', asyncHandler(async (_req, res) => {
    const users = await admin.listUsers();
    res.json(users.map((u) => ({ id: u.id, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt })));
  }));
  a.post('/users/:id/block', asyncHandler(async (req, res) => {
    await admin.blockUser(requireAuth(req).userId, req.params.id, req.body?.reason);
    res.status(204).end();
  }));
  a.post('/users/:id/unblock', asyncHandler(async (req, res) => {
    await admin.unblockUser(requireAuth(req).userId, req.params.id);
    res.status(204).end();
  }));

  a.get('/complaints', asyncHandler(async (_req, res) => {
    const list = await admin.listComplaints();
    res.json(list.map((c) => ({ id: c.id, authorId: c.authorId, targetUserId: c.targetUserId, text: c.text, status: c.status, resolution: c.resolution })));
  }));
  a.post('/complaints/:id/resolve', asyncHandler(async (req, res) => {
    await admin.resolveComplaint(requireAuth(req).userId, req.params.id, String(req.body?.resolution ?? ''));
    res.status(204).end();
  }));
  a.get('/audit', asyncHandler(async (_req, res) => {
    res.json(await admin.getAuditLog());
  }));

  const c = Router();
  c.post('/', auth, asyncHandler(async (req, res) => {
    const complaint = await admin.submitComplaint(requireAuth(req).userId, String(req.body?.targetUserId ?? ''), String(req.body?.text ?? ''));
    res.status(201).json({ id: complaint.id, status: complaint.status });
  }));

  return { admin: a, complaints: c };
}
