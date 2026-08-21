import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { E2EOrchestrator, type IntentSubmission } from '../src/flow/e2e-flow';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../src/db/connection';
import type { IntentRepository, SwapRepository, DepositRepository, ShieldTxRepository } from '../src/db/repositories';
import type { LayerSwapRelayer } from '../src/bridge/layerswap-relayer';
import type { RelayerPrivacyHubClient } from '../src/privacy/privacy-hub-client';
import type { InventoryManager } from '../src/bridge/inventory';

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
  const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
  return {
    getClient: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn(),
    executeInTransaction: vi.fn().mockImplementation(async (fn: any) => fn(mockClient)),
    close: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn(),
  } as any;
}

function createMockRepo(): any {
  return {
    create: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue(null),
    getByReferenceId: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue({}),
    updateViewingKey: vi.fn().mockResolvedValue({}),
    listByStatus: vi.fn().mockResolvedValue([]),
    countByStatus: vi.fn().mockResolvedValue({}),
    getBySwapId: vi.fn().mockResolvedValue(null),
    getByIntentId: vi.fn().mockResolvedValue(null),
    getPendingByDestinationAddress: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue({}),
    exists: vi.fn().mockResolvedValue(false),
    getByIntentId: vi.fn().mockResolvedValue([]),
    getByToAddress: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue({}),
    getByIntentId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    updateStatus: vi.fn().mockResolvedValue({}),
    updateNoteHash: vi.fn().mockResolvedValue({}),
    listAll: vi.fn().mockResolvedValue([]),
    reserve: vi.fn().mockResolvedValue({}),
    release: vi.fn().mockResolvedValue({}),
    getByChainToken: vi.fn().mockResolvedValue(null),
    getOrCreate: vi.fn().mockResolvedValue({}),
    updateBalances: vi.fn().mockResolvedValue({}),
  };
}

describe('E2EOrchestrator Integration', () => {
  let mockConfig: RelayerConfig;
  let mockDb: Database;
  let mockIntentRepo: IntentRepository;
  let mockSwapRepo: SwapRepository;
  let mockDepositRepo: DepositRepository;
  let mockShieldRepo: ShieldTxRepository;
  let mockBridge: LayerSwapRelayer;
  let mockPrivacyHub: RelayerPrivacyHubClient;
  let mockInventory: InventoryManager;
  let mockFallbackBridge: any;
  let orchestrator: E2EOrchestrator;

  beforeEach(() => {
    mockConfig = createMockConfig();
    mockDb = createMockDb();
    mockDb.executeInTransaction = vi
      .fn()
      .mockImplementation(async (fn: any) => fn({ query: vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 }) }));
    mockIntentRepo = createMockRepo();
    mockSwapRepo = createMockRepo();
    mockDepositRepo = createMockRepo();
    mockShieldRepo = createMockRepo();
    mockBridge = {
      checkHealth: vi.fn().mockResolvedValue(undefined),
      estimateFee: vi.fn().mockResolvedValue({
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
      }),
      getLimits: vi.fn().mockResolvedValue({ min: 0.001, max: 10000 }),
      reserveBridge: vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        depositAddress: '0xdeposit',
        depositActions: [],
        fee: 0.5,
        amount: 100,
        sourceToken: 'USDC',
        destinationToken: 'USDC',
        status: 'awaiting_deposit',
      }),
      getBridgeStatus: vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'completed',
        confirmations: 5,
        maxConfirmations: 12,
      }),
      refundBridge: vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'refunded',
        refundTxHash: '0xrefund123',
      }),
    } as any;

    mockFallbackBridge = {
      checkHealth: vi.fn().mockResolvedValue(undefined),
      getBridgeStatus: vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'pending',
        confirmations: 0,
        maxConfirmations: 1,
      }),
      reserveBridge: vi.fn().mockResolvedValue({
        swapId: 'swap-456',
        depositAddress: '0xdeposit2',
        depositActions: [],
        fee: 0,
        amount: 100,
        sourceToken: 'USDC',
        destinationToken: 'USDC',
        status: 'awaiting_deposit',
      }),
    } as any;

    mockPrivacyHub = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      isProverAvailable: vi.fn().mockReturnValue(true),
      shield: vi.fn().mockResolvedValue({
        transactionHash: '0xshield123',
        noteHash: '0xnote123',
        amount: 100000000n,
        token: '0x053c...',
        status: 'ACCEPTED_ON_L2',
      }),
      getBalance: vi.fn().mockResolvedValue(100000000n),
    } as any;

    mockInventory = {
      reserve: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      getAvailable: vi.fn().mockResolvedValue(1000000000n),
      getTotal: vi.fn().mockResolvedValue(1000000000n),
      getReserved: vi.fn().mockResolvedValue(0n),
      getAllInventories: vi.fn().mockResolvedValue([]),
      isHealthy: vi.fn().mockResolvedValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
      close: vi.fn(),
    } as any;

    orchestrator = new E2EOrchestrator(
      mockConfig,
      mockDb,
      mockIntentRepo,
      mockSwapRepo,
      mockDepositRepo,
      mockShieldRepo,
      mockBridge,
      mockPrivacyHub,
      mockInventory,
      mockFallbackBridge
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processIntent', () => {
    const submission: IntentSubmission = {
      userId: 'user-1',
      sourceChain: 'arbitrum',
      sourceToken: 'USDC',
      destinationChain: 'starknet',
      destinationToken: 'USDC',
      amount: '100',
      amountInBaseUnits: '100000000',
      sourceAddress: '0xsource',
      destinationAddress: '0xdest',
      privacyLevel: 'standard',
      refundAddress: '0xrefund',
      viewingKey: { publicKey: '0x01', privateKey: '0x02' },
    };

    it('should process intent successfully', async () => {
      const result = await orchestrator.processIntent(submission);

      expect(result.intentId).toMatch(/^intent_/);
      expect(result.status).toBe('awaiting_deposit');
      expect(result.depositAddress).toBe('0xdeposit');
      expect(result.fee).toBe(0.5);
    });

    it('should reserve inventory before processing', async () => {
      const result = await orchestrator.processIntent(submission);
      expect(mockInventory.reserve).toHaveBeenCalledWith('starknet', 'USDC', 100000000n);
    });

    it('should create bridge reservation', async () => {
      const result = await orchestrator.processIntent(submission);
      expect(mockBridge.reserveBridge).toHaveBeenCalled();
    });

    it('should update intent status to inventory_reserved', async () => {
      await orchestrator.processIntent(submission);
      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith(
        expect.any(String), 'inventory_reserved'
      );
    });

    it('should update intent status to bridge_reserved', async () => {
      await orchestrator.processIntent(submission);
      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith(
        expect.any(String), 'bridge_reserved'
      );
    });

    it('should release inventory on failure', async () => {
      mockBridge.getLimits = vi.fn().mockRejectedValue(new Error('Bridge API down'));
      mockFallbackBridge.reserveBridge = vi.fn().mockRejectedValue(new Error('Fallback also down'));

      await expect(orchestrator.processIntent(submission)).rejects.toThrow('Fallback also down');
      expect(mockInventory.release).toHaveBeenCalledWith('starknet', 'USDC', 100000000n);
    });

    it('should mark intent as failed on error', async () => {
      mockBridge.getLimits = vi.fn().mockRejectedValue(new Error('Bridge API down'));
      mockFallbackBridge.reserveBridge = vi.fn().mockRejectedValue(new Error('Fallback also down'));

      await expect(orchestrator.processIntent(submission)).rejects.toThrow('Fallback also down');
      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith(
        expect.any(String), 'failed', expect.stringContaining('Fallback also down')
      );
    });

    it('should reject amounts outside bridge limits', async () => {
      mockBridge.getLimits = vi.fn().mockResolvedValue({ min: 10, max: 50 });
      mockFallbackBridge.reserveBridge = vi.fn().mockRejectedValue(new Error('Amount outside fallback limits'));

      await expect(orchestrator.processIntent(submission)).rejects.toThrow('outside fallback limits');
    });
  });

  describe('onDepositReceived', () => {
    it('should shield when bridge is completed', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
        destination_address: '0xrelayer',
      } as any);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'completed',
      });

      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        viewing_key_pub: '0x123',
        viewing_key_priv: '0x456',
      } as any);

      await orchestrator.onDepositReceived({
        id: 'deposit-1',
        intentId: 'intent-1',
        swapId: 'swap-123',
        amount: 100000000n,
      });

      expect(mockPrivacyHub.shield).toHaveBeenCalledWith(
        'intent-1', 'swap-123',
        '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
        100000000n,
        { publicKey: '0x123', privateKey: '0x456' }
      );
    });

    it('should skip shielding when bridge not completed', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
      } as any);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'pending',
      });

      await orchestrator.onDepositReceived({
        id: 'deposit-1',
        intentId: 'intent-1',
        swapId: 'swap-123',
        amount: 100000000n,
      });

      expect(mockPrivacyHub.shield).not.toHaveBeenCalled();
    });

    it('should log error when swap not found', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue(null);

      await expect(
        orchestrator.onDepositReceived({
          id: 'deposit-1',
          intentId: 'intent-1',
          swapId: 'swap-123',
          amount: 100000000n,
        })
      ).resolves.toBeUndefined();

      expect(mockPrivacyHub.shield).not.toHaveBeenCalled();
    });

    it('should mark intent as failed on shield error', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
      } as any);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'completed',
      });

      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        viewing_key_pub: null,
        viewing_key_priv: null,
      } as any);

      mockPrivacyHub.shield = vi.fn().mockRejectedValue(new Error('Shield failed'));

      await orchestrator.onDepositReceived({
        id: 'deposit-1',
        intentId: 'intent-1',
        swapId: 'swap-123',
        amount: 100000000n,
      });

      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith(
        'intent-1', 'failed', 'Shield failed'
      );
    });
  });

  describe('refund flow', () => {
    it('should refund intent when bridge fails', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
        amount: '100000000',
        status: 'awaiting_deposit',
      } as any);

      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        amount_in_base_units: '100000000',
        refund_address: '0xrefund',
        status: 'failed',
      } as any);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'failed',
        outputTransactionHash: '0xrefund123',
      });

      const refundInfo = await orchestrator.refundIntent('intent-1', 'swap-123');

      expect(refundInfo.status).toBe('refunded');
      expect(mockBridge.refundBridge).toHaveBeenCalledWith('swap-123');
      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith('intent-1', 'refunding');
      expect(mockIntentRepo.updateStatus).toHaveBeenCalledWith('intent-1', 'refunded');
    });

    it('should release inventory on refund', async () => {
      mockSwapRepo.getBySwapId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
        amount: '100000000',
        status: 'awaiting_deposit',
      } as any);

      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        amount_in_base_units: '100000000',
        refund_address: '0xrefund',
        status: 'failed',
      } as any);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'expired',
        outputTransactionHash: '0xrefund123',
      });

      await orchestrator.refundIntent('intent-1', 'swap-123');

      expect(mockInventory.release).toHaveBeenCalledWith('starknet', 'USDC', 100000000n);
    });

    it('should process failed swaps automatically', async () => {
      mockSwapRepo.getPendingByDestinationAddress = vi.fn().mockResolvedValue([
        {
          swap_id: 'swap-123',
          intent_id: 'intent-1',
          amount: '100000000',
          status: 'awaiting_deposit',
        } as any,
      ]);

      mockBridge.getBridgeStatus = vi.fn().mockResolvedValue({
        swapId: 'swap-123',
        status: 'cancelled',
        outputTransactionHash: '0xcancel123',
      });

      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        amount_in_base_units: '100000000',
        refund_address: '0xrefund',
        status: 'failed',
      } as any);

      await orchestrator.processFailedSwaps();

      expect(mockBridge.refundBridge).toHaveBeenCalledWith('swap-123');
    });
  });

  describe('retry behavior', () => {
    it('should fail after max retries on persistent failure', async () => {
      mockBridge.getLimits = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      mockFallbackBridge.reserveBridge = vi.fn().mockRejectedValue(new Error('Fallback persistent failure'));

      const submission: IntentSubmission = {
        userId: 'user-1',
        sourceChain: 'arbitrum',
        sourceToken: 'USDC',
        destinationChain: 'starknet',
        destinationToken: 'USDC',
        amount: '100',
        amountInBaseUnits: '100000000',
        destinationAddress: '0xdest',
        privacyLevel: 'standard',
      };

      await expect(orchestrator.processIntent(submission)).rejects.toThrow('Fallback persistent failure');
    });
  });

  describe('health checks', () => {
    it('should return all healthy when services are up', async () => {
      const health = await orchestrator.getHealth();
      expect(health.database).toBe(true);
      expect(health.bridge).toBe(true);
      expect(health.fallback_bridge).toBe(true);
      expect(health.inventory).toBe(true);
      expect(health.account).toBe(true);
      expect(health.prover).toBe(true);
    });

    it('should report bridge unhealthy when checkHealth throws', async () => {
      mockBridge.checkHealth = vi.fn().mockRejectedValue(new Error('API down'));

      const health = await orchestrator.getHealth();
      expect(health.bridge).toBe(false);
    });

    it('should report fallback bridge unhealthy when checkHealth throws', async () => {
      mockFallbackBridge.checkHealth = vi.fn().mockRejectedValue(new Error('API down'));

      const health = await orchestrator.getHealth();
      expect(health.fallback_bridge).toBe(false);
    });
  });

  describe('getIntentStatus', () => {
    it('should return null for non-existent intent', async () => {
      mockIntentRepo.getById = vi.fn().mockResolvedValue(null);
      const result = await orchestrator.getIntentStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('should return intent status with swap and shield info', async () => {
      mockIntentRepo.getById = vi.fn().mockResolvedValue({
        id: 'intent-1',
        status: 'completed',
        source_chain: 'arbitrum',
        fail_reason: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any);

      mockSwapRepo.getByIntentId = vi.fn().mockResolvedValue({
        swap_id: 'swap-123',
        intent_id: 'intent-1',
      } as any);

      mockDepositRepo.getByIntentId = vi.fn().mockResolvedValue([{
        id: 'deposit-1',
        source_tx_hash: '0xtxhash',
        amount: '100000000',
        block_number: '100',
      }] as any);

      mockShieldRepo.getByIntentId = vi.fn().mockResolvedValue({
        tx_hash: '0xshield123',
        note_hash: '0xnote123',
      } as any);

      const result = await orchestrator.getIntentStatus('intent-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('completed');
      expect(result!.swapId).toBe('swap-123');
      expect(result!.deposit?.sourceTxHash).toBe('0xtxhash');
      expect(result!.shieldTx?.txHash).toBe('0xshield123');
    });
  });
});
