import { Router } from "express";
import { pool } from "../db/pool.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { cancelLot, createLot } from "../services/auctioneer.js";
import { countWatchers, publishLotChange } from "../services/realtime.js";
import {
  LOT_FIELDS,
  LotRejected,
  isValidId,
  serializeLot,
} from "../services/lots.js";

export const lotsRouter = Router();

const auctioneerOnly = [requireAuth, requireRole("auctioneer")];
const MAX_SEARCH_LENGTH = 100;

const STATUS_FILTERS = {
  live: "starts_at <= NOW() AND ends_at > NOW()",
  scheduled: "starts_at > NOW()",
  ended: "ends_at <= NOW()",
};

lotsRouter.get("/", optionalAuth, async (req, res) => {
  const params = [];
  const filters = ["canceled_at IS NULL"];
  const status = req.query.status;
  if (Object.hasOwn(STATUS_FILTERS, status)) {
    filters.push(STATUS_FILTERS[status]);
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length > MAX_SEARCH_LENGTH) {
    return res.status(400).json({
      error: `A busca pode ter no máximo ${MAX_SEARCH_LENGTH} caracteres.`,
    });
  }
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    filters.push(
      `(title ILIKE $${params.length} OR attributes::text ILIKE $${params.length})`,
    );
  }
  params.push(req.user?.id ?? 0);
  const userParam = `$${params.length}`;
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT ${LOT_FIELDS},
              (SELECT code FROM receipts r WHERE r.lot_id = lots.id AND r.winner_id = ${userParam}) AS my_receipt_code
       FROM lots
       WHERE ${filters.join(" AND ")}
     ) t
     ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
              (CASE WHEN status = 'ended' THEN ends_at END) DESC NULLS LAST,
              (CASE WHEN status = 'live' THEN ends_at WHEN status = 'scheduled' THEN starts_at END) ASC`,
    params,
  );
  res.json({
    server_time: new Date().toISOString(),
    lots: rows.map((row) => ({
      ...serializeLot(row),
      my_receipt_code: row.my_receipt_code,
      watchers: countWatchers(row.id),
    })),
  });
});

lotsRouter.get("/mine", ...auctioneerOnly, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS} FROM lots WHERE auctioneer_id = $1 ORDER BY id DESC`,
    [req.user.id],
  );
  const { rows: sales } = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
     FROM wallet_transactions WHERE user_id = $1 AND type = 'sale'`,
    [req.user.id],
  );
  res.json({
    lots: rows.map((row) => ({
      ...serializeLot(row),
      result:
        row.status === "ended"
          ? row.bid_count > 0
            ? { sold: true, amount_cents: row.current_bid_cents }
            : { sold: false, amount_cents: 0 }
          : null,
    })),
    total_received_cents: sales[0].total,
  });
});

lotsRouter.post("/", ...auctioneerOnly, async (req, res) => {
  try {
    const lot = await createLot(req.user.id, req.body ?? {});
    publishLotChange(lot.id, { event: "created" }).catch(() => {});
    res.status(201).json({ lot });
  } catch (error) {
    if (error instanceof LotRejected) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
});

lotsRouter.get("/:id", optionalAuth, async (req, res) => {
  if (!isValidId(req.params.id))
    return res.status(404).json({ error: "Lote não encontrado." });
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS}, leader_id,
            EXISTS (SELECT 1 FROM bids b WHERE b.lot_id = lots.id AND b.bidder_id = $2) AS viewer_has_bid,
            EXISTS (SELECT 1 FROM withdrawals w WHERE w.lot_id = lots.id AND w.user_id = $2) AS viewer_withdrawn,
            (SELECT code FROM receipts r WHERE r.lot_id = lots.id AND r.winner_id = $2) AS viewer_receipt_code,
            NOW() AS server_time
     FROM lots WHERE id = $1`,
    [req.params.id, req.user?.id ?? 0],
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Lote não encontrado." });
  res.json({
    lot: serializeLot(row),
    watchers: countWatchers(row.id),
    server_time: row.server_time,
    viewer: {
      is_leader: Boolean(req.user) && row.leader_id === req.user.id,
      has_bid: row.viewer_has_bid,
      withdrawn: row.viewer_withdrawn,
      receipt_code: row.viewer_receipt_code,
    },
  });
});

lotsRouter.get("/:id/image", async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).end();
  const { rows } = await pool.query(
    "SELECT content_type, data FROM lot_images WHERE lot_id = $1",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).end();
  res.set("Content-Type", rows[0].content_type);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(rows[0].data);
});

lotsRouter.post("/:id/cancel", ...auctioneerOnly, async (req, res) => {
  if (!isValidId(req.params.id))
    return res.status(404).json({ error: "Lote não encontrado." });
  const lotId = Number(req.params.id);
  try {
    const refunded = await cancelLot(req.user.id, lotId);
    publishLotChange(lotId, { event: "canceled" }).catch(() => {});
    res.json({ canceled: true, refunded_cents: refunded });
  } catch (error) {
    if (error instanceof LotRejected) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
});
