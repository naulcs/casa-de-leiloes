import { Router } from 'express';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import {
  ApiUnavailableError,
  ItemNotFoundError,
  downloadImage,
  getAnt,
} from '../services/inaturalist.js';
import { sealNewLot } from '../services/integrity.js';
import { LOT_FIELDS, serializeLot } from '../services/lots.js';

export const lotsRouter = Router();

const soLeiloeiro = [requireAuth, requireRole('auctioneer')];
const MAX_CENTS = 100_000_000_00;
const UM_MINUTO = 60 * 1000;

const idValido = (valor) => /^\d{1,9}$/.test(valor);
const centavos = (v) => Number.isInteger(v) && v > 0 && v <= MAX_CENTS;
const data = (v) => {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

lotsRouter.get('/', async (req, res) => {
  const params = [];
  const filtros = [];
  const status = req.query.status;
  if (['live', 'scheduled', 'ended'].includes(status)) {
    params.push(status);
    filtros.push(`status = $${params.length}`);
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    filtros.push(`(title ILIKE $${params.length} OR attributes::text ILIKE $${params.length})`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT ${LOT_FIELDS} FROM lots WHERE canceled_at IS NULL
     ) t
     ${where}
     ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
              (CASE WHEN status = 'ended' THEN ends_at END) DESC NULLS LAST,
              (CASE WHEN status = 'live' THEN ends_at WHEN status = 'scheduled' THEN starts_at END) ASC`,
    params
  );
  res.json({ lots: rows.map(serializeLot) });
});

lotsRouter.get('/mine', ...soLeiloeiro, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS} FROM lots WHERE auctioneer_id = $1 ORDER BY id DESC`,
    [req.user.id]
  );
  const { rows: vendas } = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
     FROM wallet_transactions WHERE user_id = $1 AND type = 'sale'`,
    [req.user.id]
  );
  res.json({
    lots: rows.map((row) => ({
      ...serializeLot(row),
      result:
        row.status === 'ended'
          ? row.bid_count > 0
            ? { sold: true, amount_cents: row.current_bid_cents }
            : { sold: false, amount_cents: 0 }
          : null,
    })),
    total_received_cents: vendas[0].total,
  });
});

lotsRouter.post('/', ...soLeiloeiro, async (req, res) => {
  const { external_id, starting_bid_cents, min_increment_cents } = req.body ?? {};
  const agora = new Date();
  const startsAt = req.body?.starts_at === undefined ? agora : data(req.body.starts_at);
  const endsAt = data(req.body?.ends_at);

  if (typeof external_id !== 'string' || !external_id) {
    return res.status(400).json({ error: 'Escolha uma formiga para leiloar.' });
  }
  if (!centavos(starting_bid_cents) || !centavos(min_increment_cents)) {
    return res.status(400).json({ error: 'Informe o lance inicial e o incremento mínimo (maiores que zero).' });
  }
  if (!startsAt || !endsAt) {
    return res.status(400).json({ error: 'Informe datas válidas de início e fim.' });
  }
  if (endsAt <= agora) {
    return res.status(400).json({ error: 'O fim do leilão precisa estar no futuro.' });
  }
  if (endsAt <= startsAt) {
    return res.status(400).json({ error: 'O fim do leilão precisa ser depois do início.' });
  }
  if (endsAt - Math.max(startsAt, agora) < UM_MINUTO) {
    return res.status(400).json({ error: 'O lote precisa durar pelo menos 1 minuto.' });
  }

  let formiga;
  try {
    formiga = await getAnt(external_id);
  } catch (erro) {
    if (erro instanceof ItemNotFoundError) {
      return res.status(404).json({ error: erro.message });
    }
    if (erro instanceof ApiUnavailableError) {
      return res.status(503).json({
        error: 'A API de formigas está indisponível agora. Tente de novo em instantes.',
      });
    }
    throw erro;
  }
  const imagem = await downloadImage(formiga.image_url);

  const lotId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (auctioneer_id, external_source, external_id, title, image_url, attributes,
                         starting_bid_cents, min_increment_cents, starts_at, ends_at)
       VALUES ($1, 'inaturalist', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [req.user.id, formiga.external_id, formiga.title, formiga.image_url, formiga.attributes,
       starting_bid_cents, min_increment_cents, startsAt, endsAt]
    );
        const selo = sealNewLot({
      id: rows[0].id,
      starting_bid_cents,
      min_increment_cents,
      starts_at: startsAt,
    });
    await client.query('UPDATE lots SET head_hash = $2, head_seal = $3 WHERE id = $1', [
      rows[0].id,
      selo.head_hash,
      selo.head_seal,
    ]);
    if (imagem) {
      await client.query(
        'INSERT INTO lot_images (lot_id, content_type, data) VALUES ($1, $2, $3)',
        [rows[0].id, imagem.contentType, imagem.data]
      );
    }
    return rows[0].id;
  });

  const { rows } = await pool.query(`SELECT ${LOT_FIELDS} FROM lots WHERE id = $1`, [lotId]);
  res.status(201).json({ lot: serializeLot(rows[0]) });
});

lotsRouter.get('/:id', optionalAuth, async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Lote não encontrado.' });
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id,
            EXISTS (SELECT 1 FROM bids b WHERE b.lot_id = lots.id AND b.bidder_id = $2) AS viewer_has_bid,
            NOW() AS server_time
     FROM lots WHERE id = $1`,
    [req.params.id, req.user?.id ?? 0]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'Lote não encontrado.' });
  res.json({
    lot: serializeLot(row),
    server_time: row.server_time,
    viewer: {
      is_leader: Boolean(req.user) && row.leader_id === req.user.id,
      has_bid: row.viewer_has_bid,
    },
  });
});

lotsRouter.get('/:id/image', async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).end();
  const { rows } = await pool.query(
    'SELECT content_type, data FROM lot_images WHERE lot_id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).end();
  res.set('Content-Type', rows[0].content_type);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(rows[0].data);
});

lotsRouter.post('/:id/cancel', ...soLeiloeiro, async (req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Lote não encontrado.' });

  const resultado = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, bid_count, current_bid_cents, canceled_at, settled_at, (NOW() >= ends_at) AS ended
       FROM lots WHERE id = $1 AND auctioneer_id = $2 FOR UPDATE`,
      [req.params.id, req.user.id]
    );
    const lote = rows[0];
    if (!lote) return { status: 404, error: 'Lote não encontrado.' };
    if (lote.canceled_at) return { status: 409, error: 'Este lote já foi cancelado.' };
    if (lote.settled_at || lote.ended) {
      return { status: 409, error: 'Este lote já encerrou e não pode mais ser cancelado.' };
    }
    await client.query('UPDATE lots SET canceled_at = NOW() WHERE id = $1', [lote.id]);
    return { status: 200, refunded_cents: lote.bid_count > 0 ? lote.current_bid_cents : 0 };
  });

  if (resultado.error) return res.status(resultado.status).json({ error: resultado.error });
  res.json({ canceled: true, refunded_cents: resultado.refunded_cents });
});