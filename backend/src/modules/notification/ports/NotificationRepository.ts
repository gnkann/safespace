import { Notification } from '../domain/Notification';

export interface NotificationRepository {
  save(n: Notification): Promise<void>;
  /** Невідправлені сповіщення, час відправлення яких настав. */
  findDue(now: Date): Promise<Notification[]>;
  findAll(): Promise<Notification[]>;
}
