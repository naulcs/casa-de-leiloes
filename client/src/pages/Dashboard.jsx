import { useCallback, useEffect, useState } from "react";
import AntSearch from "../components/AntSearch.jsx";
import LotForm from "../components/LotForm.jsx";
import MyLots from "../components/MyLots.jsx";
import { api } from "../api.js";
import { formatCurrency } from "../format.js";

export default function Dashboard() {
  const [lots, setLots] = useState(null);
  const [totalReceived, setTotalReceived] = useState(0);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLots = useCallback(() => {
    api("/lots/mine")
      .then((data) => {
        setLots(data.lots);
        setTotalReceived(data.total_received_cents);
      })
      .catch((failure) => setError(failure.message));
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  function selectAnt(ant) {
    setSelected(ant);
    setMessage("");
  }

  function lotCreated(lot) {
    setSelected(null);
    setMessage(`Lote "${lot.title}" criado.`);
    loadLots();
  }

  async function cancelLot(lot) {
    const question =
      lot.bid_count > 0
        ? `Cancelar o lote "${lot.title}"? Ele já tem lances: o valor reservado de quem está ganhando será devolvido na hora.`
        : `Cancelar o lote "${lot.title}"?`;
    if (!window.confirm(question)) return;
    setError("");
    setMessage("");
    try {
      const data = await api(`/lots/${lot.id}/cancel`, { method: "POST" });
      setMessage(
        data.refunded_cents > 0
          ? `Lote cancelado. ${formatCurrency(data.refunded_cents)} devolvidos ao saldo disponível de quem liderava.`
          : "Lote cancelado.",
      );
      loadLots();
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <section>
      <h1>Painel do leiloeiro</h1>
      <dl>
        <dt>Total recebido em vendas</dt>
        <dd>{formatCurrency(totalReceived)}</dd>
      </dl>

      <h2>Criar lote</h2>
      <AntSearch onSelect={selectAnt} />
      {selected && <LotForm ant={selected} onCreated={lotCreated} />}

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h2>Meus lotes</h2>
      <MyLots lots={lots} onCancel={cancelLot} />
    </section>
  );
}
