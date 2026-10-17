# React-интерфейс «Цифровой волонтёр Обнинска»

React + Tailwind CSS + Vite. Вход, мероприятия, отчёты, баланс и обменник подключены к Django API.

Запустите Django на 127.0.0.1:8000, затем из этой папки:

```bash
npm ci
npm run dev
```

Приложение: **http://127.0.0.1:5173/**. Vite проксирует API и Django Admin с сохранением origin для сессий и CSRF. Данные пользователей не хранятся в localStorage.

```bash
npm run lint
npm run build
npm run test:integration
```

Интеграционные тесты требуют работающих Django и Vite. Они используют JSDOM с настоящими HTTP-запросами. Браузерные сценарии отдельно: `npx playwright install chromium`, затем `npm run test:e2e`.

Подробный запуск и учебные аккаунты — в корневом README.md. Контракт — docs/API.md в корне репозитория.

## Оформление и помощь

Общий логотип — `public/logo.png`, компонент — `src/components/BrandLogo.jsx`. ЧаВо на главной — `src/components/FaqHelp.jsx`. Тема — `src/components/ThemeToggle.jsx`, настройка сохраняется под ключом `obninsk-theme`; первоначальная тема учитывает настройки устройства. Палитра и стили диалогов — `src/index.css`.

Отдельные проверки интерфейса без Django: `npm.cmd run test:ui` (12 тестов, API подменён). Проверены также lint и build. Инструкции установки обновления находятся в `FRONTEND-UPDATE.md` в корне проекта.
