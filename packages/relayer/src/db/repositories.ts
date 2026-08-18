import type { PoolClient } from 'pg';
import type { IntentStatus, DepositIntent } from '@nexora-protocol/shared';


export interface IntentRow {
  id: string;
  user_id: string;
  source_chain: string;
  destination_chain: string;
  source_token: string;
  destination_token: string;
  amount: string;
  amount_in_base_units: string;
  source_address: string | null;
  destination_address: string;
  privacy_level: string;
  viewing_key_pub: string | null;
  viewing_key_priv: string | null;
  refund_address: string | null;
  reference_id: string | null;
  status: string;
  fail_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SwapRow {
  swap_id: string;
  intent_id: string;
  source_network: string;
  source_token: string;
  destination_network: string;
  destination_token: string;
  amount: string;
  destination_address: string;
  deposit_address: string;
  status: string;
  fee: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositRow {
  id: string;
  intent_id: string;
  swap_id: string;
  source_tx_hash: string;
  from_address: string;
  to_address: string;
  amount: string;
  token: string;
  block_number: string;
  block_hash: string;
  detected_at: string;
  status: string;
  shield_tx_hash: string | null;
}

export interface ShieldTxRow {
  id: string;
  intent_id: string;
  swap_id: string;
  token: string;
  amount: string;
  tx_hash: string;
  note_hash: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface UnshieldTxRow {
  id: string;
  intent_id: string;
  swap_id: string;
  token: string;
  amount: string;
  tx_hash: string;
  note_hash: string | null;
  recipient: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface InventoryRow {
  id: string;
  chain: string;
  token: string;
  token_address: string;
  total_balance: string;
  reserved_balance: string;
  last_refreshed: string;
}

export class IntentRepository {
  constructor(private client: PoolClient) {}

  async create(intent: Omit<DepositIntent, 'createdAt' | 'updatedAt'> & { status?: IntentStatus }): Promise<IntentRow> {
    const id = intent.id;
    const result = await this.client.query(
      `INSERT INTO nexora.intents (
        id, user_id, source_chain, destination_chain, source_token,
        destination_token, amount, amount_in_base_units, source_address,
        destination_address, privacy_level, viewing_key_pub, viewing_key_priv,
        refund_address, reference_id, status, fail_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      RETURNING *`,
      [
        id, intent.userId, intent.sourceChain, intent.destinationChain,
        intent.sourceToken, intent.destinationToken, intent.amount,
        intent.amountInBaseUnits, intent.sourceAddress, intent.destinationAddress,
        intent.privacyLevel, intent.viewingKey?.publicKey, intent.viewingKey?.privateKey,
        intent.refundAddress, intent.referenceId, intent.status ?? 'pending', intent.failReason,
      ]
    );
    return result.rows[0];
  }

  async getById(id: string): Promise<IntentRow | null> {
    const result = await this.client.query('SELECT * FROM nexora.intents WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async getByReferenceId(referenceId: string): Promise<IntentRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.intents WHERE reference_id = $1',
      [referenceId]
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: IntentStatus, failReason?: string): Promise<IntentRow> {
    const result = await this.client.query(
      `UPDATE nexora.intents
       SET status = $1, fail_reason = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, failReason ?? null, id]
    );
    return result.rows[0];
  }

  async updateViewingKey(id: string, publicKey: string, privateKey: string): Promise<IntentRow> {
    const result = await this.client.query(
      `UPDATE nexora.intents
       SET viewing_key_pub = $1, viewing_key_priv = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [publicKey, privateKey, id]
    );
    return result.rows[0];
  }

  async listByStatus(statuses: IntentStatus[]): Promise<IntentRow[]> {
    const placeholders = statuses.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.client.query(
      `SELECT * FROM nexora.intents WHERE status IN (${placeholders}) ORDER BY created_at ASC`,
      statuses
    );
    return result.rows;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.client.query(
      `SELECT status, COUNT(*) as count FROM nexora.intents GROUP BY status`
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts;
  }

  async getPoolMetrics(): Promise<{
    totalDeposits: number;
    totalVolume: string;
    activeUsers: number;
    avgDepositSize: string;
    completedCount: number;
    shieldedCount: number;
  }> {
    const result = await this.client.query(
      `SELECT
         COUNT(*)::int AS total_deposits,
         COALESCE(SUM(CASE WHEN status IN ('completed', 'shielded') THEN amount::numeric ELSE 0 END), 0)::text AS total_volume,
         COUNT(DISTINCT user_id)::int AS active_users,
         COALESCE(AVG(CASE WHEN status IN ('completed', 'shielded') THEN amount::numeric ELSE NULL END), 0)::text AS avg_deposit_size,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
         COUNT(*) FILTER (WHERE status = 'shielded')::int AS shielded_count
       FROM nexora.intents`
    );
    const row = result.rows[0] ?? {};
    return {
      totalDeposits: parseInt(row.total_deposits ?? '0', 10),
      totalVolume: row.total_volume ?? '0',
      activeUsers: parseInt(row.active_users ?? '0', 10),
      avgDepositSize: row.avg_deposit_size ?? '0',
      completedCount: parseInt(row.completed_count ?? '0', 10),
      shieldedCount: parseInt(row.shielded_count ?? '0', 10),
    };
  }
}

export class SwapRepository {
  constructor(private client: PoolClient) {}

  async create(swap: Omit<SwapRow, 'created_at' | 'updated_at'>): Promise<SwapRow> {
    const result = await this.client.query(
      `INSERT INTO nexora.swaps (
        swap_id, intent_id, source_network, source_token, destination_network,
        destination_token, amount, destination_address, deposit_address,
        status, fee, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        swap.swap_id, swap.intent_id, swap.source_network, swap.source_token,
        swap.destination_network, swap.destination_token, swap.amount,
        swap.destination_address, swap.deposit_address, swap.status, swap.fee,
      ]
    );
    return result.rows[0];
  }

  async getBySwapId(swapId: string): Promise<SwapRow | null> {
    const result = await this.client.query('SELECT * FROM nexora.swaps WHERE swap_id = $1', [swapId]);
    return result.rows[0] ?? null;
  }

  async getByIntentId(intentId: string): Promise<SwapRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.swaps WHERE intent_id = $1 ORDER BY created_at DESC LIMIT 1',
      [intentId]
    );
    return result.rows[0] ?? null;
  }

  async getPendingByDestinationAddress(destinationAddress: string): Promise<SwapRow[]> {
    const result = await this.client.query(
      'SELECT * FROM nexora.swaps WHERE destination_address = $1 AND status IN ($2, $3, $4, $5) ORDER BY created_at ASC',
      [destinationAddress, 'pending', 'awaiting_deposit', 'awaiting_bridge', 'bridging']
    );
    return result.rows;
  }

  async updateStatus(swapId: string, status: string, fee?: number): Promise<SwapRow> {
    const result = await this.client.query(
      `UPDATE nexora.swaps
       SET status = $1, fee = COALESCE($2, fee), updated_at = NOW()
       WHERE swap_id = $3
       RETURNING *`,
      [status, fee ?? null, swapId]
    );
    return result.rows[0];
  }
}

export class DepositRepository {
  constructor(private client: PoolClient) {}

  async exists(sourceTxHash: string, fromAddress: string, toAddress: string, blockNumber: number): Promise<boolean> {
    const result = await this.client.query(
      'SELECT 1 FROM nexora.deposits WHERE source_tx_hash = $1 AND from_address = $2 AND to_address = $3 AND block_number = $4',
      [sourceTxHash, fromAddress, toAddress, blockNumber]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async create(deposit: {
    id: string;
    intent_id: string;
    swap_id: string;
    source_tx_hash: string;
    from_address: string;
    to_address: string;
    amount: string;
    token: string;
    block_number: number;
    block_hash: string;
    status?: string;
  }): Promise<DepositRow> {
    const result = await this.client.query(
      `INSERT INTO nexora.deposits (
        id, intent_id, swap_id, source_tx_hash, from_address, to_address,
        amount, token, block_number, block_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        deposit.id, deposit.intent_id, deposit.swap_id, deposit.source_tx_hash,
        deposit.from_address, deposit.to_address, deposit.amount, deposit.token,
        deposit.block_number, deposit.block_hash, deposit.status ?? 'pending',
      ]
    );
    return result.rows[0];
  }

  async getByIntentId(intentId: string): Promise<DepositRow[]> {
    const result = await this.client.query(
      'SELECT * FROM nexora.deposits WHERE intent_id = $1 ORDER BY detected_at ASC',
      [intentId]
    );
    return result.rows;
  }

  async getByToAddress(toAddress: string): Promise<DepositRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.deposits WHERE to_address = $1 ORDER BY detected_at DESC LIMIT 1',
      [toAddress]
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: string, shieldTxHash?: string): Promise<DepositRow> {
    const result = await this.client.query(
      `UPDATE nexora.deposits
       SET status = $1, shield_tx_hash = COALESCE($2, shield_tx_hash)
       WHERE id = $3
       RETURNING *`,
      [status, shieldTxHash ?? null, id]
    );
    return result.rows[0];
  }
}

export class ShieldTxRepository {
  constructor(private client: PoolClient) {}

  async create(record: {
    id: string;
    intent_id: string;
    swap_id: string;
    token: string;
    amount: string;
    tx_hash: string;
    note_hash?: string | null;
  }): Promise<ShieldTxRow> {
    const result = await this.client.query(
      `INSERT INTO nexora.shield_transactions (
        id, intent_id, swap_id, token, amount, tx_hash, note_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
      [
        record.id, record.intent_id, record.swap_id, record.token,
        record.amount, record.tx_hash, record.note_hash ?? null,
      ]
    );
    return result.rows[0];
  }

  async getByTxHash(txHash: string): Promise<ShieldTxRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.shield_transactions WHERE tx_hash = $1',
      [txHash]
    );
    return result.rows[0] ?? null;
  }

  async getByIntentId(intentId: string): Promise<ShieldTxRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.shield_transactions WHERE intent_id = $1 ORDER BY created_at DESC LIMIT 1',
      [intentId]
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: string): Promise<ShieldTxRow> {
    const result = await this.client.query(
      `UPDATE nexora.shield_transactions
       SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  async updateNoteHash(id: string, noteHash: string): Promise<ShieldTxRow> {
    const result = await this.client.query(
      'UPDATE nexora.shield_transactions SET note_hash = $1 WHERE id = $2 RETURNING *',
      [noteHash, id]
    );
    return result.rows[0];
  }
}

export class UnshieldTxRepository {
  constructor(private client: PoolClient) {}

  async create(record: {
    id: string;
    intent_id: string;
    swap_id: string;
    token: string;
    amount: string;
    tx_hash: string;
    note_hash?: string | null;
    recipient: string;
  }): Promise<UnshieldTxRow> {
    const result = await this.client.query(
      `INSERT INTO nexora.unshield_transactions (
        id, intent_id, swap_id, token, amount, tx_hash, note_hash, recipient, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *`,
      [
        record.id, record.intent_id, record.swap_id, record.token,
        record.amount, record.tx_hash, record.note_hash ?? null, record.recipient,
      ]
    );
    return result.rows[0];
  }

  async getByTxHash(txHash: string): Promise<UnshieldTxRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.unshield_transactions WHERE tx_hash = $1',
      [txHash]
    );
    return result.rows[0] ?? null;
  }

  async getByIntentId(intentId: string): Promise<UnshieldTxRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.unshield_transactions WHERE intent_id = $1 ORDER BY created_at DESC LIMIT 1',
      [intentId]
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: string): Promise<UnshieldTxRow> {
    const result = await this.client.query(
      `UPDATE nexora.unshield_transactions
       SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }
}

export class InventoryRepository {
  constructor(private client: PoolClient) {}

  async getOrCreate(chain: string, token: string, tokenAddress: string): Promise<InventoryRow> {
    const result = await this.client.query(
      `INSERT INTO nexora.inventory (id, chain, token, token_address, total_balance, reserved_balance)
       VALUES (gen_random_uuid(), $1, $2, $3, '0', '0')
       ON CONFLICT (chain, token) WHERE chain = $1 AND token = $2 DO UPDATE SET token_address = EXCLUDED.token_address
       RETURNING *`,
      [chain, token, tokenAddress]
    );
    const row = result.rows[0];
    if (!row) {
      const existing = await this.getByChainToken(chain, token);
      if (existing) return existing;
      throw new Error('Failed to get or create inventory record');
    }
    return row;
  }

  async getByChainToken(chain: string, token: string): Promise<InventoryRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.inventory WHERE chain = $1 AND token = $2',
      [chain, token]
    );
    return result.rows[0] ?? null;
  }

  async updateBalances(id: string, totalBalance: string, reservedBalance: string): Promise<InventoryRow> {
    const result = await this.client.query(
      `UPDATE nexora.inventory
       SET total_balance = $1, reserved_balance = $2, last_refreshed = NOW()
       WHERE id = $3
       RETURNING *`,
      [totalBalance, reservedBalance, id]
    );
    return result.rows[0];
  }

  async reserve(id: string, amount: string): Promise<InventoryRow> {
    const result = await this.client.query(
      `UPDATE nexora.inventory
       SET reserved_balance = (reserved_balance::numeric + $1::numeric)::text,
           last_refreshed = NOW()
       WHERE id = $2
       RETURNING *`,
      [amount, id]
    );
    return result.rows[0];
  }

  async release(id: string, amount: string): Promise<InventoryRow> {
    const result = await this.client.query(
      `UPDATE nexora.inventory
       SET reserved_balance = GREATEST(0, (reserved_balance::numeric - $1::numeric))::text,
           last_refreshed = NOW()
       WHERE id = $2
       RETURNING *`,
      [amount, id]
    );
    return result.rows[0];
  }

  async listAll(): Promise<InventoryRow[]> {
    const result = await this.client.query('SELECT * FROM nexora.inventory ORDER BY chain, token');
    return result.rows;
  }
}

export class RelayerAccountRepository {
  constructor(private client: PoolClient) {}

  async getActive(chain: string): Promise<InventoryRow | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.relayer_accounts WHERE chain = $1 AND is_active = TRUE LIMIT 1',
      [chain]
    );
    return result.rows[0] ?? null;
  }

  async getByAddress(chain: string, address: string): Promise<any | null> {
    const result = await this.client.query(
      'SELECT * FROM nexora.relayer_accounts WHERE chain = $1 AND address = $2',
      [chain, address]
    );
    return result.rows[0] ?? null;
  }

  async create(record: {
    chain: string;
    address: string;
    encryptedPrivateKey: string;
  }): Promise<any> {
    const result = await this.client.query(
      `INSERT INTO nexora.relayer_accounts (id, chain, address, encrypted_private_key, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, TRUE, NOW())
       RETURNING *`,
      [record.chain, record.address, record.encryptedPrivateKey]
    );
    return result.rows[0];
  }
}
