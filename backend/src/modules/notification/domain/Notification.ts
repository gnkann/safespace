export type NotificationType = 'EMAIL_CONFIRMATION' | 'SESSION_CONFIRMED' | 'SESSION_CANCELLED' | 'SESSION_REMINDER';

/** Email-сповіщення (FR-05). Може бути відкладеним: `scheduledFor` — час відправлення. */
export class Notification {
  private _sentAt?: Date;

  constructor(
    readonly id: string,
    readonly type: NotificationType,
    readonly recipientEmail: string,
    readonly subject: string,
    readonly body: string,
    readonly scheduledFor: Date,
  ) {}

  get sentAt(): Date | undefined {
    return this._sentAt;
  }

  get isSent(): boolean {
    return this._sentAt !== undefined;
  }

  markSent(at: Date): void {
    this._sentAt = at;
  }
}
