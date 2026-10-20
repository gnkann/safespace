# Робота з Git

## Гілки
- `main` — стабільна версія; прямі коміти заборонені, злиття лише через Pull Request;
- `develop` — інтеграційна гілка;
- `feature/<модуль>-<опис>` — одна гілка на одне завдання (власна для кожного учасника).

Рекомендовані стартові гілки (за ролями команди):

| Учасник | Гілка | Зміст |
|---------|-------|-------|
| Ягнюк А. (Backend) | `feature/backend-auth-booking-payment` | модулі auth, booking, payment, composition root |
| Мамедова Е. (Frontend) | `feature/frontend-spa-skeleton` | каркас SPA, сторінки, API-клієнт |
| Краснікова А. (Аналітик/дизайн) | `feature/domain-catalog-admin-docs` | catalog, admin, документація, трасування вимог |
| Байрамова С. (QA/DevOps) | `feature/qa-ci-notification` | тести, CI, notification |

## Процес
1. `git checkout develop && git pull`
2. `git checkout -b feature/<...>`
3. Невеликі коміти за схемою Conventional Commits: `feat(booking): add Session state machine`, `test(auth): ...`, `docs: ...`, `ci: ...`, `chore: ...`
4. `git push -u origin feature/<...>` → Pull Request у `develop` (шаблон підставляється автоматично).
5. Код-рев'ю: щонайменше одне схвалення від іншого учасника; CI має бути зеленим.
6. Squash/merge у `develop`; періодично `develop` → `main` через PR.

## Налаштування захисту `main` (GitHub → Settings → Branches)
- Require a pull request before merging (1 approval);
- Require status checks to pass (jobs `backend`, `frontend`);
- Do not allow bypassing the above settings.
