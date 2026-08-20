import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DepositEventListener, type ProcessedDeposit } from '../src/bridge/deposit-listener';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../src/db/connection';
import type { DepositRepository, SwapRepository } from '../src/db/repositories';

vi.mock('starknet', () => ({
  RpcProvider: vi.fn().mockImplementation(() => ({
    getEvents: vi.fn().mockResolvedValue({ events: [] }),
    getBlock: vi.fn().mockResolvedValue({ block_number: '0x64' }),
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
    relayerStarknetAddress: '0x049d37a6c5e9d8b70239e4e3a7a2e9a1e8e7d6c5b4a39281706f5e4d3c2b1a09',
    relayerInventoryAddress: '0x049d37a6c5e9d8b70239e4e3a7a2e9a1e8e7d6c5b4a39281706f5e4d3c2b1a09',
    environment: 'MAINNET',
    proverUrl: 'http://localhost:8080',
    indexerUrl: 'http://localhost:8081',
    paymasterRpcUrl: '',
    paymasterAddress: '',
    usdcTokenAddress: '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b',
    logLevel: 'info',
    pollIntervalMs: 1000,
    txWaitTimeoutMs: 120000,
    maxRetries: 3,
    ...overrides,
  };
}

function createMockDb(): Database {
  return {
    getClient: vi.fn(),
    query: vi.fn(),
    executeInTransaction: vi
      .fn()
      .mockImplementation(async (fn: any) => fn({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
    close: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn(),
  } as any;
}

describe('DepositEventListener', () => {
  let mockConfig: RelayerConfig;
  let mockDb: Database;
  let mockDepositRepo: DepositRepository;
  let mockSwapRepo: SwapRepository;
  let listener: DepositEventListener;

  beforeEach(() => {
    mockConfig = createMockConfig();
    mockDb = createMockDb();
    mockDepositRepo = {
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({}),
      getByIntentId: vi.fn().mockResolvedValue([]),
      getByToAddress: vi.fn().mockResolvedValue(null),
      updateStatus: vi.fn().mockResolvedValue({}),
    } as any;

    mockSwapRepo = {
      getPendingByDestinationAddress: vi.fn().mockResolvedValue([
        {
          swap_id: 'swap-123',
          intent_id: 'intent-1',
          amount: '100',
          status: 'awaiting_deposit',
        },
      ]),
      getBySwapId: vi.fn().mockResolvedValue(null),
     getPendingByDestinationAddress: vi.fn().mockResolvedValue([]),
    } as any;

    listener = new DepositEventListener(
      mockConfig,
      mockDb,
      mockDepositRepo,
      mockSwapRepo
    );
  });

  describe('extractAddress', () => {
    it('should extract hex string address', () => {
      const result = (listener as any).extractAddress('0x1234');
      expect(result).toBe('0x1234');
    });

    it('should add 0x prefix to plain hex', () => {
      const result = (listener as any).extractAddress('1234');
      expect(result).toBe('0x1234');
    });

    it('should handle bigint', () => {
      const result = (listener as any).extractAddress(1234n);
      expect(result).toMatch(/^0x/);
    });

    it('should return empty for undefined', () => {
      const result = (listener as any).extractAddress(undefined);
      expect(result).toBe('');
    });
  });

  describe('extractAmount', () => {
    it('should handle bigint', () => {
      const result = (listener as any).extractAmount([1000000n]);
      expect(result).toBe(1000000n);
    });

    it('should handle numeric string', () => {
      const result = (listener as any).extractAmount(['1000000']);
      expect(result).toBe(1000000n);
    });

    it('should handle number', () => {
      const result = (listener as any).extractAmount([1000000]);
      expect(result).toBe(1000000n);
    });

    it('should handle u256 array [low, high]', () => {
      const result = (listener as any).extractAmount([[ '1000000', '0' ]]);
      expect(result).toBe(1000000n);
    });

    it('should return 0n for empty data', () => {
      const result = (listener as any).extractAmount([]);
      expect(result).toBe(0n);
    });

    it('should return 0n for undefined data', () => {
      const result = (listener as any).extractAmount(undefined);
      expect(result).toBe(0n);
    });
  });

  describe('parseBlockNumber', () => {
    it('should parse string block number', () => {
      const result = (listener as any).parseBlockNumber('100');
      expect(result).toBe(100);
    });

    it('should parse numeric string', () => {
      const result = (listener as any).parseBlockNumber('0x64');
      expect(result).toBe(100);
    });

    it('should pass through number', () => {
      const result = (listener as any).parseBlockNumber(100);
      expect(result).toBe(100);
    });
  });

  describe('matchDepositToSwap', () => {
    it('should return null when no pending swaps', async () => {
      mockSwapRepo.getPendingByDestinationAddress = vi.fn().mockResolvedValue([]);
      const result = await (listener as any).matchDepositToSwap(1000000n);
      expect(result).toBeNull();
    });

    it('should match swap by amount within tolerance', async () => {
      mockSwapRepo.getPendingByDestinationAddress = vi.fn().mockResolvedValue([
        { swap_id: 'swap-1', intent_id: 'intent-1', amount: '1', status: 'awaiting_deposit' },
      ]);

      const result = await (listener as any).matchDepositToSwap(1000000n);
      expect(result).not.toBeNull();
      expect(result.swap_id).toBe('swap-1');
    });

    it('should return null when no amount match', async () => {
      mockSwapRepo.getPendingByDestinationAddress = vi.fn().mockResolvedValue([
        { swap_id: 'swap-1', intent_id: 'intent-1', amount: '999', status: 'awaiting_deposit' },
        { swap_id: 'swap-2', intent_id: 'intent-2', amount: '888', status: 'awaiting_deposit' },
      ]);

      const result = await (listener as any).matchDepositToSwap(1000000n);
      expect(result).toBeNull();
    });
  });

  describe('handleDepositEvent', () => {
    it('should skip events with missing from address', async () => {
      const event = {
        keys: ['', '0x123'],
        transaction_hash: '0xtxhash',
        block_number: '0x64',
      };

      const result = await (listener as any).handleDepositEvent(event);
      expect(result).toBeNull();
    });

    it('should skip events where to address does not match relayer', async () => {
      const event = {
        keys: ['', '0x123', '0x999'],
        transaction_hash: '0xtxhash',
        block_number: '0x64',
        data: ['1000000'],
      };

      const result = await (listener as any).handleDepositEvent(event);
      expect(result).toBeNull();
    });

    it('should skip already-recorded deposits', async () => {
      mockDepositRepo.exists = vi.fn().mockResolvedValue(true);

      const event = {
        keys: ['', '0x123', '0x049d37a6c5e9d8b70239e4e3a7a2e9a1e8e7d6c5b4a39281706f5e4d3c2b1a09'],
        transaction_hash: '0xtxhash',
        block_number: '0x64',
        data: ['1000000'],
      };

      const result = await (listener as any).handleDepositEvent(event);
      expect(result).toBeNull();
      expect(mockDepositRepo.exists).toHaveBeenCalled();
    });

    it('should call callback when deposit is detected', async () => {
      mockDepositRepo.exists = vi.fn().mockResolvedValue(false);

      const callback = vi.fn().mockResolvedValue(undefined);
      listener.setCallback(callback as any);

      const event = {
        keys: ['', '0x123', '0x049d37a6c5e9d8b70239e4e3a7a2e9a1e8e7d6c5b4a39281706f5e4d3c2b1a09'],
        transaction_hash: '0xtxhash123',
        block_number: '0x64',
        block_hash: '0xblockhash',
        data: ['1000000'],
      };

      const result = await (listener as any).handleDepositEvent(event);
      expect(result).not.toBeNull();
      expect(result.fromAddress).toBe('0x123');
      expect(result.amount).toBe(1000000n);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        sourceTxHash: '0xtxhash123',
        amount: 1000000n,
      }));
    });
  });

  describe('lifecycle', () => {
    it('should report not running when stopped', () => {
      expect(listener.isRunning()).toBe(false);
    });

    it('should report running when started', async () => {
      vi.spyOn(listener as any, 'getCurrentBlock').mockResolvedValue(100);
      await listener.start(1);

      expect(listener.isRunning()).toBe(true);
      await listener.stop();
      expect(listener.isRunning()).toBe(false);
    });
  });
});
