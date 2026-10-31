import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, getToken } from "../api.js";
import { useAuth } from "../auth.jsx";
import { formatarReais } from "../format.js";

function reaisParaCentavos(texto) {
  return Math.round(Number(String(texto).replace(",", ".")) * 100);
}

function formatarTempo(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const minutos = String(Math.floor(total / 60)).padStart(2, "0");
  const segundos = String(total % 60).padStart(2, "0");
  return `${minutos}:${segundos}`;
}

export default function Sala() {
  const { id } = useParams();
  const { user } = useAuth();
  const [lote, setLote] = useState(null);
  const [lances, setLances] = useState([]);
  const [liderando, setLiderando] = useState(false);
  const [desvio, setDesvio] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState("");
  const [comprovante, setComprovante] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([api(`/lots/${id}`), api(`/lots/${id}/bids`)])
      .then(([dadosLote, dadosLances]) => {
        if (!ativo) return;
        setLote(dadosLote.lot);
        setLiderando(dadosLote.viewer.is_leader);
        setDesvio(Date.parse(dadosLote.server_time) - Date.now());
        setLances(dadosLances.bids);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message);
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  useEffect(() => {
    const socket = io({ auth: { token: getToken() } });
    const idNumerico = Number(id);

    function recarregarLances() {
      api(`/lots/${id}/bids`).then((dados) => setLances(dados.bids));
    }

    socket.emit("lot:join", idNumerico);

    socket.on("lot:update", (dados) => {
      if (dados.lot.id !== idNumerico) return;
      setLote(dados.lot);
      setDesvio(Date.parse(dados.server_time) - Date.now());
      if (dados.event === "bid") {
        recarregarLances();
        if (dados.extended) {
          setAviso("Lance nos últimos 2 minutos: o tempo foi prorrogado.");
        }
      }
      if (dados.event === "canceled") setAviso("Este lote foi cancelado.");
    });

    socket.on("bid:outbid", (dados) => {
      if (dados.lot_id !== idNumerico) return;
      setLiderando(false);
      setAviso("Você foi superado. Dê um novo lance para voltar a liderar.");
    });

    socket.on("lot:won", (dados) => {
      if (dados.lot_id !== idNumerico) return;
      setComprovante(dados.receipt_code);
      setAviso("Parabéns, você ganhou este lote!");
    });

    return () => {
      socket.emit("lot:leave", idNumerico);
      socket.disconnect();
    };
  }, [id, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function darLance(evento) {
    evento.preventDefault();
    setErro("");
    const centavos = reaisParaCentavos(valor);
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    setEnviando(true);
    try {
      const dados = await api(`/lots/${id}/bids`, {
        method: "POST",
        body: { amount_cents: centavos },
      });
      setLote(dados.lot);
      setLiderando(true);
      setValor("");
      setAviso(
        dados.extended
          ? "Lance aceito. O tempo foi prorrogado em 2 minutos."
          : "Lance aceito. Você está liderando.",
      );
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!lote) {
    return erro ? <p role="alert">{erro}</p> : <p>Carregando lote...</p>;
  }

  const restante = Date.parse(lote.ends_at) - (agora + desvio);
  const aoVivo = lote.status === "live";
  const podeDarLance = aoVivo && user?.role === "bidder";

  return (
    <section className="sala">
      <Link to="/">Voltar à vitrine</Link>
      <h1>{lote.title}</h1>
      {lote.image_url && <img src={lote.image_url} alt={lote.title} />}
      <p>{lote.attributes?.["Nome científico"]}</p>

      <p>
        {lote.status === "live" && `Termina em ${formatarTempo(restante)}`}
        {lote.status === "scheduled" && "Ainda não começou."}
        {lote.status === "ended" &&
          (lote.settled ? "Encerrado e liquidado." : "Encerrado.")}
        {lote.status === "canceled" && "Cancelado."}
      </p>
      <p>
        Lance atual:{" "}
        {formatarReais(
          lote.bid_count > 0 ? lote.current_bid_cents : lote.starting_bid_cents,
        )}{" "}
        ({lote.bid_count} lances)
      </p>

      {aoVivo && liderando && <p>Você está ganhando.</p>}
      {aviso && <p role="status">{aviso}</p>}
      {comprovante && (
        <p>
          <Link to={`/comprovantes/${comprovante}`}>Ver comprovante</Link>
        </p>
      )}

      {podeDarLance && (
        <form onSubmit={darLance}>
          <label>
            Seu lance (R$)
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={`mínimo ${formatarReais(lote.min_next_bid_cents)}`}
              inputMode="decimal"
            />
          </label>
          <button type="submit" disabled={enviando}>
            Dar lance
          </button>
        </form>
      )}
      {aoVivo && !user && (
        <p>
          <Link to="/entrar">Entre</Link> para dar lances.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}

      <h2>Histórico de lances</h2>
      <ul>
        {lances.map((lance) => (
          <li key={lance.seq}>
            {lance.bidder}
            {lance.mine ? " (você)" : ""}: {formatarReais(lance.amount_cents)}
          </li>
        ))}
      </ul>
    </section>
  );
}