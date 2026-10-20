import { EmailSender } from '../ports/EmailSender';

/** dev-заглушка: виводить листи в консоль замість реальної відправки. */
export class ConsoleEmailSender implements EmailSender {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`[email] → ${to}\n  Тема: ${subject}\n  ${body}`);
  }
}

/** Заглушка для тестів: запам'ятовує надіслане. */
export class RecordingEmailSender implements EmailSender {
  readonly sent: Array<{ to: string; subject: string; body: string }> = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}
