import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { InventoryManager, InsufficientInventoryError } from '../src/bridge/inventory';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../src/db/connection';
import type { InventoryRepository } from '../src/db/repositories';

vi.mock('starknet', () => ({
  RpcProvider: vi.fn().mockImplementation(() => ({
    getBlock: vi.fn().mockResolvedValue({ block_number: '100' }).mockReturnValue({ toString: () => '100' }),
  })),
  Contract: vi.fn().mockImplementation(() => ({
    balance_of: vi.fn().mockResolvedValue({ toString: () => '1000000000' }),
  })),
  num: {
    toHex: vi.fn().mockReturnValue('0x1234'),
    toBigInt: vi.fn().mockReturnValue(100n),
  },
}));

function createMockConfig(overrides: Partial<RelayerConfig> = {}): RelayerConfig {
  return {
    port: 3001,
    dbUrl: 'postgres://localhost:5432/test',
    layerSwapApiKey: 'test-key',
    layerSwapApiUrl: 'https://api.layerswap.io',
    starknetRpcUrl: 'https://rpc.starknet.lava.build',
    starknetSepoliaRpcUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/test',
    poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    privacyHubAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    relayerPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    relayerStarknetAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    relayerInventoryAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    environment: 'MAINNET',
    proverUrl: 'http://localhost:8080',
    indexerUrl: 'http://localhost:8081',
    paymasterRpcUrl: '',
    paymasterAddress: '',
    usdcTokenAddress: '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b',
    logLevel: 'info',
    pollIntervalMs: 15000,
    txWaitTimeoutMs: 120000,
    maxRetries: 3,
    ...overrides,
  };
}

function createMockDatabase(): Database {
  return {
    getClient: vi.fn(),
    query: vi.fn(),
    executeInTransaction: vi.fn(),
    close: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn(),
  } as any;
}

function createMockInventoryRepo(total: string, reserved: string = '0'): InventoryRepository {
  return {
    getByChainToken: vi.fn().mockResolvedValue({
      id: 'test-id',
      chain: 'starknet',
      token: 'USDC',
      token_address: '0x053c...',
      total_balance: total,
      reserved_balance: reserved,
      last_refreshed: new Date().toISOString(),
    }),
    getOrCreate: vi.fn().mockResolvedValue({
      id: 'test-id',
      chain: 'starknet',
      token: 'USDC',
      token_address: '0x053c...',
      total_balance: total,
      reserved_balance: reserved,
      last_refreshed: new Date().toISOString(),
    }),
    updateBalances: vi.fn().mockResolvedValue({
      id: 'test-id',
      chain: 'starknet',
      token: 'USDC',
      token_address: '0x053c...',
      total_balance: total,
      reserved_balance: reserved,
      last_refreshed: new Date().toISOString(),
    }),
    reserve: vi.fn().mockResolvedValue({
      id: 'test-id',
      chain: 'starknet',
      token: 'USDC',
      token_address: '0x053c...',
      total_balance: total,
      reserved_balance: (BigInt(reserved) + 1000000n).toString(),
      last_refreshed: new Date().toISOString(),
    }),
    release: vi.fn().mockResolvedValue({
      id: 'test-id',
      chain: 'starknet',
      token: 'USDC',
      token_address: '0x053c...',
      total_balance: total,
      reserved_balance: (BigInt(reserved) - 1000000n).toString(),
      last_refreshed: new Date().toISOString(),
    }),
    listAll: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('InventoryManager', () => {
  let mockConfig: RelayerConfig;
  let mockDb: Database;
  let mockRepo: InventoryRepository;
  let manager: InventoryManager;

  beforeEach(() => {
    mockConfig = createMockConfig();
    mockDb = createMockDatabase();
    mockRepo = createMockInventoryRepo('1000000000', '0');

    manager = new InventoryManager(mockConfig, mockDb, mockRepo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reserve', () => {
    it('should reserve available inventory', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue({
        id: 'test-id',
        total_balance: '1000000000',
        reserved_balance: '0',
      } as any);
      mockRepo.reserve = vi.fn().mockResolvedValue({} as any);

      await expect(manager.reserve('starknet', 'USDC', 1000000n)).resolves.toBeUndefined();
      expect(mockRepo.reserve).toHaveBeenCalledWith('test-id', '1000000');
    });

    it('should throw InsufficientInventoryError when not enough available', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue({
        id: 'test-id',
        total_balance: '500',
        reserved_balance: '0',
      } as any);

      await expect(
        manager.reserve('starknet', 'USDC', 1000000n)
      ).rejects.toThrow(InsufficientInventoryError);
    });

    it('should throw when no inventory record exists', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue(null);

      await expect(
        manager.reserve('starknet', 'USDC', 100n)
      ).rejects.toThrow('No inventory record found');
    });
  });

  describe('release', () => {
    it('should release reserved inventory', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue({
        id: 'test-id',
        total_balance: '1000000000',
        reserved_balance: '1000000',
      } as any);
      mockRepo.release = vi.fn().mockResolvedValue({} as any);
      mockRepo.getByChainToken = vi.fn()
        .mockResolvedValueOnce({ id: 'test-id', total_balance: '1000000000', reserved_balance: '1000000' } as any)
        .mockResolvedValueOnce({ id: 'test-id', total_balance: '1000000000', reserved_balance: '0' } as any);

      await expect(manager.release('starknet', 'USDC', 1000000n)).resolves.toBeUndefined();
      expect(mockRepo.release).toHaveBeenCalledWith('test-id', '1000000');
    });

    it('should throw when no inventory record exists', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue(null);

      await expect(
        manager.release('starknet', 'USDC', 100n)
      ).rejects.toThrow('No inventory record found');
    });
  });

  describe('getAvailable', () => {
    it('should return available balance (total - reserved)', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue({
        total_balance: '1000000000',
        reserved_balance: '200000000',
      } as any);

      const available = await manager.getAvailable('starknet', 'USDC');
      expect(available).toBe(800000000n);
    });

    it('should return 0 when no record exists', async () => {
      mockRepo.getByChainToken = vi.fn().mockResolvedValue(null);
      const available = await manager.getAvailable('starknet', 'USDC');
      expect(available).toBe(0n);
    });
  });

  describe('getAllInventories', () => {
    it('should return all inventory records', async () => {
      mockRepo.listAll = vi.fn().mockResolvedValue([
        {
          id: '1',
          chain: 'starknet',
          token: 'USDC',
          token_address: '0x053c...',
          total_balance: '5000000000',
          reserved_balance: '1000000000',
          last_refreshed: new Date().toISOString(),
        },
      ]);

      const inventories = await manager.getAllInventories();
      expect(inventories).toHaveLength(1);
      expect(inventories[0].totalBalance).toBe(5000000000n);
      expect(inventories[0].reservedBalance).toBe(1000000000n);
      expect(inventories[0].availableBalance).toBe(4000000000n);
    });
  });
});
