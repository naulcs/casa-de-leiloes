import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatCurrency, reaisToCents } from "../format.js";

const TRANSACTION_LABELS = {
  deposit: "Depósito",
  purchase: "Compra de lote",
  sale: "Venda de lote",
};

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api("/wallet")
      .then((data) => setWallet(data))
      .catch((failure) => setError(failure.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function deposit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const cents = reaisToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setSubmitting(true);
    try {
      const summary = await api("/wallet/deposit", {
        method: "POST",
        body: { amount_cents: cents },
      });
      setAmount("");
      setMessage(
        `Depósito de ${formatCurrency(cents)} feito. Saldo disponível: ${formatCurrency(summary.available_cents)}.`,
      );
      load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!wallet) {
    return error ? <p role="alert">{error}</p> : <p>Carregando carteira...</p>;
  }

  return (
    <section>
      <h1>Minha carteira</h1>
      <dl>
        <dt>Saldo total</dt>
        <dd>{formatCurrency(wallet.total_cents)}</dd>
        <dt>Comprometido em lances</dt>
        <dd>{formatCurrency(wallet.committed_cents)}</dd>
        <dt>Disponível</dt>
        <dd>{formatCurrency(wallet.available_cents)}</dd>
      </dl>

      <form onSubmit={deposit}>
        <label>
          Valor do depósito (R$)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Depositando..." : "Depositar"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h2>Extrato</h2>
      {wallet.transactions.length === 0 ? (
        <p>Nenhuma movimentação ainda.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Lote</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {wallet.transactions.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString("pt-BR")}</td>
                  <td>{TRANSACTION_LABELS[item.type]}</td>
                  <td>
                    {item.lot_id ? (
                      <Link to={`/lotes/${item.lot_id}`}>
                        Lote {item.lot_id}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td>{formatCurrency(item.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
