import { PersonalNote } from '../domain/PersonalNote';
import { Review } from '../domain/Review';
import { Session } from '../domain/Session';
import { TimeSlot } from '../domain/TimeSlot';

export interface SlotRepository {
  save(slot: TimeSlot): Promise<void>;
  findById(id: string): Promise<TimeSlot | null>;
  findByPsychologist(psychologistId: string): Promise<TimeSlot[]>;
  /**
   * Атомарне резервування слота. Повертає false, якщо слот уже не вільний.
   * У PostgreSQL реалізується як `UPDATE ... WHERE status='OPEN'` або
   * `SELECT ... FOR UPDATE` в одній транзакції (лаб. 2, розд. 4.2) —
   * це унеможливлює подвійне бронювання.
   */
  tryReserve(slotId: string): Promise<boolean>;
  /** Повертає слот у стан OPEN (скасування, спливання часу оплати, збій ініціації платежу). */
  release(slotId: string): Promise<void>;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  findByClient(clientId: string): Promise<Session[]>;
  findByPsychologist(psychologistId: string): Promise<Session[]>;
  /** Сесії PENDING, у яких вичерпано час на оплату. */
  findPendingWithDeadlineBefore(date: Date): Promise<Session[]>;
}

export interface ReviewRepository {
  save(review: Review): Promise<void>;
  findBySession(sessionId: string): Promise<Review | null>;
  findByPsychologist(psychologistId: string): Promise<Review[]>;
}

export interface NoteRepository {
  save(note: PersonalNote): Promise<void>;
  findByClient(clientId: string): Promise<PersonalNote[]>;
  findById(id: string): Promise<PersonalNote | null>;
  delete(id: string): Promise<void>;
}
