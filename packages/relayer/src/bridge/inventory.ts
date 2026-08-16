import type { RelayerConfig } from '@nexora-protocol/shared';
import { RpcProvider, Contract } from 'starknet';
import type { Database } from '../db/connection';
import type { InventoryRepository } from '../db/repositories';
import { DEFAULT_INVENTORY_REFRESH_INTERVAL_MS } from '@nexora-protocol/shared';

export interface InventoryInfo {
  chain: string;
  token: string;
  tokenAddress: string;
  totalBalance: bigint;
  reservedBalance: bigint;
  availableBalance: bigint;
  lastRefreshed: string;
}

export class InsufficientInventoryError extends Error {
  readonly token: string;
  readonly chain: string;
  readonly available: bigint;
  readonly requested: bigint;

  constructor(chain: string, token: string, available: bigint, requested: bigint) {
    super(
      `Insufficient inventory: ${token} on ${chain}. ` +
      `Available: ${available}, Requested: ${requested}`
    );
    this.name = 'InsufficientInventoryError';
    this.token = token;
    this.chain = chain;
    this.available = available;
    this.requested = requested;
  }
}

export class InventoryManager {
  private config: RelayerConfig;
  private repo: InventoryRepository;
  private provider: RpcProvider;
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly usdcTokenAddress: string;

  constructor(config: RelayerConfig, _db: Database, repo: InventoryRepository) {
    this.config = config;
    this.repo = repo;
    this.usdcTokenAddress = config.usdcTokenAddress;
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });
  }

  async initialize(): Promise<void> {
    await this.refreshBalances();
    this.startAutoRefresh();
  }

  startAutoRefresh(intervalMs: number = DEFAULT_INVENTORY_REFRESH_INTERVAL_MS): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      this.refreshBalances().catch((err) => {
        console.error('Failed to refresh inventory:', err);
      });
    }, intervalMs);
    console.log(`Inventory auto-refresh started (interval: ${intervalMs}ms)`);
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshBalances(): Promise<void> {
    const balance = await this.fetchOnChainBalance();
    const existing = await this.repo.getByChainToken('starknet', 'USDC');

    if (existing) {
      const reserved = BigInt(existing.reserved_balance);
      const total = BigInt(balance.toString());
      await this.repo.updateBalances(existing.id, total.toString(), reserved.toString());
    } else {
      await this.repo.getOrCreate('starknet', 'USDC', this.usdcTokenAddress);
      const record = await this.repo.getByChainToken('starknet', 'USDC');
      if (record) {
        await this.repo.updateBalances(record.id, balance.toString(), '0');
      }
    }

    console.debug(`Inventory refreshed: ${balance} USDC on Starknet`);
  }

  private async fetchOnChainBalance(): Promise<bigint> {
    try {
      const contract = new Contract(
        [
          {
            type: 'function',
            name: 'balance_of',
            inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
            outputs: [{ name: 'balance', type: 'core::integer::u256' }],
          },
        ],
        this.usdcTokenAddress,
        this.provider
      );

      const result = await contract.balance_of(this.config.relayerStarknetAddress);
      const balance = BigInt(result.toString());
      return balance;
    } catch (error) {
      console.error('Failed to fetch on-chain balance:', error);
      return 0n;
    }
  }

  async getAvailable(chain: string, token: string): Promise<bigint> {
    const record = await this.repo.getByChainToken(chain, token);
    if (!record) return 0n;
    const total = BigInt(record.total_balance);
    const reserved = BigInt(record.reserved_balance);
    return total - reserved;
  }

  async getReserved(chain: string, token: string): Promise<bigint> {
    const record = await this.repo.getByChainToken(chain, token);
    if (!record) return 0n;
    return BigInt(record.reserved_balance);
  }

  async getTotal(chain: string, token: string): Promise<bigint> {
    const record = await this.repo.getByChainToken(chain, token);
    if (!record) return 0n;
    return BigInt(record.total_balance);
  }

  async reserve(chain: string, token: string, amount: bigint): Promise<void> {
    const record = await this.repo.getByChainToken(chain, token);
    if (!record) {
      throw new Error(`No inventory record found for ${chain}:${token}`);
    }

    const total = BigInt(record.total_balance);
    const reserved = BigInt(record.reserved_balance);
    const available = total - reserved;

    if (available < amount) {
      throw new InsufficientInventoryError(chain, token, available, amount);
    }

    await this.repo.reserve(record.id, amount.toString());
    console.log(`Reserved ${amount} ${token} on ${chain}. Available: ${available - amount}`);
  }

  async release(chain: string, token: string, amount: bigint): Promise<void> {
    const record = await this.repo.getByChainToken(chain, token);
    if (!record) {
      throw new Error(`No inventory record found for ${chain}:${token}`);
    }

    await this.repo.release(record.id, amount.toString());
    const reserved = await this.getReserved(chain, token);
    console.log(`Released ${amount} ${token} on ${chain}. Reserved: ${reserved}`);
  }

  async getAllInventories(): Promise<InventoryInfo[]> {
    const rows = await this.repo.listAll();
    const result: InventoryInfo[] = [];

    for (const row of rows) {
      const total = BigInt(row.total_balance);
      const reserved = BigInt(row.reserved_balance);
      result.push({
        chain: row.chain,
        token: row.token,
        tokenAddress: row.token_address,
        totalBalance: total,
        reservedBalance: reserved,
        availableBalance: total - reserved,
        lastRefreshed: row.last_refreshed,
      });
    }

    return result;
  }

  async isHealthy(): Promise<boolean> {
    const record = await this.repo.getByChainToken('starknet', 'USDC');
    if (!record) return false;
    const lastRefresh = new Date(record.last_refreshed);
    const staleThreshold = Date.now() - lastRefresh.getTime();
    return staleThreshold < DEFAULT_INVENTORY_REFRESH_INTERVAL_MS * 3;
  }

  close(): void {
    this.stopAutoRefresh();
  }
}
