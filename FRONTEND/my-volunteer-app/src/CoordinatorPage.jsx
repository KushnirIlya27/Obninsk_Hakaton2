import BrandLogo from "./components/BrandLogo";
import { Link } from "react-router-dom";
export default function CoordinatorPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2 font-sans">
      <section className="bg-[#14346b] text-white p-10 md:p-16 flex flex-col justify-between">
        <Link to="/" className="font-bold flex items-center gap-3">
          <BrandLogo />
          Цифровой волонтёр Обнинска
        </Link>
        <div className="py-20">
          <p className="eyebrow text-[#8cd646]">Кабинет координатора</p>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Помогайте тем,
            <br />
            кто помогает городу
          </h1>
          <p className="text-blue-100 text-lg mt-6">
            Проверяйте отчёты, подтверждайте часы и обрабатывайте запросы на
            поощрения.
          </p>
        </div>
        <p className="text-blue-200 text-sm">
          Учёт с прозрачной историей начислений
        </p>
      </section>
      <main className="bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-5">Вход для координатора</h2>
          <p className="text-slate-500 mb-6">
            Аккаунт и разрешения координатора назначает администратор проекта.
            Обычная регистрация создаёт аккаунт волонтёра.
          </p>
          <Link
            className="primary-button inline-block"
            to="/login?role=coordinator"
          >
            Войти координатором
          </Link>
          <p className="mt-6 text-sm text-slate-500">
            Хотите участвовать в мероприятиях?{" "}
            <Link to="/volunteer" className="text-blue-600 underline">
              Создать профиль волонтёра
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
