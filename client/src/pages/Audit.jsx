import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { formatCurrency } from "../format.js";

export default function Audit() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api(`/audit/${id}`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Verificando o histórico...</p>;

  const { intact, problems, method, lot, bids } = data;

  return (
    <section className="audit">
      <Link to={`/lotes/${lot.id}`}>Voltar ao lote</Link>
      <h1>Auditoria: {lot.title}</h1>

      <p>
        {intact
          ? "Histórico íntegro. Nenhum lance foi alterado, removido ou inserido."
          : "Histórico com problemas."}
      </p>
      {!intact && (
        <ul>
          {problems.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      )}

      <h2>Como funciona a verificação</h2>
      <p>{method}</p>
      <p>
        Selo do último lance: <code>{lot.head_hash}</code>
      </p>
      <p>Lances registrados: {lot.bid_count}</p>

      <h2>Lances em ordem</h2>
      {bids.length === 0 ? (
        <p>
          Este lote ainda não recebeu lances. A verificação confere o selo de
          abertura do lote.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Licitante</th>
                <th>Valor</th>
                <th>Horário</th>
                <th>Selo</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.seq}>
                  <td>{bid.seq}</td>
                  <td>{bid.bidder}</td>
                  <td>{formatCurrency(bid.amount_cents)}</td>
                  <td>{new Date(bid.placed_at).toLocaleString("pt-BR")}</td>
                  <td>
                    <code>{bid.hash.slice(0, 16)}...</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
