import { formatDate } from "./lib/format";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { api } from "./lib/api";
import { useResource } from "./lib/useResource";
import { Loading, Notice, ResourceError, Status } from "./components/ui";
import ReportDialog from "./components/ReportDialog";
import hero from "./assets/hero.png";

const TYPE_NAMES = {
  social: "Социальное",
  environmental: "Экологическое",
  cultural: "Культурное",
  event: "Событийное",
  sports: "Спортивное",
  zoo: "Зооволонтёрство",
  scientific: "Научное",
};

export default function VolunteerDashboard() {
  const { user, refresh } = useAuth(); 
  const events = useResource("events/");
  const activities = useResource("me/activities/");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState(null);
  
  // НОВОЕ: Состояние для фильтра
  const [filterType, setFilterType] = useState("all"); 

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
      setMessage("Вы записаны. После участия отправьте отчёт на получение койнов.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(null);
    }
  }

  // НОВОЕ: Фильтрация мероприятий
  const filteredEvents = (events.data?.results || []).filter((event) => {
    if (filterType === "all") return true;
    return event.volunteer_type === filterType;
  });

  return (
    <main className="page-shell">
      <section className="hero-panel mb-10">
        <div>
          <p className="eyebrow text-[#8cd646]">Добрые дела начинаются с вас</p>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
            Выбирайте событие
            <br />
            Записывайтесь и помогайте
          </h1>
          <p className="text-blue-100 max-w-xl">
            Запишитесь, помогите и расскажите о своей работе. Подтверждённые
            часы превратятся в койны
          </p>
        </div>
        <img src={hero} alt="" className="hidden md:block w-52 h-44 object-contain" />
      </section>
      
      {/* ОБНОВЛЕННАЯ ШАПКА КАТАЛОГА С ФИЛЬТРОМ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow">Каталог</p>
          <h2 className="text-3xl font-bold">Мероприятия ИАТЭ</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select 
            className="field py-2 px-4 rounded-xl border border-slate-200 text-sm cursor-pointer bg-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Все направления</option>
            <option value="social">Социальное</option>
            <option value="environmental">Экологическое</option>
            <option value="cultural">Культурное (Творческое)</option>
            <option value="event">Событийное</option>
            <option value="sports">Спортивное</option>
            <option value="zoo">Зооволонтёрство</option>
            <option value="scientific">Научное</option>
          </select>
          <button className="secondary-button whitespace-nowrap" onClick={reload}>
            Обновить
          </button>
        </div>
      </div>

      <Notice>{error}</Notice>
      <Notice kind="success">{message}</Notice>
      <ResourceError error={events.error} retry={events.reload} />
      <ResourceError error={activities.error} retry={activities.reload} />
      {(events.loading || activities.loading) && <Loading />}
      
      {!events.loading && filteredEvents.length === 0 && (
        <div className="panel text-slate-500">
          По выбранному направлению мероприятий пока нет.
        </div>
      )}
      
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredEvents.map((event, index) => {
          const activity = own.get(event.id);
          const isPreferred = user?.volunteer_type === event.volunteer_type && event.volunteer_type;
          
          return (
            <article
              key={event.id}
              className="panel p-0 overflow-hidden flex flex-col"
              data-testid={`event-${event.id}`}
            >
              <div
                className={`p-6 ${["bg-blue-50", "bg-green-50", "bg-orange-50"][index % 3]} flex items-center justify-between gap-3`}
              >
                {/* ИСПРАВЛЕНО: Если типа нет, пишем "Без направления" */}
                <span className="text-xs uppercase font-bold tracking-widest text-slate-500">
                  {event.volunteer_type ? TYPE_NAMES[event.volunteer_type] : "Без направления"}
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
                
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-xl font-bold leading-tight">{event.title}</h3>
                  {isPreferred && (
                    <span className="shrink-0 bg-green-100 text-green-700 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Для вас
                    </span>
                  )}
                </div>

                <p className="text-slate-500 text-sm whitespace-pre-line mb-5 flex-1">
                  {event.description}
                </p>
                
                {/* Остальная часть карточки без изменений */}
                {activity ? (
                  <div className="space-y-3">
                    <Status status={activity.status} />
                    <p className="text-sm text-slate-600">
                      Ваша ставка при записи: <strong>{activity.rate_snapshot} койнов/час</strong>
                    </p>
                    {activity.status === "approved" && (
                      <p className="text-green-700 text-sm">
                        {activity.confirmed_hours} ч. × {activity.rate_snapshot} × {activity.coefficient} = <strong>+{activity.coins_awarded} койнов</strong>
                      </p>
                    )}
                    {activity.review_note && (
                      <p className="text-sm text-slate-600">Комментарий: {activity.review_note}</p>
                    )}
                    {activity.can_submit_report && (
                      <button className="primary-button w-full" onClick={() => setReport(activity)}>
                        {activity.status === "pending" ? "Уточнить отчёт" : "Подать отчёт"}
                      </button>
                    )}
                    {activity.status === "registered" && !activity.can_submit_report && (
                      <p className="text-xs text-slate-500">Отчёт откроется {formatDate(activity.report_available_at)}.</p>
                    )}
                    {activity.status === "pending" && (
                      <p className="text-xs text-slate-500">Заявлено {activity.requested_hours} ч. Ожидаем решение координатора.</p>
                    )}
                  </div>
                ) : (
                  <button className="primary-button w-full" disabled={busy !== null} onClick={() => join(event.id)}>
                    {busy === event.id ? "Записываем…" : "Подать заявку"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      
      <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-100 p-6 text-sm text-slate-600">
        Ставка сохраняется при записи. Коэффициент по умолчанию — 1×; координатор может увеличить его при форс-мажоре, указав причину. Начисление выполняется после проверки.
      </div>
      
      {report && (
        <ReportDialog
          key={report.id}
          activity={report}
          onClose={() => setReport(null)}
          onSaved={() => {
            reload();
            setMessage("Отчёт отправлен. Баланс изменится после подтверждения координатором.");
          }}
        />
      )}
    </main>
  );
}