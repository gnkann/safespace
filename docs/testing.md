# Тестування

Тести бекенду написано на Jest та Supertest і розміщено в backend/tests.

## Запуск

```bash
cd backend
npm install
npm test
npm run test:coverage
```

## Склад тестів

- Session — діаграма станів сесії;
- AuthService — реєстрація й вхід (FR-01);
- CatalogService — пошук і фільтри (FR-02, FR-03);
- BookingFlow — бронювання, оплата, скасування, відгуки;
- Schedule — розклад психолога (FR-07);
- Admin — верифікація, скарги, аудит;
- Security — шифрування й JWT;
- api.e2e — наскрізний сценарій через HTTP.

## Автоматична перевірка

GitHub Actions (`.github/workflows/ci.yml`) на кожен push і Pull Request виконує typecheck, lint, тести та збирання.
