import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { formatarReais } from "../format.js";

export default function Auditoria() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    api(`/audit/${id}`)
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message);
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!dados) return <p>Verificando o histórico...</p>;

  const { intact, problems, method, lot, bids } = dados;

  return (
    <section className="auditoria">
      <Link to={`/lotes/${lot.id}`}>Voltar ao lote</Link>
      <h1>Auditoria: {lot.title}</h1>

      <p>
        {intact
          ? "Histórico íntegro. Nenhum lance foi alterado, removido ou inserido."
          : "Histórico com problemas."}
      </p>
      {!intact && (
        <ul>
          {problems.map((texto, i) => (
            <li key={i}>{texto}</li>
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
          {bids.map((lance) => (
            <tr key={lance.seq}>
              <td>{lance.seq}</td>
              <td>{lance.bidder}</td>
              <td>{formatarReais(lance.amount_cents)}</td>
              <td>{new Date(lance.placed_at).toLocaleString("pt-BR")}</td>
              <td>
                <code>{lance.hash.slice(0, 16)}...</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}