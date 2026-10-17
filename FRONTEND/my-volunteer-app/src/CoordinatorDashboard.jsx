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
    try {
      await api("coordinator/templates/", {title: event.title, description: event.description,
        location: event.location, coins_per_hour: event.coins_per_hour});
      saved("Мероприятие сохранено как шаблон.");
    } catch (error) { setError(error.message); }
  }
  async function archiveTemplate(id) {
    if (!window.confirm("Убрать шаблон из списка? Созданные мероприятия сохранятся.")) return;
    try { await api(`coordinator/templates/${id}/archive/`, {}); saved("Шаблон убран из списка."); }
    catch (error) { setError(error.message); }
  }
  async function issue(id) {
    setIssuing(id);
    setError("");
    try {
      await api(`coordinator/redemptions/${id}/issue/`, {});
      saved(`Запрос №${id}: выдача отмечена.`);
    } catch (error) {
      setError(error.message);
    } finally {
      setIssuing(null);
    }
  }
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex flex-wrap justify-between items-center gap-4">
          <Link
            to="/coordinator-dashboard"
            className="flex items-center gap-3 font-bold"
          >
            <BrandLogo />
            <span>Обнинск · Координатор</span>
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>{user.username}</span>
            <a href="/admin/" className="text-blue-600 underline">
              Django Admin
            </a>
            <Link to="/dashboard" className="text-blue-600">
              Кабинет волонтёра
            </Link>
            <button className="secondary-button" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </header>
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
          <Stat
            label="Отчётов на проверке"
            value={rows.filter((row) => row.status === "pending").length}
          />
          <Stat
            label="Подтверждено участий"
            value={rows.filter((row) => row.status === "approved").length}
          />
          <Stat
            label="Волонтёров в заявках"
            value={new Set(rows.map((row) => row.volunteer_id)).size}
          />
        </div>
        <Notice>{error}</Notice>
        <Notice kind="success">{message}</Notice>
        <nav
          className="flex flex-wrap gap-3 mb-7"
          aria-label="Разделы координатора"
        >
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
              <select
                className="field"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
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
                  <ReviewCard
                    key={activity.id}
                    activity={activity}
                    onSaved={saved}
                  />
                ))}
            </div>
            {activities.data &&
              !rows.some(
                (row) => filter === "all" || row.status === filter,
              ) && (
                <p className="panel text-slate-500">
                  В этом разделе пока нет заявок.
                </p>
              )}
          </>
        )}
        {tab === "rewards" && (
          <>
            <ResourceError error={requests.error} retry={requests.reload} />
            {requests.loading && <Loading />}
            <div className="space-y-4">
              {(requests.data?.results || []).map((request) => (
                <article
                  className="panel flex flex-wrap justify-between gap-4 items-center"
                  key={request.id}
                >
                  <div>
                    <h2 className="font-bold text-xl">
                      {request.reward_title}
                    </h2>
                    <p className="text-sm text-slate-500 my-2">
                      {request.volunteer_username} · {request.price} койнов ·{" "}
                      {formatDate(request.created_at)}
                    </p>
                    <Status status={request.status} />
                  </div>
                  {request.status === "pending" && (
                    <div className="flex flex-wrap gap-3"><button
                      className="primary-button"
                      disabled={issuing !== null}
                      onClick={() => issue(request.id)}
                    >
                      Отметить выдачу
                    </button><button className="secondary-button" disabled={issuing !== null}
                      onClick={() => cancelRequest(request.id)}>Отменить и вернуть койны</button></div>
                  )}
                </article>
              ))}
            </div>
            {requests.data && !requests.data.results.length && (
              <p className="panel text-slate-500">
                Запросов на выдачу пока нет.
              </p>
            )}
          </>
        )}
        {tab === "templates" && (
          <div className="space-y-6">
            <EventCreator templateMode onSaved={saved} />
            <ResourceError error={templates.error} retry={templates.reload} />
            {templates.loading && <Loading />}
            {(templates.data?.results || []).map((template) => (
              <article className="panel" key={template.id}>
                <h2 className="text-xl font-bold">{template.title}</h2>
                <p className="text-slate-500 my-3">{template.location} · {template.coins_per_hour} койнов/час</p>
                <p className="whitespace-pre-line mb-4">{template.description}</p>
                <div className="flex flex-wrap gap-3">
                  <button className="primary-button" onClick={() => {setChosenTemplate(template); setTab("events"); setMessage("Шаблон выбран. Укажите даты и создайте мероприятие.");}}>Создать по шаблону</button>
                  <button className="secondary-button" onClick={() => archiveTemplate(template.id)}>Убрать шаблон</button>
                </div>
              </article>
            ))}
            {templates.data && !templates.data.results.length && <p className="panel">Сохраните первый шаблон — его смогут использовать координаторы.</p>}
          </div>
        )}
        {tab === "events" && (
          <div className="space-y-6">
            <EventCreator key={chosenTemplate?.id || "new"} initial={chosenTemplate} onSaved={saved} />
            <ResourceError error={events.error} retry={events.reload} />
            {events.loading && <Loading />}
            <section className="panel">
              <h2 className="text-2xl font-bold mb-5">Мероприятия</h2>
              <p className="text-sm text-slate-500 mb-5">
                Изменить ставку, даты или закрыть запись можно в{" "}
                <a
                  href="/admin/catalog/event/"
                  className="text-blue-600 underline"
                >
                  Django Admin
                </a>
                .
              </p>
              <div className="divide-y divide-slate-100">
                {(events.data?.results || []).map((event) => (
                  <article key={event.id} className="py-4">
                    <h3 className="font-bold">{event.title}</h3>
                    <button className="text-blue-600 underline text-sm mt-2" onClick={() => saveEventTemplate(event)}>Сохранить как шаблон</button>
                    <p className="text-sm text-slate-500">
                      {event.coins_per_hour} койнов/час ·{" "}
                      {formatDate(event.starts_at)} ·{" "}
                      {event.is_active ? "Запись открыта" : "Запись закрыта"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      <footer className="page-shell text-xs text-slate-500">
        Цифровой волонтёр Обнинска · Добрые дела объединяют город
      </footer>
    </div>
  );
}
