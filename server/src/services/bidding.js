import { withTransaction } from '../db/tx.js';
import { bidHash, genesisHash, headSeal } from './integrity.js';
import { nextMinBid } from './lots.js';
import { getWalletSummary } from './wallet.js';

const DOIS_MINUTOS = 2 * 60 * 1000;

export class BidRejected extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

const reais = (centavos) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function placeBid({ lotId, userId, amountCents }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT *, clock_timestamp() AS now FROM lots WHERE id = $1 FOR UPDATE',
      [lotId]
    );
    const lot = rows[0];
    if (!lot) throw new BidRejected('not_found', 'Lote não encontrado.');
    const agora = lot.now;

    if (lot.canceled_at) throw new BidRejected('canceled', 'Este lote foi cancelado.');
    if (agora < lot.starts_at) throw new BidRejected('not_started', 'Este lote ainda não começou.');
    if (lot.settled_at || agora >= lot.ends_at) {
      throw new BidRejected('ended', 'Este lote já foi encerrado.');
    }
    if (lot.leader_id === userId) {
      throw new BidRejected('already_leading', 'Você já está ganhando este lote.');
    }
    const minimo = nextMinBid(lot);
    if (amountCents < minimo) {
      throw new BidRejected(
        'below_minimum',
        `Lance abaixo do mínimo. O lance mínimo agora é ${reais(minimo)}.`,
        { minimum_cents: minimo }
      );
    }

    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const carteira = await getWalletSummary(userId, client);
    if (!carteira || carteira.available_cents < amountCents) {
      throw new BidRejected(
        'insufficient_funds',
        `Saldo insuficiente. Você tem ${reais(carteira?.available_cents ?? 0)} disponível.`,
        { available_cents: carteira?.available_cents ?? 0 }
      );
    }

    const estende = lot.ends_at - agora <= DOIS_MINUTOS;
    const endsAtAfter = estende ? new Date(lot.ends_at.getTime() + DOIS_MINUTOS) : lot.ends_at;

    if (lot.bid_count > 0 && !lot.head_hash) throw new Error('Lote com lances e sem selo.');
    const bid = {
      lot_id: lot.id,
      seq: lot.bid_count + 1,
      bidder_id: userId,
      amount_cents: amountCents,
      placed_at: agora,
      ends_at_after: endsAtAfter,
      prev_hash: lot.head_hash ?? genesisHash(lot),
    };
    bid.hash = bidHash(bid);

    await client.query(
      `INSERT INTO bids (lot_id, seq, bidder_id, amount_cents, placed_at, ends_at_after, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [bid.lot_id, bid.seq, bid.bidder_id, bid.amount_cents, bid.placed_at, bid.ends_at_after,
       bid.prev_hash, bid.hash]
    );
    await client.query(
      `UPDATE lots
       SET current_bid_cents = $2, leader_id = $3, bid_count = $4,
           head_hash = $5, head_seal = $6, ends_at = $7
       WHERE id = $1`,
      [lot.id, amountCents, userId, bid.seq, bid.hash, headSeal(lot.id, bid.seq, bid.hash), endsAtAfter]
    );

    return { bid, extended: estende, previousLeaderId: lot.leader_id };
  });
}