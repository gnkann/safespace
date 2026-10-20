import { NotImplementedYetError } from '../../../shared/errors';
import { EmailSender } from '../ports/EmailSender';

/** Каркас адаптера SendGrid; реальна відправка — наступний етап. Інтерфейс уже зафіксований. */
export class SendGridEmailSender implements EmailSender {
  constructor(_apiKey: string) {}

  async send(_to: string, _subject: string, _body: string): Promise<void> {
    throw new NotImplementedYetError('Інтеграція із SendGrid');
  }
}
