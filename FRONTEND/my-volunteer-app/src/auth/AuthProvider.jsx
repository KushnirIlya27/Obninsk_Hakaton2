import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { AuthContext } from "./context";

export default function AuthProvider({ children }) {
  const generation = useRef(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const sequence = ++generation.current;
    try {
      const profile = await api("me/");
      if (sequence === generation.current) {
        setUser(profile);
        setError("");
      }
      return profile;
    } catch (error) {
      if (error.status === 401) {
        if (sequence === generation.current) {
          setUser(null);
          setError("");
        }
        return null;
      }
      if (sequence === generation.current) setError(error.message);
      throw error;
    }
  }, []);
  useEffect(() => {
    // Remove credentials left by the old browser-only prototype.
    ["registeredUsers", "userLogin", "userRole"].forEach((key) =>
      localStorage.removeItem(key),
    );
    let active = true;
    const sequence = ++generation.current;
    api("me/")
      .then((profile) => {
        if (active && sequence === generation.current) {
          setUser(profile);
          setError("");
        }
      })
      .catch((error) => {
        if (active && sequence === generation.current) {
          setUser(null);
          setError(error.status === 401 ? "" : error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expire = () => {
      generation.current += 1;
      setUser(null);
    };
    window.addEventListener("session-expired", expire);
    const focus = () => refresh().catch(() => {});
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const signIn = async (username, password) => {
    await api("auth/login/", { username, password });
    return refresh();
  };
  const register = async (data) => {
    await api("auth/register/", data);
    return refresh();
  };
  const signOut = async () => {
    await api("auth/logout/", {});
    generation.current += 1;
    setUser(null);
    setError("");
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, signIn, register, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
