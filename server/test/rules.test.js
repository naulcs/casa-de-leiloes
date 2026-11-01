import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUDIT_SECRET ??= "segredo-de-teste";

const { nextMinBid, extendEnd } = await import("../src/services/lots.js");
const { bidHash, genesisHash, headSeal, verifyLot } = await import(
  "../src/services/integrity.js"
);

function buildAuction() {
  const start = new Date("2026-01-01T10:00:00Z");
  const end = new Date("2026-01-01T10:30:00Z");
  const lot = {
    id: 1,
    starting_bid_cents: 10000,
    min_increment_cents: 500,
    starts_at: start,
    ends_at: end,
  };
  const bids = [];
  let previous = genesisHash(lot);
  [
    [10, 10000],
    [11, 10500],
    [10, 11000],
  ].forEach(([bidder, amount], i) => {
    const bid = {
      lot_id: 1,
      seq: i + 1,
      bidder_id: bidder,
      amount_cents: amount,
      placed_at: new Date(start.getTime() + (i + 1) * 60000),
      ends_at_after: end,
      prev_hash: previous,
    };
    bid.hash = bidHash(bid);
    bids.push(bid);
    previous = bid.hash;
  });
  const lastBid = bids.at(-1);
  const record = {
    ...lot,
    bid_count: bids.length,
    head_hash: lastBid.hash,
    head_seal: headSeal(1, bids.length, lastBid.hash),
    current_bid_cents: lastBid.amount_cents,
    leader_id: lastBid.bidder_id,
  };
  return { record, bids };
}

test("sem lances, o primeiro lance mínimo é o inicial", () => {
  assert.equal(
    nextMinBid({
      bid_count: 0,
      starting_bid_cents: 10000,
      min_increment_cents: 500,
    }),
    10000,
  );
});

test("com lances, o próximo mínimo soma o incremento ao lance atual", () => {
  assert.equal(
    nextMinBid({
      bid_count: 2,
      current_bid_cents: 10500,
      min_increment_cents: 500,
    }),
    11000,
  );
});

test("histórico sem alterações passa na verificação", () => {
  const { record, bids } = buildAuction();
  assert.equal(verifyLot(record, bids).intact, true);
});

test("alterar um valor do histórico é detectado", () => {
  const { record, bids } = buildAuction();
  bids[1].amount_cents = 99999;
  const { intact, problems } = verifyLot(record, bids);
  assert.equal(intact, false);
  assert.ok(problems.some((text) => text.includes("conteúdo foi alterado")));
});

test("encerrar o lote antes do horário é detectado", () => {
  const { record, bids } = buildAuction();
  record.ends_at = new Date("2026-01-01T10:29:01Z");
  const { intact, problems } = verifyLot(record, bids);
  assert.equal(intact, false);
  assert.ok(problems.some((text) => text.includes("horário de encerramento")));
});

const MINUTE = 60000;
const END_TIME = new Date("2026-01-01T10:30:00Z");
const beforeEnd = (ms) => new Date(END_TIME.getTime() - ms);

test("lance a 10 segundos do fim deixa o lote terminando 2 minutos depois do lance", () => {
  const bid = beforeEnd(10000);
  const newEnd = extendEnd(END_TIME, bid);
  assert.equal(newEnd.getTime() - bid.getTime(), 2 * MINUTE);
});

test("lance a 1m59s do fim também termina 2 minutos depois do lance", () => {
  const bid = beforeEnd(MINUTE + 59000);
  const newEnd = extendEnd(END_TIME, bid);
  assert.equal(newEnd.getTime() - bid.getTime(), 2 * MINUTE);
});

test("lance com mais de 2 minutos restantes não muda o fim", () => {
  const bid = beforeEnd(5 * MINUTE);
  assert.equal(extendEnd(END_TIME, bid).getTime(), END_TIME.getTime());
});

test("lance com exatamente 2 minutos restantes não muda o fim", () => {
  const bid = beforeEnd(2 * MINUTE);
  assert.equal(extendEnd(END_TIME, bid).getTime(), END_TIME.getTime());
});
