import BrandLogo from "./components/BrandLogo";
import { formatDate } from "./lib/format";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/useAuth";
import { api, fieldMessages } from "./lib/api";
import { useResource } from "./lib/useResource";
import { Loading, Notice, ResourceError, Stat, Status } from "./components/ui";

function ReviewCard({ activity, onSaved }) {
  const [decision, setDecision] = useState("approved");
  const [hours, setHours] = useState(activity.requested_hours || "");
  const [coefficient, setCoefficient] = useState("1.00");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = Number(hours) * activity.rate_snapshot * Number(coefficient);
  async function review(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`coordinator/activities/${activity.id}/review/`, {
        decision,
        hours,
        coefficient,
        note,
      });
      onSaved(`Отчёт №${activity.id}: решение сохранено.`);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel" data-testid={`review-${activity.id}`}>
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold">{activity.event_title}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {activity.volunteer_username} · ставка {activity.rate_snapshot}{" "}
            койнов/час
          </p>
        </div>
        <Status status={activity.status} />
      </div>
      {activity.report_text && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line mb-5">
          {activity.report_text}
        </p>
      )}
      {activity.status === "registered" && (
        <p className="text-slate-500 text-sm">
          Волонтёр ещё не отправил отчёт. Начисление недоступно.
        </p>
      )}
      {activity.status === "approved" && (
        <p className="text-green-700">
          {activity.confirmed_hours} ч. × {activity.rate_snapshot} ×{" "}
          {activity.coefficient} ={" "}
          <strong>+{activity.coins_awarded} койнов</strong>
        </p>
      )}
      {activity.review_note && (
        <p className="text-sm mt-3">Решение: {activity.review_note}</p>
      )}
      {activity.status === "pending" && (
        <form onSubmit={review} className="space-y-5">
          <p className="text-sm text-slate-600">
            Волонтёр заявил {activity.requested_hours} ч.
          </p>
          <Notice>{error}</Notice>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="field-label">
              Решение
              <select
                className="field"
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
              >
                <option value="approved">Подтвердить часы</option>
                <option value="rejected">Отклонить отчёт</option>
              </select>
            </label>
            <label className="field-label">
              Подтверждённые часы
              <input
                className="field"
                type="number"
                min="0.1"
                max="24"
                step="0.1"
                value={hours}
                required={decision === "approved"}
                disabled={decision === "rejected"}
                onChange={(event) => setHours(event.target.value)}
              />
            </label>
            <label className="field-label">
              Коэффициент
              <input
                className="field"
                type="number"
                min="1.00"
                max="10.00"
                step="0.05"
                value={coefficient}
                required={decision === "approved"}
                disabled={decision === "rejected"}
                onChange={(event) => setCoefficient(event.target.value)}
              />
            </label>
          </div>
          <label className="field-label">
            Комментарий / причина
            <textarea
              className="field"
              rows="2"
              maxLength="3000"
              required={decision === "rejected" || Number(coefficient) !== 1}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="При изменении коэффициента или отказе укажите причину"
            />
          </label>
          {decision === "approved" && (
            <p className="text-sm text-slate-600">
              Предварительно: {hours || 0} ч. × {activity.rate_snapshot} ×{" "}
              {coefficient || 1} ={" "}
              <strong>
                {Number.isFinite(preview)
                  ? Math.round(preview + Number.EPSILON)
                  : 0}{" "}
                койнов
              </strong>
              . Итог рассчитает сервер.
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить решение"}
          </button>
        </form>
      )}
    </article>
  );
}

function EventCreator({ onSaved, initial = null, templateMode = false }) {
  const empty = {
    title: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
    coins_per_hour: "10",
  };
  const [form, setForm] = useState({ ...empty, ...initial, starts_at: "", ends_at: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const change = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api(templateMode ? "coordinator/templates/" : "coordinator/events/", {
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_active: true,
      });
      setForm(empty);
      onSaved(templateMode ? "Шаблон сохранён." : "Мероприятие создано и доступно волонтёрам.");
    } catch (error) {
      setError(error.message);
      setFields(fieldMessages(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={create} className="panel space-y-5">
      <h2 className="text-2xl font-bold">{templateMode ? "Сохранить шаблон" : "Создать мероприятие"}</h2>
      {error && (
        <Notice>
          {error}
          {Object.values(fields).map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </Notice>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <label className="field-label">
          Название
          <input
            className="field"
            required
            maxLength="200"
            name="title"
            value={form.title}
            onChange={change}
          />
        </label>
        <label className="field-label">
          Место
          <input
            className="field"
            required
            maxLength="200"
            name="location"
            value={form.location}
            onChange={change}
          />
        </label>
        {!templateMode && <label className="field-label">
          Начало
          <input
            className="field"
            required
            type="datetime-local"
            name="starts_at"
            value={form.starts_at}
            onChange={change}
          />
        </label>}
        {!templateMode && <label className="field-label">
          Окончание
          <input
            className="field"
            required
            type="datetime-local"
            name="ends_at"
            value={form.ends_at}
            onChange={change}
          />
        </label>}
      </div>
      <label className="field-label">
        Описание
        <textarea
          className="field"
          rows="3"
          name="description"
          value={form.description}
          onChange={change}
        />
      </label>
      <label className="field-label max-w-xs">
        Ставка, койнов в час
        <input
          className="field"
          required
          type="number"
          min="1"
          max="100000"
          step="1"
          name="coins_per_hour"
          value={form.coins_per_hour}
          onChange={change}
        />
      </label>
      <p className="text-sm text-slate-500">
        Коэффициент устанавливается отдельно при проверке отчёта, по умолчанию
        1×.
      </p>
      <button className="primary-button" disabled={busy}>
        {busy ? "Сохраняем…" : templateMode ? "Сохранить шаблон" : "Создать мероприятие"}
      </button>
    </form>
  );
}

export default function CoordinatorDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("reports");
  const [chosenTemplate, setChosenTemplate] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(null);
  
  const [savingTemplateId, setSavingTemplateId] = useState(null);
  const [savedTemplateId, setSavedTemplateId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [archivedId, setArchivedId] = useState(null);

  const activities = useResource("coordinator/activities/");
  const requests = useResource(
    user.can_issue ? "coordinator/redemptions/" : null,
  );
  const events = useResource(
    user.can_manage_events ? "coordinator/events/" : null,
  );
  const templates = useResource(user.can_manage_events ? "coordinator/templates/" : null);
  const rows = activities.data?.results || [];
  const reload = () => {
    activities.reload();
    requests.reload();
    events.reload();
    templates.reload();
  };
  const saved = (message) => {
    setMessage(message);
    reload();
  };
  async function logout() {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      setError(error.message);
    }
  }
  async function cancelRequest(id) {
    if (!window.confirm("Отменить запрос и вернуть койны волонтёру?")) return;
    setIssuing(id);
    setError("");
    try {
      await api(`redemptions/${id}/cancel/`, {});
      saved(`Запрос №${id}: отменён, койны возвращены.`);
    } catch (error) { setError(error.message); }
    finally { setIssuing(null); }
  }
  async function saveEventTemplate(event) {
    setSavingTemplateId(event.id);
    setError("");
    try {
      await api("coordinator/templates/", {
        title: event.title, description: event.description,
        location: event.location, coins_per_hour: event.coins_per_hour
      });
      saved("Мероприятие сохранено как шаблон.");
      setSavedTemplateId(event.id);
      setTimeout(() => setSavedTemplateId(null), 3000);
    } catch (error) { setError(error.message); }
    finally { setSavingTemplateId(null); }
  }
  async function archiveTemplate(id) {
    if (!window.confirm("Убрать шаблон из списка? Созданные мероприятия сохранятся.")) return;
    setArchivingId(id);
    setError("");
    try {
      await api(`coordinator/templates/${id}/archive/`, {});
      setArchivedId(id);
      setTimeout(() => {
        saved("Шаблон убран из списка.");
        setArchivedId(null);
        setArchivingId(null);
      }, 1500);
    } catch (error) { 
      setError(error.message); 
      setArchivingId(null);
    }
  }
  async function issue(id) {
    setIssuing(id);
    setError("");
    try {
      await api(`coordinator/redemptions/${id}/issue/`, {});
      saved(`Запрос №${id}: выдача отмечена.`);
    } catch (error) { setError(error.message); }
    finally { setIssuing(null); }
  }

  // Получаем первые две буквы логина для аватарки
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "CO";

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* ================= ОБНОВЛЕННАЯ ШАПКА ================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Логотип */}
          <Link to="/coordinator-dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 border border-slate-100">
              <BrandLogo />
            </div>
            <span className="font-extrabold text-[#14346b] text-lg hidden sm:block">ИАТЭ · Координатор</span>
          </Link>

          {/* Правая часть */}
          <div className="flex items-center gap-2 md:gap-5">
            
            {/* Ссылки */}
            <nav className="hidden md:flex items-center gap-1">
              <a href="/admin/" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#1e4b8f] hover:bg-slate-50 rounded-lg transition-colors">
                Django Admin
              </a>
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#1e4b8f] hover:bg-slate-50 rounded-lg transition-colors">
                Кабинет волонтёра
              </Link>
            </nav>

            {/* Разделитель */}
            <div className="hidden md:block w-px h-6 bg-slate-200"></div>

            {/* Профиль пользователя */}
            <div className="flex items-center gap-3 pl-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1e4b8f] flex items-center justify-center font-bold text-xs ring-2 ring-white">
                {initials}
              </div>
              <span className="text-sm font-semibold text-slate-700 hidden sm:block">{user?.username}</span>
            </div>

            {/* Кнопка выхода */}
            <button 
              onClick={logout}
              className="ml-2 flex items-center gap-2 px-3 py-2 md:px-4 text-sm font-medium text-slate-600 border border-slate-300 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:block">Выйти</span>
            </button>
          </div>
        </div>
      </header>
      {/* ====================================================== */}

      <main className="page-shell">
        <div className="flex justify-between gap-4 items-center mb-7">
          <div>
            <p className="eyebrow">Проверка добрых дел</p>
            <h1 className="text-3xl md:text-4xl font-extrabold">
              Панель координатора
            </h1>
          </div>
          <button className="secondary-button" onClick={reload}>
            Обновить
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mb-7">
          <Stat label="Отчётов на проверке" value={rows.filter((row) => row.status === "pending").length} />
          <Stat label="Подтверждено участий" value={rows.filter((row) => row.status === "approved").length} />
          <Stat label="Волонтёров в заявках" value={new Set(rows.map((row) => row.volunteer_id)).size} />
        </div>
        <Notice>{error}</Notice>
        <Notice kind="success">{message}</Notice>
        <nav className="flex flex-wrap gap-3 mb-7" aria-label="Разделы координатора">
          {[
            ["reports", "Отчёты"],
            ...(user.can_issue ? [["rewards", "Выдача поощрений"]] : []),
            ...(user.can_manage_events ? [["events", "Мероприятия"], ["templates", "Шаблоны"]] : []),
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "primary-button" : "secondary-button"}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "reports" && (
          <>
            <ResourceError error={activities.error} retry={activities.reload} />
            <label className="field-label max-w-xs mb-6">
              Статус
              <select className="field" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="pending">Отчёты на проверке</option>
                <option value="registered">Ожидаем отчёт</option>
                <option value="approved">Подтверждено</option>
                <option value="rejected">Отклонено</option>
                <option value="all">Все участия</option>
              </select>
            </label>
            {activities.loading && <Loading />}
            <div className="space-y-5">
              {rows
                .filter((row) => filter === "all" || row.status === filter)
                .map((activity) => (
                  <ReviewCard key={activity.id} activity={activity} onSaved={saved} />
                ))}
            </div>
            {activities.data && !rows.some((row) => filter === "all" || row.status === filter) && (
              <p className="panel text-slate-500">В этом разделе пока нет заявок.</p>
            )}
          </>
        )}
        {tab === "rewards" && (
          <>
            <ResourceError error={requests.error} retry={requests.reload} />
            {requests.loading && <Loading />}
            <div className="space-y-4">
              {(requests.data?.results || []).map((request) => (
                <article className="panel flex flex-wrap justify-between gap-4 items-center" key={request.id}>
                  <div>
                    <h2 className="font-bold text-xl">{request.reward_title}</h2>
                    <p className="text-sm text-slate-500 my-2">
                      {request.volunteer_username} · {request.price} койнов · {formatDate(request.created_at)}
                    </p>
                    <Status status={request.status} />
                  </div>
                  {request.status === "pending" && (
                    <div className="flex flex-wrap gap-3">
                      <button className="primary-button" disabled={issuing !== null} onClick={() => issue(request.id)}>
                        Подтвердить
                      </button>
                      <button className="secondary-button" disabled={issuing !== null} onClick={() => cancelRequest(request.id)}>
                        Отменить выдачу
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {requests.data && !requests.data.results.length && (
              <p className="panel text-slate-500">Запросов на выдачу пока нет.</p>
            )}
          </>
        )}
        {tab === "templates" && (
          <div className="space-y-6">
            <EventCreator templateMode onSaved={saved} />
            <ResourceError error={templates.error} retry={templates.reload} />
            {templates.loading && <Loading />}
            <div className="space-y-4">
              {(templates.data?.results || []).map((template) => (
                <article className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4" key={template.id}>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900">{template.title}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-2 mb-3">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                        {template.location}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {template.coins_per_hour} койнов/час
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-slate-600 text-sm">{template.description}</p>
                  </div>
                  <div className="flex flex-wrap md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1e4b8f] hover:bg-[#15386d] text-white transition-colors" onClick={() => {setChosenTemplate(template); setTab("events"); setMessage("Шаблон выбран. Укажите даты и создайте мероприятие.");}}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Создать по шаблону
                    </button>
                    <button 
                      disabled={archivingId === template.id || archivedId === template.id}
                      onClick={() => archiveTemplate(template.id)}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                        archivedId === template.id
                          ? "bg-green-50 text-green-700 border-green-200"
                          : archivingId === template.id
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-wait"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-red-600 hover:border-red-200"
                      }`}
                    >
                      {archivedId === template.id ? (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Удалено</>
                      ) : archivingId === template.id ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Удаление...</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Убрать шаблон</>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {templates.data && !templates.data.results.length && <p className="panel text-slate-500">Сохраните первый шаблон — его смогут использовать координаторы.</p>}
          </div>
        )}
        {tab === "events" && (
          <div className="space-y-6">
            <EventCreator key={chosenTemplate?.id || "new"} initial={chosenTemplate} onSaved={saved} />
            <ResourceError error={events.error} retry={events.reload} />
            {events.loading && <Loading />}
            <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Мероприятия</h2>
                <p className="text-sm text-slate-500">
                  Изменить ставку, даты или закрыть запись можно в{" "}
                  <a href="/admin/catalog/event/" className="text-[#1e4b8f] hover:underline font-medium">Django Admin</a>.
                </p>
              </div>
              <div className="space-y-4">
                {(events.data?.results || []).map((event) => (
                  <div key={event.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-[#1e4b8f] hover:shadow-md transition-all gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1e4b8f] flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">{event.title}</h3>
                        <div className={`flex items-center gap-2 mt-1 text-xs font-medium ${event.is_active ? "text-green-600" : "text-slate-500"}`}>
                          <span className={`w-2 h-2 rounded-full ${event.is_active ? "bg-green-500" : "bg-slate-400"}`}></span>
                          {event.is_active ? "Запись открыта" : "Запись закрыта"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 md:w-1/3">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {formatDate(event.starts_at)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {event.coins_per_hour} койнов/час
                      </div>
                    </div>
                    <div>
                      <button 
                        disabled={savingTemplateId === event.id || savedTemplateId === event.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                          savedTemplateId === event.id ? "bg-green-50 text-green-700 border-green-200" : savingTemplateId === event.id ? "bg-slate-100 text-slate-400 border-slate-200 cursor-wait" : "text-[#1e4b8f] bg-blue-50 hover:bg-[#1e4b8f] hover:text-white border-transparent"
                        }`} 
                        onClick={() => saveEventTemplate(event)}
                      >
                        {savedTemplateId === event.id ? (
                          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Сохранено</>
                        ) : savingTemplateId === event.id ? (
                          <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Сохранение...</>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Сохранить как шаблон</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      <footer className="page-shell text-xs text-slate-500">
        Цифровой волонтёр ИАТЭ · Добрые дела объединяют город
      </footer>
    </div>
  );
}