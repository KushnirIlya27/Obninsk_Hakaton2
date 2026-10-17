import { formatDate } from "./lib/format";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { api } from "./lib/api";
import { useResource } from "./lib/useResource";
import { Loading, Notice, ResourceError, Status } from "./components/ui";
import ReportDialog from "./components/ReportDialog";
import hero from "./assets/hero.png";

export default function VolunteerDashboard() {
  const { refresh } = useAuth();
  const events = useResource("events/");
  const activities = useResource("me/activities/");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState(null);
  const own = new Map(
    (activities.data?.results || []).map((activity) => [
      activity.event_id,
      activity,
    ]),
  );
  const reload = () => {
    events.reload();
    activities.reload();
    refresh().catch(() => {});
  };
  async function join(id) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await api(`events/${id}/apply/`, {});
      reload();
      setMessage(
        "Вы записаны. После участия отправьте отчёт на получение койнов.",
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="page-shell">
      <section className="hero-panel mb-10">
        <div>
          <p className="eyebrow text-[#8cd646]">Добрые дела начинаются с вас</p>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
            Выбирайте событие.
            <br />
            Меняйте город.
          </h1>
          <p className="text-blue-100 max-w-xl">
            Запишитесь, помогите и расскажите о своей работе. Подтверждённые
            часы превратятся в койны.
          </p>
        </div>
        <img
          src={hero}
          alt=""
          className="hidden md:block w-52 h-44 object-contain"
        />
      </section>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="eyebrow">Каталог</p>
          <h2 className="text-3xl font-bold">Мероприятия Обнинска</h2>
        </div>
        <button className="secondary-button" onClick={reload}>
          Обновить
        </button>
      </div>
      <Notice>{error}</Notice>
      <Notice kind="success">{message}</Notice>
      <ResourceError error={events.error} retry={events.reload} />
      <ResourceError error={activities.error} retry={activities.reload} />
      {(events.loading || activities.loading) && <Loading />}
      {events.data && !events.data.results.length && (
        <div className="panel text-slate-500">
          Открытых мероприятий пока нет. Загляните позже.
        </div>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {(events.data?.results || []).map((event, index) => {
          const activity = own.get(event.id);
          return (
            <article
              key={event.id}
              className="panel p-0 overflow-hidden flex flex-col"
              data-testid={`event-${event.id}`}
            >
              <div
                className={`p-6 ${["bg-blue-50", "bg-green-50", "bg-orange-50"][index % 3]} flex items-center justify-between gap-3`}
              >
                <span className="text-xs uppercase font-bold tracking-widest text-slate-500">
                  Доброе дело
                </span>
                <span className="bg-white rounded-full px-3 py-2 text-blue-800 font-bold">
                  {event.coins_per_hour} койнов/час
                </span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="text-xs text-slate-500 mb-2">
                  {formatDate(event.starts_at)}
                  {event.ends_at ? ` — ${formatDate(event.ends_at)}` : ""}
                </p>
                <p className="text-sm text-slate-500 mb-3">{event.location}</p>
                <h3 className="text-xl font-bold mb-3">{event.title}</h3>
                <p className="text-slate-500 text-sm whitespace-pre-line mb-5 flex-1">
                  {event.description}
                </p>
                {activity ? (
                  <div className="space-y-3">
                    <Status status={activity.status} />
                    <p className="text-sm text-slate-600">
                      Ваша ставка при записи:{" "}
                      <strong>{activity.rate_snapshot} койнов/час</strong>
                    </p>
                    {activity.status === "approved" && (
                      <p className="text-green-700 text-sm">
                        {activity.confirmed_hours} ч. × {activity.rate_snapshot}{" "}
                        × {activity.coefficient} ={" "}
                        <strong>+{activity.coins_awarded} койнов</strong>
                      </p>
                    )}
                    {activity.review_note && (
                      <p className="text-sm text-slate-600">
                        Комментарий: {activity.review_note}
                      </p>
                    )}
                    {activity.can_submit_report && (
                      <button
                        className="primary-button w-full"
                        onClick={() => setReport(activity)}
                      >
                        {activity.status === "pending"
                          ? "Уточнить отчёт"
                          : "Подать отчёт"}
                      </button>
                    )}
                    {activity.status === "registered" &&
                      !activity.can_submit_report && (
                        <p className="text-xs text-slate-500">
                          Отчёт откроется{" "}
                          {formatDate(activity.report_available_at)}.
                        </p>
                      )}
                    {activity.status === "pending" && (
                      <p className="text-xs text-slate-500">
                        Заявлено {activity.requested_hours} ч. Ожидаем решение
                        координатора.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    className="primary-button w-full"
                    disabled={busy !== null}
                    onClick={() => join(event.id)}
                  >
                    {busy === event.id ? "Записываем…" : "Подать заявку"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-100 p-6 text-sm text-slate-600">
        Ставка сохраняется при записи. Коэффициент по умолчанию — 1×;
        координатор может увеличить его при форс-мажоре, указав причину.
        Начисление выполняется после проверки.
      </div>
      {report && (
        <ReportDialog
          key={report.id}
          activity={report}
          onClose={() => setReport(null)}
          onSaved={() => {
            reload();
            setMessage(
              "Отчёт отправлен. Баланс изменится после подтверждения координатором.",
            );
          }}
        />
      )}
    </main>
  );
}
