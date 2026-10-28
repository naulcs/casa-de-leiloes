import { pool } from '../db/pool.js';

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
    [userId]
  );
  if (!rows[0]) return null;
  const total = Number(rows[0].total_cents);
  const committed = Number(rows[0].committed_cents);
  return { total_cents: total, committed_cents: committed, available_cents: total - committed };
}