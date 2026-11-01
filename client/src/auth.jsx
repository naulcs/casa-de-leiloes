import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";
import { AuthContext } from "./useAuth.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function saveSession(data) {
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return saveSession(data);
  }

  async function register(payload) {
    const data = await api("/auth/register", { method: "POST", body: payload });
    return saveSession(data);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
