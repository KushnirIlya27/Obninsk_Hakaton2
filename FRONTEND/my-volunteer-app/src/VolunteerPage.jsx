import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { fieldMessages } from "./lib/api";

const VolunteerPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [login, setLogin] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    setErrors((previous) => ({ ...previous, phone: "" }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = {};
    if (!login.trim()) validation.login = "Введите логин";
    if (phone.replace(/\D/g, "").length !== 10)
      validation.phone = "Введите 10 цифр телефона после +7";
    if (password.length < 8)
      validation.password = "Пароль должен содержать не менее 8 символов";
    if (!isAgreed) validation.terms = "Необходимо согласиться с правилами";
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      await register({
        username: login.trim(),
        phone: "+7" + phone.replace(/\D/g, ""),
        password1: password,
        password2: password,
        email,
        info,
      });
      navigate("/dashboard");
    } catch (error) {
      const fields = fieldMessages(error);
      setErrors({
        general: [error.message, fields.email, fields.info]
          .filter(Boolean)
          .join(" "),
        login: fields.username,
        phone: fields.phone,
        password: fields.password1 || fields.password2,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-full md:w-[45%] bg-[#14346b] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Логотип */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-blue-200">
              Цифровой волонтер
            </span>
            <span className="text-sm font-bold tracking-wider">ОБНИНСКА</span>
          </div>
        </div>

        {/* Центральный контент */}
        <div className="my-12 md:my-auto relative z-10 max-w-lg">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-8">
            <svg
              className="w-7 h-7 text-blue-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>

          <div className="text-xs font-bold tracking-widest text-blue-300 uppercase mb-4">
            Кабинет волонтера
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Твое время
            <br />
            меняет <span className="text-[#8cd646]">город</span>
          </h1>

          <p className="text-blue-100 text-lg max-w-md">
            Участвуй в событиях, собирай добрые часы и обменивай их на городские
            поощрения.
          </p>
        </div>

        {/* Футер */}
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
              Безопасный демо-режим
            </div>
            <div className="text-xs mt-1">
              Данные формы используются только внутри прототипа
            </div>
          </div>
        </div>

        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div className="w-full md:w-[55%] bg-white flex flex-col items-center p-6 md:p-12 relative overflow-y-auto">
        <div className="w-full max-w-xl my-auto">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 text-sm font-medium"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Вернуться к выбору роли
          </button>

          <div className="mb-8">
            <h2 className="text-xs font-bold text-green-600 tracking-wider uppercase mb-2">
              Шаг 2 из 2
            </h2>
            <h3 className="text-3xl font-bold text-slate-900 mb-3">
              Создание профиля
            </h3>
            <p className="text-slate-500 text-sm">
              Заполните данные, чтобы начать участвовать в событиях.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
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
              </div>
              <div>
                <div className="text-xs text-slate-500">Вы входите как</div>
                <div className="text-sm font-semibold text-slate-900">
                  Волонтер
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Изменить
            </button>
          </div>

          {errors.general && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              {errors.general}
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
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
                    if (errors.login) setErrors({ ...errors, login: null });
                  }}
                  placeholder="volunteer_obninsk"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.login ? "border-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"} focus:ring-1 outline-none transition-all text-sm`}
                />
              </div>
              {errors.login && (
                <p className="text-red-500 text-xs mt-1">{errors.login}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Электронная почта
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold">@</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.ru"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Номер телефона
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold">+7</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="900 000-00-00"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.phone ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"} outline-none transition-all text-sm`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Сферы интересов
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
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={info}
                  maxLength="2000"
                  onChange={(event) => setInfo(event.target.value)}
                  placeholder="Экология, помощь животным, образование..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Пароль */}
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
                    if (errors.password)
                      setErrors({ ...errors, password: null });
                  }}
                  placeholder="Не менее 8 символов"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"} outline-none transition-all text-sm`}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div className="flex items-start gap-3 mt-6">
              <input
                type="checkbox"
                id="terms-vol" // Для VolunteerPage замени на id="terms-vol"
                checked={isAgreed}
                onChange={(e) => {
                  setIsAgreed(e.target.checked);
                  if (errors.terms) setErrors({ ...errors, terms: null });
                }}
                className={`mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 ${errors.terms ? "border-red-500 ring-1 ring-red-500" : ""}`}
              />
              <div>
                <label
                  htmlFor="terms-vol"
                  className="text-xs text-slate-500 leading-relaxed cursor-pointer"
                >
                  {" "}
                  {/* Для VolunteerPage замени на htmlFor="terms-vol" */}Я
                  согласен с правилами сервиса и обработкой учебных данных в
                  рамках демонстрации
                </label>
                {errors.terms && (
                  <p className="text-red-500 text-xs mt-1">{errors.terms}</p>
                )}
              </div>
            </div>

            <button
              disabled={busy}
              type="submit"
              className="w-full bg-[#1e4b8f] hover:bg-[#15386d] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mt-8"
            >
              {busy ? "Создаём профиль…" : "Создать профиль"}
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-400">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Реальная регистрация и передача персональных данных не выполняются
          </div>

          <div className="text-center mt-4 text-sm text-slate-500">
            Уже есть аккаунт?{" "}
            <Link
              to="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Войти
            </Link>
          </div>
        </div>

        <button className="absolute bottom-6 right-6 w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition-colors">
          <span className="font-bold text-lg">?</span>
        </button>
      </div>
    </div>
  );
};

export default VolunteerPage;
