import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
export function useResource(path) {
  const [state, setState] = useState({ data: null, error: "" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api(path, undefined, { signal: controller.signal })
      .then((data) => setState({ data, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState((previous) => ({ ...previous, error: error.message }));
      });
    return () => controller.abort();
  }, [path, version]);
  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);
  return {
    ...state,
    loading: Boolean(path) && state.data === null && !state.error,
    reload,
  };
}
