import { PaymentStatus } from '../../shared/domain/enums';
import { NotFoundError } from '../../shared/errors';
import { EventBus } from '../../shared/events/EventBus';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { PaymentInitiator, PaymentIntentInfo } from '../booking/ports/PaymentInitiator';
import { Payment } from './domain/Payment';
import { PaymentGateway } from './ports/PaymentGateway';
import { PaymentRepository } from './ports/PaymentRepository';

const CURRENCY = 'UAH';

/**
 * FR-06. Реалізує порт PaymentInitiator модуля booking.
 * Про результат оплати повідомляє подією — booking підписаний на неї
 * і сам підтверджує сесію (немає циклічної залежності модулів).
 */
export class PaymentService implements PaymentInitiator {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly payments: PaymentRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  async initiate(sessionId: string, amount: number): Promise<PaymentIntentInfo> {
    const intent = await this.gateway.createPaymentIntent({ amount, currency: CURRENCY, metadata: { sessionId } });
    const payment = new Payment(newId(), sessionId, amount, CURRENCY, intent.providerPaymentId, this.clock.now());
    await this.payments.save(payment);
    return { paymentId: payment.id, clientSecret: intent.clientSecret, amount, currency: CURRENCY };
  }

  /** Обробка вебхука провайдера; повторна доставка тієї ж події безпечна (ідемпотентність). */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const event = this.gateway.parseWebhook(rawBody, signature);
    const payment = await this.payments.findByProviderId(event.providerPaymentId);
    if (!payment) throw new NotFoundError('Платіж');
    if (payment.status !== PaymentStatus.PENDING) return;

    if (event.type === 'payment.succeeded') {
      payment.markSucceeded();
      await this.payments.save(payment);
      await this.events.publish('payment.succeeded', { paymentId: payment.id, sessionId: payment.sessionId });
    } else {
      payment.markFailed();
      await this.payments.save(payment);
      await this.events.publish('payment.failed', { paymentId: payment.id, sessionId: payment.sessionId });
    }
  }
}
