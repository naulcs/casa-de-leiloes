CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('auctioneer', 'bidder')),
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lots (
  id                  SERIAL PRIMARY KEY,
  auctioneer_id       INT NOT NULL REFERENCES users(id),
  external_source     TEXT NOT NULL,
  external_id         TEXT NOT NULL,
  title               TEXT NOT NULL,
  image_url           TEXT,
  attributes          JSONB NOT NULL DEFAULT '{}'::jsonb,
  starting_bid_cents  BIGINT NOT NULL CHECK (starting_bid_cents > 0),
  min_increment_cents BIGINT NOT NULL CHECK (min_increment_cents > 0),
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  current_bid_cents   BIGINT,
  leader_id           INT REFERENCES users(id),
  bid_count           INT NOT NULL DEFAULT 0,
  head_hash           TEXT,
  head_seal           TEXT,
  canceled_at         TIMESTAMPTZ,
  settled_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS lots_pending_settlement_idx
  ON lots (ends_at) WHERE settled_at IS NULL AND canceled_at IS NULL;

CREATE TABLE IF NOT EXISTS bids (
  id            SERIAL PRIMARY KEY,
  lot_id        INT NOT NULL REFERENCES lots(id),
  seq           INT NOT NULL,
  bidder_id     INT NOT NULL REFERENCES users(id),
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  placed_at     TIMESTAMPTZ NOT NULL,
  ends_at_after TIMESTAMPTZ NOT NULL,
  prev_hash     TEXT NOT NULL,
  hash          TEXT NOT NULL,
  UNIQUE (lot_id, seq)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL CHECK (type IN ('deposit', 'purchase', 'sale')),
  amount_cents BIGINT NOT NULL,
  lot_id       INT REFERENCES lots(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  lot_id       INT NOT NULL UNIQUE REFERENCES lots(id),
  winner_id    INT NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL,
  bid_count    INT NOT NULL,
  final_hash   TEXT NOT NULL,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lot_images (
  lot_id       INT PRIMARY KEY REFERENCES lots(id),
  content_type TEXT NOT NULL,
  data         BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS withdrawals (
  lot_id     INT NOT NULL REFERENCES lots(id),
  user_id    INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lot_id, user_id)
);

CREATE INDEX IF NOT EXISTS bids_bidder_idx ON bids (bidder_id, lot_id);

CREATE INDEX IF NOT EXISTS lots_active_leader_idx
  ON lots (leader_id) WHERE canceled_at IS NULL AND settled_at IS NULL;

CREATE INDEX IF NOT EXISTS lots_auctioneer_idx ON lots (auctioneer_id, id DESC);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
  ON wallet_transactions (user_id, id DESC);

CREATE INDEX IF NOT EXISTS lots_vitrine_ends_at_idx
  ON lots (ends_at) WHERE canceled_at IS NULL;

CREATE INDEX IF NOT EXISTS lots_vitrine_starts_at_idx
  ON lots (starts_at) WHERE canceled_at IS NULL;
