import { test, expect } from "@playwright/test";

const demoPassword = "Demo-Obninsk-2026!";
async function signIn(page, username, password, coordinator = false) {
  await page.goto(coordinator ? "/login?role=coordinator" : "/login");
  await page.getByPlaceholder("Ваш логин").fill(username);
  await page.getByPlaceholder("Ваш пароль").fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(
    coordinator ? /\/coordinator-dashboard$/ : /\/dashboard$/,
  );
}
async function apiPost(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const { csrfToken } = await fetch("/api/auth/csrf/").then((response) =>
        response.json(),
      );
      const response = await fetch(`/api/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    },
    { path, body },
  );
}
async function balance(page) {
  return (await (await page.request.get("/api/me/")).json()).balance;
}

// Run against a local migrated DB with seed_demo. Each run creates its own training account.
test("регистрация → отчёт → 30 → покупка → 10; коэффициент 1.5 → +90", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const username = `integration_${Date.now()}`;
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/volunteer");
  await page.getByPlaceholder("volunteer_obninsk").fill(username);
  await page.getByPlaceholder("900 000-00-00").fill("9001234567");
  await page
    .getByPlaceholder("Экология, помощь животным, образование...")
    .fill("Учебный сценарий интеграции");
  await page
    .getByPlaceholder("Не менее 8 символов")
    .fill("Strong-Obninsk-2026!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Создать профиль" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Мероприятия Обнинска" }),
  ).toBeVisible();
  expect(await balance(page)).toBe(0);
  const card = page
    .locator('article[data-testid^="event-"]')
    .filter({ hasText: "10 койнов/час" })
    .first();
  await card.getByRole("button", { name: "Подать заявку" }).click();
  await card.getByRole("button", { name: "Подать отчёт", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Сколько часов вы работали").fill("3");
  await dialog
    .getByLabel("Что вы делали")
    .fill("Помогал убирать парк, собирал мусор.");
  await dialog.getByRole("button", { name: "Отправить отчёт" }).click();
  await expect(dialog).not.toBeVisible();
  expect(await balance(page)).toBe(0);
  const activities = await (
    await page.request.get("/api/me/activities/")
  ).json();
  const activityId = activities.results[0].id;
  const coordinatorContext = await browser.newContext({ baseURL });
  const coordinator = await coordinatorContext.newPage();
  coordinator.on("pageerror", (error) => runtimeErrors.push(error.message));
  try {
    await signIn(coordinator, "coordinator", demoPassword, true);
    const report = coordinator
      .locator("article")
      .filter({ hasText: username })
      .first();
    await expect(report).toBeVisible();
    await report.getByRole("button", { name: "Сохранить решение" }).click();
    await expect(
      coordinator.getByRole("status").filter({ hasText: "решение сохранено" }),
    ).toBeVisible();
    await expect.poll(() => balance(page)).toBe(30);
    const duplicate = await apiPost(
      coordinator,
      `coordinator/activities/${activityId}/review/`,
      { decision: "approved", hours: "3" },
    );
    expect(duplicate.status).toBe(409);
    await page.bringToFront();
    await page
      .getByRole("link", { name: "Поощрения", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Обновить" }).click();
    const reward = page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: "Учебный значок", exact: true }),
      });
    await reward.getByRole("button", { name: "Обменять", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Подтвердить обмен", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "оформлен" }),
    ).toBeVisible();
    await expect.poll(() => balance(page)).toBe(10);
    await page
      .getByRole("link", { name: "Мой профиль", exact: true })
      .first()
      .click();
    await expect(page.getByText("+30", { exact: true })).toBeVisible();
    await expect(page.getByText("-20", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Мои часы и койны" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("registeredUsers")),
    ).toBeNull();

    await coordinator.bringToFront();
    await coordinator
      .getByRole("button", { name: "Выдача поощрений", exact: true })
      .click();
    await coordinator
      .getByRole("button", { name: "Обновить", exact: true })
      .click();
    await coordinator
      .locator("article")
      .filter({ hasText: username })
      .getByRole("button", { name: "Отметить выдачу" })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/me/redemptions/")).json())
            .results[0].status,
      )
      .toBe("issued");

    await coordinator
      .getByRole("button", { name: "Мероприятия", exact: true })
      .click();
    const title = `Дождь: ${username}`;
    const date = (hoursAgo) =>
      new Date(Date.now() - hoursAgo * 3600000).toISOString().slice(0, 16);
    await coordinator.getByLabel("Название", { exact: true }).fill(title);
    await coordinator
      .getByLabel("Место", { exact: true })
      .fill("Учебная площадка");
    await coordinator.getByLabel("Начало", { exact: true }).fill(date(6));
    await coordinator.getByLabel("Окончание", { exact: true }).fill(date(3));
    await coordinator
      .getByLabel("Ставка, койнов в час", { exact: true })
      .fill("20");
    await coordinator
      .getByRole("button", { name: "Создать мероприятие", exact: true })
      .click();
    await expect(
      coordinator
        .getByRole("status")
        .filter({ hasText: "Мероприятие создано" }),
    ).toBeVisible();
    await page.bringToFront();
    await page
      .getByRole("link", { name: "Главная", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Обновить", exact: true }).click();
    const rainCard = page.locator("article").filter({ hasText: title });
    await rainCard.getByRole("button", { name: "Подать заявку" }).click();
    await rainCard
      .getByRole("button", { name: "Подать отчёт", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Что вы делали")
      .fill("Помогал под дождём");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Отправить отчёт" })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await coordinator.bringToFront();
    await coordinator
      .getByRole("button", { name: "Отчёты", exact: true })
      .click();
    await coordinator
      .getByRole("button", { name: "Обновить", exact: true })
      .click();
    const rainReport = coordinator
      .locator("article")
      .filter({ hasText: title });
    const coefficient = rainReport.getByLabel("Коэффициент", { exact: true });
    await coefficient.fill("1.03");
    expect(
      await coefficient.evaluate((input) => input.validity.stepMismatch),
    ).toBe(true);
    await coefficient.fill("1.50");
    await rainReport
      .getByLabel("Комментарий / причина")
      .fill("Работа под дождём");
    await rainReport.getByRole("button", { name: "Сохранить решение" }).click();
    await expect.poll(() => balance(page)).toBe(100);
    const forbidden = await apiPost(
      page,
      `coordinator/activities/${activityId}/review/`,
      { decision: "approved", hours: "3" },
    );
    expect(forbidden.status).toBe(403);
    expect(await balance(page)).toBe(100);
    await page.bringToFront();
    await page
      .getByRole("link", { name: "Мой профиль", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Обновить", exact: true }).click();
    await expect(page.getByText("+90", { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("volunteer-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath("volunteer-mobile.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await coordinatorContext.close();
  }
});

test("закрытые маршруты и запрет входа волонтёра как координатора", async ({
  page,
}) => {
  await page.goto("/coordinator-dashboard");
  await expect(page).toHaveURL(/\/login\?role=coordinator$/);
  await page.getByPlaceholder("Ваш логин").fill("volunteer");
  await page.getByPlaceholder("Ваш пароль").fill(demoPassword);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByText("У этого аккаунта нет прав координатора."),
  ).toBeVisible();
  expect((await page.request.get("/api/me/")).status()).toBe(401);
  await page.goto("/coordinator");
  await expect(
    page.getByRole("link", { name: "Войти координатором" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
