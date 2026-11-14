import { afterEach, beforeEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";
configure({ asyncUtilTimeout: 10000 });
const nativeFetch = globalThis.fetch;
const cookies = new Map();
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

// JSDOM provides the DOM, while HTTP and validation run against the real Vite/Django servers.
// Only this test adapter manages HttpOnly cookies; application code never reads sessionid.
beforeEach(() => {
  cookies.clear();
  document.cookie.split(";").forEach((cookie) => {
    document.cookie = `${cookie.split("=")[0].trim()}=; Max-Age=0; Path=/`;
  });
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = async (path, options = {}) => {
    const url = new URL(path, "http://127.0.0.1:5173");
    if (url.origin !== "http://127.0.0.1:5173")
      throw new Error("Tests only use the local application.");
    const headers = new Headers(options.headers);
    if (cookies.size)
      headers.set(
        "Cookie",
        [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      );
    if (options.method === "POST") headers.set("Origin", url.origin);
    const response = await nativeFetch(url, { ...options, headers });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0];
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator),
        value = pair.slice(separator + 1);
      if (/max-age=0/i.test(raw)) cookies.delete(name);
      else cookies.set(name, value);
      if (!/httponly/i.test(raw)) document.cookie = `${pair}; Path=/`;
    }
    return response;
  };
});
afterEach(() => {
  cleanup();
  globalThis.fetch = nativeFetch;
});
