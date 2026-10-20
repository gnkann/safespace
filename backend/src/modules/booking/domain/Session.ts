import { Role, SessionStatus } from '../../../shared/domain/enums';
import { InvalidStateTransitionError, ValidationError } from '../../../shared/errors';

export interface SessionProps {
  id: string;
  clientId: string;
  psychologistId: string;
  slotId: string;
  startsAt: Date;
  createdAt: Date;
  paymentDeadline: Date;
  status?: SessionStatus;
  cancelReason?: string;
  cancelledBy?: Role;
}

/** Дозволені переходи — прямий переклад діаграми станів (лаб. 2, рис. 4). */
const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  [SessionStatus.PENDING]: [SessionStatus.CONFIRMED, SessionStatus.CANCELLED, SessionStatus.EXPIRED],
  [SessionStatus.CONFIRMED]: [SessionStatus.COMPLETED, SessionStatus.CANCELLED],
  [SessionStatus.COMPLETED]: [],
  [SessionStatus.CANCELLED]: [],
  [SessionStatus.EXPIRED]: [],
};

/**
 * Сесія (бронювання) — центральний агрегат модуля booking.
 * Методи confirm(), cancel(), complete(), expire() відповідають діаграмі класів.
 * Інваріанти станів захищені тут, а не розкидані по сервісах (SRP, NFR-02).
 */
export class Session {
  readonly id: string;
  readonly clientId: string;
  readonly psychologistId: string;
  readonly slotId: string;
  readonly startsAt: Date;
  readonly createdAt: Date;
  readonly paymentDeadline: Date;
  private _status: SessionStatus;
  private _cancelReason?: string;
  private _cancelledBy?: Role;

  constructor(props: SessionProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.psychologistId = props.psychologistId;
    this.slotId = props.slotId;
    this.startsAt = props.startsAt;
    this.createdAt = props.createdAt;
    this.paymentDeadline = props.paymentDeadline;
    this._status = props.status ?? SessionStatus.PENDING;
    this._cancelReason = props.cancelReason;
    this._cancelledBy = props.cancelledBy;
  }

  get status(): SessionStatus {
    return this._status;
  }
  get cancelReason(): string | undefined {
    return this._cancelReason;
  }
  get cancelledBy(): Role | undefined {
    return this._cancelledBy;
  }

  /** Успішна оплата → сесія підтверджена. */
  confirm(): void {
    this.transitionTo(SessionStatus.CONFIRMED);
  }

  /** FR-08: скасувати може клієнт або психолог; причина обов'язкова. */
  cancel(by: Role, reason: string): void {
    if (by !== Role.CLIENT && by !== Role.PSYCHOLOGIST) {
      throw new ValidationError('Скасувати сесію може лише клієнт або психолог');
    }
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Вкажіть причину скасування', { reason: "Обов'язкове поле" });
    }
    this.transitionTo(SessionStatus.CANCELLED);
    this._cancelledBy = by;
    this._cancelReason = reason.trim();
  }

  /** Проведену сесію можна завершити лише після її початку. */
  complete(now: Date): void {
    if (now < this.startsAt) throw new ValidationError('Сесія ще не розпочалася');
    this.transitionTo(SessionStatus.COMPLETED);
  }

  /** Оплата не надійшла вчасно (за замовчуванням 15 хв). */
  expire(now: Date): void {
    if (now < this.paymentDeadline) throw new ValidationError('Час на оплату ще не минув');
    this.transitionTo(SessionStatus.EXPIRED);
  }

  canTransitionTo(next: SessionStatus): boolean {
    return TRANSITIONS[this._status].includes(next);
  }

  private transitionTo(next: SessionStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new InvalidStateTransitionError('Сесія', this._status, next);
    }
    this._status = next;
  }
}
