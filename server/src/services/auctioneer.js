import { pool } from "../db/pool.js";
import { withTransaction } from "../db/tx.js";
import {
  ApiUnavailableError,
  ItemNotFoundError,
  downloadImage,
  getAnt,
} from "./inaturalist.js";
import { sealNewLot } from "./integrity.js";
import { LOT_FIELDS, LotRejected, serializeLot, validateLot } from "./lots.js";

async function fetchAnt(externalId) {
  try {
    return await getAnt(externalId);
  } catch (error) {
    if (error instanceof ItemNotFoundError) {
      throw new LotRejected(404, error.message);
    }
    if (error instanceof ApiUnavailableError) {
      throw new LotRejected(
        503,
        "A API de formigas está indisponível agora. Tente de novo em instantes.",
      );
    }
    throw error;
  }
}

export async function createLot(auctioneerId, input) {
  const lot = validateLot(input, new Date());
  const ant = await fetchAnt(lot.externalId);
  const image = await downloadImage(ant.image_url);

  const lotId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (auctioneer_id, external_source, external_id, title, image_url, attributes,
                         starting_bid_cents, min_increment_cents, starts_at, ends_at)
       VALUES ($1, 'inaturalist', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        auctioneerId,
        ant.external_id,
        ant.title,
        ant.image_url,
        ant.attributes,
        lot.startingBidCents,
        lot.minIncrementCents,
        lot.startsAt,
        lot.endsAt,
      ],
    );
    const seal = sealNewLot({
      id: rows[0].id,
      starting_bid_cents: lot.startingBidCents,
      min_increment_cents: lot.minIncrementCents,
      starts_at: lot.startsAt,
    });
    await client.query(
      "UPDATE lots SET head_hash = $2, head_seal = $3 WHERE id = $1",
      [rows[0].id, seal.head_hash, seal.head_seal],
    );
    if (image) {
      await client.query(
        "INSERT INTO lot_images (lot_id, content_type, data) VALUES ($1, $2, $3)",
        [rows[0].id, image.contentType, image.data],
      );
    }
    return rows[0].id;
  });

  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS} FROM lots WHERE id = $1`,
    [lotId],
  );
  return serializeLot(rows[0]);
}

export function cancelLot(auctioneerId, lotId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, bid_count, current_bid_cents, canceled_at, settled_at, (NOW() >= ends_at) AS ended
       FROM lots WHERE id = $1 AND auctioneer_id = $2 FOR UPDATE`,
      [lotId, auctioneerId],
    );
    const lot = rows[0];
    if (!lot) throw new LotRejected(404, "Lote não encontrado.");
    if (lot.canceled_at) {
      throw new LotRejected(409, "Este lote já foi cancelado.");
    }
    if (lot.settled_at || lot.ended) {
      throw new LotRejected(
        409,
        "Este lote já encerrou e não pode mais ser cancelado.",
      );
    }
    await client.query("UPDATE lots SET canceled_at = NOW() WHERE id = $1", [
      lot.id,
    ]);
    return lot.bid_count > 0 ? lot.current_bid_cents : 0;
  });
}
