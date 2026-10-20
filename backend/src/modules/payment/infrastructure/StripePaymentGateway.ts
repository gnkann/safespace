import { NotImplementedYetError } from '../../../shared/errors';
import { CreateIntentRequest, CreateIntentResult, PaymentGateway, WebhookEvent } from '../ports/PaymentGateway';

/**
 * Каркас адаптера Stripe API. Реальна інтеграція (Payment Intent + перевірка
 * підпису вебхука через `stripe.webhooks.constructEvent`) — завдання наступної лабораторної.
 * Інтерфейс уже зафіксований, тому решта системи не зміниться.
 */
export class StripePaymentGateway implements PaymentGateway {
  constructor(_secretKey: string, _webhookSecret: string) {}

  async createPaymentIntent(_req: CreateIntentRequest): Promise<CreateIntentResult> {
    throw new NotImplementedYetError('Інтеграція зі Stripe');
  }

  parseWebhook(_rawBody: string, _signature: string | undefined): WebhookEvent {
    throw new NotImplementedYetError('Перевірка вебхука Stripe');
  }
}
