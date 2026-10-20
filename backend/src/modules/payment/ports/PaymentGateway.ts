export interface CreateIntentRequest {
  amount: number;
  currency: string;
  /** Додаткові дані для звірки (наприклад, sessionId). */
  metadata: Record<string, string>;
}

export interface CreateIntentResult {
  providerPaymentId: string;
  clientSecret: string;
}

export interface WebhookEvent {
  type: 'payment.succeeded' | 'payment.failed';
  providerPaymentId: string;
}

/**
 * Абстракція платіжного провайдера (OCP/DIP): додати PayPal чи LiqPay = новий клас,
 * без змін у PaymentService. Усі виклики йдуть лише через HTTPS (NFR-03).
 */
export interface PaymentGateway {
  createPaymentIntent(req: CreateIntentRequest): Promise<CreateIntentResult>;
  /** Перевіряє підпис вебхука та повертає нормалізовану подію. */
  parseWebhook(rawBody: string, signature: string | undefined): WebhookEvent;
}
