import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAdapter, type FreshAddressResult, type WithdrawalReceipt } from '../src/adapters/base-adapter';
import type { BridgeQuote, BridgeReservation, DepositStatusResult, DepositAction } from '../src/adapters/types';

function createMockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({
      error: ok ? null : { code: 'TEST_ERROR', message: 'Test error' },
      data,
    }),
  } as unknown as Response;
}

function mockFetchSuccess(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue(createMockFetchResponse(data, true, status));
}

function mockFetchFailure(status = 500, message = 'Test error') {
  return vi.fn().mockResolvedValue(createMockFetchResponse(null, false, status));
}

describe('BaseAdapter', () => {
  let adapter: BaseAdapter;

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetchSuccess([
        {
          name: 'STARKNET_MAINNET',
          display_name: 'Starknet',
          logo: 'https://logo.starknet',
          chain_id: '0x534e5f4d41494e',
          type: 'starknet',
          tokens: [
            { symbol: 'USDC', display_asset: 'USD Coin', logo: 'https://usdc.logo', contract: '0x053c...', decimals: 6, precision: 6, price_in_usd: 1, listing_date: '2021-01-01' },
            { symbol: 'ETH', display_asset: 'Ethereum', logo: 'https://eth.logo', contract: null, decimals: 18, precision: 18, price_in_usd: 3000, listing_date: '2021-01-01' },
          ],
        },
        {
          name: 'BASE_MAINNET',
          display_name: 'Base',
          logo: 'https://logo.base',
          chain_id: '0x2105',
          type: 'evm',
          tokens: [
            { symbol: 'USDC', display_asset: 'USD Coin', logo: 'https://usdc.logo', contract: '0xdac1...', decimals: 6, precision: 6, price_in_usd: 1, listing_date: '2021-01-01' },
          ],
        },
      ]));
    adapter = new BaseAdapter({
      apiKey: 'test-api-key',
      environment: 'MAINNET',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should construct with valid config', () => {
      expect(adapter['sourceNetwork']).toBe('STARKNET');
      expect(adapter['destinationNetwork']).toBe('BASE');
      expect(adapter['defaultToken']).toBe('USDC');
      expect(adapter['client']).toBeDefined();
    });

    it('should throw InvalidArgumentError without API key', () => {
      expect(() => new BaseAdapter({ apiKey: '' })).toThrow('LayerSwap API key is required for BaseAdapter');
    });
  });

  describe('generateFreshAddress', () => {
    it('should generate a valid EVM address', async () => {
      const result: FreshAddressResult = await adapter.generateFreshAddress();

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('0x')).toBe(true);
      expect(result.address.length).toBe(42);
      expect(result.privateKey).toBeDefined();
      expect(result.privateKey.length).toBeGreaterThan(0);
    });

    it('should generate unique addresses on each call', async () => {
      const result1: FreshAddressResult = await adapter.generateFreshAddress();
      const result2: FreshAddressResult = await adapter.generateFreshAddress();

      expect(result1.address).not.toBe(result2.address);
      expect(result1.privateKey).not.toBe(result2.privateKey);
    });
  });

  describe('getSupportedTokens', () => {
    it('should return supported tokens for source network', async () => {
      const tokens = await adapter.getSupportedTokens();

      expect(tokens).toHaveLength(2);
      expect(tokens[0].symbol).toBe('USDC');
      expect(tokens[1].symbol).toBe('ETH');
    });

    it('should throw NexoraError on API failure', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(500, 'API down'));

      await expect(adapter.getSupportedTokens()).rejects.toThrow('Failed to fetch supported tokens');
    });
  });

  describe('estimateFee', () => {
    it('should return a bridge quote', async () => {
      const mockQuote = {
        source_network: { name: 'STARKNET_MAINNET' },
        source_token: { symbol: 'USDC' },
        destination_network: { name: 'BASE_MAINNET' },
        destination_token: { symbol: 'USDC' },
        receive_amount: 99.5,
        min_receive_amount: 99,
        total_fee: 0.5,
        total_fee_in_usd: 0.5,
        blockchain_fee: 0.3,
        service_fee: 0.2,
        avg_completion_time: '~2 minutes',
      };

      vi.stubGlobal('fetch', mockFetchSuccess({ quote: mockQuote }));

      const quote: BridgeQuote = await adapter.estimateFee('USDC', 'USDC', 100);

      expect(quote.sourceNetwork).toBe('STARKNET_MAINNET');
      expect(quote.destinationNetwork).toBe('BASE_MAINNET');
      expect(quote.receiveAmount).toBe(99.5);
      expect(quote.totalFee).toBe(0.5);
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      await expect(adapter.estimateFee('USDC', 'USDC', 0)).rejects.toThrow('Amount must be greater than zero');
      await expect(adapter.estimateFee('USDC', 'USDC', -1)).rejects.toThrow('Amount must be greater than zero');
    });

    it('should throw NexoraError on LayerSwap API error', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(400, 'Invalid token'));

      await expect(adapter.estimateFee('USDC', 'USDC', 100)).rejects.toThrow('Fee estimation failed');
    });
  });

  describe('getLimits', () => {
    it('should return min and max limits', async () => {
      const mockLimits = { min_amount: 1, max_amount: 10000 };

      vi.stubGlobal('fetch', mockFetchSuccess(mockLimits));

      const limits = await adapter.getLimits('USDC', 'USDC', 100);

      expect(limits.min).toBe(1);
      expect(limits.max).toBe(10000);
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      await expect(adapter.getLimits('USDC', 'USDC', 0)).rejects.toThrow('Amount must be greater than zero');
    });
  });

  describe('reserveBridge', () => {
    it('should create a bridge reservation', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-base-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xfreshBaseAddress',
          requested_amount: 100,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {
            reference_id: 'intent-1',
            deposit_address: '0xdepositStarknet',
            refund_address: '0xrefund',
          },
          transactions: [],
        },
        deposit_actions: [
          {
            type: 'transfer',
            to_address: '0xdepositStarknet',
            amount: 100,
            amount_in_base_units: '100000000',
            order: 1,
            network: { name: 'STARKNET_MAINNET' },
            token: { symbol: 'USDC' },
            fee_token: { symbol: 'USDC' },
            call_data: null,
            gas_limit: '50000',
          },
        ],
        quote: {
          total_fee: 0.5,
        },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const reservation = await adapter.reserveBridge('USDC', 'USDC', 100, '0xfreshBaseAddress', undefined, '0xrefund', 'intent-1');

      expect(reservation.swapId).toBe('swap-base-123');
      expect(reservation.depositAddress).toBe('0xdepositStarknet');
      expect(reservation.destinationAddress).toBe('0xfreshBaseAddress');
      expect(reservation.status).toBe('user_transfer_pending');
      expect(reservation.depositActions).toHaveLength(1);
      expect(reservation.depositActions[0].toAddress).toBe('0xdepositStarknet');
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      await expect(adapter.reserveBridge('USDC', 'USDC', 0, '0xrecipient')).rejects.toThrow();
    });

    it('should throw InvalidArgumentError for missing destination address', async () => {
      await expect(adapter.reserveBridge('USDC', 'USDC', 100, '')).rejects.toThrow();
    });

    it('should throw NexoraError on reservation failure', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(400, 'Insufficient inventory'));

      await expect(adapter.reserveBridge('USDC', 'USDC', 100, '0xrecipient')).rejects.toThrow('Bridge reservation failed');
    });
  });

  describe('getBridgeStatus', () => {
    it('should return bridge status by swap ID', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-base-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'completed',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xfreshBaseAddress',
          requested_amount: 100,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {},
          transactions: [
            { type: 'input', transaction_hash: '0xtx1', status: 'completed' },
            { type: 'output', transaction_hash: '0xtx2', status: 'completed' },
          ],
        },
        deposit_actions: [],
        quote: { total_fee: 0.5 },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const status: DepositStatusResult = await adapter.getBridgeStatus('swap-base-123');

      expect(status.swapId).toBe('swap-base-123');
      expect(status.status).toBe('completed');
      expect(status.inputTransactionHash).toBe('0xtx1');
      expect(status.outputTransactionHash).toBe('0xtx2');
    });

    it('should throw InvalidArgumentError for empty swap ID', async () => {
      await expect(adapter.getBridgeStatus('')).rejects.toThrow('Swap ID is required');
    });
  });

  describe('getBridgeStatusByTxHash', () => {
    it('should return bridge status by transaction hash', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-base-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'ls_transfer_pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xfreshBaseAddress',
          requested_amount: 100,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {},
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.5 },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const status: DepositStatusResult = await adapter.getBridgeStatusByTxHash('0xtxhash');

      expect(status.swapId).toBe('swap-base-123');
      expect(status.status).toBe('processing');
    });

    it('should throw InvalidArgumentError for empty transaction hash', async () => {
      await expect(adapter.getBridgeStatusByTxHash('')).rejects.toThrow('Transaction hash is required');
    });
  });

  describe('getDepositActions', () => {
    it('should return deposit actions', async () => {
      const mockActions = [
        {
          type: 'transfer',
          to_address: '0xdeposit',
          amount: 100,
          amount_in_base_units: '100000000',
          order: 1,
          network: { name: 'STARKNET_MAINNET' },
          token: { symbol: 'USDC' },
          fee_token: { symbol: 'USDC' },
          call_data: null,
          gas_limit: '50000',
        },
      ];

      vi.stubGlobal('fetch', mockFetchSuccess(mockActions));

      const actions = await adapter.getDepositActions('swap-base-123');

      expect(actions).toHaveLength(1);
      expect(actions[0].toAddress).toBe('0xdeposit');
      expect(actions[0].amount).toBe(100);
    });

    it('should throw InvalidArgumentError for empty swap ID', async () => {
      await expect(adapter.getDepositActions('')).rejects.toThrow('Swap ID is required');
    });
  });

  describe('executeWithdrawal', () => {
    it('should generate fresh address and reserve bridge', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-base-456',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xfreshBaseAddress',
          requested_amount: 50,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {
            reference_id: 'withdraw-1',
            deposit_address: '0xdepositStarknet',
          },
          transactions: [],
        },
        deposit_actions: [
          {
            type: 'transfer',
            to_address: '0xdepositStarknet',
            amount: 50,
            amount_in_base_units: '50000000',
            order: 1,
            network: { name: 'STARKNET_MAINNET' },
            token: { symbol: 'USDC' },
            fee_token: { symbol: 'USDC' },
            call_data: null,
            gas_limit: '50000',
          },
        ],
        quote: { total_fee: 0.25 },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const receipt: WithdrawalReceipt = await adapter.executeWithdrawal({
        token: 'USDC',
        amount: 50,
        referenceId: 'withdraw-1',
      });

      expect(receipt.swapId).toBe('swap-base-456');
      expect(receipt.freshAddress).toBeDefined();
      expect(receipt.freshAddress.startsWith('0x')).toBe(true);
      expect(receipt.freshAddress.length).toBe(42);
      expect(receipt.destinationAddress).toBe(receipt.freshAddress);
      expect(receipt.depositAddress).toBe('0xdepositStarknet');
      expect(receipt.fee).toBe(0.25);
      expect(receipt.estimatedArrival).toBeDefined();
    });

    it('should use provided recipient instead of generating fresh address', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-base-789',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xprovidedRecipient',
          requested_amount: 25,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {
            deposit_address: '0xdepositStarknet',
          },
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.1 },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const receipt: WithdrawalReceipt = await adapter.executeWithdrawal({
        token: 'USDC',
        amount: 25,
        recipient: '0xprovidedRecipient',
      });

      expect(receipt.destinationAddress).toBe('0xprovidedRecipient');
      expect(receipt.freshAddress).not.toBe('0xprovidedRecipient');
      expect(receipt.freshAddress.startsWith('0x')).toBe(true);
    });

    it('should throw InvalidArgumentError for missing token', async () => {
      await expect(adapter.executeWithdrawal({ token: '', amount: 50 })).rejects.toThrow('Token is required for withdrawal');
    });

    it('should throw InvalidArgumentError for non-positive amount', async () => {
      await expect(adapter.executeWithdrawal({ token: 'USDC', amount: 0 })).rejects.toThrow('Amount must be greater than zero');
    });
  });

  describe('checkHealth', () => {
    it('should pass when LayerSwap is healthy', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess({ status: 'ok' }));

      await expect(adapter.checkHealth()).resolves.toBeUndefined();
    });

    it('should throw NexoraError when LayerSwap is unhealthy', async () => {
      vi.stubGlobal('fetch', mockFetchFailure(503, 'Service unavailable'));

      await expect(adapter.checkHealth()).rejects.toThrow('LayerSwap health check failed');
    });
  });

  describe('speedUpDepositDetection', () => {
    it('should call LayerSwap speed up API', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess({ status: 'ok' }));

      await expect(adapter.speedUpDepositDetection('swap-123', '0xtxhash')).resolves.toBeUndefined();
    });

    it('should throw InvalidArgumentError for empty swap ID', async () => {
      await expect(adapter.speedUpDepositDetection('', '0xtxhash')).rejects.toThrow();
    });

    it('should throw InvalidArgumentError for empty transaction hash', async () => {
      await expect(adapter.speedUpDepositDetection('swap-123', '')).rejects.toThrow();
    });
  });

  describe('pollBridgeStatus', () => {
    it('should poll and callback on status update', async () => {
      const mockSwapResponse = {
        swap: {
          id: 'swap-poll-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xfreshBaseAddress',
          requested_amount: 100,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {},
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.5 },
      };

      vi.stubGlobal('fetch', mockFetchSuccess(mockSwapResponse));

      const onUpdate = vi.fn();
      const stopPolling = adapter.pollBridgeStatus('swap-poll-123', onUpdate, 100);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(onUpdate).toHaveBeenCalled();
      expect(onUpdate.mock.calls[0][0].swapId).toBe('swap-poll-123');

      stopPolling();
    });

    it('should throw if already polling same swap', async () => {
      vi.stubGlobal('fetch', mockFetchSuccess({
        swap: {
          id: 'swap-dup',
          created_date: '2024-01-01T00:00:00Z',
          status: 'pending',
          source_network: { name: 'STARKNET_MAINNET' },
          source_token: { symbol: 'USDC' },
          destination_network: { name: 'BASE_MAINNET' },
          destination_token: { symbol: 'USDC' },
          destination_address: '0xrecipient',
          requested_amount: 100,
          fail_reason: null,
          use_deposit_address: true,
          metadata: {},
          transactions: [],
        },
        deposit_actions: [],
        quote: { total_fee: 0.5 },
      }));

      adapter.pollBridgeStatus('swap-dup', vi.fn(), 100);
      expect(() => adapter.pollBridgeStatus('swap-dup', vi.fn(), 100)).toThrow('Already polling status for swap: swap-dup');
    });
  });
});
