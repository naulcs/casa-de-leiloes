import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Carousel from "../Carousel.jsx";
import { api } from "../api.js";
import { formatCurrency } from "../format.js";

const OUTCOME_LABELS = {
  leading: "Você está ganhando",
  outbid: "Superado",
  won: "Arrematado",
  won_pending: "Arrematado (aguardando liquidação)",
  lost: "Não arrematado",
  canceled: "Cancelado",
};

export default function MyBids() {
  const [lots, setLots] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/me/bids")
      .then((data) => {
        if (active) setLots(data.lots);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!lots) return <p>Carregando seus arremates...</p>;
  if (lots.length === 0) {
    return <p>Você ainda não deu lances em nenhum lote.</p>;
  }

  return (
    <section>
      <h1>Meus arremates</h1>
      <Carousel>
        {lots.map((lot) => (
          <li key={lot.id} className="card">
            <Link to={`/lotes/${lot.id}`}>
              {lot.image_url && <img src={lot.image_url} alt={lot.title} />}
              <h2>{lot.title}</h2>
            </Link>
            <p>{OUTCOME_LABELS[lot.outcome]}</p>
            <p>Seu maior lance: {formatCurrency(lot.my_best_cents)}</p>
            <p>Lance final: {formatCurrency(lot.current_bid_cents)}</p>
            {lot.receipt_code && (
              <Link to={`/comprovantes/${lot.receipt_code}`}>
                Ver comprovante
              </Link>
            )}
          </li>
        ))}
      </Carousel>
    </section>
  );
}
