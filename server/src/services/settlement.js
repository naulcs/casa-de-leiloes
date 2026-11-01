import { randomBytes } from "node:crypto";
import { pool } from "../db/pool.js";
import { withTransaction } from "../db/tx.js";
import { emitToUser, publishLotChange } from "./realtime.js";

export function settleLot(lotId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM lots
       WHERE id = $1 AND settled_at IS NULL AND canceled_at IS NULL
         AND ends_at <= clock_timestamp()
       FOR UPDATE`,
      [lotId],
    );
    const lot = rows[0];
    if (!lot) return null;

    if (lot.bid_count === 0) {
      await client.query(
        "UPDATE lots SET settled_at = clock_timestamp() WHERE id = $1",
        [lot.id],
      );
      return { lotId: lot.id, sold: false };
    }

    for (const id of [lot.leader_id, lot.auctioneer_id].sort((a, b) => a - b)) {
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);
    }

    const amount = lot.current_bid_cents;
    const debit = await client.query(
      "UPDATE users SET balance_cents = balance_cents - $1 WHERE id = $2 AND balance_cents >= $1",
      [amount, lot.leader_id],
    );
    if (debit.rowCount !== 1) {
      throw new Error(
        `Saldo do vencedor insuficiente na liquidacao do lote ${lot.id}`,
      );
    }
    await client.query(
      "UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2",
      [amount, lot.auctioneer_id],
    );
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents, lot_id)
       VALUES ($1, 'purchase', $2, $4), ($3, 'sale', $5, $4)`,
      [lot.leader_id, -amount, lot.auctioneer_id, lot.id, amount],
    );

    const code = randomBytes(12).toString("base64url");
    await client.query(
      `INSERT INTO receipts (code, lot_id, winner_id, amount_cents, bid_count, final_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [code, lot.id, lot.leader_id, amount, lot.bid_count, lot.head_hash],
    );
    await client.query(
      "UPDATE lots SET settled_at = clock_timestamp() WHERE id = $1",
      [lot.id],
    );

    return {
      lotId: lot.id,
      sold: true,
      code,
      winnerId: lot.leader_id,
      amount_cents: amount,
    };
  });
}

async function settlePendingLots() {
  const { rows } = await pool.query(
    `SELECT id FROM lots
     WHERE settled_at IS NULL AND canceled_at IS NULL AND ends_at <= NOW()
     ORDER BY ends_at LIMIT 20`,
  );
  for (const { id } of rows) {
    try {
      const result = await settleLot(id);
      if (!result) continue;
      await publishLotChange(id, { event: "settled", sold: result.sold });
      if (result.sold) {
        emitToUser(result.winnerId, "lot:won", {
          lot_id: id,
          receipt_code: result.code,
        });
      }
    } catch (error) {
      console.error(`Falha ao liquidar o lote ${id}:`, error.message);
    }
  }
}

let startsCheckedUntil = null;

async function announceStartedLots() {
  const { rows } = await pool.query(
    `SELECT NOW() AS until,
            ARRAY(SELECT id FROM lots
                  WHERE canceled_at IS NULL
                    AND starts_at > $1 AND starts_at <= NOW()) AS ids`,
    [startsCheckedUntil ?? new Date()],
  );
  startsCheckedUntil = rows[0].until;
  for (const id of rows[0].ids) {
    await publishLotChange(id, { event: "started" });
  }
}

export function startSettler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await announceStartedLots();
      await settlePendingLots();
    } catch (error) {
      console.error("Falha no liquidador:", error.message);
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, 2000);
}
