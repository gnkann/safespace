import { AuditLogEntry } from '../domain/AuditLogEntry';
import { Complaint } from '../domain/Complaint';

export interface AuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
  findAll(): Promise<AuditLogEntry[]>;
}

export interface ComplaintRepository {
  save(c: Complaint): Promise<void>;
  findById(id: string): Promise<Complaint | null>;
  findAll(): Promise<Complaint[]>;
}
