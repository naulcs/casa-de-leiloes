import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { formatCurrency } from "../format.js";

export default function Receipt() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/receipts/${code}`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [code]);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Carregando comprovante...</p>;

  const { receipt, lot, audit } = data;
  const isIntact = audit.intact && audit.matches_receipt;

  async function share() {
    const link = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Comprovante FormiLance", url: link });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt("Copie o link do comprovante:", link);
    }
  }

  return (
    <section className="receipt">
      <h1>Comprovante de arremate</h1>
      <p>
        <button type="button" onClick={share}>
          Compartilhar comprovante
        </button>{" "}
        {copied && <span>Link copiado.</span>}
      </p>
      {lot.image_url && <img src={lot.image_url} alt={lot.title} />}
      <h2>{lot.title}</h2>
      <p>{lot.attributes?.["Nome científico"]}</p>

      <dl>
        <dt>Vencedor</dt>
        <dd>{receipt.winner}</dd>
        <dt>Valor final</dt>
        <dd>{formatCurrency(receipt.amount_cents)}</dd>
        <dt>Lances no histórico</dt>
        <dd>{receipt.bid_count}</dd>
        <dt>Emitido em</dt>
        <dd>{new Date(receipt.issued_at).toLocaleString("pt-BR")}</dd>
        <dt>Código</dt>
        <dd>{receipt.code}</dd>
      </dl>

      <p>
        {isIntact
          ? "Histórico íntegro: confere com este comprovante."
          : "Atenção: o histórico não confere com este comprovante."}
      </p>
      {!audit.intact && (
        <ul>
          {audit.problems.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
