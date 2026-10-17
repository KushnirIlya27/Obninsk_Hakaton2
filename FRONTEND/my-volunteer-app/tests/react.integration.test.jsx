import { test, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { api } from "../src/lib/api";

function mount(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function signIn(user, username, coordinator = false) {
  if (coordinator)
    await user.click(
      screen.getByRole("button", { name: "Координатор", exact: true }),
    );
  if (!coordinator) await user.click(screen.getByRole('button', { name: 'Волонтер', exact: true }));
  await user.type(screen.getByPlaceholderText("Ваш логин"), username);
  await user.type(
    screen.getByPlaceholderText("Ваш пароль"),
    "Demo-Obninsk-2026!",
  );
  await user.click(screen.getByRole("button", { name: "Войти", exact: true }));
}

test("React routes/forms use actual sessions, reports, balances and reward purchases", async () => {
  const user = userEvent.setup();
  const username = `dom_${Date.now()}`;
  mount("/volunteer");
  await user.type(screen.getByPlaceholderText("volunteer_obninsk"), username);
  await user.type(screen.getByPlaceholderText("900 000-00-00"), "9001234567");
  await user.type(
    screen.getByPlaceholderText("Не менее 8 символов"),
    "Demo-Obninsk-2026!",
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Создать профиль" }));
  await screen.findByRole("heading", { name: "Мероприятия Обнинска" });
  expect((await api("me/")).balance).toBe(0);
  const eventTitle = await screen.findByRole("heading", {
    name: "Уборка городского парка",
  });
  const card = within(eventTitle.closest("article"));
  await user.click(card.getByRole("button", { name: "Подать заявку" }));
  await user.click(
    await card.findByRole("button", { name: "Подать отчёт", exact: true }),
  );
  const modal = within(screen.getByRole("dialog"));
  await user.clear(modal.getByLabelText("Сколько часов вы работали"));
  await user.type(modal.getByLabelText("Сколько часов вы работали"), "3");
  await user.type(
    modal.getByLabelText("Что вы делали"),
    "Помогал убирать учебный парк",
  );
  await user.click(modal.getByRole("button", { name: "Отправить отчёт" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await api("me/")).balance).toBe(0);
  const activity = (await api("me/activities/")).results[0];
  await user.click(
    screen.getByRole("button", { name: "сменить", exact: true }),
  );
  await screen.findByRole("heading", { name: "Войти в аккаунт" });
  await signIn(user, "coordinator", true);
  await screen.findByRole("heading", { name: "Панель координатора" });
  const reportCard = within(await screen.findByTestId(`review-${activity.id}`));
  await user.click(
    reportCard.getByRole("button", { name: "Сохранить решение" }),
  );
  await screen.findByText(`Отчёт №${activity.id}: решение сохранено.`);
  await expect(
    api(`coordinator/activities/${activity.id}/review/`, {
      decision: "approved",
      hours: "3",
    }),
  ).rejects.toMatchObject({ status: 409 });
  await user.click(screen.getByRole("button", { name: "Выйти", exact: true }));
  await screen.findByRole("heading", { name: "Войти в аккаунт" });
  await signIn(user, username);
  await screen.findByRole("heading", { name: "Мероприятия Обнинска" });
  expect((await api("me/")).balance).toBe(30);
  await user.click(
    screen.getAllByRole("link", { name: "Поощрения", exact: true })[0],
  );
  const reward = within(
    (
      await screen.findByRole("heading", {
        name: "Учебный значок",
        exact: true,
      })
    ).closest("article"),
  );
  await user.click(
    await reward.findByRole("button", { name: "Обменять", exact: true }),
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Подтвердить обмен",
      exact: true,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await api("me/")).balance).toBe(10);
  expect(localStorage.getItem("registeredUsers")).toBeNull();
  await user.click(
    screen.getAllByRole("link", { name: "Мой профиль", exact: true })[0],
  );
  await screen.findByText("+30", { exact: true });
  await screen.findByText("-20", { exact: true });
  await user.click(screen.getAllByRole("link", { name: "Поощрения", exact: true })[0]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await user.click(await screen.findByRole("button", { name: "Отменить и вернуть койны" }));
  await screen.findByText("Запрос отменён. Койны возвращены.");
  await waitFor(async () => expect((await api("me/")).balance).toBe(30));
  expect((await api("me/redemptions/")).results[0].status).toBe("cancelled");
  vi.restoreAllMocks();
});

test("React refuses coordinator access for an ordinary volunteer", async () => {
  const user = userEvent.setup();
  mount("/coordinator-dashboard");
  await screen.findByRole("heading", { name: "Войти в аккаунт" });
  await user.type(screen.getByPlaceholderText("Ваш логин"), "volunteer");
  await user.type(
    screen.getByPlaceholderText("Ваш пароль"),
    "Demo-Obninsk-2026!",
  );
  await user.click(screen.getByRole("button", { name: "Войти", exact: true }));
  await screen.findByText("У этого аккаунта нет прав координатора.");
  await expect(api("me/")).rejects.toMatchObject({ status: 401 });
});


test("Coordinator saves template and creates a dated event from it", async () => {
  const user = userEvent.setup();
  mount("/login");
  await screen.findByRole("heading", { name: "Войти в аккаунт" });
  await signIn(user, "coordinator", true);
  await screen.findByRole("heading", { name: "Панель координатора" });
  await user.click(screen.getByRole("button", { name: "Шаблоны", exact: true }));
  const title = `Шаблон ${Date.now()}`;
  await user.type(screen.getByLabelText("Название"), title);
  await user.type(screen.getByLabelText("Место"), "Парк");
  await user.type(screen.getByLabelText("Описание"), "Уборка парка");
  await user.click(screen.getByRole("button", { name: "Сохранить шаблон", exact: true }));
  const card = within((await screen.findByRole("heading", { name: title })).closest("article"));
  await user.click(card.getByRole("button", { name: "Создать по шаблону" }));
  expect(screen.getByLabelText("Название").value).toBe(title);
  expect(screen.getByLabelText("Место").value).toBe("Парк");
  // Native datetime input typing differs in jsdom; supply dates through DOM change events.
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("Начало"), {target: {value: "2026-10-21T10:00"}});
  fireEvent.change(screen.getByLabelText("Окончание"), {target: {value: "2026-10-21T12:00"}});
  await user.click(screen.getByRole("button", { name: "Создать мероприятие", exact: true }));
  await screen.findByText("Мероприятие создано и доступно волонтёрам.");
  expect((await api("coordinator/events/")).results.some(event => event.title === title)).toBe(true);
});
