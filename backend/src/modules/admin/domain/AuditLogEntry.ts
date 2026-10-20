export type AuditAction =
  | 'PSYCHOLOGIST_VERIFIED'
  | 'PSYCHOLOGIST_REJECTED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'COMPLAINT_RESOLVED';

/** Запис журналу дій адміністратора (NFR-08). Незмінний (immutable). */
export class AuditLogEntry {
  constructor(
    readonly id: string,
    readonly adminId: string,
    readonly action: AuditAction,
    readonly targetId: string,
    readonly details: string | undefined,
    readonly createdAt: Date,
  ) {}
}
