import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatarReais } from "../format.js";

const ABAS = [
  { valor: "live", rotulo: "Ao vivo" },
  { valor: "scheduled", rotulo: "Agendados" },
  { valor: "ended", rotulo: "Encerrados" },
];

export default function Vitrine() {
  const [aba, setAba] = useState("live");
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [lotes, setLotes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const params = new URLSearchParams({ status: aba });
    if (termo) params.set("q", termo);
    setCarregando(true);
    api(`/lots?${params}`)
      .then((data) => setLotes(data.lots))
      .catch(() => setLotes([]))
      .finally(() => setCarregando(false));
  }, [aba, termo]);

  return (
    <section>
      <div className="abas">
        {ABAS.map((item) => (
          <button
            key={item.valor}
            type="button"
            onClick={() => setAba(item.valor)}
            disabled={aba === item.valor}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Buscar formiga..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {carregando && <p>Carregando lotes...</p>}
      {!carregando && lotes.length === 0 && <p>Nenhum lote nesta aba.</p>}

      <ul className="grade">
        {lotes.map((lote) => (
          <li key={lote.id} className="card">
            <Link to={`/lotes/${lote.id}`}>
              {lote.image_url && <img src={lote.image_url} alt={lote.title} />}
              <h2>{lote.title}</h2>
            </Link>
            <p>
              Lance atual:{" "}
              {formatarReais(
                lote.bid_count > 0
                  ? lote.current_bid_cents
                  : lote.starting_bid_cents,
              )}
            </p>
            <p>{lote.bid_count} lances</p>
            {lote.my_receipt_code && (
              <Link to={`/comprovantes/${lote.my_receipt_code}`}>
                Ver comprovante
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
