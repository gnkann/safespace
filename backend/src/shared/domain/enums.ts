/** Спільні перелічення доменної моделі (див. діаграму класів, лаб. 2, рис. 2). */

export enum Role {
  CLIENT = 'CLIENT',
  PSYCHOLOGIST = 'PSYCHOLOGIST',
  ADMIN = 'ADMIN',
}

/** Статус облікового запису. Клієнт отримує доступ лише після підтвердження email (FR-01.1). */
export enum AccountStatus {
  UNVERIFIED_EMAIL = 'UNVERIFIED_EMAIL',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

/** Статус верифікації анкети психолога: «На перевірці» → «Підтверджено» / «Відхилено» (FR-01.2, FR-10). */
export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/** Життєвий цикл сесії (діаграма станів, лаб. 2, рис. 4). */
export enum SessionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum SlotStatus {
  OPEN = 'OPEN',
  BOOKED = 'BOOKED',
  CLOSED = 'CLOSED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum ComplaintStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}
