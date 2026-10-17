import { formatDate } from "./lib/format";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth/useAuth";
import { api, requestKey } from "./lib/api";
import { useResource } from "./lib/useResource";
import { Coin, Loading, Notice, ResourceError, Status } from "./components/ui";

function PurchaseDialog({ reward, balance, busy, error, onClose, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="purchase-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="rounded-3xl p-8 w-[95vw] max-w-lg border-0"
    >
      <h2 id="purchase-title" className="text-2xl font-bold mb-4">
        Подтвердить обмен
      </h2>
      <p className="mb-2">{reward.title}</p>
      <p className="text-slate-600 mb-5">
        Спишется {reward.price} койнов. Остаток после обмена:{" "}
        {balance - reward.price}.
      </p>
      <Notice>{error}</Notice>
      <p className="text-sm text-slate-500 mb-6">
        Это учебное поощрение. Запрос на условную выдачу увидит координатор.
      </p>
      <div className="flex justify-end gap-3">
        <button className="secondary-button" disabled={busy} onClick={onClose}>
          Отмена
        </button>
        <button className="primary-button" disabled={busy} onClick={onConfirm}>
          {busy ? "Оформляем…" : "Подтвердить обмен"}
        </button>
      </div>
    </dialog>
  );
}

export default function VolunteerRewards() {
  const { user, refresh } = useAuth();
  const rewards = useResource("rewards/");
  const requests = useResource("me/redemptions/");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    for (const receipt of requests.data?.results || []) {
      const storageKey = `purchase:${user.id}:${receipt.reward_id}`;
      if (sessionStorage.getItem(storageKey) === receipt.request_key)
        sessionStorage.removeItem(storageKey);
    }
  }, [requests.data, user.id]);
  async function cancelRequest(id) {
    if (!window.confirm("Отменить запрос? Списанные койны вернутся на баланс.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`redemptions/${id}/cancel/`, {});
      setMessage("Запрос отменён. Койны возвращены.");
      requests.reload();
      await refresh();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  async function buy() {
    setBusy(true);
    setError("");
    const storageKey = `purchase:${user.id}:${selected.id}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = requestKey();
      sessionStorage.setItem(storageKey, key);
    }
    try {
      const receipt = await api(`rewards/${selected.id}/purchase/`, {
        request_key: key,
      });
      sessionStorage.removeItem(storageKey);
      setSelected(null);
      setMessage(
        `Запрос №${receipt.id} оформлен. Координатор увидит его в списке выдачи.`,
      );
      requests.reload();
      await refresh().catch(() =>
        setMessage(
          `Запрос №${receipt.id} оформлен. Для обновления баланса нажмите «Обновить».`,
        ),
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page-shell">
      <section className="hero-panel mb-10">
        <div>
          <p className="eyebrow text-[#8cd646]">Спасибо за ваш вклад</p>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            Добрые дела
            <br />
            становятся подарками
          </h1>
          <p className="text-blue-100">
            Обменивайте подтверждённые часы на учебные поощрения.
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 border border-white/20 p-6 min-w-56">
          <p className="text-blue-100 text-sm mb-3">Доступно для обмена</p>
          <Coin value={user.balance} className="text-2xl" />
        </div>
      </section>
      <div className="flex justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Поощрения</h2>
        <button
          className="secondary-button"
          onClick={() => {
            rewards.reload();
            requests.reload();
            refresh().catch(() => {});
          }}
        >
          Обновить
        </button>
      </div>
      <Notice kind="success">{message}</Notice>
      {!selected && <Notice>{error}</Notice>}
      <ResourceError error={rewards.error} retry={rewards.reload} />
      <ResourceError error={requests.error} retry={requests.reload} />
      {rewards.loading && <Loading />}
      {rewards.data && !rewards.data.results.length && (
        <p className="panel text-slate-500">Пока нет доступных поощрений.</p>
      )}
      <div className="grid md:grid-cols-3 gap-6">
        {(rewards.data?.results || []).map((reward, index) => (
          <article
            className="panel p-0 overflow-hidden flex flex-col"
            key={reward.id}
          >
            <div
              className={`h-40 flex items-center justify-center ${["bg-green-50", "bg-blue-50", "bg-orange-50"][index % 3]}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-20 h-20 text-[#1e4b8f]"
                aria-hidden="true"
              >
                <path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" />
              </svg>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <h3 className="font-bold text-xl mb-3">{reward.title}</h3>
              <p className="text-sm text-slate-500 mb-5 flex-1">
                {reward.description}
              </p>
              <Coin value={reward.price} className="mb-5 text-xl" />
              <button
                className="primary-button w-full"
                disabled={user.balance < reward.price}
                onClick={() => {
                  setSelected(reward);
                  setError("");
                }}
              >
                {user.balance < reward.price
                  ? "Недостаточно койнов"
                  : "Обменять"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="panel mt-8">
        <h2 className="text-2xl font-bold mb-5">Мои запросы на выдачу</h2>
        {requests.loading && <Loading />}
        {requests.data && !requests.data.results.length && (
          <p className="text-slate-500">После обмена здесь появится запрос.</p>
        )}
        <div className="divide-y divide-slate-100">
          {(requests.data?.results || []).map((request) => (
            <div
              className="py-4 flex flex-wrap justify-between items-center gap-3"
              key={request.id}
            >
              <div>
                <p className="font-semibold">{request.reward_title}</p>
                <p className="text-sm text-slate-500">
                  {request.price} койнов · {formatDate(request.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Status status={request.status} />
                {request.status === "pending" && <button className="secondary-button" disabled={busy}
                  onClick={() => cancelRequest(request.id)}>Отменить и вернуть койны</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
      {selected && (
        <PurchaseDialog
          key={selected.id}
          reward={selected}
          balance={user.balance}
          busy={busy}
          error={error}
          onClose={() => setSelected(null)}
          onConfirm={buy}
        />
      )}
    </main>
  );
}
