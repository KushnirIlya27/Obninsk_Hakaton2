# API общего приложения

Базовый путь `/api/`, JSON, адреса заканчиваются `/`. React использует `src/lib/api.js`. В разработке все запросы идут на origin Vite `http://127.0.0.1:5173` и проксируются в Django. В браузере сохраняется сессионная cookie, а не пароль.

## Авторизация

1. `GET auth/csrf/` устанавливает CSRF-cookie и возвращает `csrfToken`.
2. Для POST нужен `X-CSRFToken` и cookie сессии.
3. После входа или регистрации токен меняется. Общий API-клиент читает актуальную CSRF-cookie.
4. Если Django отклонил запрос до вызова view с `code: csrf_failed`, клиент обновляет токен и повторяет запрос один раз. Остальные ошибки и сетевые сбои автоматически не повторяются.
5. Права возвращает `GET me/`; выбор роли в интерфейсе разрешений не назначает.

| Метод | Путь | Тело / ответ |
|---|---|---|
| GET | `auth/csrf/` | `{ csrfToken }` |
| POST | `auth/register/` | `username`, `password1`, `password2`, необязательные `email`, `phone`, `info` |
| POST | `auth/login/` | `username`, `password` |
| POST | `auth/logout/` | `{}` |
| GET | `me/` | `id`, `username`, `name`, `email`, `phone`, `info`, `balance`, `confirmed_hours`, `is_staff`, `can_review`, `can_issue`, `can_manage_events` |
| GET | `stats/` | `volunteers`, `confirmed_hours`, `events`; публичная агрегированная статистика |

Регистрация принимает также старое поле `password` вместо пары паролей. Все пароли проходят Django-валидацию. Логин проверяется на занятость, контакты — на формат. Переданный `role` / `is_staff` не даёт прав. Ошибки формы: `{ error, fields: { username: [{message, code}], ... } }`. Успех регистрации — 201, автоматический вход и `redirect_url: "/dashboard"`.

## Мероприятия и отчёты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `events/` | Активные события и участие текущего пользователя |
| POST | `events/{id}/apply/` | Записаться; тело `{}` |
| GET | `me/activities/` | Свои участия и отчёты |
| POST | `activities/{id}/report/` | `{ hours: "3.0", report_text: "Что делал" }` |
| POST | `activities/{id}/hours/` | Старый совместимый метод; описание необязательно |
| GET | `coordinator/activities/?status=pending` | Отчёты координатору; фильтр необязателен |
| POST | `coordinator/activities/{id}/review/` | Решение координатора |
| GET | `coordinator/events/` | Все события для организатора с правом `view_event` |
| POST | `coordinator/events/` | Создать событие; нужно `add_event` |

Событие: `id`, `title`, `description`, `location`, `starts_at`, `ends_at`, `coins_per_hour`, `rate`, `is_active`, `report_available_at`. `rate` — совместимый псевдоним `coins_per_hour`. В публичном каталоге добавляются `my_status` и `activity_id`.

Создание:

```json
{
  "title": "Помощь городскому парку",
  "location": "Обнинск",
  "description": "Учебная акция",
  "starts_at": "2026-10-17T09:00:00+03:00",
  "ends_at": "2026-10-17T12:00:00+03:00",
  "coins_per_hour": 20,
  "is_active": true
}
```

Ставка — целое 1–100000. Дата окончания позже начала. Изменение существующего события доступно в Django Admin.

Участие: `id`, `event_id`, `event_title`, даты события, `volunteer_id`, `volunteer_username`, `rate_snapshot`, `requested_hours`, `report_text`, `report_submitted_at`, `status`, `can_submit_report`, `confirmed_hours`, `coefficient`, `multiplier`, `coins_awarded`, `review_note`, `reviewed_by_id`, `reviewed_at`, `created_at`.

`coefficient` и `multiplier` — два имени одного значения. Часы и коэффициент передаются строками Decimal, койны — целыми. Время — ISO 8601. Нельзя редактировать чужое участие.

Переходы: `registered` после записи → `pending` после отчёта → `approved` / `rejected` после решения. До отчёта начислять нельзя. Отчёт принимается только после `report_available_at` (окончание либо начало, если окончание не заполнено). Описание в новом методе обязательно, до 3000 символов; часы 0.1–24 с шагом 0.1. До проверки отчёт можно уточнять.

Подтверждение:

```json
{
  "decision": "approved",
  "hours": "3.0",
  "coefficient": "1.50",
  "note": "Работа под дождём"
}
```

Можно отправить `multiplier` вместо `coefficient`. По умолчанию 1.00. Диапазон **1.00–10.00**, шаг **0.05**. При отличии от 1 обязателен комментарий. Формула: подтверждённые часы × rate_snapshot × коэффициент, ROUND_HALF_UP до целого. Ставка берётся из записи, а не из текущего события или присланного тела.

Отказ:

```json
{ "decision": "rejected", "note": "Участие не подтверждено" }
```

После решения повторная проверка возвращает 409. Своё участие координатор подтвердить не может. Координатору нужны `is_staff` и разрешение `catalog.review_activity`.

## Поощрения и история

| Метод | Путь | Назначение |
|---|---|---|
| GET | `rewards/` | Активные учебные награды: `id`, `title`, `description`, `price` |
| POST | `rewards/{id}/purchase/` | `{ request_key: "UUID" }`; списать и создать запрос |
| GET | `me/redemptions/` | Свои запросы и статусы выдачи |
| GET | `me/transactions/` | Своя история начислений и списаний |
| GET | `coordinator/redemptions/` | Запросы координатору |
| POST | `coordinator/redemptions/{id}/issue/` | `{}`; отметить условную выдачу |

Запрос на поощрение содержит `id`, `reward_id`, `reward_title`, `volunteer_id`, `price`, `request_key`, `status`, `created_at`, `issued_by_id`, `issued_at`; координатору добавляется имя волонтёра. Статусы: `pending`, `issued`.

UUID генерируется один раз на намерение купить. При потере ответа повторяется тот же ключ. React сохраняет только незавершённые UUID в sessionStorage, без паролей и сессионных токенов. После подтверждения ответа или сверки со списком запросов ключ убирается. Повтор ключа возвращает тот же запрос без списания. Новый ключ означает новую покупку.

Цена и баланс берутся из БД. Покупка и начисление атомарны. Выдача не списывает койны ещё раз. Для выдачи требуется `catalog.fulfill_redemption`.

## Коды ответа

- 200 — успех или безопасный повтор записи/покупки.
- 201 — пользователь, участие, событие или запрос создан.
- 400 — ошибки JSON, полей, времени, часов или коэффициента.
- 401 — требуется вход / неверный пароль.
- 403 — недостаточно прав либо CSRF; для CSRF добавляется `code: csrf_failed`.
- 404 — объект отсутствует либо чужой.
- 409 — конфликт состояния, недостаточно койнов, уже рассмотрено / выдано.
- 405 — неподдерживаемый метод.

Списки возвращаются как `{ results: [...] }`. В учебном MVP пагинации нет.
