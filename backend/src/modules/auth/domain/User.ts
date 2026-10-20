import { AccountStatus, Role } from '../../../shared/domain/enums';
import { ConflictError } from '../../../shared/errors';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  status?: AccountStatus;
  createdAt: Date;
}

/**
 * Абстрактний базовий клас усіх користувачів (діаграма класів, лаб. 2).
 * SRP: відповідає лише за дані облікового запису та його статус —
 * не за платежі, бронювання чи сповіщення.
 * LSP: Client, Psychologist і Admin можна використовувати скрізь, де очікується User.
 */
export abstract class User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
  private _passwordHash: string;
  private _status: AccountStatus;

  protected constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email.trim().toLowerCase();
    this._passwordHash = props.passwordHash;
    this._status = props.status ?? AccountStatus.UNVERIFIED_EMAIL;
    this.createdAt = props.createdAt;
  }

  abstract get role(): Role;

  get passwordHash(): string {
    return this._passwordHash;
  }

  get status(): AccountStatus {
    return this._status;
  }

  get isActive(): boolean {
    return this._status === AccountStatus.ACTIVE;
  }

  /** Підтвердження email активує обліковий запис (FR-01.1). */
  confirmEmail(): void {
    if (this._status === AccountStatus.BLOCKED) {
      throw new ConflictError('Обліковий запис заблоковано');
    }
    this._status = AccountStatus.ACTIVE;
  }

  /** Блокування адміністратором (FR-11, FR-12). */
  block(): void {
    this._status = AccountStatus.BLOCKED;
  }

  unblock(): void {
    if (this._status === AccountStatus.BLOCKED) this._status = AccountStatus.ACTIVE;
  }

  changePasswordHash(hash: string): void {
    this._passwordHash = hash;
  }
}
