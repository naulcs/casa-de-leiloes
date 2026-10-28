import { Router } from 'express';
import { pool } from '../db/pool.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { BidRejected, placeBid } from '../services/bidding.js';
import { bidderAlias } from '../services/integrity.js';
import { LOT_FIELDS, serializeLot } from '../services/lots.js';
import { getWalletSummary } from '../services/wallet.js';

export const bidsRouter = Router();

const idValido = (valor) => /^\d{1,9}$/.test(valor);
const MAX_CENTS = 100_000_000_00;

bidsRouter.post('/:id/bids', requireAuth, requireRole('bidder'), async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Lote não encontrado.' });
  const amount = req.body?.amount_cents;
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_CENTS) {
    return res.status(400).json({ error: 'Informe um valor de lance válido.', code: 'invalid_amount' });
  }

  try {
    const { bid, extended } = await placeBid({
      lotId: Number(req.params.id),
      userId: req.user.id,
      amountCents: amount,
    });
    const { rows } = await pool.query(`SELECT ${LOT_FIELDS} FROM lots WHERE id = $1`, [bid.lot_id]);
    res.status(201).json({
      bid: { seq: bid.seq, amount_cents: bid.amount_cents, placed_at: bid.placed_at },
      extended,
      lot: serializeLot(rows[0]),
      wallet: await getWalletSummary(req.user.id),
    });
  } catch (erro) {
    if (erro instanceof BidRejected) {
      const status = erro.code === 'not_found' ? 404 : 409;
      return res.status(status).json({ error: erro.message, code: erro.code, ...erro.extra });
    }
    throw erro;
  }
});

bidsRouter.get('/:id/bids', optionalAuth, async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Lote não encontrado.' });
  const lotId = Number(req.params.id);
  const lote = await pool.query('SELECT 1 FROM lots WHERE id = $1', [lotId]);
  if (!lote.rows[0]) return res.status(404).json({ error: 'Lote não encontrado.' });

  const { rows } = await pool.query(
    'SELECT seq, bidder_id, amount_cents, placed_at FROM bids WHERE lot_id = $1 ORDER BY seq DESC',
    [lotId]
  );
  res.json({
    bids: rows.map((b) => ({
      seq: b.seq,
      bidder: bidderAlias(lotId, b.bidder_id),
      mine: Boolean(req.user) && b.bidder_id === req.user.id,
      amount_cents: b.amount_cents,
      placed_at: b.placed_at,
    })),
  });
});