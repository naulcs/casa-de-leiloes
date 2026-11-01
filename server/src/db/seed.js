import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { withTransaction } from "./tx.js";
import { placeBid } from "../services/bidding.js";
import { downloadImage, searchAnts } from "../services/inaturalist.js";
import { sealNewLot } from "../services/integrity.js";

const PASSWORD = "123456";
const INITIAL_DEPOSIT = 50000;
const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;

const USERS = [
  { name: "Leo", email: "leiloeiro@exemplo.com", role: "auctioneer" },
  { name: "Ana", email: "ana@exemplo.com", role: "bidder" },
  { name: "Bia", email: "bia@exemplo.com", role: "bidder" },
];

const FALLBACK_LOTS = [
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

async function deposit(userId) {
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET balance_cents = balance_cents + $1 WHERE id = $2",
      [INITIAL_DEPOSIT, userId],
    );
    await client.query(
      "INSERT INTO wallet_transactions (user_id, type, amount_cents) VALUES ($1, 'deposit', $2)",
      [userId, INITIAL_DEPOSIT],
    );
  });
}

async function createUser({ name, email, role }) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, hash, role],
  );
  if (rows[0]) {
    if (role === "bidder") await deposit(rows[0].id);
    return rows[0].id;
  }
  const { rows: existing } = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  return existing[0].id;
}

async function cleanOldNames() {
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

async function fetchSpecies() {
  try {
    const { items } = await searchAnts("formiga", 1);
    const seen = new Set();
    return items
      .filter((item) => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
      })
      .slice(0, 8);
  } catch {
    return FALLBACK_LOTS;
  }
}

async function createSeedLot({ auctioneerId, species, startsAt, endsAt }) {
  const externalId = species.image_url
    ? `especie-${species.external_id}`
    : species.external_id;
  const { rows: existing } = await pool.query(
    `SELECT id, bid_count FROM lots
     WHERE external_source = 'seed' AND external_id = $1
       AND canceled_at IS NULL AND ends_at > NOW()`,
    [externalId],
  );
  if (existing[0]) return existing[0];

  const image = await downloadImage(species.image_url);

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO lots (auctioneer_id, external_source, external_id, title, image_url, attributes,
                         starting_bid_cents, min_increment_cents, starts_at, ends_at)
       VALUES ($1, 'seed', $2, $3, $4, $5, 10000, 500, $6, $7)
       RETURNING id, bid_count`,
      [
        auctioneerId,
        externalId,
        species.title,
        species.image_url,
        species.attributes,
        startsAt,
        endsAt,
      ],
    );
    const seal = sealNewLot({
      id: rows[0].id,
      starting_bid_cents: 10000,
      min_increment_cents: 500,
      starts_at: startsAt,
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
    return rows[0];
  });
}

async function placeSeedBids(lot, bids) {
  if (lot.bid_count > 0) return;
  for (const [userId, amountCents] of bids) {
    try {
      await placeBid({ lotId: lot.id, userId, amountCents });
    } catch (error) {
      console.log(`Lance não aplicado no lote ${lot.id}: ${error.message}`);
    }
  }
}

async function main() {
  const auctioneer = await createUser(USERS[0]);
  const ana = await createUser(USERS[1]);
  const bia = await createUser(USERS[2]);

  const fixedNames = await cleanOldNames();

  const now = Date.now();
  const inMinutes = (minutes) => new Date(now + minutes * MINUTE);
  const inDays = (days) => new Date(now + days * DAY);
  const speciesList = await fetchSpecies();
  const bidsPerLot = [
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

  let liveCount = 0;
  let scheduledCount = 0;
  for (const [position, species] of speciesList.entries()) {
    const isScheduled = position % 2 === 1 && position > 2;
    const lot = await createSeedLot({
      auctioneerId: auctioneer,
      species,
      startsAt: isScheduled ? inDays(1 + position * 0.25) : inMinutes(-5),
      endsAt: isScheduled ? inDays(4 + position * 0.25) : inDays(3 + position),
    });
    if (isScheduled) {
      scheduledCount += 1;
    } else {
      liveCount += 1;
      await placeSeedBids(lot, bidsPerLot[liveCount - 1] ?? []);
    }
  }

  console.log("Dados de teste prontos:");
  console.log("- 1 leiloeiro: leiloeiro@exemplo.com");
  console.log("- 2 licitantes: ana@exemplo.com e bia@exemplo.com");
  console.log(`- ${liveCount} lotes ao vivo e ${scheduledCount} agendados`);
  console.log(`- ${fixedNames} nomes antigos corrigidos (sem "-")`);
}

main()
  .catch((error) => {
    console.error("Falha ao criar os dados de teste:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
