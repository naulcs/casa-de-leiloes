import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Carousel from "../Carousel.jsx";
import AntColony from "../AntColony.jsx";
import { io } from "socket.io-client";
import { api, getToken } from "../api.js";
import { formatBidCount, formatCurrency, formatDuration } from "../format.js";
import { SECTIONS } from "../sections.js";

const SORTERS = {
  live: (a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at),
  scheduled: (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  ended: (a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at),
};

function matchesSearch(lot, term) {
  if (!term) return true;
  const text = `${lot.title} ${Object.values(lot.attributes ?? {}).join(" ")}`;
  return text.toLowerCase().includes(term.toLowerCase());
}

function Home() {
  const [liveCount, setLiveCount] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    api("/lots?status=live")
      .then((data) => setLiveCount(data.lots.length))
      .catch(() => setLiveCount(null));
  }, []);

  function moveLight(event) {
    const box = titleRef.current.getBoundingClientRect();
    titleRef.current.style.setProperty(
      "--light-x",
      `${event.clientX - box.left}px`,
    );
    titleRef.current.style.setProperty(
      "--light-y",
      `${event.clientY - box.top}px`,
    );
  }

  return (
    <section className="hero" onPointerMove={moveLight}>
      <AntColony />
      <div className="hero-labels">
        <span>Tempo real</span>
        <span>Lances selados</span>
        <span>Auditoria pública</span>
      </div>
      <h1 className="hero-title brand-title" ref={titleRef}>
        FormiLance
      </h1>
      <p className="hero-text">
        O leilão de formigas ao vivo. Cada lance é selado e cada lote pode ser
        auditado por qualquer pessoa.
      </p>
      <div className="hero-stats">
        <div>
          <strong>{liveCount ?? "–"}</strong>
          <span>lotes ao vivo agora</span>
        </div>
        <div>
          <strong>2 min</strong>
          <span>de prorrogação contra lance de última hora</span>
        </div>
      </div>
      <Link to="/ao-vivo" className="hero-cta">
        Ver lotes ao vivo
      </Link>
    </section>
  );
}

function LotList({ status }) {
  const section = SECTIONS.find((item) => item.value === status);
  const [searchText, setSearchText] = useState("");
  const [term, setTerm] = useState("");
  const [lots, setLots] = useState([]);
  const [loadedTerm, setLoadedTerm] = useState(null);
  const [error, setError] = useState("");
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const loading = loadedTerm !== term && !error;

  useEffect(() => {
    const timer = setTimeout(() => setTerm(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let active = true;
    let retry = null;
    const params = new URLSearchParams({ status });
    if (term) params.set("q", term);

    function load() {
      clearTimeout(retry);
      api(`/lots?${params}`)
        .then((data) => {
          if (!active) return;
          setLots(data.lots);
          setClockOffset(Date.parse(data.server_time) - Date.now());
          setError("");
          setLoadedTerm(term);
        })
        .catch(() => {
          if (!active) return;
          setError(
            "Não foi possível carregar os lotes agora. Tentando de novo em alguns segundos...",
          );
          retry = setTimeout(load, 5000);
        });
    }

    function updateLot(lotId, changes) {
      setLots((current) =>
        current.map((lot) => (lot.id === lotId ? { ...lot, ...changes } : lot)),
      );
    }

    const socket = io({ auth: { token: getToken() } });
    socket.on("connect", () => socket.emit("showcase:join"));
    socket.io.on("reconnect", load);
    socket.on("lot:update", (data) => {
      setClockOffset(Date.parse(data.server_time) - Date.now());
      setLots((current) => {
        const previous = current.find((lot) => lot.id === data.lot.id);
        const others = current.filter((lot) => lot.id !== data.lot.id);
        if (data.lot.status !== status || !matchesSearch(data.lot, term)) {
          return previous ? others : current;
        }
        const lot = {
          watchers: 0,
          my_receipt_code: null,
          ...previous,
          ...data.lot,
        };
        return [...others, lot].sort(SORTERS[status]);
      });
    });
    socket.on("lot:presence", (data) =>
      updateLot(data.lot_id, { watchers: data.watchers }),
    );
    socket.on("lot:won", (data) =>
      updateLot(data.lot_id, { my_receipt_code: data.receipt_code }),
    );
    load();

    return () => {
      active = false;
      clearTimeout(retry);
      socket.disconnect();
    };
  }, [status, term]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <h1>{section.label}</h1>

      <input
        type="search"
        aria-label="Buscar formiga"
        placeholder="Buscar formiga..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      {loading && <p>Carregando lotes...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && lots.length === 0 && (
        <p>
          {term
            ? `Nenhum lote encontrado para “${term}”.`
            : "Nenhum lote por aqui."}
        </p>
      )}

      <Carousel>
        {lots.map((lot) => {
          const isLive = lot.status === "live";
          const remaining = Date.parse(lot.ends_at) - (now + clockOffset);

          return (
            <li key={lot.id} className="card">
              <Link to={`/lotes/${lot.id}`}>
                {lot.image_url && <img src={lot.image_url} alt={lot.title} />}
                <h2>{lot.title}</h2>
              </Link>
              <p>
                Lance atual:{" "}
                {formatCurrency(
                  lot.bid_count > 0
                    ? lot.current_bid_cents
                    : lot.starting_bid_cents,
                )}
              </p>
              <p>{formatBidCount(lot.bid_count)}</p>
              {isLive && (
                <p>
                  Termina em {formatDuration(remaining)} · {lot.watchers} na
                  sala
                </p>
              )}
              {lot.my_receipt_code && (
                <Link to={`/comprovantes/${lot.my_receipt_code}`}>
                  Ver comprovante
                </Link>
              )}
            </li>
          );
        })}
      </Carousel>
    </section>
  );
}

export default function Showcase({ status }) {
  if (!status) return <Home />;
  return <LotList key={status} status={status} />;
}
