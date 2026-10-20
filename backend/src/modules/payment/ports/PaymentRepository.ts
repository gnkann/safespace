import { Payment } from '../domain/Payment';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findByProviderId(providerPaymentId: string): Promise<Payment | null>;
  findBySession(sessionId: string): Promise<Payment | null>;
}
