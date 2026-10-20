/**
 * Абстракція часу. Дає змогу тестувати правила, що залежать від часу
 * (15-хвилинне вікно оплати, email-нагадування) без очікування реального часу.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Керований годинник для тестів. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T10:00:00Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }
}
