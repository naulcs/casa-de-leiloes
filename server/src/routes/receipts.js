import { Router } from "express";
import { pool } from "../db/pool.js";
import { bidderAlias, verifyLot } from "../services/integrity.js";
import { LOT_FIELDS } from "../services/lots.js";

export const receiptsRouter = Router();

receiptsRouter.get("/:code", async (req, res) => {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(req.params.code)) {
    return res.status(404).json({ error: "Comprovante não encontrado." });
  }
  const { rows: receipts } = await pool.query(
    "SELECT * FROM receipts WHERE code = $1",
    [req.params.code],
  );
  const receipt = receipts[0];
  if (!receipt)
    return res.status(404).json({ error: "Comprovante não encontrado." });

  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id, head_hash, head_seal FROM lots WHERE id = $1`,
    [receipt.lot_id],
  );
  const lot = rows[0];
  const { rows: bids } = await pool.query(
    "SELECT * FROM bids WHERE lot_id = $1 ORDER BY seq, id",
    [lot.id],
  );
  const { intact, problems } = verifyLot(lot, bids);

  res.json({
    receipt: {
      code: receipt.code,
      issued_at: receipt.issued_at,
      amount_cents: receipt.amount_cents,
      bid_count: receipt.bid_count,
      final_hash: receipt.final_hash,
      winner: bidderAlias(lot.id, receipt.winner_id),
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
        lot.head_hash === receipt.final_hash &&
        lot.bid_count === receipt.bid_count &&
        lot.current_bid_cents === receipt.amount_cents,
    },
  });
});
