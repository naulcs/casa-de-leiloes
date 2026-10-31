import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const VAZIO = { name: "", email: "", password: "", role: "bidder" };

export default function Login() {
  const { entrar, cadastrar } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState("entrar");
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (modo === "entrar") await entrar(form.email, form.password);
      else await cadastrar(form);
      navigate("/");
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="login">
      <div className="abas">
        <button
          type="button"
          onClick={() => setModo("entrar")}
          disabled={modo === "entrar"}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setModo("cadastrar")}
          disabled={modo === "cadastrar"}
        >
          Cadastrar
        </button>
      </div>

      <form onSubmit={enviar}>
        {modo === "cadastrar" && (
          <>
            <label>
              Nome
              <input
                value={form.name}
                onChange={(e) => alterar("name", e.target.value)}
                required
              />
            </label>
            <label>
              Tipo de conta
              <select
                value={form.role}
                onChange={(e) => alterar("role", e.target.value)}
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
            onChange={(e) => alterar("email", e.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            minLength={6}
            value={form.password}
            onChange={(e) => alterar("password", e.target.value)}
            required
          />
        </label>

        {erro && <p role="alert">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </section>
  );
}