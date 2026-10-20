import { ComplaintStatus } from '../../../shared/domain/enums';
import { ConflictError } from '../../../shared/errors';

/** Скарга користувача (FR-11). */
export class Complaint {
  private _status = ComplaintStatus.OPEN;
  private _resolution?: string;

  constructor(
    readonly id: string,
    readonly authorId: string,
    readonly targetUserId: string,
    readonly text: string,
    readonly createdAt: Date,
  ) {}

  get status(): ComplaintStatus {
    return this._status;
  }
  get resolution(): string | undefined {
    return this._resolution;
  }

  resolve(resolution: string): void {
    if (this._status === ComplaintStatus.RESOLVED) throw new ConflictError('Скаргу вже розглянуто');
    this._status = ComplaintStatus.RESOLVED;
    this._resolution = resolution;
  }
}
