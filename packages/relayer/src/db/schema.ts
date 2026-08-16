export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS nexora;

CREATE TABLE IF NOT EXISTS nexora.intents (
    id              UUID PRIMARY KEY,
    user_id         TEXT NOT NULL,
    source_chain    TEXT NOT NULL,
    destination_chain TEXT NOT NULL,
    source_token    TEXT NOT NULL,
    destination_token TEXT NOT NULL,
    amount          TEXT NOT NULL,
    amount_in_base_units TEXT NOT NULL,
    source_address  TEXT,
    destination_address TEXT NOT NULL,
    privacy_level   TEXT NOT NULL DEFAULT 'standard',
    viewing_key_pub TEXT,
    viewing_key_priv TEXT,
    refund_address  TEXT,
    reference_id    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    fail_reason     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intents_status ON nexora.intents(status);
CREATE INDEX IF NOT EXISTS idx_intents_user_id ON nexora.intents(user_id);
CREATE INDEX IF NOT EXISTS idx_intents_reference_id ON nexora.intents(reference_id);

CREATE TABLE IF NOT EXISTS nexora.swaps (
    swap_id         TEXT PRIMARY KEY,
    intent_id       UUID NOT NULL REFERENCES nexora.intents(id),
    source_network  TEXT NOT NULL,
    source_token    TEXT NOT NULL,
    destination_network TEXT NOT NULL,
    destination_token TEXT NOT NULL,
    amount          NUMERIC NOT NULL,
    destination_address TEXT NOT NULL,
    deposit_address TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    fee             NUMERIC,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swaps_intent_id ON nexora.swaps(intent_id);
CREATE INDEX IF NOT EXISTS idx_swaps_status ON nexora.swaps(status);

CREATE TABLE IF NOT EXISTS nexora.deposits (
    id              UUID PRIMARY KEY,
    intent_id       UUID NOT NULL REFERENCES nexora.intents(id),
    swap_id         TEXT NOT NULL REFERENCES nexora.swaps(swap_id),
    source_tx_hash  TEXT NOT NULL,
    from_address    TEXT NOT NULL,
    to_address      TEXT NOT NULL,
    amount          TEXT NOT NULL,
    token           TEXT NOT NULL,
    block_number    BIGINT NOT NULL,
    block_hash      TEXT NOT NULL,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'pending',
    shield_tx_hash  TEXT,
    UNIQUE(source_tx_hash, from_address, to_address, block_number)
);

CREATE INDEX IF NOT EXISTS idx_deposits_intent_id ON nexora.deposits(intent_id);
CREATE INDEX IF NOT EXISTS idx_deposits_swap_id ON nexora.deposits(swap_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON nexora.deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_to_address ON nexora.deposits(to_address);

CREATE TABLE IF NOT EXISTS nexora.shield_transactions (
    id              UUID PRIMARY KEY,
    intent_id       UUID NOT NULL REFERENCES nexora.intents(id),
    swap_id         TEXT NOT NULL,
    token           TEXT NOT NULL,
    amount          TEXT NOT NULL,
    tx_hash         TEXT NOT NULL,
    note_hash       TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shield_intent_id ON nexora.shield_transactions(intent_id);
CREATE INDEX IF NOT EXISTS idx_shield_tx_hash ON nexora.shield_transactions(tx_hash);

CREATE TABLE IF NOT EXISTS nexora.unshield_transactions (
    id              UUID PRIMARY KEY,
    intent_id       UUID NOT NULL REFERENCES nexora.intents(id),
    swap_id         TEXT NOT NULL,
    token           TEXT NOT NULL,
    amount          TEXT NOT NULL,
    tx_hash         TEXT NOT NULL,
    note_hash       TEXT,
    recipient       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_unshield_intent_id ON nexora.unshield_transactions(intent_id);
CREATE INDEX IF NOT EXISTS idx_unshield_swap_id ON nexora.unshield_transactions(swap_id);
CREATE INDEX IF NOT EXISTS idx_unshield_tx_hash ON nexora.unshield_transactions(tx_hash);

CREATE TABLE IF NOT EXISTS nexora.inventory (
    id              UUID PRIMARY KEY,
    chain           TEXT NOT NULL,
    token           TEXT NOT NULL,
    token_address   TEXT NOT NULL,
    total_balance   TEXT NOT NULL DEFAULT '0',
    reserved_balance TEXT NOT NULL DEFAULT '0',
    last_refreshed  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_chain_token ON nexora.inventory(chain, token);

CREATE TABLE IF NOT EXISTS nexora.relayer_accounts (
    id              UUID PRIMARY KEY,
    chain           TEXT NOT NULL,
    address         TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relayer_accounts_chain ON nexora.relayer_accounts(chain, address);
`;

export const DROP_SCHEMA_SQL = `
DROP SCHEMA IF EXISTS nexora CASCADE;
`;

export const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: '001_initial_schema', sql: SCHEMA_SQL },
];
