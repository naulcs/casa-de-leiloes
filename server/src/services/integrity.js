import { createHmac } from 'node:crypto';
import { config } from '../config.js';

if (!config.auditSecret) {
  throw new Error('Faltou AUDIT_SECRET no arquivo server/.env');
}

const hmac = (texto) => createHmac('sha256', config.auditSecret).update(texto).digest('hex');
const iso = (data) => new Date(data).toISOString();

export const genesisHash = (lot) =>
  hmac(['genesis', lot.id, lot.starting_bid_cents, lot.min_increment_cents, iso(lot.starts_at)].join('|'));

export const bidHash = (b) =>
  hmac(
    ['bid', b.lot_id, b.seq, b.bidder_id, b.amount_cents, iso(b.placed_at), iso(b.ends_at_after), b.prev_hash].join('|')
  );

export const headSeal = (lotId, bidCount, headHash) =>
  hmac(['head', lotId, bidCount, headHash].join('|'));

export const bidderAlias = (lotId, userId) =>
  `Licitante #${hmac(`alias|${lotId}|${userId}`).slice(0, 6).toUpperCase()}`;

export function sealNewLot(lot) {
  const head_hash = genesisHash(lot);
  return { head_hash, head_seal: headSeal(lot.id, 0, head_hash) };
}

export function verifyLot(lot, bids) {
  const problems = [];
  if (!lot.head_hash || !lot.head_seal) {
    problems.push('O lote não possui selo de integridade.');
  }

  let prevHash = genesisHash(lot);
  bids.forEach((bid, i) => {
    const esperado = i + 1;
    if (bid.seq !== esperado) {
      problems.push(`Sequência quebrada: esperado o lance #${esperado}, mas veio o #${bid.seq} (lance removido ou inserido).`);
    }
    if (bid.prev_hash !== prevHash) {
      problems.push(`Lance #${bid.seq}: não se liga ao lance anterior.`);
    }
    if (bidHash(bid) !== bid.hash) {
      problems.push(`Lance #${bid.seq}: o conteúdo foi alterado.`);
    }
    const anterior = bids[i - 1];
    const minimo = anterior ? anterior.amount_cents + lot.min_increment_cents : lot.starting_bid_cents;
    if (bid.amount_cents < minimo) {
      problems.push(`Lance #${bid.seq}: valor abaixo do mínimo permitido na época.`);
    }
    if (anterior && anterior.bidder_id === bid.bidder_id) {
      problems.push(`Lance #${bid.seq}: o líder cobriu o próprio lance.`);
    }
    prevHash = bid.hash;
  });

  const ultimo = bids.at(-1);
  const topoEsperado = ultimo ? ultimo.hash : genesisHash(lot);
  if (lot.bid_count !== bids.length) {
    problems.push(`O lote registra ${lot.bid_count} lances, mas o histórico tem ${bids.length}.`);
  }
  if (lot.head_hash !== topoEsperado) {
    problems.push('O fim do histórico não confere com o registro do lote.');
  }
  if (lot.head_hash && lot.head_seal !== headSeal(lot.id, lot.bid_count, lot.head_hash)) {
    problems.push('O selo do lote é inválido.');
  }
  if ((lot.current_bid_cents ?? null) !== (ultimo?.amount_cents ?? null)) {
    problems.push('O lance atual do lote não confere com o histórico.');
  }
  if ((lot.leader_id ?? null) !== (ultimo?.bidder_id ?? null)) {
    problems.push('O líder do lote não confere com o histórico.');
  }
  if (ultimo && new Date(lot.ends_at).getTime() !== new Date(ultimo.ends_at_after).getTime()) {
    problems.push('O horário de encerramento do lote foi alterado.');
  }
  return { intact: problems.length === 0, problems };
}