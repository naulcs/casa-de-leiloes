import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, getToken } from "../api.js";
import { useAuth } from "../auth.jsx";
import { contarLances, formatarReais, formatarTempo } from "../format.js";

function reaisParaCentavos(texto) {
  return Math.round(Number(String(texto).replace(",", ".")) * 100);
}

const DOIS_MINUTOS = 2 * 60 * 1000;

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
  const [temLance, setTemLance] = useState(false);
  const [desistiu, setDesistiu] = useState(false);
  const [pessoas, setPessoas] = useState(0);
  const [fim, setFim] = useState(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([api(`/lots/${id}`), api(`/lots/${id}/bids`)])
      .then(([dadosLote, dadosLances]) => {
        if (!ativo) return;
        setLote(dadosLote.lot);
        setLiderando(dadosLote.viewer.is_leader);
        setTemLance(dadosLote.viewer.has_bid);
        setDesistiu(dadosLote.viewer.withdrawn);
        setPessoas(dadosLote.watchers);
        setFim(dadosLote.fim);
        setComprovante(dadosLote.viewer.receipt_code);
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
        api(`/lots/${id}`).then((detalhe) => setFim(detalhe.fim));
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

    socket.on("lot:presence", (dados) => {
      if (dados.lot_id !== idNumerico) return;
      setPessoas(dados.watchers);
      api(`/lots/${id}`).then((dadosLote) => setFim(dadosLote.fim));
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
      setTemLance(true);
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
  async function desistir() {
    if (
      !window.confirm(
        "Desistir deste lote? Depois disso você não poderá mais dar lances nele.",
      )
    ) {
      return;
    }
    setErro("");
    try {
      await api(`/lots/${id}/withdraw`, { method: "POST" });
      setDesistiu(true);
      setAviso("Você desistiu deste lote.");
    } catch (falha) {
      setErro(falha.message);
    }
  }
  if (!lote) {
    return erro ? <p role="alert">{erro}</p> : <p>Carregando lote...</p>;
  }

  const restante = Date.parse(lote.ends_at) - (agora + desvio);
  const aoVivo = lote.status === "live";
  const podeDarLance =
    lote.status !== "canceled" && user?.role === "bidder" && !desistiu;
  const melhores = new Map();
  for (const lance of lances) {
    const atual = melhores.get(lance.bidder);
    if (!atual || lance.amount_cents > atual.valor) {
      melhores.set(lance.bidder, {
        valor: lance.amount_cents,
        meu: lance.mine,
      });
    }
  }
  const ranking = [...melhores.values()].sort((a, b) => b.valor - a.valor);
  const minhaPosicao = ranking.findIndex((item) => item.meu) + 1;
  const podeDesistir =
    aoVivo && user?.role === "bidder" && temLance && !liderando && !desistiu;

  return (
    <section className="sala">
      <Link to="/">Voltar à vitrine</Link>
      {lote.bid_count > 0 && (
        <Link to={`/auditoria/${lote.id}`}>Ver auditoria do lote</Link>
      )}
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
        ({contarLances(lote.bid_count)})
      </p>

      {aoVivo && liderando && <p>Você está ganhando.</p>}
      {minhaPosicao > 0 && (
        <p>
          Sua posição: {minhaPosicao}º de {ranking.length}{" "}
          {ranking.length === 1 ? "licitante" : "licitantes"}.
        </p>
      )}
      {lote.status === "scheduled" && user?.role === "bidder" && (
        <p role="status">
          Este lote ainda não começou. Os lances abrem em{" "}
          {new Date(lote.starts_at).toLocaleString("pt-BR")}.
        </p>
      )}
      {lote.status === "ended" && user?.role === "bidder" && (
        <p role="status">
          Este lote já foi encerrado e não aceita mais lances.
        </p>
      )}
      {aoVivo && <p>{pessoas} pessoas acompanhando este lote.</p>}
      {aoVivo && fim?.aviso_minuto_final && restante <= DOIS_MINUTOS && (
        <p role="status">
          Quando chegar no minuto final, o leilão será encerrado: não há mais
          participantes e só uma pessoa está ganhando. Ela vence.
        </p>
      )}
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
      {podeDesistir && (
        <button type="button" onClick={desistir}>
          Desistir deste lote
        </button>
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
