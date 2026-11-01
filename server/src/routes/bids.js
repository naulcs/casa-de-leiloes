import { Router } from "express";
import { pool } from "../db/pool.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { BidRejected, placeBid, withdrawFromLot } from "../services/bidding.js";
import { bidderAlias } from "../services/integrity.js";
import { announceBid, publishLotChange } from "../services/realtime.js";
import {
  LOT_FIELDS,
  MAX_CENTS,
  isValidId,
  serializeLot,
} from "../services/lots.js";
import { getWalletSummary } from "../services/wallet.js";

export const bidsRouter = Router();

bidsRouter.post(
  "/:id/bids",
  requireAuth,
  requireRole("bidder"),
  async (req, res) => {
    if (!isValidId(req.params.id))
      return res.status(404).json({ error: "Lote não encontrado." });
    const amount = req.body?.amount_cents;
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_CENTS) {
      return res.status(400).json({
        error: "Informe um valor de lance válido.",
        code: "invalid_amount",
      });
    }

    try {
      const result = await placeBid({
        lotId: Number(req.params.id),
        userId: req.user.id,
        amountCents: amount,
      });
      const { bid, extended } = result;
      announceBid(result);
      const { rows } = await pool.query(
        `SELECT ${LOT_FIELDS} FROM lots WHERE id = $1`,
        [bid.lot_id],
      );
      res.status(201).json({
        bid: {
          seq: bid.seq,
          amount_cents: bid.amount_cents,
          placed_at: bid.placed_at,
        },
        extended,
        lot: serializeLot(rows[0]),
        wallet: await getWalletSummary(req.user.id),
      });
    } catch (error) {
      if (error instanceof BidRejected) {
        const status = error.code === "not_found" ? 404 : 409;
        return res
          .status(status)
          .json({ error: error.message, code: error.code, ...error.extra });
      }
      throw error;
    }
  },
);

bidsRouter.get("/:id/bids", optionalAuth, async (req, res) => {
  if (!isValidId(req.params.id))
    return res.status(404).json({ error: "Lote não encontrado." });
  const lotId = Number(req.params.id);
  const lot = await pool.query("SELECT 1 FROM lots WHERE id = $1", [lotId]);
  if (!lot.rows[0])
    return res.status(404).json({ error: "Lote não encontrado." });

  const { rows } = await pool.query(
    "SELECT seq, bidder_id, amount_cents, placed_at FROM bids WHERE lot_id = $1 ORDER BY seq DESC",
    [lotId],
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

bidsRouter.post(
  "/:id/withdraw",
  requireAuth,
  requireRole("bidder"),
  async (req, res) => {
    if (!isValidId(req.params.id))
      return res.status(404).json({ error: "Lote não encontrado." });
    try {
      await withdrawFromLot({
        lotId: Number(req.params.id),
        userId: req.user.id,
      });
      publishLotChange(Number(req.params.id), { event: "withdrawn" }).catch(
        () => {},
      );
      res.json({ withdrawn: true });
    } catch (error) {
      if (error instanceof BidRejected) {
        const status = error.code === "not_found" ? 404 : 409;
        return res
          .status(status)
          .json({ error: error.message, code: error.code });
      }
      throw error;
    }
  },
);
