import { Router } from 'express';
import { pool } from '../db/pool.js';
import { bidderAlias, verifyLot } from '../services/integrity.js';
import { LOT_FIELDS } from '../services/lots.js';

export const auditRouter = Router();

const METODO =
  'Cada lance recebe um selo (HMAC-SHA256) calculado com todos os seus dados e com o selo do lance ' +
  'anterior, formando uma corrente. O lote guarda o selo do último lance e a contagem de lances, também ' +
  'assinados. O segredo da assinatura fica fora do banco: quem alterar, remover ou inserir um lance direto ' +
  'no banco não consegue recalcular os selos, e a verificação abaixo aponta a diferença.';

auditRouter.get('/:id', async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.id)) return res.status(404).json({ error: 'Lote não encontrado.' });
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id, head_hash, head_seal FROM lots WHERE id = $1`,
    [req.params.id]
  );
  const lot = rows[0];
  if (!lot) return res.status(404).json({ error: 'Lote não encontrado.' });

  const { rows: bids } = await pool.query(
    'SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq, id',
    [lot.id]
  );
  const { intact, problems } = verifyLot(lot, bids);

  res.json({
    intact,
    problems,
    method: METODO,
    lot: {
      id: lot.id,
      title: lot.title,
      status: lot.status,
      starting_bid_cents: lot.starting_bid_cents,
      min_increment_cents: lot.min_increment_cents,
      starts_at: lot.starts_at,
      ends_at: lot.ends_at,
      current_bid_cents: lot.current_bid_cents,
      bid_count: lot.bid_count,
      head_hash: lot.head_hash,
    },
    bids: bids.map((b) => ({
      seq: b.seq,
      bidder: bidderAlias(lot.id, b.bidder_id),
      amount_cents: b.amount_cents,
      placed_at: b.placed_at,
      ends_at_after: b.ends_at_after,
      prev_hash: b.prev_hash,
      hash: b.hash,
    })),
  });
});