import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Carrossel from "../Carrossel.jsx";
import Formigueiro from "../Formigueiro.jsx";
import { api } from "../api.js";
import { contarLances, formatarReais, formatarTempo } from "../format.js";

export const SECOES = [
  { valor: "live", rotulo: "Ao vivo", caminho: "/ao-vivo" },
  { valor: "scheduled", rotulo: "Agendados", caminho: "/agendados" },
  { valor: "ended", rotulo: "Encerrados", caminho: "/encerrados" },
];

const DOIS_MINUTOS = 2 * 60 * 1000;

function Inicio() {
  const [aoVivo, setAoVivo] = useState(null);
  const titulo = useRef(null);

  useEffect(() => {
    api("/lots?status=live")
      .then((data) => setAoVivo(data.lots.length))
      .catch(() => setAoVivo(null));
  }, []);

  function moverLuz(evento) {
    const caixa = titulo.current.getBoundingClientRect();
    titulo.current.style.setProperty(
      "--luz-x",
      `${evento.clientX - caixa.left}px`,
    );
    titulo.current.style.setProperty(
      "--luz-y",
      `${evento.clientY - caixa.top}px`,
    );
  }

  return (
    <section className="hero" onPointerMove={moverLuz}>
      <Formigueiro />
      <div className="hero-rotulos">
        <span>Tempo real</span>
        <span>Lances selados</span>
        <span>Auditoria pública</span>
      </div>
      <h1 className="hero-titulo letreiro" ref={titulo}>
        FormiLance
      </h1>
      <p className="hero-texto">
        O leilão de formigas ao vivo. Cada lance é selado e cada lote pode ser
        auditado por qualquer pessoa.
      </p>
      <div className="hero-numeros">
        <div>
          <strong>{aoVivo ?? "–"}</strong>
          <span>lotes ao vivo agora</span>
        </div>
        <div>
          <strong>2 min</strong>
          <span>de prorrogação contra lance de última hora</span>
        </div>
      </div>
      <Link to="/ao-vivo" className="hero-chamada">
        Ver lotes ao vivo
      </Link>
    </section>
  );
}

function ListaDeLotes({ status }) {
  const secao = SECOES.find((item) => item.valor === status);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [lotes, setLotes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [desvio, setDesvio] = useState(0);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const params = new URLSearchParams({ status });
    if (termo) params.set("q", termo);

    function carregar() {
      api(`/lots?${params}`)
        .then((data) => {
          setLotes(data.lots);
          setDesvio(Date.parse(data.server_time) - Date.now());
          setErro("");
        })
        .catch(() =>
          setErro(
            "Não foi possível carregar os lotes agora. Tentando de novo em alguns segundos...",
          ),
        )
        .finally(() => setCarregando(false));
    }

    setCarregando(true);
    carregar();
    const timer = setInterval(carregar, 5000);
    return () => clearInterval(timer);
  }, [status, termo]);

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <h1>{secao.rotulo}</h1>

      <input
        type="search"
        placeholder="Buscar formiga..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {carregando && <p>Carregando lotes...</p>}
      {erro && <p role="alert">{erro}</p>}
      {!carregando && !erro && lotes.length === 0 && (
        <p>Nenhum lote por aqui.</p>
      )}

      <Carrossel>
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
              <p>{contarLances(lote.bid_count)}</p>
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
      </Carrossel>
    </section>
  );
}

export default function Vitrine({ status }) {
  if (!status) return <Inicio />;
  return <ListaDeLotes key={status} status={status} />;
}
