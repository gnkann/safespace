import { Router } from 'express';
import { Role } from '../../../shared/domain/enums';
import { ValidationError } from '../../../shared/errors';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { authenticate, requireAuth, requireRole } from '../../../shared/http/authMiddleware';
import { TokenService } from '../../../shared/security/TokenService';
import { BookingService } from '../BookingService';
import { PersonalCabinetService } from '../PersonalCabinetService';
import { ReviewService } from '../ReviewService';
import { ScheduleService } from '../ScheduleService';
import { Session } from '../domain/Session';
import { TimeSlot } from '../domain/TimeSlot';

const parseDate = (v: unknown, field: string): Date => {
  const d = new Date(String(v));
  if (v === undefined || Number.isNaN(d.getTime())) throw new ValidationError(`Некоректна дата ${field}`);
  return d;
};

const slotDto = (s: TimeSlot) => ({ id: s.id, psychologistId: s.psychologistId, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status });
const sessionDto = (s: Session) => ({
  id: s.id, clientId: s.clientId, psychologistId: s.psychologistId, slotId: s.slotId,
  startsAt: s.startsAt, status: s.status, paymentDeadline: s.paymentDeadline,
  cancelReason: s.cancelReason, cancelledBy: s.cancelledBy,
});

export interface BookingDeps {
  schedule: ScheduleService;
  booking: BookingService;
  reviews: ReviewService;
  cabinet: PersonalCabinetService;
  tokens: TokenService;
}

/** Маршрути слотів, сесій, відгуків та особистого кабінету (FR-04, FR-07, FR-08, FR-09). */
export function bookingRoutes({ schedule, booking, reviews, cabinet, tokens }: BookingDeps): Router {
  const r = Router();
  const auth = authenticate(tokens);
  const client = requireRole(Role.CLIENT);
  const psychologist = requireRole(Role.PSYCHOLOGIST);

  // --- Розклад психолога (FR-07) ---
  r.get('/psychologists/:id/slots', asyncHandler(async (req, res) => {
    res.json((await schedule.listOpenPublic(req.params.id)).map(slotDto));
  }));
  r.get('/slots/my', auth, psychologist, asyncHandler(async (req, res) => {
    res.json((await schedule.listOwn(requireAuth(req).userId)).map(slotDto));
  }));
  r.post('/slots', auth, psychologist, asyncHandler(async (req, res) => {
    const slot = await schedule.createSlot(requireAuth(req).userId, parseDate(req.body?.startsAt, 'startsAt'), parseDate(req.body?.endsAt, 'endsAt'));
    res.status(201).json(slotDto(slot));
  }));
  r.delete('/slots/:id', auth, psychologist, asyncHandler(async (req, res) => {
    await schedule.closeSlot(requireAuth(req).userId, req.params.id);
    res.status(204).end();
  }));

  // --- Сесії (FR-04, FR-08) ---
  r.post('/sessions', auth, client, asyncHandler(async (req, res) => {
    const { session, payment } = await booking.bookSession(requireAuth(req).userId, String(req.body?.slotId ?? ''));
    res.status(201).json({ session: sessionDto(session), payment });
  }));
  r.get('/sessions/my', auth, asyncHandler(async (req, res) => {
    const a = requireAuth(req);
    const list = a.role === Role.PSYCHOLOGIST ? await booking.listForPsychologist(a.userId) : await booking.listForClient(a.userId);
    res.json(list.map(sessionDto));
  }));
  r.post('/sessions/:id/cancel', auth, asyncHandler(async (req, res) => {
    res.json(sessionDto(await booking.cancel(req.params.id, requireAuth(req), String(req.body?.reason ?? ''))));
  }));
  r.post('/sessions/:id/complete', auth, psychologist, asyncHandler(async (req, res) => {
    res.json(sessionDto(await booking.complete(req.params.id, requireAuth(req))));
  }));
  r.post('/sessions/:id/review', auth, client, asyncHandler(async (req, res) => {
    const rv = await reviews.leaveReview(requireAuth(req).userId, req.params.id, Number(req.body?.rating), String(req.body?.text ?? ''));
    res.status(201).json({ id: rv.id, rating: rv.rating, text: rv.text });
  }));

  // --- Особистий кабінет клієнта (FR-09) ---
  r.get('/notes', auth, client, asyncHandler(async (req, res) => {
    res.json(await cabinet.listNotes(requireAuth(req).userId));
  }));
  r.post('/notes', auth, client, asyncHandler(async (req, res) => {
    res.status(201).json(await cabinet.addNote(requireAuth(req).userId, String(req.body?.content ?? '')));
  }));
  r.delete('/notes/:id', auth, client, asyncHandler(async (req, res) => {
    await cabinet.deleteNote(requireAuth(req).userId, req.params.id);
    res.status(204).end();
  }));

  return r;
}
