import { AccountStatus, Role } from '../../shared/domain/enums';
import { ConflictError, ForbiddenError, UnauthorizedError, NotFoundError } from '../../shared/errors';
import { EventBus } from '../../shared/events/EventBus';
import { newId } from '../../shared/id';
import { PasswordHasher } from '../../shared/security/PasswordHasher';
import { TokenService } from '../../shared/security/TokenService';
import { Clock } from '../../shared/time/Clock';
import { Client } from './domain/Client';
import { Psychologist, PsychologistProfile } from './domain/Psychologist';
import { User } from './domain/User';
import { UserRepository } from './ports/UserRepository';
import { Validator } from './validators';

export interface RegisterClientDto {
  pseudonym: string;
  email: string;
  password: string;
  passwordConfirm: string;
  isAdultConfirmed: boolean;
  consentAccepted: boolean;
  realName?: string;
  phone?: string;
}

export interface RegisterPsychologistDto {
  email: string;
  password: string;
  passwordConfirm: string;
  consentAccepted: boolean;
  profile: PsychologistProfile;
}

/**
 * FR-01. Єдина відповідальність (SRP): реєстрація та автентифікація.
 * Усі залежності передаються через конструктор як абстракції (DIP) —
 * сервіс можна тестувати без БД, bcrypt та JWT.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  /** FR-01.1 */
  async registerClient(dto: RegisterClientDto): Promise<Client> {
    new Validator()
      .nonEmpty(dto.pseudonym, 'pseudonym', 'Вкажіть псевдонім')
      .email(dto.email)
      .password(dto.password, dto.passwordConfirm)
      .require(dto.isAdultConfirmed === true, 'isAdultConfirmed', 'Потрібне підтвердження, що вам 18 років або більше')
      .require(dto.consentAccepted === true, 'consentAccepted', 'Потрібна згода з умовами використання та політикою конфіденційності')
      .throwIfInvalid();
    await this.assertEmailFree(dto.email);

    const client = new Client({
      id: newId(),
      email: dto.email,
      passwordHash: await this.hasher.hash(dto.password),
      createdAt: this.clock.now(),
      pseudonym: dto.pseudonym.trim(),
      realName: dto.realName,
      phone: dto.phone,
      consentAcceptedAt: this.clock.now(),
    });
    await this.users.save(client);
    await this.sendConfirmation(client);
    return client;
  }

  /** FR-01.2 (кроки 1 і 2 об'єднано в одному DTO; файли дипломів завантажуються окремо). */
  async registerPsychologist(dto: RegisterPsychologistDto): Promise<Psychologist> {
    const v = new Validator()
      .email(dto.email)
      .password(dto.password, dto.passwordConfirm)
      .require(dto.consentAccepted === true, 'consentAccepted', 'Потрібна згода з умовами використання')
      .nonEmpty(dto.profile?.fullName, 'profile.fullName', 'Вкажіть ПІБ')
      .require((dto.profile?.diplomaFileKeys?.length ?? 0) >= 1, 'profile.diplomaFileKeys', 'Потрібен щонайменше один скан диплома')
      .require((dto.profile?.certificateFileKeys?.length ?? 0) <= 5, 'profile.certificateFileKeys', 'Не більше 5 сертифікатів')
      .require((dto.profile?.bio?.length ?? 0) <= 1000, 'profile.bio', 'Опис — до 1000 символів')
      .require((dto.profile?.pricePerSession ?? 0) > 0, 'profile.pricePerSession', 'Вкажіть вартість сесії')
      .require((dto.profile?.sessionDurationMin ?? 0) > 0, 'profile.sessionDurationMin', 'Вкажіть тривалість сесії');
    v.throwIfInvalid();
    await this.assertEmailFree(dto.email);

    const psychologist = new Psychologist({
      id: newId(),
      email: dto.email,
      passwordHash: await this.hasher.hash(dto.password),
      createdAt: this.clock.now(),
      consentAcceptedAt: this.clock.now(),
      profile: dto.profile,
    });
    await this.users.save(psychologist);
    await this.sendConfirmation(psychologist);
    return psychologist;
  }

  async confirmEmail(token: string): Promise<void> {
    const userId = this.tokens.verifyEmailConfirmationToken(token);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Користувача');
    user.confirmEmail();
    await this.users.save(user);
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const user = await this.users.findByEmail(email ?? '');
    // Однакова відповідь для «немає користувача» та «неправильний пароль» — не розкриваємо, чи існує email.
    if (!user || !(await this.hasher.compare(password ?? '', user.passwordHash))) {
      throw new UnauthorizedError('Невірний email або пароль');
    }
    if (user.status === AccountStatus.BLOCKED) throw new ForbiddenError('Обліковий запис заблоковано');
    if (!user.isActive) throw new ForbiddenError('Підтвердіть email, щоб увійти');
    return { token: this.tokens.signAccessToken({ userId: user.id, role: user.role as Role }), user };
  }

  private async assertEmailFree(email: string): Promise<void> {
    if (await this.users.findByEmail(email)) throw new ConflictError('Користувач із таким email вже існує');
  }

  private async sendConfirmation(user: User): Promise<void> {
    await this.events.publish('user.registered', {
      userId: user.id,
      email: user.email,
      confirmationToken: this.tokens.signEmailConfirmationToken(user.id),
    });
  }
}
