import { withTransaction } from "../db/tx.js";
import { bidHash, genesisHash, headSeal } from "./integrity.js";
import { nextMinBid, extendEnd } from "./lots.js";
import { getWalletSummary } from "./wallet.js";

export class BidRejected extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const formatCurrency = (cents) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function placeBid({ lotId, userId, amountCents }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT *, clock_timestamp() AS now FROM lots WHERE id = $1 FOR UPDATE",
      [lotId],
    );
    const lot = rows[0];
    if (!lot) throw new BidRejected("not_found", "Lote não encontrado.");
    const now = lot.now;

    if (lot.canceled_at)
      throw new BidRejected("canceled", "Este lote foi cancelado.");
    if (now < lot.starts_at)
      throw new BidRejected("not_started", "Este lote ainda não começou.");
    if (lot.settled_at || now >= lot.ends_at) {
      throw new BidRejected("ended", "Este lote já foi encerrado.");
    }
    if (lot.leader_id === userId) {
      throw new BidRejected(
        "already_leading",
        "Você já está ganhando este lote.",
      );
    }
    const { rows: hasWithdrawn } = await client.query(
      "SELECT 1 FROM withdrawals WHERE lot_id = $1 AND user_id = $2",
      [lotId, userId],
    );
    if (hasWithdrawn[0]) {
      throw new BidRejected("withdrawn", "Você desistiu deste lote.");
    }
    const minimum = nextMinBid(lot);
    if (amountCents < minimum) {
      throw new BidRejected(
        "below_minimum",
        `Lance abaixo do mínimo. O lance mínimo agora é ${formatCurrency(minimum)}.`,
        { minimum_cents: minimum },
      );
    }

    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
      userId,
    ]);
    const wallet = await getWalletSummary(userId, client);
    if (!wallet || wallet.available_cents < amountCents) {
      throw new BidRejected(
        "insufficient_funds",
        `Saldo insuficiente. Você tem ${formatCurrency(wallet?.available_cents ?? 0)} disponível.`,
        { available_cents: wallet?.available_cents ?? 0 },
      );
    }

    const endsAtAfter = extendEnd(lot.ends_at, now);
    const wasExtended = endsAtAfter > lot.ends_at;

    if (lot.bid_count > 0 && !lot.head_hash)
      throw new Error("Lote com lances e sem selo.");
    const bid = {
      lot_id: lot.id,
      seq: lot.bid_count + 1,
      bidder_id: userId,
      amount_cents: amountCents,
      placed_at: now,
      ends_at_after: endsAtAfter,
      prev_hash: lot.head_hash ?? genesisHash(lot),
    };
    bid.hash = bidHash(bid);

    await client.query(
      `INSERT INTO bids (lot_id, seq, bidder_id, amount_cents, placed_at, ends_at_after, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        bid.lot_id,
        bid.seq,
        bid.bidder_id,
        bid.amount_cents,
        bid.placed_at,
        bid.ends_at_after,
        bid.prev_hash,
        bid.hash,
      ],
    );
    await client.query(
      `UPDATE lots
       SET current_bid_cents = $2, leader_id = $3, bid_count = $4,
           head_hash = $5, head_seal = $6, ends_at = $7
       WHERE id = $1`,
      [
        lot.id,
        amountCents,
        userId,
        bid.seq,
        bid.hash,
        headSeal(lot.id, bid.seq, bid.hash),
        endsAtAfter,
      ],
    );

    return { bid, extended: wasExtended, previousLeaderId: lot.leader_id };
  });
}

export function withdrawFromLot({ lotId, userId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT *, clock_timestamp() AS now FROM lots WHERE id = $1 FOR UPDATE",
      [lotId],
    );
    const lot = rows[0];
    if (!lot) throw new BidRejected("not_found", "Lote não encontrado.");
    if (lot.canceled_at)
      throw new BidRejected("canceled", "Este lote foi cancelado.");
    if (lot.settled_at || lot.now >= lot.ends_at) {
      throw new BidRejected("ended", "Este lote já foi encerrado.");
    }
    if (lot.leader_id === userId) {
      throw new BidRejected(
        "leading",
        "Quem está ganhando não pode desistir do lote.",
      );
    }

    const { rows: participated } = await client.query(
      "SELECT 1 FROM bids WHERE lot_id = $1 AND bidder_id = $2 LIMIT 1",
      [lotId, userId],
    );
    if (!participated[0]) {
      throw new BidRejected(
        "not_bidder",
        "Você ainda não deu lances neste lote.",
      );
    }

    const { rows: alreadyWithdrew } = await client.query(
      "SELECT 1 FROM withdrawals WHERE lot_id = $1 AND user_id = $2",
      [lotId, userId],
    );
    if (alreadyWithdrew[0]) {
      throw new BidRejected("withdrawn", "Você já desistiu deste lote.");
    }

    await client.query(
      "INSERT INTO withdrawals (lot_id, user_id) VALUES ($1, $2)",
      [lotId, userId],
    );
  });
}
