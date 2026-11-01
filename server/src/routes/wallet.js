import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  DepositRejected,
  deposit,
  getWalletSummary,
} from "../services/wallet.js";

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", async (req, res) => {
  const summary = await getWalletSummary(req.user.id);
  const { rows } = await pool.query(
    `SELECT id, type, amount_cents, lot_id, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY id DESC
     LIMIT 30`,
    [req.user.id],
  );
  res.json({ ...summary, transactions: rows });
});

walletRouter.post("/deposit", requireRole("bidder"), async (req, res) => {
  try {
    res.status(201).json(await deposit(req.user.id, req.body?.amount_cents));
  } catch (error) {
    if (error instanceof DepositRejected) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});
