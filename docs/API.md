# API для фронтенда

Базовый путь `/api/`. Все адреса заканчиваются `/`. Тела POST — JSON. Авторизация — Django session cookie. Для запросов, меняющих данные, обязателен CSRF. Используйте тот же origin, что и backend, либо dev-proxy для `/api/`; CORS для отдельного домена в этом MVP не настроен.

## Авторизация

1. `GET /api/auth/csrf/` устанавливает CSRF-cookie и возвращает `csrfToken`.
2. `POST /api/auth/login/` с `{ "username": "volunteer", "password": "Demo-Obninsk-2026!" }` и заголовком `X-CSRFToken`.
3. Сохранить новый `csrfToken` из ответа входа: Django меняет токен при логине.
4. Дальнейшие POST отправлять с cookie и новым `X-CSRFToken`.
5. `POST /api/auth/logout/` завершает сессию.

Пример клиента (в браузере на том же origin):

```javascript
let csrfToken;
async function api(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!response.ok) throw new Error(`${response.status}: ${data.error || text}`);
  return data;
}
async function signIn(username) {
  csrfToken = (await api('auth/csrf/')).csrfToken;
  const result = await api('auth/login/', {
    username, password: 'Demo-Obninsk-2026!',
  });
  csrfToken = result.csrfToken;
  return result;
}
```

## Контракт

| Метод и путь после `/api/` | Доступ | Тело / назначение |
|---|---|---|
| `GET events/` | Все | Доступные мероприятия |
| `GET rewards/` | Все | Активные поощрения и цены |
| `GET me/` | Вход | Имя, баланс, подтверждённые часы |
| `POST events/{id}/apply/` | Вход | `{}`; заявка текущего пользователя |
| `GET me/activities/` | Вход | Собственные заявки и решения |
| `POST activities/{id}/hours/` | Владелец заявки | `{ "hours": "3.0" }`; заявить часы без начисления |
| `GET me/transactions/` | Вход | Своя история начислений и списаний |
| `POST rewards/{id}/purchase/` | Вход | `{ "request_key": "UUID" }` |
| `GET me/redemptions/` | Вход | Свои запросы на поощрения |
| `GET coordinator/activities/?status=pending` | Координатор с правом проверки | Список заявок; фильтр статуса необязателен |
| `POST coordinator/activities/{id}/review/` | Координатор с правом проверки | `{ "decision": "approved", "hours": "3.0", "note": "Участие проверено" }` |
| `POST coordinator/activities/{id}/review/` | Координатор с правом проверки | `{ "decision": "rejected", "note": "Причина отказа" }` |
| `GET coordinator/redemptions/` | Координатор с правом выдачи | Все запросы на поощрения |
| `POST coordinator/redemptions/{id}/issue/` | Координатор с правом выдачи | `{}`; отметить условную выдачу |

Списки возвращаются как `{ "results": [...] }`. В этом небольшом MVP пагинации нет. Decimal-часы в ответе — строки. Койны и цена — целые числа. Дата/время — ISO 8601, в БД используется UTC, в админке — московское время.

Для подтверждения обязательно передавать фактические `hours`; заявленные часы могут отличаться. Для отклонения обязателен непустой комментарий. Дробные часы допустимы с шагом 0.1, до 24 часов на заявку. Изменение часов после решения запрещено.

Заявка повторно возвращается с тем же ID. При покупке генерируйте ключ через `crypto.randomUUID()` **один раз на намерение купить** и сохраняйте его для сетевых повторов. Новый ключ означает новую покупку. Повтор с тем же ключом возвращает прежний запрос без списания, даже если цена уже изменилась. Один ключ нельзя использовать для другого поощрения.

## Полный сценарий HTTP

После `seed_demo` на новом учебном пользователе, с функциями `api` и `signIn` из примера выше:

```javascript
await signIn('volunteer');
const event = (await api('events/')).results[0];
const activity = await api(`events/${event.id}/apply/`, {});
await api(`activities/${activity.id}/hours/`, { hours: '3.0' });
console.log(await api('me/')); // balance: 0

await signIn('coordinator');
await api(`coordinator/activities/${activity.id}/review/`, {
  decision: 'approved', hours: '3.0', note: 'Учебная проверка',
});

await signIn('volunteer');
console.log(await api('me/')); // balance: 30, confirmed_hours: "3.0"
const reward = (await api('rewards/')).results.find(item => item.price === 20);
const requestKey = crypto.randomUUID();
const redemption = await api(`rewards/${reward.id}/purchase/`, { request_key: requestKey });
console.log(await api('me/')); // balance: 10
console.log(await api('me/transactions/')); // +30 и -20 с основаниями

await signIn('coordinator');
console.log(await api('coordinator/redemptions/'));
await api(`coordinator/redemptions/${redemption.id}/issue/`, {});
try {
  await api(`coordinator/activities/${activity.id}/review/`, {
    decision: 'approved', hours: '3.0',
  });
} catch (error) {
  console.log(error.message); // 409: заявка уже рассмотрена
}
```

Повторять демонстрацию следует с новой учётной записью или другим событием: рассмотренная заявка намеренно не сбрасывается. Вместо API-подтверждения можно войти координатором в `/admin/` и воспользоваться «Проверить часы».

## Ошибки

- `400` — некорректный JSON, часы, UUID или отсутствующее поле.
- `401` — не выполнен вход / неверные учётные данные.
- `403` — нет прав или ошибка CSRF; Django может вернуть HTML для CSRF.
- `404` — объект отсутствует либо заявка принадлежит другому пользователю.
- `409` — заявка уже рассмотрена, недостаточно койнов, поощрение недоступно и другие конфликты состояния.
- `405` — неподдерживаемый HTTP-метод.

Бизнес-ошибки возвращаются как `{ "error": "Понятное описание" }`. При успешном создании заявки/покупки возвращается `201`; при безопасном повторе — `200`.
