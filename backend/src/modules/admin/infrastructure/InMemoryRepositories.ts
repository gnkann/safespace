import { AuditLogEntry } from '../domain/AuditLogEntry';
import { Complaint } from '../domain/Complaint';
import { AuditLogRepository, ComplaintRepository } from '../ports/repositories';

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly items: AuditLogEntry[] = [];
  async append(entry: AuditLogEntry): Promise<void> {
    this.items.push(entry);
  }
  async findAll(): Promise<AuditLogEntry[]> {
    return [...this.items];
  }
}

export class InMemoryComplaintRepository implements ComplaintRepository {
  private readonly items = new Map<string, Complaint>();
  async save(c: Complaint): Promise<void> {
    this.items.set(c.id, c);
  }
  async findById(id: string): Promise<Complaint | null> {
    return this.items.get(id) ?? null;
  }
  async findAll(): Promise<Complaint[]> {
    return [...this.items.values()];
  }
}
