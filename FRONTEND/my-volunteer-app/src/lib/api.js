export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

let csrfRequest;
function csrfCookie() {
  return document.cookie
    .split("; ")
    .find((value) => value.startsWith("csrftoken="))
    ?.split("=")
    .slice(1)
    .join("=");
}
async function ensureCsrf(force = false) {
  if (!force && csrfCookie()) return csrfCookie();
  if (!csrfRequest) {
    csrfRequest = fetch("/api/auth/csrf/", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok)
          throw new ApiError(
            "Сервер недоступен. Проверьте запуск Django.",
            response.status,
          );
        return (await response.json()).csrfToken;
      })
      .finally(() => {
        csrfRequest = undefined;
      });
  }
  return csrfRequest;
}

export async function api(path, body, options = {}) {
  const write = body !== undefined;
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method: write ? "POST" : "GET",
      credentials: "same-origin",
      signal: options.signal,
      headers: write
        ? {
            "Content-Type": "application/json",
            "X-CSRFToken": await ensureCsrf(),
          }
        : {},
      body: write ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError" || error instanceof ApiError) throw error;
    throw new ApiError(
      "Нет связи с сервером. Проверьте Django и повторите запрос.",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "Сервер вернул неожиданный ответ. Проверьте запуск Django и настройки proxy.",
      response.status,
    );
  }
  // A CSRF rejection happens before the view: retrying it cannot duplicate an operation.
  if (
    write &&
    response.status === 403 &&
    data.code === "csrf_failed" &&
    !options.csrfRetried
  ) {
    await ensureCsrf(true);
    return api(path, body, { ...options, csrfRetried: true });
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      data.error || "Не удалось выполнить запрос.",
      response.status,
      data.fields,
    );
  }
  return data;
}

export function fieldMessages(error) {
  const result = {};
  for (const [name, values] of Object.entries(error.fields || {})) {
    result[name] = values
      .map((value) => (typeof value === "string" ? value : value.message))
      .join(" ");
  }
  return result;
}

export function requestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
