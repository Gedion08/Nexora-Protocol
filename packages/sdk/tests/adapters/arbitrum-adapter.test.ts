import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArbitrumAdapter } from '../../src/adapters/arbitrum-adapter';
import { LayerSwapApiError } from '../../src/adapters/layerswap-client';
import { InvalidArgumentError, NexoraError, ErrorCode } from '../../src/utils/errors';

function mockFetchSuccess(data: unknown, ok = true, status = 200): () => void {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({ error: null, data }),
  } as Response));
  return () => {
    vi.stubGlobal('fetch', originalFetch);
  };
}

function mockFetchError(status: number, errorCode = 'BAD_REQUEST', message = 'Bad request'): () => void {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: errorCode, message }, data: null }),
  } as Response));
  return () => {
    vi.stubGlobal('fetch', originalFetch);
  };
}

describe('ArbitrumAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw if apiKey is empty', () => {
      expect(() => new ArbitrumAdapter({ apiKey: '' })).toThrow(InvalidArgumentError);
    });

    it('should construct with valid config', () => {
      const adapter = new ArbitrumAdapter({
        apiKey: 'test-api-key',
        environment: 'SEPOLIA',
      });
      expect(adapter.sourceNetwork).toBe('ARBITRUM');
      expect(adapter.destinationNetwork).toBe('STARKNET');
      expect(adapter.defaultToken).toBe('ETH');
    });

    it('should accept custom baseUrl and timeoutMs', () => {
      const adapter = new ArbitrumAdapter({
        apiKey: 'test-api-key',
        baseUrl: 'https://sandbox.layerswap.io',
        environment: 'MAINNET',
        timeoutMs: 60_000,
      });
      expect(adapter.client['baseUrl']).toBe('https://sandbox.layerswap.io');
      expect(adapter.timeoutMs).toBe(60_000);
    });
  });

  describe('getSupportedTokens', () => {
    it('should return tokens for the Arbitrum network', async () => {
      const restore = mockFetchSuccess([
        {
          name: 'ARBITRUM_MAINNET',
          display_name: 'Arbitrum One',
          logo: 'https://example.com/arb.png',
          chain_id: '42161',
          type: 'evm',
          tokens: [
            { symbol: 'ETH', display_asset: 'ETH', logo: 'https://example.com/eth.png', contract: null, decimals: 18, precision: 18, price_in_usd: 2000, listing_date: '2021-01-01' },
            { symbol: 'USDC', display_asset: 'USDC', logo: 'https://example.com/usdc.png', contract: '0xusdc', decimals: 6, precision: 6, price_in_usd: 1, listing_date: '2021-01-01' },
          ],
        },
      ]);

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const tokens = await adapter.getSupportedTokens();

      expect(tokens).toHaveLength(2);
      expect(tokens[0].symbol).toBe('ETH');
      expect(tokens[1].symbol).toBe('USDC');
      expect(tokens[1].contract).toBe('0xusdc');
      restore();
    });

    it('should return empty array if network not found', async () => {
      const restore = mockFetchSuccess([
        { name: 'ETHEREUM_MAINNET', tokens: [] },
      ]);

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const tokens = await adapter.getSupportedTokens();
      expect(tokens).toHaveLength(0);
      restore();
    });

    it('should throw NexoraError on network failure', async () => {
      const restore = mockFetchError(500, 'INTERNAL_ERROR', 'Server error');

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.getSupportedTokens()).rejects.toThrow(NexoraError);
      restore();
    });
  });

  describe('estimateFee', () => {
    it('should return a quote for the given route', async () => {
      const restore = mockFetchSuccess({
        quote: {
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          receive_amount: 0.099,
          min_receive_amount: 0.098,
          total_fee: 0.001,
          total_fee_in_usd: 2,
          blockchain_fee: 0.0005,
          service_fee: 0.0005,
          avg_completion_time: '~30 seconds',
          rate: 0.99,
        },
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const quote = await adapter.estimateFee('ETH', 'ETH', 0.1);

      expect(quote.receiveAmount).toBeCloseTo(0.099);
      expect(quote.totalFee).toBeCloseTo(0.001);
      expect(quote.blockchainFee).toBeCloseTo(0.0005);
      expect(quote.serviceFee).toBeCloseTo(0.0005);
      restore();
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.estimateFee('ETH', 'ETH', 0)).rejects.toThrow(InvalidArgumentError);
      await expect(adapter.estimateFee('ETH', 'ETH', -1)).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw NexoraError on LayerSwap API error', async () => {
      const restore = mockFetchError(400, 'BAD_REQUEST', 'Invalid amount');

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.estimateFee('ETH', 'ETH', 0.1)).rejects.toThrow(NexoraError);
      restore();
    });
  });

  describe('getLimits', () => {
    it('should return min and max amounts', async () => {
      const restore = mockFetchSuccess({
        min_amount: 0.001,
        max_amount: 10,
        min_amount_in_usd: 2,
        max_amount_in_usd: 20000,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const limits = await adapter.getLimits('ETH', 'ETH', 0.1);

      expect(limits.min).toBeCloseTo(0.001);
      expect(limits.max).toBeCloseTo(10);
      restore();
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.getLimits('ETH', 'ETH', 0)).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('reserveBridge', () => {
    it('should create a swap reservation', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [
          {
            type: 'transfer',
            to_address: '0xdeposit',
            amount: 0.1,
            amount_in_base_units: '100000000000000000',
            order: 1,
            network: { name: 'ARBITRUM_MAINNET' },
            token: { symbol: 'ETH' },
            fee_token: { symbol: 'ETH' },
            call_data: null,
            gas_limit: '21000',
          },
        ],
        quote: {
          total_fee: 0.001,
          blockchain_fee: 0.0005,
          service_fee: 0.0005,
        },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const reservation = await adapter.reserveBridge('ETH', 'ETH', 0.1, '0xdestination', '0xsource');

      expect(reservation.swapId).toBe('swap-123');
      expect(reservation.status).toBe('user_transfer_pending');
      expect(reservation.depositAddress).toBe('0xdeposit');
      expect(reservation.depositActions).toHaveLength(1);
      expect(reservation.depositActions[0].toAddress).toBe('0xdeposit');
      restore();
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.reserveBridge('ETH', 'ETH', 0, '0xdestination')).rejects.toThrow(InvalidArgumentError);
      await expect(adapter.reserveBridge('ETH', 'ETH', -1, '0xdestination')).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw InvalidArgumentError for missing destination address', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.reserveBridge('ETH', 'ETH', 0.1, '')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getBridgeStatus', () => {
    it('should return deposit status for a swap', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'ls_transfer_pending',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [
            { type: 'input', transaction_hash: '0xinput123', confirmations: 5, max_confirmations: 12 },
            { type: 'output', transaction_hash: '0xoutput456', confirmations: 3, max_confirmations: 12 },
          ],
        },
        deposit_actions: [],
        quote: { total_fee: 0.001 },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const status = await adapter.getBridgeStatus('swap-123');

      expect(status.swapId).toBe('swap-123');
      expect(status.status).toBe('processing');
      expect(status.inputTransactionHash).toBe('0xinput123');
      expect(status.outputTransactionHash).toBe('0xoutput456');
      restore();
    });

    it('should throw InvalidArgumentError for empty swapId', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.getBridgeStatus('')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getBridgeStatusByTxHash', () => {
    it('should return deposit status by transaction hash', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-456',
          created_date: '2024-01-01T00:00:00Z',
          status: 'completed',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.001 },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const status = await adapter.getBridgeStatusByTxHash('0xtxhash');

      expect(status.swapId).toBe('swap-456');
      expect(status.status).toBe('completed');
      restore();
    });

    it('should throw InvalidArgumentError for empty transaction hash', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.getBridgeStatusByTxHash('')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getDepositActions', () => {
    it('should return deposit actions', async () => {
      const restore = mockFetchSuccess([
        {
          type: 'transfer',
          to_address: '0xdeposit',
          amount: 0.1,
          amount_in_base_units: '100000000000000000',
          order: 1,
          network: { name: 'ARBITRUM_MAINNET' },
          token: { symbol: 'ETH' },
          fee_token: { symbol: 'ETH' },
          call_data: null,
          gas_limit: '21000',
        },
      ]);

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      const actions = await adapter.getDepositActions('swap-123', '0xsource');

      expect(actions).toHaveLength(1);
      expect(actions[0].toAddress).toBe('0xdeposit');
      expect(actions[0].amount).toBeCloseTo(0.1);
      restore();
    });

    it('should throw InvalidArgumentError for empty swapId', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.getDepositActions('')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('speedUpDepositDetection', () => {
    it('should call speed up endpoint', async () => {
      const restore = mockFetchSuccess({ success: true });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.speedUpDepositDetection('swap-123', '0xtxhash')).resolves.toBeUndefined();
      restore();
    });

    it('should throw InvalidArgumentError for missing swapId', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.speedUpDepositDetection('', '0xtxhash')).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw InvalidArgumentError for missing transaction hash', async () => {
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.speedUpDepositDetection('swap-123', '')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('checkHealth', () => {
    it('should succeed when LayerSwap is healthy', async () => {
      const restore = mockFetchSuccess(null);
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.checkHealth()).resolves.toBeUndefined();
      restore();
    });

    it('should throw NexoraError when LayerSwap is unhealthy', async () => {
      const restore = mockFetchError(503, 'SERVICE_UNAVAILABLE', 'Service down');
      const adapter = new ArbitrumAdapter({ apiKey: 'test-key' });
      await expect(adapter.checkHealth()).rejects.toThrow(NexoraError);
      restore();
    });
  });

  describe('pollBridgeStatus', () => {
    it('should poll and stop on terminal status', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'completed',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.001 },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key', timeoutMs: 5000 });
      const onUpdate = vi.fn();

      const stop = adapter.pollBridgeStatus('swap-123', onUpdate, 100);
      await new Promise((r) => setTimeout(r, 300));

      expect(onUpdate).toHaveBeenCalled();
      expect(onUpdate.mock.calls[0]?.[0].status).toBe('completed');
      stop();
      restore();
    });

    it('should return a stop function', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.001 },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key', timeoutMs: 10_000 });
      const onUpdate = vi.fn();
      const stop = adapter.pollBridgeStatus('swap-123', onUpdate, 100);
      expect(typeof stop).toBe('function');
      stop();
      restore();
    });

    it('should throw if already polling the same swap', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xdestination',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xdeposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.001 },
        refuel: null,
        reward: null,
      });

      const adapter = new ArbitrumAdapter({ apiKey: 'test-key', timeoutMs: 10_000 });
      adapter.pollBridgeStatus('swap-123', vi.fn(), 100);
      expect(() => adapter.pollBridgeStatus('swap-123', vi.fn(), 100)).toThrow(NexoraError);
      restore();
    });
  });
});
