import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { withTransaction } from "./tx.js";
import { placeBid } from "../services/bidding.js";
import { sealNewLot } from "../services/integrity.js";

const SENHA = "123456";
const DEPOSITO_INICIAL = 50000;

const USUARIOS = [
  { name: "Leo", email: "leiloeiro@exemplo.com", role: "auctioneer" },
  { name: "Ana", email: "ana@exemplo.com", role: "bidder" },
  { name: "Bia", email: "bia@exemplo.com", role: "bidder" },
];

async function depositar(userId) {
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2",
      [DEPOSITO_INICIAL, userId],
    );
    await client.query(
      "INSERT INTO wallet_transactions (user_id, type, amount_cents) VALUES ($1, 'deposit', $2)",
      [userId, DEPOSITO_INICIAL],
    );
  });
}

async function criarUsuario({ name, email, role }) {
  const hash = await bcrypt.hash(SENHA, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, hash, role],
  );
  if (rows[0]) {
    if (role === "bidder") await depositar(rows[0].id);
    return rows[0].id;
  }
  const { rows: existentes } = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  return existentes[0].id;
}

async function criarLote({
  auctioneerId,
  externalId,
  title,
  attributes,
  startingBidCents,
  minIncrementCents,
  startsAt,
  endsAt,
}) {
  const { rows: existentes } = await pool.query(
    "SELECT id FROM lots WHERE external_source = 'seed' AND external_id = $1",
    [externalId],
  );
  if (existentes[0]) return existentes[0].id;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (auctioneer_id, external_source, external_id, title, attributes,
                         starting_bid_cents, min_increment_cents, starts_at, ends_at)
       VALUES ($1, 'seed', $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        auctioneerId,
        externalId,
        title,
        attributes,
        startingBidCents,
        minIncrementCents,
        startsAt,
        endsAt,
      ],
    );
    const selo = sealNewLot({
      id: rows[0].id,
      starting_bid_cents: startingBidCents,
      min_increment_cents: minIncrementCents,
      starts_at: startsAt,
    });
    await client.query(
      "UPDATE lots SET head_hash = $2, head_seal = $3 WHERE id = $1",
      [rows[0].id, selo.head_hash, selo.head_seal],
    );
    return rows[0].id;
  });
}

async function main() {
  const leiloeiro = await criarUsuario(USUARIOS[0]);
  const ana = await criarUsuario(USUARIOS[1]);
  const bia = await criarUsuario(USUARIOS[2]);

  const agora = Date.now();
  const emMinutos = (minutos) => new Date(agora + minutos * 60000);

  const aoVivo = await criarLote({
    auctioneerId: leiloeiro,
    externalId: "ao-vivo",
    title: "Formiga-cortadeira",
    attributes: {
      "Nome científico": "Atta sexdens",
      "Nome popular": "Formiga-cortadeira",
      Foto: "Exemplo para testes",
    },
    startingBidCents: 10000,
    minIncrementCents: 500,
    startsAt: emMinutos(-5),
    endsAt: emMinutos(30),
  });

  const { rows } = await pool.query(
    "SELECT bid_count FROM lots WHERE id = $1",
    [aoVivo],
  );
  if (rows[0].bid_count === 0) {
    await placeBid({ lotId: aoVivo, userId: ana, amountCents: 10000 });
    await placeBid({ lotId: aoVivo, userId: bia, amountCents: 10500 });
    await placeBid({ lotId: aoVivo, userId: ana, amountCents: 11000 });
  }

  await criarLote({
    auctioneerId: leiloeiro,
    externalId: "agendado",
    title: "Formiga-argentina",
    attributes: {
      "Nome científico": "Linepithema humile",
      "Nome popular": "Formiga-argentina",
    },
    startingBidCents: 5000,
    minIncrementCents: 500,
    startsAt: emMinutos(60),
    endsAt: emMinutos(120),
  });

  console.log("Dados de teste prontos:");
  console.log("- 1 leiloeiro: leiloeiro@exemplo.com");
  console.log("- 2 licitantes: ana@exemplo.com e bia@exemplo.com");
  console.log("- 1 lote ao vivo com lances e 1 lote agendado");
}

main()
  .catch((erro) => {
    console.error("Falha ao criar os dados de teste:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());