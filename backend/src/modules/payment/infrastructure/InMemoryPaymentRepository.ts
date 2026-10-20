import { Payment } from '../domain/Payment';
import { PaymentRepository } from '../ports/PaymentRepository';

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly items = new Map<string, Payment>();

  async save(payment: Payment): Promise<void> {
    this.items.set(payment.id, payment);
  }
  async findByProviderId(providerPaymentId: string): Promise<Payment | null> {
    return [...this.items.values()].find((p) => p.providerPaymentId === providerPaymentId) ?? null;
  }
  async findBySession(sessionId: string): Promise<Payment | null> {
    return [...this.items.values()].find((p) => p.sessionId === sessionId) ?? null;
  }
}
