import { PaymentStatus } from '../../../shared/domain/enums';
import { InvalidStateTransitionError } from '../../../shared/errors';

/** Платіж за сесію: рівно один на сесію (композиція в діаграмі класів). Дані карток не зберігаються — їх обробляє Stripe (NFR-03). */
export class Payment {
  private _status: PaymentStatus = PaymentStatus.PENDING;

  constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly amount: number,
    readonly currency: string,
    readonly providerPaymentId: string,
    readonly createdAt: Date,
  ) {}

  get status(): PaymentStatus {
    return this._status;
  }

  markSucceeded(): void {
    this.transition(PaymentStatus.SUCCEEDED);
  }

  markFailed(): void {
    this.transition(PaymentStatus.FAILED);
  }

  private transition(next: PaymentStatus): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new InvalidStateTransitionError('Платіж', this._status, next);
    }
    this._status = next;
  }
}
