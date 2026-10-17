export function Notice({ children, kind = "error" }) {
  return children ? (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-xl border p-4 text-sm mb-5 ${kind === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}
    >
      {children}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <p role="status" className="py-12 text-center text-slate-500">
      Загружаем данные…
    </p>
  );
}
export function ResourceError({ error, retry }) {
  return error ? (
    <Notice>
      {error}{" "}
      <button onClick={retry} className="underline ml-2">
        Повторить
      </button>
    </Notice>
  ) : null;
}
export function Stat({ label, value }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5">
      <div className="text-sm text-slate-500 mb-2">{label}</div>
      <div className="text-3xl font-bold text-[#1e4b8f]">{value}</div>
    </div>
  );
}
export function Coin({ value, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/coin.png" alt="" className="w-7 h-7 object-contain" />
      <strong>{value}</strong>
      <span>койнов</span>
    </span>
  );
}
const statusNames = {
  registered: "Записан",
  pending: "На проверке",
  approved: "Подтверждено",
  rejected: "Отклонено",
  issued: "Выдано",
  cancelled: "Отменено, койны возвращены",
};
export function Status({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${status === "approved" || status === "issued" ? "bg-green-100 text-green-800" : status === "rejected" ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}
    >
      {statusNames[status] || status}
    </span>
  );
}
