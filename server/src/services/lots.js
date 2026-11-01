export const STATUS_SQL = `CASE
  WHEN canceled_at IS NOT NULL THEN 'canceled'
  WHEN NOW() < starts_at THEN 'scheduled'
  WHEN NOW() < ends_at THEN 'live'
  ELSE 'ended'
END`;

export const LOT_FIELDS = `id, title, attributes, starting_bid_cents, min_increment_cents,
  starts_at, ends_at, current_bid_cents, bid_count, settled_at,
  EXISTS (SELECT 1 FROM lot_images li WHERE li.lot_id = lots.id) AS has_image,
  ${STATUS_SQL} AS status`;

export const MAX_CENTS = 100_000_000_00;

export const isValidId = (value) => /^\d{1,9}$/.test(value);

export const EXTENSION_MS = 2 * 60 * 1000;

export class LotRejected extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ONE_MINUTE = 60 * 1000;

const isValidCents = (value) =>
  Number.isInteger(value) && value > 0 && value <= MAX_CENTS;

const parseDate = (value) => {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function validateLot(input, now) {
  const { external_id, starting_bid_cents, min_increment_cents } = input;
  const startsAt =
    input.starts_at === undefined ? now : parseDate(input.starts_at);
  const endsAt = parseDate(input.ends_at);

  if (typeof external_id !== "string" || !external_id) {
    throw new LotRejected(400, "Escolha uma formiga para leiloar.");
  }
  if (!isValidCents(starting_bid_cents) || !isValidCents(min_increment_cents)) {
    throw new LotRejected(
      400,
      "Informe o lance inicial e o incremento mínimo (maiores que zero).",
    );
  }
  if (!startsAt || !endsAt) {
    throw new LotRejected(400, "Informe datas válidas de início e fim.");
  }
  if (endsAt <= now) {
    throw new LotRejected(400, "O fim do leilão precisa estar no futuro.");
  }
  if (endsAt <= startsAt) {
    throw new LotRejected(400, "O fim do leilão precisa ser depois do início.");
  }
  if (endsAt - Math.max(startsAt, now) < ONE_MINUTE) {
    throw new LotRejected(400, "O lote precisa durar pelo menos 1 minuto.");
  }
  return {
    externalId: external_id,
    startingBidCents: starting_bid_cents,
    minIncrementCents: min_increment_cents,
    startsAt,
    endsAt,
  };
}

export function extendEnd(currentEnd, bidTime) {
  const limit = new Date(bidTime.getTime() + EXTENSION_MS);
  return limit > currentEnd ? limit : currentEnd;
}

export function nextMinBid(lot) {
  return lot.bid_count === 0
    ? lot.starting_bid_cents
    : lot.current_bid_cents + lot.min_increment_cents;
}

export function serializeLot(row) {
  return {
    id: row.id,
    title: row.title,
    attributes: row.attributes,
    image_url: row.has_image ? `/api/lots/${row.id}/image` : null,
    starting_bid_cents: row.starting_bid_cents,
    min_increment_cents: row.min_increment_cents,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    current_bid_cents: row.current_bid_cents,
    bid_count: row.bid_count,
    min_next_bid_cents: nextMinBid(row),
    status: row.status,
    settled: Boolean(row.settled_at),
  };
}
