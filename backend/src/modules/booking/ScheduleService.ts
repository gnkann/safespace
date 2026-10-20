import { SlotStatus } from '../../shared/domain/enums';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { PsychologistRepository } from '../catalog/ports/PsychologistRepository';
import { AvailabilityProvider } from '../catalog/ports/AvailabilityProvider';
import { TimeSlot } from './domain/TimeSlot';
import { SlotRepository } from './ports/repositories';

/**
 * FR-07: керування розкладом психолога. SRP: тільки слоти.
 * Також реалізує порт AvailabilityProvider для каталогу (DIP).
 */
export class ScheduleService implements AvailabilityProvider {
  constructor(
    private readonly slots: SlotRepository,
    private readonly psychologists: PsychologistRepository,
    private readonly clock: Clock,
  ) {}

  async createSlot(psychologistId: string, startsAt: Date, endsAt: Date): Promise<TimeSlot> {
    if (!(await this.psychologists.findPsychologistById(psychologistId))) throw new NotFoundError('Психолога');
    if (startsAt <= this.clock.now()) throw new ValidationError('Слот має бути в майбутньому');

    const slot = new TimeSlot({ id: newId(), psychologistId, startsAt, endsAt });
    const existing = await this.slots.findByPsychologist(psychologistId);
    if (existing.some((s) => s.status !== SlotStatus.CLOSED && s.overlaps(slot))) {
      throw new ConflictError('Слот перетинається з наявним');
    }
    await this.slots.save(slot);
    return slot;
  }

  async closeSlot(psychologistId: string, slotId: string): Promise<void> {
    const slot = await this.slots.findById(slotId);
    if (!slot) throw new NotFoundError('Слот');
    if (slot.psychologistId !== psychologistId) throw new ForbiddenError();
    slot.close();
    await this.slots.save(slot);
  }

  /** Усі слоти власного календаря психолога (будь-який статус). */
  async listOwn(psychologistId: string): Promise<TimeSlot[]> {
    return this.sorted(await this.slots.findByPsychologist(psychologistId));
  }

  /** Вільні майбутні слоти верифікованого психолога — для клієнта (FR-04). */
  async listOpenPublic(psychologistId: string): Promise<TimeSlot[]> {
    const p = await this.psychologists.findPsychologistById(psychologistId);
    if (!p || !p.isPublic) throw new NotFoundError('Психолога');
    const now = this.clock.now();
    const all = await this.slots.findByPsychologist(psychologistId);
    return this.sorted(all.filter((s) => s.isOpen && s.startsAt > now));
  }

  async hasOpenSlot(psychologistId: string, from?: Date, to?: Date): Promise<boolean> {
    const now = this.clock.now();
    const all = await this.slots.findByPsychologist(psychologistId);
    return all.some(
      (s) => s.isOpen && s.startsAt > now && (!from || s.startsAt >= from) && (!to || s.endsAt <= to),
    );
  }

  private sorted(slots: TimeSlot[]): TimeSlot[] {
    return [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}
