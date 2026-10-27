
# SafeSpace

Онлайн-платформа психологічної підтримки для молоді: зручний, анонімний та доступний шлях до кваліфікованої допомоги.
Навчальний проєкт з дисципліни «Життєвий цикл розробки програмного забезпечення» (КПІ ім. Ігоря Сікорського, ІП-43).

Поточний стан — **базова структура коду (лабораторна робота №4)**: класи, модулі та функції з мінімальним
функціоналом відповідно до архітектури з лабораторної №2 (модульний моноліт). Усі модулі працюють
на in-memory сховищах і заглушках зовнішніх сервісів; повна інтеграція — наступні етапи.

## Структура репозиторію

```
safespace/
├── backend/                 Node.js + Express + TypeScript (модульний моноліт)
│   ├── src/
│   │   ├── config/          читання та валідація конфігурації
│   │   ├── shared/          спільне ядро: помилки, події, безпека, час, HTTP-middleware
│   │   ├── modules/
│   │   │   ├── auth/        реєстрація, вхід, JWT, User/Client/Psychologist/Admin  (FR-01)
│   │   │   ├── catalog/     каталог, пошук, профіль психолога                      (FR-02, 03)
│   │   │   ├── booking/     слоти, сесії, відгуки, особистий кабінет               (FR-04, 07–09)
│   │   │   ├── payment/     платежі, шлюз (Fake/Stripe), вебхук                    (FR-06)
│   │   │   ├── notification/ email-сповіщення та нагадування                       (FR-05)
│   │   │   └── admin/       верифікація, скарги, користувачі, аудит                (FR-10–12, NFR-08)
│   │   ├── container.ts     composition root (збирання залежностей)
│   │   ├── app.ts           Express-застосунок
│   │   └── server.ts        точка входу
│   └── tests/               unit- та e2e-тести (Jest, Supertest)
├── frontend/                React + TypeScript + Tailwind (Vite)
│   └── src/ {api, auth, components, pages}
├── docs/                    architecture.md, api.md, git-workflow.md
├── .github/                 CI (GitHub Actions), шаблон PR, CODEOWNERS
└── README.md
```

Детальніше: [docs/architecture.md](docs/architecture.md) · [docs/api.md](docs/api.md) · [docs/git-workflow.md](docs/git-workflow.md).

## Технологічний стек
React (TypeScript), Tailwind CSS · Node.js, Express.js · PostgreSQL (на наступному етапі) · JWT · Stripe API · SendGrid/Nodemailer · Jest · GitHub Actions.

## Запуск

Потрібно: Node.js ≥ 20.

### Backend
```bash
cd backend
cp .env.example .env      # за потреби змініть значення
npm install
npm run dev               # http://localhost:4000, перевірка: GET /api/health
npm test                  # 55 тестів
npm run test:coverage     # звіт про покриття
npm run build && npm start
```
Початковий адміністратор створюється автоматично, якщо в `.env` задані `ADMIN_EMAIL` та `ADMIN_PASSWORD`.
У dev-режимі листи виводяться в консоль, а платежі імітуються (`PAYMENT_PROVIDER=fake`).

### Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (запити /api проксуються на :4000)
npm run build
```

## Інтеграція компонентів (лаб № 5)
### Docker Compose (рекомендовано)
```bash
docker compose up --build
# Frontend:  <http://localhost:8080>   (nginx; запити /api проксуються на backend)
# Backend:   <http://localhost:4000/api/health>
node scripts/smoke.mjs <http://localhost:8080>   # інтеграційна перевірка через frontend
```
Секрети беруться зі змінних середовища (`JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`); значення за замовчуванням у compose — лише для локальної демонстрації.

### Локально через npm
```bash
npm run install:all
npm run build && npm test && npm run lint && npm run typecheck
# термінал 1: cd backend && npm run dev      термінал 2: cd frontend && npm run dev
npm run smoke -- <http://localhost:5173>            # через Vite-проксі
```
​
## Управління залежностями
- Кожен компонент має власні `package.json` + `package-lock.json`; CI та Docker використовують npm ci (відтворювані збірки за lock-файлом).
- Версії синхронізовано: Node.js ≥ 20 (`engines`, CI, Docker-образи `node:20-alpine`), TypeScript ^5.4.5 в обох пакетах.
- Dependabot (`.github/dependabot.ym`l) щотижня створює PR на оновлення npm-залежностей backend/frontend та GitHub Actions.
- `npm run audit:all` — перевірка вразливостей; `npm run outdated:all` — застарілі пакети. Для backend виконано `npm audit fix` (0 вразливостей у prod-залежностях, виправлено `body-parser`).
- Відомі залишки: `react-router-dom` 6.x має moderate-попередження (open redirect у `<Link>`, SSR-гідратація). Проєкт — чистий SPA без SSR і без переходів за користувацькими URL; оновлення до v7 — breaking change, винесено в дорожню карту.

## Перевірка функціональних вимог

| Вимога | Як перевірено | Де |
|---|---|---|
| FR-01 Реєстрація/вхід | наскрізний тест + smoke (реєстрація, login → JWT) | `tests/api.e2e.test.ts`, `scripts/smoke.mjs` |
| FR-02, FR-03 Каталог, пошук, профіль | e2e + unit | `CatalogService.test.ts` |
| FR-04, FR-07 Слоти й бронювання | e2e + unit | `Schedule.test.ts`, `BookingFlow.test.ts` |
| FR-05 Email-сповіщення | події `session.confirmed`, `user.registered` → Notification | `BookingFlow.test.ts` |
| FR-06 Оплата | `PaymentService` ↔ `BookingService` через подію `payment.succeeded` + вебхук | e2e |
| FR-08, FR-09 Скасування, кабінет, нотатки | e2e | `Session.test.ts` |
| FR-10–12 Модерація, скарги, блокування | unit | `Admin.test.ts` |

Точки інтеграції між модулями: порти (AvailabilityProvider, ReviewReader, PaymentInitiator) та EventBus; збирання залежностей — у container.ts. Frontend ↔ backend — REST (/api, JWT у Authorization), опис — [docs/api.md](docs/api.md). 

## Перевірка нефункціональних вимог

| Вимога | Спосіб підтвердження |
|---|---|
| NFR-03 Безпека | JWT + RBAC (401/403 у smoke та e2e), bcrypt, AES-256-GCM для нотаток, Helmet, у production заборонені тестові ключі (`config/env.ts`) |
| NFR-04 Надійність | єдиний формат помилок, `HEALTHCHECK` у Docker, `restart: unless-stopped` |
| NFR-06 Зручність/доступність | frontend-маршрути, ProtectedRoute, адаптивний UI (Tailwind) |
| NFR-08 Аудит | `GET /admin/audit`, запис дій адміністратора |
| Якість/супровідність | CI: typecheck, lint, 55 тестів + coverage, build обох частин; SOLID-архітектура |
| Портативність | один і той самий результат локально та в Docker |

## Принципи
Код організовано за принципами SOLID: сервіси залежать від інтерфейсів (портів), а не від конкретних БД чи провайдерів;
модулі взаємодіють через порти й доменні події. Докладне зіставлення — у [docs/architecture.md](docs/architecture.md).

## Команда та ролі

| Учасник | Роль | Відповідальність у цій роботі |
|---|---|---|
| Ягнюк Анна | Backend-розробник | модулі `auth`, `booking`, `payment`, `container.ts`, `app.ts`, API |
| Мамедова Ельміра | Frontend-розробник | `frontend/`: маршрути, API-клієнт, сторінки, доступність (NFR-06) |
| Краснікова Анастасія | UI/UX-дизайнер та бізнес-аналітик | модулі `catalog`, `admin`, доменна модель, `docs/`, трасування вимог |
| Байрамова Сабіна | QA / DevOps-інженер | `tests/`, CI/CD (`.github/workflows`), модуль `notification`, `.gitignore`, налаштування захисту гілок |

> Гілки, процес код-рев'ю та правила комітів — у [docs/git-workflow.md](docs/git-workflow.md).

## Дорожня карта
1. PostgreSQL-репозиторії та міграції; 2. реальні адаптери Stripe та SendGrid; 3. завантаження дипломів у S3;
4. повні UI-форми психолога й адміністратора; 5. поза MVP — відеоконсультації, чат, рейтинги, SMS.
