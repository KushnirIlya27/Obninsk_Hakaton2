import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import ThemeToggle from "../src/components/ThemeToggle";

vi.mock("../src/lib/api", () => ({
  api: vi.fn(async (path) => {
    if (path === "me/") return {
      id: 1, username: "coordinator", balance: 30, confirmed_hours: "3.0",
      can_review: true, can_issue: true, can_manage_events: true,
    };
    if (path === "stats/") return { volunteers: 3, events: 3, confirmed_hours: "9" };
    return { results: [] };
  }),
  fieldMessages: () => ({}),
  requestKey: () => "00000000-0000-4000-8000-000000000000",
}));

let systemChange;
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: (_event, callback) => { systemChange = callback; },
    removeEventListener: vi.fn(),
  })));
  document.documentElement.classList.remove("dark");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

for (const path of ["/", "/login", "/volunteer", "/coordinator", "/dashboard", "/dashboard/rewards", "/dashboard/profile", "/coordinator-dashboard"]) {
  test(`Real logo and theme control are available at ${path}`, async () => {
    mount(path);
    const logos = await screen.findAllByAltText("Цифровой волонтёр Обнинска");
    expect(logos.some(logo => logo.getAttribute("src") === "/logo.png")).toBe(true);
    expect(screen.getByRole("button", { name: "Включить тёмную тему" })).toBeTruthy();
    expect(screen.queryByText(/демо-режим|демонстрационная|учебная система/i)).toBeNull();
  });
}

test("Theme choice persists after remount and beats system preference", async () => {
  const user = userEvent.setup();
  const first = render(<ThemeToggle />);
  await user.click(screen.getByRole("button", { name: "Включить тёмную тему" }));
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("obninsk-theme")).toBe("dark");
  first.unmount();
  render(<ThemeToggle />);
  expect(screen.getByRole("button", { name: "Включить светлую тему" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Включить светлую тему" }));
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(localStorage.getItem("obninsk-theme")).toBe("light");
});

test("Initial system theme is used when there is no saved choice", async () => {
  window.matchMedia.mockReturnValue({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()});
  render(<ThemeToggle />);
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
});

test("Saved explicit choice survives system changes and syncs another tab", async () => {
  localStorage.setItem("obninsk-theme", "dark");
  render(<ThemeToggle />);
  systemChange();
  expect(document.documentElement.dataset.theme).toBe("dark");
  localStorage.setItem("obninsk-theme", "light");
  fireEvent(window, new StorageEvent("storage", { key: "obninsk-theme", newValue: "light" }));
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
});

test("FAQ opens, reveals refund rules, and closes", async () => {
  const user = userEvent.setup();
  mount("/");
  await user.click(screen.getByRole("button", { name: /ЧаВо/ }));
  const dialog = screen.getByRole("dialog", { name: "Частые вопросы" });
  expect(dialog.hasAttribute("open")).toBe(true);
  const summary = screen.getByText("Можно ли отменить обмен и вернуть койны?");
  await user.click(summary);
  expect(summary.closest("details").open).toBe(true);
  expect(screen.getByText(/Вернётся стоимость, зафиксированная при обмене/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Закрыть ЧаВо" }));
  expect(dialog.hasAttribute("open")).toBe(false);
});
