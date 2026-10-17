import { formatDate } from "./lib/format";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { useResource } from "./lib/useResource";
import {
  Coin,
  Loading,
  ResourceError,
  Stat,
  Status,
  Notice,
} from "./components/ui";
import ReportDialog from "./components/ReportDialog";

export default function VolunteerProfile() {
  const { user, refresh } = useAuth();
  const activities = useResource("me/activities/");
  const ledger = useResource("me/transactions/");
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const rows = activities.data?.results || [];
  const reload = () => {
    activities.reload();
    ledger.reload();
    refresh().catch(() => {});
  };
  return (
    <main className="page-shell space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Личный кабинет</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Мои часы и койны
          </h1>
          <p className="text-slate-500 mt-3">
            {user.name || user.username}
            {user.email && ` · ${user.email}`}
          </p>
        </div>
        <button className="secondary-button" onClick={reload}>
          Обновить
        </button>
      </div>
      <Notice kind="success">{message}</Notice>
      <div className="grid sm:grid-cols-3 gap-5">
        <Stat label="Баланс койнов" value={user.balance} />
        <Stat label="Подтверждено часов" value={user.confirmed_hours} />
        <Stat
          label="Подтверждено событий"
          value={rows.filter((row) => row.status === "approved").length}
        />
      </div>
      <ResourceError error={activities.error} retry={activities.reload} />
      <ResourceError error={ledger.error} retry={ledger.reload} />
      <section className="panel">
        <h2 className="text-2xl font-bold mb-6">Мои заявки и отчёты</h2>
        {activities.loading && <Loading />}
        {activities.data && !rows.length && (
          <p className="text-slate-500">
            Выберите первое мероприятие в каталоге.
          </p>
        )}
        <div className="space-y-4">
          {rows.map((activity) => (
            <article
              key={activity.id}
              className="border border-slate-100 rounded-2xl p-5"
            >
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h3 className="font-bold">{activity.event_title}</h3>
                <Status status={activity.status} />
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Ставка при записи: {activity.rate_snapshot} койнов/час
              </p>
              {activity.requested_hours && (
                <p className="text-sm mt-2">
                  Заявлено {activity.requested_hours} ч. {activity.report_text}
                </p>
              )}
              {activity.status === "approved" && (
                <p className="text-green-700 mt-3">
                  {activity.confirmed_hours} ч. × {activity.rate_snapshot} ×{" "}
                  {activity.coefficient} ={" "}
                  <strong>+{activity.coins_awarded} койнов</strong>
                </p>
              )}
              {activity.review_note && (
                <p className="text-sm mt-2 text-slate-600">
                  Комментарий координатора: {activity.review_note}
                </p>
              )}
              {activity.can_submit_report && (
                <button
                  className="primary-button mt-4"
                  onClick={() => setReport(activity)}
                >
                  {activity.status === "pending"
                    ? "Уточнить отчёт"
                    : "Подать отчёт"}
                </button>
              )}
              {activity.status === "registered" &&
                !activity.can_submit_report && (
                  <p className="text-sm text-slate-500 mt-3">
                    Отчёт будет доступен{" "}
                    {formatDate(activity.report_available_at)}.
                  </p>
                )}
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="flex flex-wrap justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold">История операций</h2>
          <Coin value={user.balance} />
        </div>
        {ledger.loading && <Loading />}
        {ledger.data && !ledger.data.results.length && (
          <p className="text-slate-500">
            Операции появятся после первого начисления.
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {(ledger.data?.results || []).map((entry) => (
            <div key={entry.id} className="py-4 flex items-start gap-5">
              <span
                className={`font-bold min-w-16 ${entry.amount > 0 ? "text-green-700" : "text-slate-700"}`}
              >
                {entry.amount > 0 ? "+" : ""}
                {entry.amount}
              </span>
              <div>
                <p className="text-sm">{entry.description}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDate(entry.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {report && (
        <ReportDialog
          key={report.id}
          activity={report}
          onClose={() => setReport(null)}
          onSaved={() => {
            reload();
            setMessage("Отчёт передан координатору.");
          }}
        />
      )}
    </main>
  );
}
