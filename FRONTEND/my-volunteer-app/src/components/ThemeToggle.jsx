import { useEffect, useState } from "react";
import { applyTheme, savedTheme, systemTheme, THEME_KEY } from "../theme/preferences";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => savedTheme() || systemTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!savedTheme()) setTheme(systemTheme());
    };
    const onStorage = (event) => {
      if (event.key === THEME_KEY || event.key === null) {
        setTheme(savedTheme() || systemTheme());
      }
    };
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Theme still works for this session if browser storage is unavailable.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        {theme === "dark" ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
        ) : (
          <path d="M20.7 13.1A8.8 8.8 0 0 1 10.9 3.3 9 9 0 1 0 20.7 13.1Z" />
        )}
      </svg>
      <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>
    </button>
  );
}
