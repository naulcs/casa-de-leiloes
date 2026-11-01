import assert from "node:assert/strict";
import { test } from "node:test";
import { limitFailedAttempts } from "../src/middleware/rateLimit.js";
import { LotRejected, validateLot } from "../src/services/lots.js";

const NOW = new Date("2026-01-01T10:00:00Z");
const inMinutes = (minutes) =>
  new Date(NOW.getTime() + minutes * 60000).toISOString();

const validInput = {
  external_id: "123",
  starting_bid_cents: 10000,
  min_increment_cents: 500,
  ends_at: inMinutes(30),
};

function rejection(input) {
  try {
    validateLot({ ...validInput, ...input }, NOW);
  } catch (error) {
    assert.ok(error instanceof LotRejected);
    return error;
  }
  assert.fail("o lote deveria ser recusado");
}

test("lote válido começa agora quando o início não é informado", () => {
  const lot = validateLot(validInput, NOW);
  assert.equal(lot.startsAt.getTime(), NOW.getTime());
  assert.equal(lot.endsAt.toISOString(), inMinutes(30));
});

test("lote sem formiga escolhida é recusado", () => {
  assert.equal(rejection({ external_id: "" }).status, 400);
});

test("lance inicial ou incremento zerados são recusados", () => {
  assert.equal(rejection({ starting_bid_cents: 0 }).status, 400);
  assert.equal(rejection({ min_increment_cents: 1.5 }).status, 400);
});

test("fim no passado, antes do início ou com menos de 1 minuto é recusado", () => {
  assert.match(
    rejection({ ends_at: inMinutes(-1) }).message,
    /precisa estar no futuro/,
  );
  assert.match(
    rejection({ starts_at: inMinutes(40) }).message,
    /depois do início/,
  );
  assert.match(
    rejection({ ends_at: inMinutes(0.5) }).message,
    /pelo menos 1 minuto/,
  );
});

test("só tentativas que falham contam para o limite de login", () => {
  const limit = limitFailedAttempts({
    windowMs: 60000,
    max: 2,
    message: "Espere.",
  });
  const statuses = [];
  function attempt(resultStatus) {
    const listeners = [];
    const res = {
      statusCode: resultStatus,
      set() {},
      on(event, listener) {
        listeners.push(listener);
      },
      status(code) {
        statuses.push(code);
        return { json() {} };
      },
    };
    limit({ ip: "10.0.0.1" }, res, () => statuses.push(resultStatus));
    listeners.forEach((listener) => listener());
  }
  attempt(200);
  attempt(401);
  attempt(200);
  attempt(401);
  attempt(200);
  assert.deepEqual(statuses, [200, 401, 200, 401, 429]);
});
