import { Router } from "express";
import { pool } from "../db/pool.js";
import { bidderAlias, verifyLot } from "../services/integrity.js";
import { LOT_FIELDS } from "../services/lots.js";

export const receiptsRouter = Router();

receiptsRouter.get("/:code", async (req, res) => {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(req.params.code)) {
    return res.status(404).json({ error: "Comprovante não encontrado." });
  }
  const { rows: recibos } = await pool.query(
    "SELECT * FROM receipts WHERE code = $1",
    [req.params.code],
  );
  const recibo = recibos[0];
  if (!recibo)
    return res.status(404).json({ error: "Comprovante não encontrado." });

  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id, head_hash, head_seal FROM lots WHERE id = $1`,
    [recibo.lot_id],
  );
  const lot = rows[0];
  const { rows: bids } = await pool.query(
    "SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq, id",
    [lot.id],
  );
  const { intact, problems } = verifyLot(lot, bids);

  res.json({
    receipt: {
      code: recibo.code,
      issued_at: recibo.issued_at,
      amount_cents: recibo.amount_cents,
      bid_count: recibo.bid_count,
      final_hash: recibo.final_hash,
      winner: bidderAlias(lot.id, recibo.winner_id),
    },
    lot: {
      id: lot.id,
      title: lot.title,
      attributes: lot.attributes,
      image_url: lot.has_image ? `/api/lots/${lot.id}/image` : null,
      ends_at: lot.ends_at,
    },
    audit: {
      intact,
      problems,
      matches_receipt:
        lot.head_hash === recibo.final_hash &&
        lot.bid_count === recibo.bid_count &&
        lot.current_bid_cents === recibo.amount_cents,
    },
  });
});
