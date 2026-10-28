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