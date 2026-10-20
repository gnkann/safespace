import { User } from '../domain/User';

/**
 * Порт збереження користувачів (DIP). Бізнес-логіка залежить від цього інтерфейсу,
 * а не від PostgreSQL. ISP: лише операції, потрібні модулю автентифікації.
 */
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
}
