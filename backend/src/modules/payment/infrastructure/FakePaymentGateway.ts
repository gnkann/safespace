import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../../shared/errors';
import { CreateIntentRequest, CreateIntentResult, PaymentGateway, WebhookEvent } from '../ports/PaymentGateway';

/** Локальна заглушка для розробки й тестів: ніяких зовнішніх викликів. */
export class FakePaymentGateway implements PaymentGateway {
  async createPaymentIntent(_req: CreateIntentRequest): Promise<CreateIntentResult> {
    const id = `pi_fake_${randomUUID()}`;
    return { providerPaymentId: id, clientSecret: `${id}_secret` };
  }

  parseWebhook(rawBody: string): WebhookEvent {
    try {
      const parsed = JSON.parse(rawBody) as WebhookEvent;
      if (!parsed.providerPaymentId || !['payment.succeeded', 'payment.failed'].includes(parsed.type)) throw new Error();
      return parsed;
    } catch {
      throw new ValidationError('Некоректний вебхук');
    }
  }
}
