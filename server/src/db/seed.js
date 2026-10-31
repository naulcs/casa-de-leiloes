import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { withTransaction } from "./tx.js";
import { placeBid } from "../services/bidding.js";
import { downloadImage, searchAnts } from "../services/inaturalist.js";
import { sealNewLot } from "../services/integrity.js";

const SENHA = "123456";
const DEPOSITO_INICIAL = 50000;
const MINUTO = 60000;

const USUARIOS = [
  { name: "Leo", email: "leiloeiro@exemplo.com", role: "auctioneer" },
  { name: "Ana", email: "ana@exemplo.com", role: "bidder" },
  { name: "Bia", email: "bia@exemplo.com", role: "bidder" },
];

const LOTES_RESERVA = [
  {
    external_id: "ao-vivo",
    title: "Formiga cortadeira",
    image_url: null,
    attributes: {
      "Nome científico": "Atta sexdens",
      "Nome popular": "Formiga cortadeira",
    },
  },
  {
    external_id: "agendado",
    title: "Formiga argentina",
    image_url: null,
    attributes: {
      "Nome científico": "Linepithema humile",
      "Nome popular": "Formiga argentina",
    },
  },
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

async function limparNomesAntigos() {
  const { rowCount } = await pool.query(
    `UPDATE lots
     SET title = regexp_replace(title, '\\s*-\\s*', ' ', 'g'),
         attributes = CASE
           WHEN attributes ? 'Nome popular' THEN jsonb_set(
             attributes,
             '{Nome popular}',
             to_jsonb(regexp_replace(attributes->>'Nome popular', '\\s*-\\s*', ' ', 'g'))
           )
           ELSE attributes
         END
     WHERE title LIKE '%-%' OR attributes->>'Nome popular' LIKE '%-%'`,
  );
  return rowCount;
}

async function buscarEspecies() {
  try {
    const { items } = await searchAnts("formiga", 1);
    const vistos = new Set();
    return items
      .filter((item) => {
        if (vistos.has(item.title)) return false;
        vistos.add(item.title);
        return true;
      })
      .slice(0, 8);
  } catch {
    return LOTES_RESERVA;
  }
}

async function criarLote({ auctioneerId, especie, startsAt, endsAt }) {
  const externalId = especie.image_url
    ? `especie-${especie.external_id}`
    : especie.external_id;
  const { rows: existentes } = await pool.query(
    "SELECT id, bid_count FROM lots WHERE external_source = 'seed' AND external_id = $1",
    [externalId],
  );
  if (existentes[0]) return existentes[0];

  const imagem = await downloadImage(especie.image_url);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (auctioneer_id, external_source, external_id, title, image_url, attributes,
                         starting_bid_cents, min_increment_cents, starts_at, ends_at)
       VALUES ($1, 'seed', $2, $3, $4, $5, 10000, 500, $6, $7)
       RETURNING id, bid_count`,
      [
        auctioneerId,
        externalId,
        especie.title,
        especie.image_url,
        especie.attributes,
        startsAt,
        endsAt,
      ],
    );
    const selo = sealNewLot({
      id: rows[0].id,
      starting_bid_cents: 10000,
      min_increment_cents: 500,
      starts_at: startsAt,
    });
    await client.query(
      "UPDATE lots SET head_hash = $2, head_seal = $3 WHERE id = $1",
      [rows[0].id, selo.head_hash, selo.head_seal],
    );
    if (imagem) {
      await client.query(
        "INSERT INTO lot_images (lot_id, content_type, data) VALUES ($1, $2, $3)",
        [rows[0].id, imagem.contentType, imagem.data],
      );
    }
    return rows[0];
  });
}

async function darLances(lote, lances) {
  if (lote.bid_count > 0) return;
  for (const [userId, amountCents] of lances) {
    try {
      await placeBid({ lotId: lote.id, userId, amountCents });
    } catch (erro) {
      console.log(`Lance não aplicado no lote ${lote.id}: ${erro.message}`);
    }
  }
}

async function main() {
  const leiloeiro = await criarUsuario(USUARIOS[0]);
  const ana = await criarUsuario(USUARIOS[1]);
  const bia = await criarUsuario(USUARIOS[2]);

  const corrigidos = await limparNomesAntigos();

  const agora = Date.now();
  const emMinutos = (minutos) => new Date(agora + minutos * MINUTO);
  const especies = await buscarEspecies();
  const lancesPorLote = [
    [
      [ana, 10000],
      [bia, 10500],
      [ana, 11000],
    ],
    [[bia, 10000]],
    [
      [ana, 10000],
      [bia, 10500],
    ],
  ];

  let aoVivo = 0;
  let agendados = 0;
  for (const [posicao, especie] of especies.entries()) {
    const agendado = posicao % 2 === 1 && posicao > 2;
    const lote = await criarLote({
      auctioneerId: leiloeiro,
      especie,
      startsAt: agendado ? emMinutos(30 + posicao * 10) : emMinutos(-5),
      endsAt: agendado
        ? emMinutos(120 + posicao * 10)
        : emMinutos(20 + posicao * 15),
    });
    if (agendado) {
      agendados += 1;
    } else {
      aoVivo += 1;
      await darLances(lote, lancesPorLote[aoVivo - 1] ?? []);
    }
  }

  console.log("Dados de teste prontos:");
  console.log("- 1 leiloeiro: leiloeiro@exemplo.com");
  console.log("- 2 licitantes: ana@exemplo.com e bia@exemplo.com");
  console.log(`- ${aoVivo} lotes ao vivo e ${agendados} agendados`);
  console.log(`- ${corrigidos} nomes antigos corrigidos (sem "-")`);
}

main()
  .catch((erro) => {
    console.error("Falha ao criar os dados de teste:", erro.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
