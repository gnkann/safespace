import { EventBus } from '../../shared/events/EventBus';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { UserRepository } from '../auth/ports/UserRepository';
import { Notification, NotificationType } from './domain/Notification';
import { EmailSender } from './ports/EmailSender';
import { NotificationRepository } from './ports/NotificationRepository';

/**
 * FR-05. Реагує на доменні події (OCP: нові типи сповіщень — нові підписки,
 * існуючий код не змінюється) і відправляє відкладені нагадування за розкладом.
 */
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly sender: EmailSender,
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly reminderBeforeHours = 24,
    private readonly appUrl = 'http://localhost:5173',
  ) {}

  /** Підписує сервіс на події шини; викликається у composition root. */
  register(events: EventBus): void {
    events.subscribe('user.registered', async (e) => {
      await this.enqueue('EMAIL_CONFIRMATION', e.email, 'Підтвердіть email у SafeSpace',
        `Для активації облікового запису перейдіть за посиланням: ${this.appUrl}/confirm-email?token=${e.confirmationToken}`);
    });

    events.subscribe('session.confirmed', async (e) => {
      const [client, psych] = await Promise.all([this.users.findById(e.clientId), this.users.findById(e.psychologistId)]);
      const when = e.startsAt.toISOString();
      for (const user of [client, psych]) {
        if (!user) continue;
        await this.enqueue('SESSION_CONFIRMED', user.email, 'Сесію підтверджено', `Сесію заплановано на ${when}.`);
        const remindAt = new Date(e.startsAt.getTime() - this.reminderBeforeHours * 3_600_000);
        await this.enqueue('SESSION_REMINDER', user.email, 'Нагадування про сесію', `Нагадуємо: сесія розпочнеться ${when}.`,
          remindAt > this.clock.now() ? remindAt : this.clock.now());
      }
    });

    events.subscribe('session.cancelled', async (e) => {
      const [client, psych] = await Promise.all([this.users.findById(e.clientId), this.users.findById(e.psychologistId)]);
      for (const user of [client, psych]) {
        if (!user) continue;
        await this.enqueue('SESSION_CANCELLED', user.email, 'Сесію скасовано', `Причина: ${e.reason}.`);
      }
    });
  }

  /** Викликається планувальником: надсилає все, що вже час відправити. */
  async processDue(): Promise<number> {
    const now = this.clock.now();
    const due = await this.repo.findDue(now);
    let sent = 0;
    for (const n of due) {
      try {
        await this.sender.send(n.recipientEmail, n.subject, n.body);
        n.markSent(now);
        await this.repo.save(n);
        sent++;
      } catch (err) {
        // Збій одного листа не блокує решту; спроба повториться при наступному запуску.
        console.error(`[notification] не вдалося надіслати ${n.id}:`, err);
      }
    }
    return sent;
  }

  private async enqueue(type: NotificationType, to: string, subject: string, body: string, scheduledFor = this.clock.now()): Promise<void> {
    await this.repo.save(new Notification(newId(), type, to, subject, body, scheduledFor));
  }
}
