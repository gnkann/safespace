import { AppConfig } from './config/env';
import { InMemoryEventBus, EventBus } from './shared/events/EventBus';
import { newId } from './shared/id';
import { AesGcmEncryptor, Encryptor } from './shared/security/Encryptor';
import { BcryptPasswordHasher, PasswordHasher } from './shared/security/PasswordHasher';
import { JwtTokenService, TokenService } from './shared/security/TokenService';
import { Clock, SystemClock } from './shared/time/Clock';

import { AuthService } from './modules/auth/AuthService';
import { Admin } from './modules/auth/domain/Admin';
import { InMemoryUserRepository } from './modules/auth/infrastructure/InMemoryUserRepository';
import { AccountStatus } from './shared/domain/enums';

import { CatalogService } from './modules/catalog/CatalogService';

import { BookingService } from './modules/booking/BookingService';
import { PersonalCabinetService } from './modules/booking/PersonalCabinetService';
import { ReviewService } from './modules/booking/ReviewService';
import { ScheduleService } from './modules/booking/ScheduleService';
import {
  InMemoryNoteRepository, InMemoryReviewRepository, InMemorySessionRepository, InMemorySlotRepository,
} from './modules/booking/infrastructure/InMemoryRepositories';

import { PaymentService } from './modules/payment/PaymentService';
import { FakePaymentGateway } from './modules/payment/infrastructure/FakePaymentGateway';
import { InMemoryPaymentRepository } from './modules/payment/infrastructure/InMemoryPaymentRepository';
import { StripePaymentGateway } from './modules/payment/infrastructure/StripePaymentGateway';
import { PaymentGateway } from './modules/payment/ports/PaymentGateway';
import { PaymentRepository } from './modules/payment/ports/PaymentRepository';
import { NoteRepository } from './modules/booking/ports/repositories';

import { NotificationService } from './modules/notification/NotificationService';
import { ConsoleEmailSender } from './modules/notification/infrastructure/ConsoleEmailSender';
import { InMemoryNotificationRepository } from './modules/notification/infrastructure/InMemoryNotificationRepository';
import { SendGridEmailSender } from './modules/notification/infrastructure/SendGridEmailSender';
import { EmailSender } from './modules/notification/ports/EmailSender';

import { AdminService } from './modules/admin/AdminService';
import { InMemoryAuditLogRepository, InMemoryComplaintRepository } from './modules/admin/infrastructure/InMemoryRepositories';

export interface Container {
  config: AppConfig;
  clock: Clock;
  events: EventBus;
  tokens: TokenService;
  auth: AuthService;
  catalog: CatalogService;
  schedule: ScheduleService;
  booking: BookingService;
  reviews: ReviewService;
  cabinet: PersonalCabinetService;
  payments: PaymentService;
  notifications: NotificationService;
  admin: AdminService;
  /** Сховища — для діагностики та тестів (напр., перевірити, що нотатки зберігаються зашифрованими). */
  repositories: { notes: NoteRepository; payments: PaymentRepository };
  bootstrap(): Promise<void>;
}

export interface ContainerOverrides {
  clock?: Clock;
  emailSender?: EmailSender;
  paymentGateway?: PaymentGateway;
  hasher?: PasswordHasher;
  encryptor?: Encryptor;
}

/**
 * Composition root: єдине місце, де конкретні реалізації «склеюються» з абстракціями (DIP).
 * Перехід на PostgreSQL = заміна InMemory*Repository на Postgres*Repository лише тут.
 */
export function createContainer(config: AppConfig, overrides: ContainerOverrides = {}): Container {
  const clock = overrides.clock ?? new SystemClock();
  const events = new InMemoryEventBus();
  const hasher = overrides.hasher ?? new BcryptPasswordHasher(config.bcryptRounds);
  const tokens = new JwtTokenService(config.jwtSecret, config.jwtExpiresIn);
  const encryptor = overrides.encryptor ?? new AesGcmEncryptor(config.encryptionKey);

  // Сховища (тимчасово in-memory)
  const userRepo = new InMemoryUserRepository();
  const slotRepo = new InMemorySlotRepository();
  const sessionRepo = new InMemorySessionRepository();
  const reviewRepo = new InMemoryReviewRepository();
  const noteRepo = new InMemoryNoteRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const notificationRepo = new InMemoryNotificationRepository();

  // Зовнішні адаптери
  const gateway: PaymentGateway =
    overrides.paymentGateway ??
    (config.paymentProvider === 'stripe'
      ? new StripePaymentGateway(config.stripeSecretKey, config.stripeWebhookSecret)
      : new FakePaymentGateway());
  const emailSender: EmailSender =
    overrides.emailSender ??
    (config.emailProvider === 'sendgrid' ? new SendGridEmailSender(config.sendgridApiKey) : new ConsoleEmailSender());

  // Сервіси модулів
  const auth = new AuthService(userRepo, hasher, tokens, events, clock);
  const schedule = new ScheduleService(slotRepo, userRepo, clock);
  const reviews = new ReviewService(reviewRepo, sessionRepo, userRepo, clock);
  const catalog = new CatalogService(userRepo, schedule, reviews);
  const payments = new PaymentService(gateway, paymentRepo, events, clock);
  const booking = new BookingService(sessionRepo, slotRepo, userRepo, payments, events, clock, config.paymentTimeoutMin);
  const cabinet = new PersonalCabinetService(noteRepo, encryptor, clock);
  const notifications = new NotificationService(notificationRepo, emailSender, userRepo, clock, config.reminderBeforeHours, config.corsOrigin);
  const admin = new AdminService(userRepo, userRepo, new InMemoryComplaintRepository(), new InMemoryAuditLogRepository(), clock);

  // Підписки між модулями — лише через події
  notifications.register(events);
  events.subscribe('payment.succeeded', (e) => booking.confirmPaid(e.sessionId));

  return {
    config, clock, events, tokens, auth, catalog, schedule, booking, reviews, cabinet, payments, notifications, admin,
    repositories: { notes: noteRepo, payments: paymentRepo },
    async bootstrap() {
      if (config.adminEmail && config.adminPassword && !(await userRepo.findByEmail(config.adminEmail))) {
        await userRepo.save(new Admin({
          id: newId(),
          email: config.adminEmail,
          passwordHash: await hasher.hash(config.adminPassword),
          status: AccountStatus.ACTIVE,
          createdAt: clock.now(),
        }));
      }
    },
  };
}
