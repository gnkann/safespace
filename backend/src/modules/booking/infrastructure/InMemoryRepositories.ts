import { SlotStatus } from '../../../shared/domain/enums';
import { PersonalNote } from '../domain/PersonalNote';
import { Review } from '../domain/Review';
import { Session } from '../domain/Session';
import { TimeSlot } from '../domain/TimeSlot';
import { NoteRepository, ReviewRepository, SessionRepository, SlotRepository } from '../ports/repositories';
import { SessionStatus } from '../../../shared/domain/enums';

export class InMemorySlotRepository implements SlotRepository {
  private readonly items = new Map<string, TimeSlot>();

  async save(slot: TimeSlot): Promise<void> {
    this.items.set(slot.id, slot);
  }
  async findById(id: string): Promise<TimeSlot | null> {
    return this.items.get(id) ?? null;
  }
  async findByPsychologist(psychologistId: string): Promise<TimeSlot[]> {
    return [...this.items.values()].filter((s) => s.psychologistId === psychologistId);
  }
  /** Node.js однопотоковий, тому check-and-set між `await` тут атомарний. */
  async tryReserve(slotId: string): Promise<boolean> {
    const slot = this.items.get(slotId);
    if (!slot || slot.status !== SlotStatus.OPEN) return false;
    slot.book();
    return true;
  }
  async release(slotId: string): Promise<void> {
    this.items.get(slotId)?.release();
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly items = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.items.set(session.id, session);
  }
  async findById(id: string): Promise<Session | null> {
    return this.items.get(id) ?? null;
  }
  async findByClient(clientId: string): Promise<Session[]> {
    return [...this.items.values()].filter((s) => s.clientId === clientId);
  }
  async findByPsychologist(psychologistId: string): Promise<Session[]> {
    return [...this.items.values()].filter((s) => s.psychologistId === psychologistId);
  }
  async findPendingWithDeadlineBefore(date: Date): Promise<Session[]> {
    return [...this.items.values()].filter((s) => s.status === SessionStatus.PENDING && s.paymentDeadline <= date);
  }
}

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly items: Review[] = [];

  async save(review: Review): Promise<void> {
    this.items.push(review);
  }
  async findBySession(sessionId: string): Promise<Review | null> {
    return this.items.find((r) => r.sessionId === sessionId) ?? null;
  }
  async findByPsychologist(psychologistId: string): Promise<Review[]> {
    return this.items.filter((r) => r.psychologistId === psychologistId);
  }
}

export class InMemoryNoteRepository implements NoteRepository {
  private readonly items = new Map<string, PersonalNote>();

  async save(note: PersonalNote): Promise<void> {
    this.items.set(note.id, note);
  }
  async findByClient(clientId: string): Promise<PersonalNote[]> {
    return [...this.items.values()].filter((n) => n.clientId === clientId);
  }
  async findById(id: string): Promise<PersonalNote | null> {
    return this.items.get(id) ?? null;
  }
  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}
