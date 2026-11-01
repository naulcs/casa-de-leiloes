import { pool } from "../db/pool.js";
import { withTransaction } from "../db/tx.js";

export const MAX_DEPOSIT_CENTS = 100_000_00;

export class DepositRejected extends Error {}

export async function getWalletSummary(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT u.balance_cents AS total_cents,
            COALESCE((
              SELECT SUM(l.current_bid_cents)
              FROM lots l
              WHERE l.leader_id = u.id
                AND l.canceled_at IS NULL
                AND l.settled_at IS NULL
            ), 0)::bigint AS committed_cents
     FROM users u
     WHERE u.id = $1`,
    [userId],
  );
  if (!rows[0]) return null;
  const total = Number(rows[0].total_cents);
  const committed = Number(rows[0].committed_cents);
  return {
    total_cents: total,
    committed_cents: committed,
    available_cents: total - committed,
  };
}

export async function deposit(userId, amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new DepositRejected("Informe um valor de depósito maior que zero.");
  }
  if (amountCents > MAX_DEPOSIT_CENTS) {
    throw new DepositRejected("O depósito máximo por vez é R$ 100.000,00.");
  }
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2",
      [amountCents, userId],
    );
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents)
       VALUES ($1, 'deposit', $2)`,
      [userId, amountCents],
    );
  });
  return getWalletSummary(userId);
}
