import { ValidationError } from '../../../shared/errors';

/** Відгук (0..1 на сесію). Створюється лише після завершення сесії. */
export class Review {
  constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly clientId: string,
    readonly psychologistId: string,
    readonly rating: number,
    readonly text: string,
    readonly createdAt: Date,
  ) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError('Оцінка має бути цілим числом від 1 до 5');
    }
  }
}
