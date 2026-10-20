import { Role, SessionStatus } from '../../shared/domain/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { EventBus } from '../../shared/events/EventBus';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { PsychologistRepository } from '../catalog/ports/PsychologistRepository';
import { Session } from './domain/Session';
import { PaymentInitiator, PaymentIntentInfo } from './ports/PaymentInitiator';
import { SessionRepository, SlotRepository } from './ports/repositories';

export interface BookingResult {
  session: Session;
  payment: PaymentIntentInfo;
}

export interface Actor {
  userId: string;
  role: Role;
}

/**
 * FR-04, FR-08: бронювання, підтвердження, скасування, завершення сесій.
 * Реалізує сценарій з діаграми послідовностей (лаб. 2, рис. 3):
 * перевірка слота → резервування → Session(PENDING) → платіжний намір.
 * Стан Session змінюється лише через методи самого агрегата.
 */
export class BookingService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly slots: SlotRepository,
    private readonly psychologists: PsychologistRepository,
    private readonly payments: PaymentInitiator,
    private readonly events: EventBus,
    private readonly clock: Clock,
    private readonly paymentTimeoutMin = 15,
  ) {}

  async bookSession(clientId: string, slotId: string): Promise<BookingResult> {
    const slot = await this.slots.findById(slotId);
    if (!slot) throw new NotFoundError('Слот');

    const psychologist = await this.psychologists.findPsychologistById(slot.psychologistId);
    if (!psychologist || !psychologist.isPublic) throw new NotFoundError('Психолога');

    const now = this.clock.now();
    if (slot.startsAt <= now) throw new ConflictError('Цей час уже минув');

    // Атомарне резервування — захист від подвійного бронювання (NFR-02).
    if (!(await this.slots.tryReserve(slotId))) throw new ConflictError('Цей слот уже зайнятий');

    const session = new Session({
      id: newId(),
      clientId,
      psychologistId: psychologist.id,
      slotId,
      startsAt: slot.startsAt,
      createdAt: now,
      paymentDeadline: new Date(now.getTime() + this.paymentTimeoutMin * 60_000),
    });
    await this.sessions.save(session);

    let payment: PaymentIntentInfo;
    try {
      payment = await this.payments.initiate(session.id, psychologist.profile.pricePerSession);
    } catch (err) {
      // Платіж не створено — не тримаємо слот заблокованим.
      session.cancel(Role.CLIENT, 'Не вдалося створити платіж');
      await this.sessions.save(session);
      await this.slots.release(slotId);
      throw err;
    }

    await this.events.publish('session.booked', { sessionId: session.id, clientId, psychologistId: psychologist.id });
    return { session, payment };
  }

  /** Викликається підписником події payment.succeeded (див. composition root). */
  async confirmPaid(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Сесію');

    if (!session.canTransitionTo(SessionStatus.CONFIRMED)) {
      // Оплата надійшла для вже скасованої/простроченої сесії. Не ламаємо вебхук:
      // таку ситуацію потрібно вирішувати поверненням коштів (реалізація — наступний етап).
      console.warn(`[booking] платіж для сесії ${sessionId} у статусі ${session.status}: потрібне повернення коштів`);
      return;
    }
    session.confirm();
    await this.sessions.save(session);
    await this.events.publish('session.confirmed', {
      sessionId: session.id,
      clientId: session.clientId,
      psychologistId: session.psychologistId,
      startsAt: session.startsAt,
    });
  }

  async cancel(sessionId: string, actor: Actor, reason: string): Promise<Session> {
    const session = await this.getOwned(sessionId, actor);
    session.cancel(actor.role, reason);
    await this.sessions.save(session);
    await this.slots.release(session.slotId);
    await this.events.publish('session.cancelled', {
      sessionId: session.id,
      clientId: session.clientId,
      psychologistId: session.psychologistId,
      cancelledBy: actor.role,
      reason: session.cancelReason ?? reason,
    });
    return session;
  }

  /** Завершити сесію може лише її психолог. */
  async complete(sessionId: string, actor: Actor): Promise<Session> {
    if (actor.role !== Role.PSYCHOLOGIST) throw new ForbiddenError();
    const session = await this.getOwned(sessionId, actor);
    session.complete(this.clock.now());
    await this.sessions.save(session);
    await this.events.publish('session.completed', { sessionId: session.id });
    return session;
  }

  /** Планова задача: переводить прострочені PENDING у EXPIRED та звільняє слоти. */
  async expireOverdue(): Promise<number> {
    const now = this.clock.now();
    const overdue = await this.sessions.findPendingWithDeadlineBefore(now);
    for (const session of overdue) {
      session.expire(now);
      await this.sessions.save(session);
      await this.slots.release(session.slotId);
      await this.events.publish('session.expired', { sessionId: session.id });
    }
    return overdue.length;
  }

  async listForClient(clientId: string): Promise<Session[]> {
    return this.sessions.findByClient(clientId);
  }

  async listForPsychologist(psychologistId: string): Promise<Session[]> {
    return this.sessions.findByPsychologist(psychologistId);
  }

  private async getOwned(sessionId: string, actor: Actor): Promise<Session> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Сесію');
    const owns =
      (actor.role === Role.CLIENT && session.clientId === actor.userId) ||
      (actor.role === Role.PSYCHOLOGIST && session.psychologistId === actor.userId);
    if (!owns) throw new ForbiddenError();
    return session;
  }
}
