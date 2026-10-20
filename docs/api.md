# REST API (скелет)

Базовий префікс `/api`. Автентифікація: `Authorization: Bearer <JWT>`. Формат помилки: `{"error":{"code","message","details?"}}`.

| Метод і шлях | Роль | Вимога |
|---|---|---|
| `GET /health` | — | — |
| `POST /auth/register/client` | — | FR-01.1 |
| `POST /auth/register/psychologist` | — | FR-01.2 |
| `POST /auth/confirm-email` `{token}` | — | FR-01.1 |
| `POST /auth/login` | — | FR-01 |
| `GET /psychologists?specialization&minPrice&maxPrice&from&to` | — | FR-02 |
| `GET /psychologists/:id` | — | FR-03 |
| `GET /psychologists/:id/slots` | — | FR-04 |
| `GET /slots/my`, `POST /slots`, `DELETE /slots/:id` | Психолог | FR-07 |
| `POST /sessions` `{slotId}` | Клієнт | FR-04, FR-06 |
| `GET /sessions/my` | Клієнт / Психолог | FR-09 |
| `POST /sessions/:id/cancel` `{reason}` | Клієнт / Психолог | FR-08 |
| `POST /sessions/:id/complete` | Психолог | FR-08 |
| `POST /sessions/:id/review` `{rating,text}` | Клієнт | FR-03 |
| `GET/POST /notes`, `DELETE /notes/:id` | Клієнт | FR-09 |
| `POST /payments/webhook` | Платіжний провайдер | FR-06 |
| `POST /complaints` `{targetUserId,text}` | Авторизований | FR-11 |
| `GET /admin/psychologists/pending`, `POST /admin/psychologists/:id/verify\|reject` | Адмін | FR-10 |
| `GET /admin/users`, `POST /admin/users/:id/block\|unblock` | Адмін | FR-12 |
| `GET /admin/complaints`, `POST /admin/complaints/:id/resolve` | Адмін | FR-11 |
| `GET /admin/audit` | Адмін | NFR-08 |
