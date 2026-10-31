import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { formatarReais, formatarTempo } from "../format.js";

const ABAS = [
  { valor: "live", rotulo: "Ao vivo" },
  { valor: "scheduled", rotulo: "Agendados" },
  { valor: "ended", rotulo: "Encerrados" },
];

const DOIS_MINUTOS = 2 * 60 * 1000;

export default function Vitrine() {
  const [aba, setAba] = useState("live");
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [lotes, setLotes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [desvio, setDesvio] = useState(0);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const params = new URLSearchParams({ status: aba });
    if (termo) params.set("q", termo);

    function carregar() {
      api(`/lots?${params}`)
        .then((data) => {
          setLotes(data.lots);
          setDesvio(Date.parse(data.server_time) - Date.now());
        })
        .catch(() => {})
        .finally(() => setCarregando(false));
    }

    setCarregando(true);
    carregar();
    const timer = setInterval(carregar, 5000);
    return () => clearInterval(timer);
  }, [aba, termo]);

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        {lotes.map((lote) => {
          const aoVivo = lote.status === "live";
          const restante = Date.parse(lote.ends_at) - (agora + desvio);
          const aviso =
            aoVivo && lote.aviso_minuto_final && restante <= DOIS_MINUTOS;

          return (
            <li key={lote.id} className="card">
              <Link to={`/lotes/${lote.id}`}>
                {lote.image_url && (
                  <img src={lote.image_url} alt={lote.title} />
                )}
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
              {aoVivo && (
                <p>
                  Termina em {formatarTempo(restante)} · {lote.watchers} na sala
                </p>
              )}
              {aviso && (
                <p role="status">
                  Será encerrado no minuto final: não há mais participantes e só
                  uma pessoa está ganhando.
                </p>
              )}
              {lote.my_receipt_code && (
                <Link to={`/comprovantes/${lote.my_receipt_code}`}>
                  Ver comprovante
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
