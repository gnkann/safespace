import { SlotStatus } from '../../../shared/domain/enums';
import { ConflictError, ValidationError } from '../../../shared/errors';

export interface TimeSlotProps {
  id: string;
  psychologistId: string;
  startsAt: Date;
  endsAt: Date;
  status?: SlotStatus;
}

/** Слот у календарі психолога (FR-07). */
export class TimeSlot {
  readonly id: string;
  readonly psychologistId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  private _status: SlotStatus;

  constructor(props: TimeSlotProps) {
    if (props.endsAt <= props.startsAt) throw new ValidationError('Кінець слота має бути пізніше за початок');
    this.id = props.id;
    this.psychologistId = props.psychologistId;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this._status = props.status ?? SlotStatus.OPEN;
  }

  get status(): SlotStatus {
    return this._status;
  }

  get isOpen(): boolean {
    return this._status === SlotStatus.OPEN;
  }

  overlaps(other: { startsAt: Date; endsAt: Date }): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }

  book(): void {
    if (!this.isOpen) throw new ConflictError('Слот вже зайнятий або закритий');
    this._status = SlotStatus.BOOKED;
  }

  /** Слот знову стає вільним після скасування або спливу часу оплати. */
  release(): void {
    if (this._status === SlotStatus.BOOKED) this._status = SlotStatus.OPEN;
  }

  close(): void {
    if (this._status === SlotStatus.BOOKED) throw new ConflictError('Неможливо закрити слот із активним бронюванням');
    this._status = SlotStatus.CLOSED;
  }
}
