import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { LOT_FIELDS, serializeLot } from "../services/lots.js";

export const meRouter = Router();

meRouter.get("/bids", requireAuth, requireRole("bidder"), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id,
            (SELECT MAX(amount_cents) FROM bids b WHERE b.lot_id = lots.id AND b.bidder_id = $1) AS my_best_cents,
            (SELECT code FROM receipts r WHERE r.lot_id = lots.id AND r.winner_id = $1) AS receipt_code
     FROM lots
     WHERE EXISTS (SELECT 1 FROM bids b WHERE b.lot_id = lots.id AND b.bidder_id = $1)
     ORDER BY id DESC`,
    [req.user.id],
  );

  res.json({
    lots: rows.map((row) => {
      const leader = row.leader_id === req.user.id;
      let outcome;
      if (row.status === "canceled") outcome = "canceled";
      else if (row.status === "ended")
        outcome = leader ? (row.settled_at ? "won" : "won_pending") : "lost";
      else outcome = leader ? "leading" : "outbid";
      return {
        ...serializeLot(row),
        outcome,
        my_best_cents: row.my_best_cents,
        receipt_code: row.receipt_code,
      };
    }),
  });
});
