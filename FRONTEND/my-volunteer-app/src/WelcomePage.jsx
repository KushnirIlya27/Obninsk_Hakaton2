import FaqHelp from "./components/FaqHelp";
import BrandLogo from "./components/BrandLogo";
import { useResource } from "./lib/useResource";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
const WelcomePage = () => {
  const navigate = useNavigate();
  const stats = useResource("stats/");
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans">
      {/* ЛЕВАЯ ПАНЕЛЬ (Темно-синяя) */}
      <div className="w-full md:w-1/2 bg-[#14346b] text-white p-8 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Верхний блок с логотипом */}
        <div className="flex items-center gap-3 relative z-10">
          <BrandLogo />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-blue-200">
              Цифровой волонтер
            </span>
            <span className="text-sm font-bold tracking-wider">ОБНИНСКА</span>
          </div>
        </div>

        {/* Центральный блок с текстом и статистикой */}
        <div className="my-12 md:my-auto relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-blue-100 mb-6">
            <svg
              className="w-3 h-3 text-[#8cd646]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Делать добро — просто
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Твое время
            <br />
            меняет <span className="text-[#8cd646]">город</span>
          </h1>

          <p className="text-blue-100 text-lg mb-12 max-w-md">
            Участвуй в событиях Обнинска, собирай койны и получай городские
            поощрения.
          </p>

          {/* Статистика */}
          <div className="flex gap-8 md:gap-12">
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">
                {stats.data?.volunteers ?? "—"}
              </div>
              <div className="text-blue-200 text-sm">волонтеров</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">
                {stats.data?.confirmed_hours ?? "—"}
              </div>
              <div className="text-blue-200 text-sm">добрых часов</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">
                {stats.data?.events ?? "—"}
              </div>
              <div className="text-blue-200 text-sm">события</div>
            </div>
          </div>
        </div>

        {/* Декоративный график внизу (имитация столбиков) */}
        <div className="absolute bottom-0 left-0 right-0 h-48 flex items-end justify-around opacity-20 pointer-events-none px-4 gap-2">
          <div className="w-1/6 bg-blue-400 rounded-t-lg h-1/3"></div>
          <div className="w-1/6 bg-blue-400 rounded-t-lg h-1/2"></div>
          <div className="w-1/6 bg-blue-400 rounded-t-lg h-2/5"></div>
          <div className="w-1/6 bg-blue-400 rounded-t-lg h-3/4"></div>
          <div className="w-1/6 bg-blue-400 rounded-t-lg h-1/2"></div>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ (Светлая) */}
      <div className="w-full md:w-1/2 bg-slate-50 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-4">
            <Link
              to="/login"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Уже есть аккаунт? Войти
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-xs font-bold text-green-600 tracking-wider uppercase mb-2">
              Добро пожаловать
            </h2>
            <h3 className="text-3xl font-bold text-slate-900 mb-3">
              Как вы хотите войти?
            </h3>
            <p className="text-slate-500 text-sm">
              Выберите свою роль, чтобы начать.
            </p>
          </div>

          {/* Карточки выбора роли */}
          <div className="flex flex-col gap-4 mb-8">
            {/* Карточка: Волонтер */}
            <button
              onClick={() => navigate("/volunteer")}
              className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Я волонтер</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    События, часы и поощрения
                  </div>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors"
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

            {/* Карточка: Координатор */}
            <button
              onClick={() => navigate("/coordinator")}
              className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-green-500 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
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
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    Я координатор
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Подтверждение заявок
                  </div>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-slate-400 group-hover:text-green-500 transition-colors"
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
          </div>


        </div>

        <FaqHelp />
      </div>
    </div>
  );
};

export default WelcomePage;
