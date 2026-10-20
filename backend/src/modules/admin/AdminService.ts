import { Role, VerificationStatus } from '../../shared/domain/enums';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { Psychologist } from '../auth/domain/Psychologist';
import { User } from '../auth/domain/User';
import { UserRepository } from '../auth/ports/UserRepository';
import { PsychologistRepository } from '../catalog/ports/PsychologistRepository';
import { AuditAction, AuditLogEntry } from './domain/AuditLogEntry';
import { Complaint } from './domain/Complaint';
import { AuditLogRepository, ComplaintRepository } from './ports/repositories';

/**
 * FR-10, FR-11, FR-12, NFR-08. Кожна дія адміністратора, що змінює стан системи,
 * фіксується в журналі аудиту (метод `audit`).
 */
export class AdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly psychologists: PsychologistRepository,
    private readonly complaints: ComplaintRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  // --- FR-10: верифікація анкет ---

  listPendingPsychologists(): Promise<Psychologist[]> {
    return this.psychologists.findPsychologistsByVerification(VerificationStatus.PENDING);
  }

  async verifyPsychologist(adminId: string, psychologistId: string): Promise<void> {
    const p = await this.getPsychologist(psychologistId);
    p.verify();
    await this.users.save(p);
    await this.log(adminId, 'PSYCHOLOGIST_VERIFIED', psychologistId);
  }

  async rejectPsychologist(adminId: string, psychologistId: string, reason: string): Promise<void> {
    if (!reason?.trim()) throw new ValidationError('Вкажіть причину відхилення');
    const p = await this.getPsychologist(psychologistId);
    p.reject();
    await this.users.save(p);
    await this.log(adminId, 'PSYCHOLOGIST_REJECTED', psychologistId, reason.trim());
  }

  // --- FR-12: керування користувачами ---

  listUsers(): Promise<User[]> {
    return this.users.findAll();
  }

  async blockUser(adminId: string, userId: string, reason?: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user.role === Role.ADMIN) throw new ConflictError('Не можна заблокувати адміністратора');
    user.block();
    await this.users.save(user);
    await this.log(adminId, 'USER_BLOCKED', userId, reason);
  }

  async unblockUser(adminId: string, userId: string): Promise<void> {
    const user = await this.getUser(userId);
    user.unblock();
    await this.users.save(user);
    await this.log(adminId, 'USER_UNBLOCKED', userId);
  }

  // --- FR-11: скарги ---

  async submitComplaint(authorId: string, targetUserId: string, text: string): Promise<Complaint> {
    if (!text?.trim()) throw new ValidationError('Опишіть скаргу');
    await this.getUser(targetUserId);
    const c = new Complaint(newId(), authorId, targetUserId, text.trim(), this.clock.now());
    await this.complaints.save(c);
    return c;
  }

  listComplaints(): Promise<Complaint[]> {
    return this.complaints.findAll();
  }

  async resolveComplaint(adminId: string, complaintId: string, resolution: string): Promise<void> {
    const c = await this.complaints.findById(complaintId);
    if (!c) throw new NotFoundError('Скаргу');
    c.resolve(resolution);
    await this.complaints.save(c);
    await this.log(adminId, 'COMPLAINT_RESOLVED', complaintId, resolution);
  }

  // --- NFR-08 ---

  getAuditLog(): Promise<AuditLogEntry[]> {
    return this.audit.findAll();
  }

  private async log(adminId: string, action: AuditAction, targetId: string, details?: string): Promise<void> {
    await this.audit.append(new AuditLogEntry(newId(), adminId, action, targetId, details, this.clock.now()));
  }

  private async getUser(id: string): Promise<User> {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundError('Користувача');
    return u;
  }

  private async getPsychologist(id: string): Promise<Psychologist> {
    const p = await this.psychologists.findPsychologistById(id);
    if (!p) throw new NotFoundError('Психолога');
    return p;
  }
}
