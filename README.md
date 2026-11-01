# SafeSpace

Онлайн-платформа психологічної підтримки для молоді: зручний, анонімний та доступний шлях до кваліфікованої допомоги.
Навчальний проєкт з дисципліни «Життєвий цикл розробки програмного забезпечення» (КПІ ім. Ігоря Сікорського, ІП-43).

Поточний стан — **тестування та валідація (лабораторна робота №6)** поверх базової структури коду (лабораторна №4): класи, модулі та функції з мінімальним
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
│   └── tests/               unit/ component/ system/ nfr/ + сервісні тести (Jest, Supertest)
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
npm test                  # 129 тестів (unit, component, system, NFR)
npm run test:unit         # також test:component, test:system, test:nfr
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
