import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatarReais, reaisParaCentavos } from "../format.js";

const TIPOS = {
  deposit: "Depósito",
  purchase: "Compra de lote",
  sale: "Venda de lote",
};

export default function Carteira() {
  const [carteira, setCarteira] = useState(null);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  function carregar() {
    api("/wallet")
      .then((dados) => setCarteira(dados))
      .catch((falha) => setErro(falha.message));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function depositar(evento) {
    evento.preventDefault();
    setErro("");
    const centavos = reaisParaCentavos(valor);
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setEnviando(true);
    try {
      await api("/wallet/deposit", {
        method: "POST",
        body: { amount_cents: centavos },
      });
      setValor("");
      carregar();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!carteira) {
    return erro ? <p role="alert">{erro}</p> : <p>Carregando carteira...</p>;
  }

  return (
    <section>
      <h1>Minha carteira</h1>
      <dl>
        <dt>Saldo total</dt>
        <dd>{formatarReais(carteira.total_cents)}</dd>
        <dt>Comprometido em lances</dt>
        <dd>{formatarReais(carteira.committed_cents)}</dd>
        <dt>Disponível</dt>
        <dd>{formatarReais(carteira.available_cents)}</dd>
      </dl>

      <form onSubmit={depositar}>
        <label>
          Valor do depósito (R$)
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button type="submit" disabled={enviando}>
          Depositar
        </button>
      </form>
      {erro && <p role="alert">{erro}</p>}

      <h2>Extrato</h2>
      {carteira.transactions.length === 0 && <p>Nenhuma movimentação ainda.</p>}
      <ul>
        {carteira.transactions.map((item) => (
          <li key={item.id}>
            {new Date(item.created_at).toLocaleString("pt-BR")} —{" "}
            {TIPOS[item.type]}
            {item.lot_id && (
              <>
                {" "}
                (<Link to={`/lotes/${item.lot_id}`}>lote {item.lot_id}</Link>)
              </>
            )}
            : {formatarReais(item.amount_cents)}
          </li>
        ))}
      </ul>
    </section>
  );
}
