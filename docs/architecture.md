# Архітектура коду SafeSpace

Реалізує рішення з лабораторної роботи №2: **модульний моноліт** (Node.js + Express + TypeScript) і SPA на React.

## Шари всередині кожного модуля

```
modules/<module>/
  domain/          сутності та правила предметної області (без залежностей від Express/БД)
  ports/           інтерфейси (абстракції) для зовнішнього світу: сховища, шлюзи, відправники
  infrastructure/  конкретні реалізації портів (in-memory, Fake/Stripe/SendGrid)
  <Module>Service  прикладна логіка (use cases), залежить лише від domain і ports
  http/            тонкий HTTP-шар: маршрути Express
```

Правило залежностей: `http → service → domain`, `service → ports ← infrastructure`.
Домен нічого не знає про HTTP чи базу даних.

## Відповідність компонентній діаграмі (лаб. 2, рис. 1)

| Модуль (Service)      | Каталог                          | Вимоги                      |
|-----------------------|----------------------------------|-----------------------------|
| Auth Service          | `modules/auth`                   | FR-01, NFR-03, NFR-04       |
| Catalog Service       | `modules/catalog`                | FR-02, FR-03                |
| Booking Service       | `modules/booking`                | FR-04, FR-07, FR-08, FR-09  |
| Payment Service       | `modules/payment`                | FR-06, NFR-03               |
| Notification Service  | `modules/notification`           | FR-05                       |
| Admin Service         | `modules/admin`                  | FR-10, FR-11, FR-12, NFR-08 |
| SPA (React)           | `frontend/src`                   | FR-01–FR-12 (UI), NFR-06    |

## Відповідність діаграмі класів (лаб. 2, рис. 2)

| Клас діаграми    | Файл                                               |
|------------------|----------------------------------------------------|
| User (abstract)  | `modules/auth/domain/User.ts`                      |
| Client           | `modules/auth/domain/Client.ts`                    |
| Psychologist     | `modules/auth/domain/Psychologist.ts`              |
| Admin            | `modules/auth/domain/Admin.ts`                     |
| Session          | `modules/booking/domain/Session.ts`                |
| Payment          | `modules/payment/domain/Payment.ts`                |
| Review           | `modules/booking/domain/Review.ts`                 |
| PersonalNote     | `modules/booking/domain/PersonalNote.ts`           |
| Notification     | `modules/notification/domain/Notification.ts`      |

Діаграма станів (рис. 4) реалізована таблицею переходів `TRANSITIONS` у `Session.ts`;
діаграма послідовностей (рис. 3) — методом `BookingService.bookSession` + `PaymentService.handleWebhook`.

## Взаємодія модулів

Модулі **не імпортують сервіси одне одного**. Зв'язок — двома способами:

1. **Порти** — наприклад, `CatalogService` залежить від `AvailabilityProvider` і `ReviewReader`,
   які реалізують `ScheduleService` і `ReviewService`; `BookingService` залежить від `PaymentInitiator`,
   який реалізує `PaymentService`.
2. **Події** (`shared/events/EventBus.ts`): `payment.succeeded` → `BookingService.confirmPaid`;
   `session.confirmed` / `session.cancelled` / `user.registered` → `NotificationService`.

Це дозволяє пізніше винести будь-який модуль у мікросервіс, замінивши порт на HTTP-клієнт, а шину — на брокер.

## Принципи SOLID — де саме застосовано

| Принцип | Приклад у коді |
|---------|----------------|
| **S** | `AuthService` лише реєструє й автентифікує; платежі — `PaymentService`; листи — `NotificationService`; шифрування нотаток — окремий `Encryptor`. |
| **O** | Новий тип сповіщення = нова підписка в `NotificationService.register`; новий платіжний провайдер = новий клас, що реалізує `PaymentGateway`. |
| **L** | `Client`, `Psychologist`, `Admin` взаємозамінні як `User` (`AuthService.login` працює з будь-яким). |
| **I** | Вузькі порти: `UserRepository` (автентифікація) і `PsychologistRepository` (каталог) — окремі інтерфейси, хоча реалізує їх один клас; `EmailSender` має єдиний метод. |
| **D** | Сервіси отримують залежності через конструктор як інтерфейси; конкретні класи підставляються лише в `container.ts` (composition root). |

## Що залишено на наступні етапи
- PostgreSQL-реалізації репозиторіїв (зараз in-memory) та міграції;
- реальні адаптери Stripe і SendGrid (зараз `Fake`/`Console`, каркаси `Stripe*`/`SendGrid*`);
- завантаження файлів дипломів у S3 (зараз зберігаються ключі);
- UI-форми психолога (створення слотів) і адмін-модерація скарг; відеозв'язок і чат (поза MVP).
