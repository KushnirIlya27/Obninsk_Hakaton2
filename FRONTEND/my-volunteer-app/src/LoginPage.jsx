import BrandLogo from "./components/BrandLogo";
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth/useAuth";

const LoginPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn, signOut } = useAuth();
  const [role, setRole] = useState(
    params.get("role") === "coordinator" ? "coordinator" : "volunteer",
  );
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = {};
    if (!login.trim()) validation.login = "Введите логин";
    if (!password) validation.password = "Введите пароль";
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      const user = await signIn(login.trim(), password);
      if (role === "coordinator" && !user.can_review) {
        await signOut();
        setErrors({ general: "У этого аккаунта нет прав координатора." });
        return;
      }
      navigate(user.can_review ? "/coordinator-dashboard" : "/dashboard");
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-full md:w-1/2 bg-[#14346b] text-white p-8 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
            <BrandLogo />
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-blue-200">
              Цифровой волонтер
            </span>
            <span className="text-sm font-bold tracking-wider">ОБНИНСКА</span>
          </div>
        </div>

        <div className="my-12 md:my-auto relative z-10 max-w-lg">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            С возвращением
            <br />в <span className="text-[#8cd646]">систему</span>
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            Войдите в личный кабинет, чтобы продолжить помогать городу.
          </p>
        </div>

        <div className="relative z-10 flex items-start gap-3 text-blue-200">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <div>
            <div className="text-sm font-semibold text-white">
              Безопасный вход
            </div>
            <div className="text-xs mt-1">
              Вход через защищённую сессию сервера
            </div>
          </div>
        </div>

        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-xs font-bold text-green-600 tracking-wider uppercase mb-2">
              Вход
            </h2>
            <h3 className="text-3xl font-bold text-slate-900 mb-3">
              Войти в аккаунт
            </h3>
            <p className="text-slate-500 text-sm">
              Выберите роль и введите данные для входа.
            </p>
          </div>

          {/* Переключатель роли */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                setRole("volunteer");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-all ${
                role === "volunteer"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <svg
                className="w-4 h-4"
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
              Волонтер
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("coordinator");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-all ${
                role === "coordinator"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Координатор
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
                <svg
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {errors.general}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Логин
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
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
                </div>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    if (errors.login || errors.general)
                      setErrors({ ...errors, login: null, general: null });
                  }}
                  placeholder="Ваш логин"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.login ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"} focus:ring-1 outline-none transition-all text-sm`}
                />
              </div>
              {errors.login && (
                <p className="text-red-500 text-xs mt-1">{errors.login}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password || errors.general)
                      setErrors({ ...errors, password: null, general: null });
                  }}
                  placeholder="Ваш пароль"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"} focus:ring-1 outline-none transition-all text-sm`}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <button
              disabled={busy}
              type="submit"
              className="w-full bg-[#1e4b8f] hover:bg-[#15386d] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
            >
              Войти
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
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-slate-500">
            Нет аккаунта?{" "}
            <Link to="/" className="text-blue-600 hover:underline font-medium">
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
