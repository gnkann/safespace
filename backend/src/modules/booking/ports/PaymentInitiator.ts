export interface PaymentIntentInfo {
  paymentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

/**
 * Порт, через який booking ініціює оплату, не знаючи про Stripe (DIP).
 * Реалізується модулем payment.
 */
export interface PaymentInitiator {
  initiate(sessionId: string, amount: number): Promise<PaymentIntentInfo>;
}
