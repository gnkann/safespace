import { Notification } from '../domain/Notification';
import { NotificationRepository } from '../ports/NotificationRepository';

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<string, Notification>();

  async save(n: Notification): Promise<void> {
    this.items.set(n.id, n);
  }
  async findDue(now: Date): Promise<Notification[]> {
    return [...this.items.values()].filter((n) => !n.isSent && n.scheduledFor <= now);
  }
  async findAll(): Promise<Notification[]> {
    return [...this.items.values()];
  }
}
