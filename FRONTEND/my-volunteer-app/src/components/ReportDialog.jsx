import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Notice } from "./ui";

export default function ReportDialog({ activity, onClose, onSaved }) {
  const dialog = useRef(null);
  const [hours, setHours] = useState(activity.requested_hours || "3.0");
  const [report, setReport] = useState(activity.report_text || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`activities/${activity.id}/report/`, {
        hours,
        report_text: report,
      });
      onSaved();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="report-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="rounded-3xl p-6 md:p-8 w-[95vw] max-w-xl border-0"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="eyebrow">Подтверждение участия</p>
          <h2 id="report-title" className="text-2xl font-bold">
            Отчёт на получение койнов
          </h2>
        </div>
        <button
          aria-label="Закрыть отчёт"
          className="text-2xl text-slate-500"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="font-semibold mb-2">{activity.event_title}</p>
      <p className="text-slate-500 mb-5">
        Ваша ставка: {activity.rate_snapshot} койнов/час. Койны начислят после
        проверки координатором.
      </p>
      <Notice>{error}</Notice>
      <form onSubmit={submit} className="space-y-5">
        <label className="field-label">
          Сколько часов вы работали
          <input
            autoFocus
            type="number"
            min="0.1"
            max="24"
            step="0.1"
            required
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className="field"
          />
        </label>
        <label className="field-label">
          Что вы делали
          <textarea
            required
            maxLength="3000"
            rows="4"
            value={report}
            onChange={(event) => setReport(event.target.value)}
            placeholder="Кратко опишите свою работу"
            className="field"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Отправляем…" : "Отправить отчёт"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
