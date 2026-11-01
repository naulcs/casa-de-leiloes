import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUDIT_SECRET ??= "segredo-de-teste";

const { avaliarFimDoLeilao, nextMinBid, prorrogarFim } = await import(
  "../src/services/lots.js"
);
const { bidHash, genesisHash, headSeal, verifyLot } = await import(
  "../src/services/integrity.js"
);

function montarLeilao() {
  const inicio = new Date("2026-01-01T10:00:00Z");
  const fim = new Date("2026-01-01T10:30:00Z");
  const lote = {
    id: 1,
    starting_bid_cents: 10000,
    min_increment_cents: 500,
    starts_at: inicio,
    ends_at: fim,
  };
  const lances = [];
  let anterior = genesisHash(lote);
  [
    [10, 10000],
    [11, 10500],
    [10, 11000],
  ].forEach(([licitante, valor], i) => {
    const bid = {
      lot_id: 1,
      seq: i + 1,
      bidder_id: licitante,
      amount_cents: valor,
      placed_at: new Date(inicio.getTime() + (i + 1) * 60000),
      ends_at_after: fim,
      prev_hash: anterior,
    };
    bid.hash = bidHash(bid);
    lances.push(bid);
    anterior = bid.hash;
  });
  const ultimo = lances.at(-1);
  const registro = {
    ...lote,
    bid_count: lances.length,
    head_hash: ultimo.hash,
    head_seal: headSeal(1, lances.length, ultimo.hash),
    current_bid_cents: ultimo.amount_cents,
    leader_id: ultimo.bidder_id,
  };
  return { registro, lances };
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

test("sem licitantes, o leilão não encerra antes do tempo", () => {
  const fim = avaliarFimDoLeilao([], new Set());
  assert.equal(fim.encerra_no_minuto_final, false);
  assert.equal(fim.aviso_minuto_final, false);
});

test("um só licitante, mesmo na sala, não encerra antes do tempo", () => {
  const fim = avaliarFimDoLeilao([1], new Set([1]));
  assert.equal(fim.encerra_no_minuto_final, false);
});

test("dois licitantes com um deles na sala encerram e mostram aviso", () => {
  const fim = avaliarFimDoLeilao([1, 2], new Set([2]));
  assert.equal(fim.encerra_no_minuto_final, true);
  assert.equal(fim.aviso_minuto_final, true);
});

test("dois licitantes na sala encerram sem aviso", () => {
  const fim = avaliarFimDoLeilao([1, 2], new Set([1, 2]));
  assert.equal(fim.encerra_no_minuto_final, true);
  assert.equal(fim.aviso_minuto_final, false);
});

test("dois licitantes fora da sala não encerram antes do tempo", () => {
  const fim = avaliarFimDoLeilao([1, 2], new Set([3]));
  assert.equal(fim.encerra_no_minuto_final, false);
});

test("histórico sem alterações passa na verificação", () => {
  const { registro, lances } = montarLeilao();
  assert.equal(verifyLot(registro, lances).intact, true);
});

test("alterar um valor do histórico é detectado", () => {
  const { registro, lances } = montarLeilao();
  lances[1].amount_cents = 99999;
  const { intact, problems } = verifyLot(registro, lances);
  assert.equal(intact, false);
  assert.ok(problems.some((texto) => texto.includes("conteúdo foi alterado")));
});

test("encerramento antecipado não é tratado como alteração", () => {
  const { registro, lances } = montarLeilao();
  const antecipado = new Date("2026-01-01T10:29:01Z");
  registro.ends_at = antecipado;
  registro.early_end_at = antecipado;
  assert.equal(verifyLot(registro, lances).intact, true);
});

const MINUTO = 60000;
const FIM = new Date("2026-01-01T10:30:00Z");
const antesDoFim = (ms) => new Date(FIM.getTime() - ms);

test("lance a 10 segundos do fim deixa o lote terminando 2 minutos depois do lance", () => {
  const lance = antesDoFim(10000);
  const novoFim = prorrogarFim(FIM, lance);
  assert.equal(novoFim.getTime() - lance.getTime(), 2 * MINUTO);
});

test("lance a 1m59s do fim também termina 2 minutos depois do lance", () => {
  const lance = antesDoFim(MINUTO + 59000);
  const novoFim = prorrogarFim(FIM, lance);
  assert.equal(novoFim.getTime() - lance.getTime(), 2 * MINUTO);
});

test("lance com mais de 2 minutos restantes não muda o fim", () => {
  const lance = antesDoFim(5 * MINUTO);
  assert.equal(prorrogarFim(FIM, lance).getTime(), FIM.getTime());
});

test("lance com exatamente 2 minutos restantes não muda o fim", () => {
  const lance = antesDoFim(2 * MINUTO);
  assert.equal(prorrogarFim(FIM, lance).getTime(), FIM.getTime());
});

test("com o encerramento antecipado desligado, nada encerra antes do tempo", () => {
  const fim = avaliarFimDoLeilao([1, 2], new Set([2]), false);
  assert.equal(fim.encerra_no_minuto_final, false);
  assert.equal(fim.aviso_minuto_final, false);
});
