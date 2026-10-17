import BrandLogo from "./components/BrandLogo";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { Notice } from "./components/ui";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const VolunteerLayout = () => {
  const { user, signOut } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Достаем логин волонтера
  const userLogin = user.name || user.username;
  const initials = userLogin.substring(0, 2).toUpperCase();

  // Состояние для мобильного меню
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Функция выхода (смена пользователя)
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      setError(error.message);
    }
  };

  // Классы для активных и неактивных вкладок (для десктопа)
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2 py-6 border-b-2 font-medium transition-colors ${
      isActive
        ? "text-blue-600 border-blue-600"
        : "text-slate-500 border-transparent hover:text-slate-900"
    }`;

  // Классы для мобильного меню
  const mobileNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors text-left ${
      isActive ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ШАПКА (HEADER) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          {/* Логотип */}
          <div className="flex items-center gap-3">
            {/* Вставляем нашу картинку */}
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
              <BrandLogo />
            </div>
            {/* Текст рядом */}
            <div className="hidden sm:flex flex-col">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Цифровой волонтер
              </span>
              <span className="text-sm font-bold tracking-wider text-slate-900">
                ОБНИНСКА
              </span>
            </div>
          </div>

          {/* НАВИГАЦИЯ (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 h-full">
            <NavLink to="/dashboard" end className={navLinkClass}>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Главная
            </NavLink>

            <NavLink to="/dashboard/rewards" className={navLinkClass}>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              Поощрения
            </NavLink>

            <NavLink to="/dashboard/profile" className={navLinkClass}>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Мой профиль
            </NavLink>
          </nav>

          {/* Правая часть: баланс + профиль + бургер */}
          <div className="flex items-center gap-3">
            {/* Баланс (скрыт на очень маленьких экранах) */}
            <div className="hidden sm:flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                <img
                  src="/coin.png"
                  alt="Коин"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-blue-900 font-bold">{user.balance}</span>
              <span className="text-blue-700 text-sm">коинов</span>
            </div>

            {/* Профиль */}
            <div className="flex items-center gap-3 md:border-l md:border-slate-200 md:pl-6">
              <div className="w-10 h-10 bg-[#1e4b8f] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-bold text-slate-900">
                  {userLogin}
                </span>
                <span className="text-xs text-slate-500">
                  Волонтер ·{" "}
                  <button
                    onClick={handleLogout}
                    className="text-blue-600 hover:underline"
                  >
                    сменить
                  </button>
                </span>
              </div>
            </div>

            {/* БУРГЕР-КНОПКА (только для мобильных) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="Открыть меню"
            >
              {isMobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ВЫПАДАЮЩЕЕ МОБИЛЬНОЕ МЕНЮ */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white shadow-lg">
            <nav className="flex flex-col p-4 gap-1">
              <NavLink
                to="/dashboard"
                end
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Главная
              </NavLink>

              <NavLink
                to="/dashboard/rewards"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
                Поощрения
              </NavLink>

              <NavLink
                to="/dashboard/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Мой профиль
              </NavLink>

              {/* Разделитель и информация о пользователе */}
              <div className="border-t border-slate-100 mt-2 pt-4 px-4 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {userLogin}
                    </div>
                    <div className="text-xs text-slate-500">Волонтер</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Сменить
                  </button>
                </div>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ЗДЕСЬ ОТОБРАЖАЕТСЯ КОНТЕНТ СТРАНИЦ (Главная / Поощрения / Профиль) */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <Notice>{error}</Notice>
      </div>
      <Outlet context={{ userLogin }} />

      {/* Плавающая кнопка помощи */}
      <button className="fixed bottom-6 right-6 w-12 h-12 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-slate-700 transition-colors z-40">
        <span className="font-bold text-xl">?</span>
      </button>
    </div>
  );
};

export default VolunteerLayout;
