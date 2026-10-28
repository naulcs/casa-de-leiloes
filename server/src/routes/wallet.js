import { Router } from 'express';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getWalletSummary } from '../services/wallet.js';

export const walletRouter = Router();

const MAX_DEPOSIT_CENTS = 100_000_00; 

walletRouter.use(requireAuth);

walletRouter.get('/', async (req, res) => {
  const summary = await getWalletSummary(req.user.id);
  const { rows } = await pool.query(
    `SELECT id, type, amount_cents, lot_id, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY id DESC
     LIMIT 30`,
    [req.user.id]
  );
  res.json({ ...summary, transactions: rows });
});

walletRouter.post('/deposit', requireRole('bidder'), async (req, res) => {
  const amount = req.body?.amount_cents;
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Informe um valor de depósito maior que zero.' });
  }
  if (amount > MAX_DEPOSIT_CENTS) {
    return res.status(400).json({ error: 'O depósito máximo por vez é R$ 100.000,00.' });
  }

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2',
      [amount, req.user.id]
    );
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents)
       VALUES ($1, 'deposit', $2)`,
      [req.user.id, amount]
    );
  });

  res.status(201).json(await getWalletSummary(req.user.id));
});