import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { formatarReais } from "../format.js";

export default function Comprovante() {
  const { code } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    api(`/receipts/${code}`)
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message);
      });
    return () => {
      ativo = false;
    };
  }, [code]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!dados) return <p>Carregando comprovante...</p>;

  const { receipt, lot, audit } = dados;
  const integro = audit.intact && audit.matches_receipt;

  return (
    <section className="comprovante">
      <h1>Comprovante de arremate</h1>
      {lot.image_url && <img src={lot.image_url} alt={lot.title} />}
      <h2>{lot.title}</h2>
      <p>{lot.attributes?.["Nome científico"]}</p>

      <dl>
        <dt>Vencedor</dt>
        <dd>{receipt.winner}</dd>
        <dt>Valor final</dt>
        <dd>{formatarReais(receipt.amount_cents)}</dd>
        <dt>Lances no histórico</dt>
        <dd>{receipt.bid_count}</dd>
        <dt>Emitido em</dt>
        <dd>{new Date(receipt.issued_at).toLocaleString("pt-BR")}</dd>
        <dt>Código</dt>
        <dd>{receipt.code}</dd>
      </dl>

      <p>
        {integro
          ? "Histórico íntegro: confere com este comprovante."
          : "Atenção: o histórico não confere com este comprovante."}
      </p>
      {!audit.intact && (
        <ul>
          {audit.problems.map((texto, i) => (
            <li key={i}>{texto}</li>
          ))}
        </ul>
      )}
    </section>
  );
}