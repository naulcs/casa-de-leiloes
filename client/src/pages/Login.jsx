import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth.js";

const EMPTY_FORM = { name: "", email: "", password: "", role: "bidder" };

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from ?? "/";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
      navigate(destination, { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="login">
      {location.state?.from && (
        <p role="status">Entre na sua conta para continuar.</p>
      )}
      <div className="tabs">
        <button
          type="button"
          onClick={() => setMode("login")}
          disabled={mode === "login"}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          disabled={mode === "register"}
        >
          Cadastrar
        </button>
      </div>

      <form onSubmit={submit}>
        {mode === "register" && (
          <>
            <label>
              Nome
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>
            <label>
              Tipo de conta
              <select
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
              >
                <option value="bidder">Licitante</option>
                <option value="auctioneer">Leiloeiro</option>
              </select>
            </label>
          </>
        )}
        <label>
          E-mail
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            required
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}
