import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { RelayerApiServer } from '../src/api/server';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../src/db/connection';
import type { E2EOrchestrator } from '../src/flow/e2e-flow';
import type { DepositEventListener } from '../src/bridge/deposit-listener';
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

function createMockDeps(): any {
  const orchestrator: E2EOrchestrator = {
    initialize: vi.fn().mockResolvedValue(undefined),
    processIntent: vi.fn().mockResolvedValue({
      intentId: 'intent-test-1',
      status: 'awaiting_deposit',
      depositAddress: '0xdeposit123',
      depositActions: [],
      fee: 0.5,
      estimatedArrival: new Date().toISOString(),
      referenceId: 'intent-test-1',
    }),
    getIntentStatus: vi.fn().mockResolvedValue({
      intentId: 'intent-test-1',
      status: 'awaiting_deposit',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }),
    getHealth: vi.fn().mockResolvedValue({
      database: true,
      bridge: true,
      inventory: true,
      account: true,
    }),
    processPendingDeposits: vi.fn().mockResolvedValue(undefined),
    onDepositReceived: vi.fn(),
  } as any;

  const depositListener: DepositEventListener = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    setCallback: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
    getRelayerAddress: vi.fn().mockReturnValue('0xrelayer'),
  } as any;

  const inventory: InventoryManager = {
    reserve: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    getAvailable: vi.fn().mockResolvedValue(1000000000n),
    getTotal: vi.fn().mockResolvedValue(1000000000n),
    getReserved: vi.fn().mockResolvedValue(0n),
    getAllInventories: vi.fn().mockResolvedValue([{
      chain: 'starknet',
      token: 'USDC',
      tokenAddress: '0x053c...',
      totalBalance: 1000000000n,
      reservedBalance: 0n,
      availableBalance: 1000000000n,
      lastRefreshed: new Date().toISOString(),
    }]),
    isHealthy: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
    close: vi.fn(),
  } as any;

  const database: Database = {
    getClient: vi.fn(),
    query: vi.fn(),
    executeInTransaction: vi.fn().mockImplementation(async (fn: any) => fn({
      query: vi.fn().mockResolvedValue({ rows: [{ swap_id: 'swap-123', intent_id: 'intent-1' }] }),
    })),
    close: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn(),
  } as any;

  return {
    config: createMockConfig(),
    db: database,
    orchestrator,
    depositListener,
    inventory,
  };
}

describe('RelayerApiServer', () => {
  let server: RelayerApiServer;
  let deps: any;

  beforeEach(() => {
    deps = createMockDeps();
    server = new RelayerApiServer(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const res = await request(server.getApp()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.services).toBeDefined();
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const res = await request(server.getApp()).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when database and account are healthy', async () => {
      const res = await request(server.getApp()).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });

  describe('GET /', () => {
    it('should return service info', async () => {
      const res = await request(server.getApp()).get('/');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nexora Protocol Relayer');
      expect(res.body.status).toBe('running');
    });
  });

  describe('POST /intents', () => {
    it('should create an intent and return deposit address', async () => {
      const res = await request(server.getApp())
        .post('/intents')
        .send({
          userId: 'user-1',
          sourceChain: 'arbitrum',
          sourceToken: 'USDC',
          destinationChain: 'starknet',
          destinationToken: 'USDC',
          amount: '100',
          destinationAddress: '0xdest',
          privacyLevel: 'standard',
        });

      expect(res.status).toBe(201);
      expect(res.body.intentId).toBe('intent-test-1');
      expect(res.body.status).toBe('awaiting_deposit');
      expect(res.body.depositAddress).toBe('0xdeposit123');
    });

    it('should return 400 for missing userId', async () => {
      const res = await request(server.getApp())
        .post('/intents')
        .send({
          sourceChain: 'arbitrum',
          sourceToken: 'USDC',
          amount: '100',
          destinationChain: 'starknet',
          destinationToken: 'USDC',
          destinationAddress: '0xdest',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_id is required');
    });

    it('should return 400 for non-positive amount', async () => {
      const res = await request(server.getApp())
        .post('/intents')
        .send({
          userId: 'user-1',
          sourceChain: 'arbitrum',
          sourceToken: 'USDC',
          destinationChain: 'starknet',
          destinationToken: 'USDC',
          amount: '0',
          destinationAddress: '0xdest',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('amount must be greater than zero');
    });

    it('should return 400 for missing destination address', async () => {
      const res = await request(server.getApp())
        .post('/intents')
        .send({
          userId: 'user-1',
          sourceChain: 'arbitrum',
          sourceToken: 'USDC',
          destinationChain: 'starknet',
          destinationToken: 'USDC',
          amount: '100',
          destinationAddress: '',
        });

      expect(res.status).toBe(400);
    });

    it('should handle bridge errors', async () => {
      deps.orchestrator.processIntent = vi.fn().mockRejectedValue(new Error('Bridge API down'));

      const res = await request(server.getApp())
        .post('/intents')
        .send({
          userId: 'user-1',
          sourceChain: 'arbitrum',
          sourceToken: 'USDC',
          destinationChain: 'starknet',
          destinationToken: 'USDC',
          amount: '100',
          destinationAddress: '0xdest',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('intent_submission_failed');
      expect(res.body.message).toBe('Bridge API down');
    });
  });

  describe('GET /intents/:id', () => {
    it('should return intent status', async () => {
      const res = await request(server.getApp()).get('/intents/intent-123');
      expect(res.status).toBe(200);
      expect(res.body.intentId).toBe('intent-test-1');
    });

    it('should return 404 for non-existent intent', async () => {
      deps.orchestrator.getIntentStatus = vi.fn().mockResolvedValue(null);

      const res = await request(server.getApp()).get('/intents/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('intent_not_found');
    });
  });

  describe('GET /inventory', () => {
    it('should return inventory list', async () => {
      const res = await request(server.getApp()).get('/inventory');
      expect(res.status).toBe(200);
      expect(res.body.inventories).toBeDefined();
      expect(res.body.inventories).toHaveLength(1);
      expect(res.body.inventories[0].token).toBe('USDC');
    });
  });

  describe('GET /inventory/:token', () => {
    it('should return token-specific inventory', async () => {
      const res = await request(server.getApp()).get('/inventory/USDC');
      expect(res.status).toBe(200);
      expect(res.body.token).toBe('USDC');
      expect(res.body.availableBalance).toBe('1000000000');
    });
  });

  describe('GET /quotes', () => {
    it('should return quote for valid query params', async () => {
      deps.orchestrator['bridge'] = {
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
          avgCompletionTime: '~2 min',
          minAmount: 0.001,
          maxAmount: 10000,
        }),
        getLimits: vi.fn().mockResolvedValue({ min: 0.001, max: 10000 }),
      };

      const res = await request(server.getApp())
        .get('/quotes?sourceToken=USDC&destinationToken=USDC&amount=100');
      expect(res.status).toBe(200);
      expect(res.body.receiveAmount).toBeCloseTo(99.5);
    });

    it('should return 400 for missing params', async () => {
      const res = await request(server.getApp())
        .get('/quotes?sourceToken=USDC');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /webhooks/layerswap', () => {
    it('should process LayerSwap webhook', async () => {
      const res = await request(server.getApp())
        .post('/webhooks/layerswap')
        .send({
          swap_id: 'swap-123',
          status: 'completed',
        });

      expect(res.status).toBe(200);
      expect(res.body.swapId).toBe('swap-123');
    });

    it('should return 400 for missing swap_id', async () => {
      const res = await request(server.getApp())
        .post('/webhooks/layerswap')
        .send({ status: 'completed' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /info/tokens', () => {
    it('should return supported tokens', async () => {
      const res = await request(server.getApp()).get('/info/tokens');
      expect(res.status).toBe(200);
      expect(res.body.source.chain).toBe('arbitrum');
      expect(res.body.destination.chain).toBe('starknet');
    });
  });
});
