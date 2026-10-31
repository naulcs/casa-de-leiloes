import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Carrossel from "../Carrossel.jsx";
import { api } from "../api.js";
import { formatarReais } from "../format.js";

const SITUACOES = {
  leading: "Você está ganhando",
  outbid: "Superado",
  won: "Arrematado",
  won_pending: "Arrematado (aguardando liquidação)",
  lost: "Não arrematado",
  canceled: "Cancelado",
};

export default function Arremates() {
  const [lotes, setLotes] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    api("/me/bids")
      .then((dados) => {
        if (ativo) setLotes(dados.lots);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) return <p role="alert">{erro}</p>;
  if (!lotes) return <p>Carregando seus arremates...</p>;
  if (lotes.length === 0) {
    return <p>Você ainda não deu lances em nenhum lote.</p>;
  }

  return (
    <section>
      <h1>Meus arremates</h1>
      <Carrossel>
        {lotes.map((lote) => (
          <li key={lote.id} className="card">
            <Link to={`/lotes/${lote.id}`}>
              {lote.image_url && <img src={lote.image_url} alt={lote.title} />}
              <h2>{lote.title}</h2>
            </Link>
            <p>{SITUACOES[lote.outcome]}</p>
            <p>Seu maior lance: {formatarReais(lote.my_best_cents)}</p>
            <p>Lance final: {formatarReais(lote.current_bid_cents)}</p>
            {lote.receipt_code && (
              <Link to={`/comprovantes/${lote.receipt_code}`}>
                Ver comprovante
              </Link>
            )}
          </li>
        ))}
      </Carrossel>
    </section>
  );
}
