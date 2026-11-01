import { Link, useParams } from "react-router-dom";
import BidForm from "../components/BidForm.jsx";
import BidHistory from "../components/BidHistory.jsx";
import { rankBidders, useLotRoom } from "../hooks/useLotRoom.js";
import { formatBidCount, formatCurrency, formatDuration } from "../format.js";
import { useAuth } from "../useAuth.js";

export default function LotRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const room = useLotRoom(id, user?.id);
  const { lot, bids, isLeading, hasBid, hasWithdrawn, receipt, error } = room;

  async function confirmWithdraw() {
    if (
      window.confirm(
        "Desistir deste lote? Depois disso você não poderá mais dar lances nele.",
      )
    ) {
      await room.withdraw();
    }
  }

  if (!lot) {
    return error ? <p role="alert">{error}</p> : <p>Carregando lote...</p>;
  }

  const isLive = lot.status === "live";
  const isBidder = user?.role === "bidder";
  const canBid = lot.status !== "canceled" && isBidder && !hasWithdrawn;
  const isOutbid = isLive && isBidder && hasBid && !isLeading && !hasWithdrawn;
  const ranking = rankBidders(bids);
  const myPosition = ranking.findIndex((item) => item.mine) + 1;

  return (
    <section className="lot-room">
      <Link to="/">Voltar à vitrine</Link>
      {lot.bid_count > 0 && (
        <Link to={`/auditoria/${lot.id}`}>Ver auditoria do lote</Link>
      )}
      <h1>{lot.title}</h1>
      {lot.image_url && <img src={lot.image_url} alt={lot.title} />}
      <p>{lot.attributes?.["Nome científico"]}</p>

      <p>
        {isLive && `Termina em ${formatDuration(room.remaining)}`}
        {lot.status === "scheduled" && "Ainda não começou."}
        {lot.status === "ended" &&
          (lot.settled ? "Encerrado e liquidado." : "Encerrado.")}
        {lot.status === "canceled" && "Cancelado."}
      </p>
      <p>
        Lance atual:{" "}
        {formatCurrency(
          lot.bid_count > 0 ? lot.current_bid_cents : lot.starting_bid_cents,
        )}{" "}
        ({formatBidCount(lot.bid_count)})
      </p>

      {isLive && isLeading && <p role="status">Você está ganhando.</p>}
      {isOutbid && (
        <p role="alert">
          Você foi superado. Dê um novo lance para voltar a liderar.
        </p>
      )}
      {myPosition > 0 && (
        <p>
          Sua posição: {myPosition}º de {ranking.length}{" "}
          {ranking.length === 1 ? "licitante" : "licitantes"}.
        </p>
      )}
      {lot.status === "scheduled" && isBidder && (
        <p role="status">
          Este lote ainda não começou. Os lances abrem em{" "}
          {new Date(lot.starts_at).toLocaleString("pt-BR")}.
        </p>
      )}
      {lot.status === "ended" && isBidder && (
        <p role="status">
          Este lote já foi encerrado e não aceita mais lances.
        </p>
      )}
      {isLive && (
        <p>
          {room.watchers}{" "}
          {room.watchers === 1 ? "pessoa acompanhando" : "pessoas acompanhando"}{" "}
          este lote.
        </p>
      )}
      {room.notice && <p role="status">{room.notice}</p>}
      {receipt && (
        <p>
          <Link to={`/comprovantes/${receipt}`}>Ver comprovante</Link>
        </p>
      )}

      {canBid && (
        <BidForm minimumCents={lot.min_next_bid_cents} onBid={room.placeBid} />
      )}
      {isOutbid && (
        <button type="button" onClick={confirmWithdraw}>
          Desistir deste lote
        </button>
      )}
      {isLive && !user && (
        <p>
          <Link to="/entrar" state={{ from: `/lotes/${lot.id}` }}>
            Entre
          </Link>{" "}
          para dar lances.
        </p>
      )}
      {error && <p role="alert">{error}</p>}

      <h2>Histórico de lances</h2>
      <BidHistory bids={bids} />
    </section>
  );
}
