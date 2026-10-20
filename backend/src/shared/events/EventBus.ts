
/**
 * Доменні події модульного моноліту. Модулі не викликають один одного напряму,
 * а обмінюються подіями — це зберігає слабку зв'язаність і дозволяє пізніше
 * виокремити модуль у мікросервіс (лаб. 2, розд. 2.2, п. 4).
 */
export interface DomainEvents {
  'user.registered': { userId: string; email: string; confirmationToken: string };
  'session.booked': { sessionId: string; clientId: string; psychologistId: string };
  'session.confirmed': { sessionId: string; clientId: string; psychologistId: string; startsAt: Date };
  'session.cancelled': { sessionId: string; clientId: string; psychologistId: string; cancelledBy: string; reason: string };
  'session.expired': { sessionId: string };
  'session.completed': { sessionId: string };
  'payment.succeeded': { paymentId: string; sessionId: string };
  'payment.failed': { paymentId: string; sessionId: string };
}

export type EventName = keyof DomainEvents;
export type EventHandler<K extends EventName> = (payload: DomainEvents[K]) => void | Promise<void>;

export interface EventBus {
  publish<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void>;
  subscribe<K extends EventName>(name: K, handler: EventHandler<K>): void;
}

/** Синхронна in-process реалізація; у майбутньому може бути замінена на брокер повідомлень. */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<EventName, Array<EventHandler<EventName>>>();

  subscribe<K extends EventName>(name: K, handler: EventHandler<K>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as EventHandler<EventName>);
    this.handlers.set(name, list);
  }

  async publish<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void> {
    for (const handler of this.handlers.get(name) ?? []) {
      await handler(payload);
    }
  }
}

