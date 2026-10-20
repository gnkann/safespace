import { VerificationStatus } from '../../../shared/domain/enums';
import { Psychologist } from '../domain/Psychologist';
import { User } from '../domain/User';
import { PsychologistRepository } from '../../catalog/ports/PsychologistRepository';
import { UserRepository } from '../ports/UserRepository';

/**
 * Тимчасова реалізація для розробки та тестів.
 * На наступному етапі замінюється на PostgresUserRepository без змін у сервісах.
 * Один клас реалізує два вузькі інтерфейси (ISP).
 */
export class InMemoryUserRepository implements UserRepository, PsychologistRepository {
  private readonly users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((u) => u.email === normalized) ?? null;
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  // --- PsychologistRepository ---

  async findPsychologistById(id: string): Promise<Psychologist | null> {
    const user = this.users.get(id);
    return user instanceof Psychologist ? user : null;
  }

  async findPublicPsychologists(): Promise<Psychologist[]> {
    return this.psychologists().filter((p) => p.isPublic);
  }

  async findPsychologistsByVerification(status: VerificationStatus): Promise<Psychologist[]> {
    return this.psychologists().filter((p) => p.verificationStatus === status);
  }

  private psychologists(): Psychologist[] {
    return [...this.users.values()].filter((u): u is Psychologist => u instanceof Psychologist);
  }
}
