import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LayerSwapRelayer } from '../src/bridge/layerswap-relayer';
import { ArbitrumAdapter, type BridgeReservation } from '@nexora-protocol/sdk';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../src/db/connection';

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
    pollIntervalMs: 15000,
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

describe('LayerSwapRelayer', () => {
  let mockConfig: RelayerConfig;
  let mockDb: Database;
  let relayer: LayerSwapRelayer;

  beforeEach(() => {
    mockConfig = createMockConfig();
    mockDb = createMockDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should construct with valid config', () => {
      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      expect(relayer['config']).toBe(mockConfig);
      expect(relayer['adapter']).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should pass when bridge is healthy', async () => {
      vi.spyOn(ArbitrumAdapter.prototype, 'checkHealth').mockResolvedValue(undefined);
      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      await expect(relayer.checkHealth()).resolves.toBeUndefined();
    });

    it('should throw when bridge is unhealthy', async () => {
      vi.spyOn(ArbitrumAdapter.prototype, 'checkHealth').mockRejectedValue(new Error('API down'));
      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      await expect(relayer.checkHealth()).rejects.toThrow('API down');
    }, 10000);
  });

  describe('estimateFee', () => {
    it('should return quote from adapter', async () => {
      const mockQuote = {
        sourceNetwork: 'ARBITRUM',
        sourceToken: 'USDC',
        destinationNetwork: 'STARKNET',
        destinationToken: 'USDC',
        amount: 100,
        receiveAmount: 99.5,
        totalFee: 0.5,
        blockchainFee: 0.3,
        serviceFee: 0.2,
        avgCompletionTime: '~2 minutes',
        minAmount: 0.001,
        maxAmount: 10000,
      };

      vi.spyOn(ArbitrumAdapter.prototype, 'estimateFee').mockResolvedValue(mockQuote);

      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      const quote = await relayer.estimateFee('USDC', 'USDC', 100);

      expect(quote.receiveAmount).toBeCloseTo(99.5);
      expect(quote.totalFee).toBeCloseTo(0.5);
    });
  });

  describe('getLimits', () => {
    it('should return min and max limits', async () => {
      vi.spyOn(ArbitrumAdapter.prototype, 'getLimits').mockResolvedValue({ min: 0.001, max: 10000 });

      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      const limits = await relayer.getLimits('USDC', 'USDC', 100);

      expect(limits.min).toBeCloseTo(0.001);
      expect(limits.max).toBeCloseTo(10000);
    });
  });

  describe('reserveBridge', () => {
    it('should create reservation and store swap record', async () => {
      const mockReservation: BridgeReservation = {
        swapId: 'swap-123',
        sourceNetwork: 'ARBITRUM_MAINNET',
        sourceToken: 'USDC',
        destinationNetwork: 'STARKNET_MAINNET',
        destinationToken: 'USDC',
        amount: 100,
        destinationAddress: '0x049d37a6c5e9d8b70239e4e3a7a2e9a1e8e7d6c5b4a39281706f5e4d3c2b1a09',
        depositAddress: '0xdeposit',
        refundAddress: '0xrefund',
        referenceId: 'intent-1',
        status: 'user_transfer_pending',
        depositActions: [
          {
            type: 'transfer',
            toAddress: '0xdeposit',
            amount: 100,
            amountInBaseUnits: '100000000',
            order: 1,
            network: 'ARBITRUM_MAINNET',
            token: 'USDC',
            callData: null,
          },
        ],
        fee: 0.5,
        createdAt: '2024-01-01T00:00:00Z',
        inputTransactionHash: null,
        outputTransactionHash: null,
      };

      vi.spyOn(ArbitrumAdapter.prototype, 'reserveBridge').mockResolvedValue(mockReservation);

      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      const result = await relayer.reserveBridge(
        'intent-1',
        'USDC',
        'USDC',
        100,
        '0xsource',
        '0xrefund',
        'intent-1'
      );

      expect(result.swapId).toBe('swap-123');
      expect(result.depositAddress).toBe('0xdeposit');
      expect(result.fee).toBe(0.5);
      expect(result.depositActions).toHaveLength(1);
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      await expect(
        relayer.reserveBridge('intent-1', 'USDC', 'USDC', 0)
      ).rejects.toThrow();
    });
  });

  describe('getBridgeStatus', () => {
    it('should return status from adapter', async () => {
      vi.spyOn(ArbitrumAdapter.prototype, 'getBridgeStatus').mockResolvedValue({
        swapId: 'swap-123',
        status: 'completed',
        confirmations: 5,
        maxConfirmations: 12,
      });

      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      const status = await relayer.getBridgeStatus('swap-123');

      expect(status.status).toBe('completed');
    });

    it('should throw InvalidArgumentError for empty swapId', async () => {
      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      await expect(relayer.getBridgeStatus('')).rejects.toThrow();
    });
  });

  describe('getDepositActions', () => {
    it('should return deposit actions', async () => {
      const mockActions = [
        {
          type: 'transfer' as const,
          toAddress: '0xdeposit',
          amount: 100,
          amountInBaseUnits: '100000000',
          order: 1,
          network: 'ARBITRUM_MAINNET',
          token: 'USDC',
          callData: null,
        },
      ];

      vi.spyOn(ArbitrumAdapter.prototype, 'getDepositActions').mockResolvedValue(mockActions);

      const relayer = new LayerSwapRelayer(mockConfig, mockDb);
      const actions = await relayer.getDepositActions('swap-123');

      expect(actions).toHaveLength(1);
      expect(actions[0].toAddress).toBe('0xdeposit');
    });
  });
});
