import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setCarregando(false);
      return;
    }
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setCarregando(false));
  }, []);

  async function guardarSessao(data) {
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function entrar(email, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return guardarSessao(data);
  }

  async function cadastrar(dados) {
    const data = await api("/auth/register", { method: "POST", body: dados });
    return guardarSessao(data);
  }

  function sair() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, carregando, entrar, cadastrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
