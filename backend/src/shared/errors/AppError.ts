/** Базова помилка застосунку. Містить HTTP-статус і машинозчитуваний код. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Необхідна автентифікація') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Недостатньо прав') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(404, 'NOT_FOUND', `${entity} не знайдено`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/** Спроба недопустимого переходу між станами (наприклад, оплата скасованої сесії — NFR-02). */
export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(409, 'INVALID_STATE_TRANSITION', `${entity}: перехід ${from} → ${to} неможливий`);
  }
}

export class NotImplementedYetError extends AppError {
  constructor(feature: string) {
    super(501, 'NOT_IMPLEMENTED', `${feature} буде реалізовано на наступному етапі`);
  }
}
