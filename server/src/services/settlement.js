import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';
import { emitToUser, publishLotChange } from './realtime.js';

export function settleLot(lotId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM lots
       WHERE id = $1 AND settled_at IS NULL AND canceled_at IS NULL
         AND ends_at <= clock_timestamp()
       FOR UPDATE`,
      [lotId]
    );
    const lot = rows[0];
    if (!lot) return null;

    if (lot.bid_count === 0) {
      await client.query('UPDATE lots SET settled_at = clock_timestamp() WHERE id = $1', [lot.id]);
      return { lotId: lot.id, sold: false };
    }

    for (const id of [lot.leader_id, lot.auctioneer_id].sort((a, b) => a - b)) {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);
    }

    const valor = lot.current_bid_cents;
    const debito = await client.query(
      'UPDATE users SET balance_cents = balance_cents - $1 WHERE id = $2 AND balance_cents >= $1',
      [valor, lot.leader_id]
    );
    if (debito.rowCount !== 1) {
      throw new Error(`Saldo do vencedor insuficiente na liquidacao do lote ${lot.id}`);
    }
    await client.query('UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2', [
      valor,
      lot.auctioneer_id,
    ]);
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount_cents, lot_id)
       VALUES ($1, 'purchase', $2, $4), ($3, 'sale', $5, $4)`,
      [lot.leader_id, -valor, lot.auctioneer_id, lot.id, valor]
    );

    const code = randomBytes(12).toString('base64url');
    await client.query(
      `INSERT INTO receipts (code, lot_id, winner_id, amount_cents, bid_count, final_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [code, lot.id, lot.leader_id, valor, lot.bid_count, lot.head_hash]
    );
    await client.query('UPDATE lots SET settled_at = clock_timestamp() WHERE id = $1', [lot.id]);

    return { lotId: lot.id, sold: true, code, winnerId: lot.leader_id, amount_cents: valor };
  });
}

async function liquidarPendentes() {
  const { rows } = await pool.query(
    `SELECT id FROM lots
     WHERE settled_at IS NULL AND canceled_at IS NULL AND ends_at <= NOW()
     ORDER BY ends_at LIMIT 20`
  );
  for (const { id } of rows) {
    try {
      const resultado = await settleLot(id);
      if (!resultado) continue;
      await publishLotChange(id, { event: 'settled', sold: resultado.sold });
      if (resultado.sold) {
        emitToUser(resultado.winnerId, 'lot:won', { lot_id: id, receipt_code: resultado.code });
      }
    } catch (erro) {
      console.error(`Falha ao liquidar o lote ${id}:`, erro.message);
    }
  }
}

export function startSettler() {
  let rodando = false;
  const tick = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await liquidarPendentes();
    } catch (erro) {
      console.error('Falha no liquidador:', erro.message);
    } finally {
      rodando = false;
    }
  };
  tick();
  return setInterval(tick, 2000);
}