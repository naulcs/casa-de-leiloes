import { Link } from "react-router-dom";
import { formatBidCount, formatCurrency } from "../format.js";

const STATUS = {
  scheduled: "Agendado",
  live: "Ao vivo",
  ended: "Encerrado",
  canceled: "Cancelado",
};

function describeResult(lot) {
  if (!lot.result) return "–";
  return lot.result.sold
    ? `Vendido por ${formatCurrency(lot.result.amount_cents)}`
    : "Sem venda";
}

export default function MyLots({ lots, onCancel }) {
  if (lots === null) return <p>Carregando lotes...</p>;
  if (lots.length === 0) return <p>Nenhum lote criado ainda.</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Lote</th>
            <th>Situação</th>
            <th>Lance atual</th>
            <th>Resultado</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td>
                <Link to={`/lotes/${lot.id}`}>{lot.title}</Link>
              </td>
              <td>{STATUS[lot.status]}</td>
              <td>
                {formatCurrency(
                  lot.bid_count > 0
                    ? lot.current_bid_cents
                    : lot.starting_bid_cents,
                )}
                <small> ({formatBidCount(lot.bid_count)})</small>
              </td>
              <td>{describeResult(lot)}</td>
              <td>
                {(lot.status === "scheduled" || lot.status === "live") && (
                  <button type="button" onClick={() => onCancel(lot)}>
                    Cancelar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
