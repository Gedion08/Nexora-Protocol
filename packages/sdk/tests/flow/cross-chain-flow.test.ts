import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrossChainFlow } from '../../src/flow/cross-chain-flow';
import { ArbitrumAdapter } from '../../src/adapters/arbitrum-adapter';
import { BaseAdapter } from '../../src/adapters/base-adapter';
import { StarknetAccountGenerator } from '../../src/adapters/starknet-account';
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

describe('CrossChainFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw for zero amount', () => {
      expect(() => new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'test-key' },
        baseAdapter: { apiKey: 'test-key' },
        amount: 0,
        destinationAddress: '0xbase',
      })).toThrow(InvalidArgumentError);
    });

    it('should throw for negative amount', () => {
      expect(() => new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'test-key' },
        baseAdapter: { apiKey: 'test-key' },
        amount: -1,
        destinationAddress: '0xbase',
      })).toThrow(InvalidArgumentError);
    });

    it('should throw for missing destination address', () => {
      expect(() => new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'test-key' },
        baseAdapter: { apiKey: 'test-key' },
        amount: 0.1,
        destinationAddress: '',
      })).toThrow(InvalidArgumentError);
    });

    it('should construct with valid config', () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      expect(flow).toBeInstanceOf(CrossChainFlow);
    });
  });

  describe('generateFreshStarknetAccount', () => {
    it('should generate random account when r/s not provided', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      const account = await flow.generateFreshStarknetAccount('0x534e5f4d41494e', '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');
      expect(account.privateKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
      expect(account.address).toMatch(/^0x[0-9a-fA-F]{62,63}$/);
    });

    it('should generate deterministic account from signature', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      const account1 = await flow.generateFreshStarknetAccount(
        '0x534e5f4d41494e',
        '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
        123n,
        456n
      );
      const account2 = await flow.generateFreshStarknetAccount(
        '0x534e5f4d41494e',
        '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
        123n,
        456n
      );

      expect(account1.address).toBe(account2.address);
      expect(account1.privateKey).toBe(account2.privateKey);
    });
  });

  describe('executeFullFlow', () => {
    it('should throw if Starknet account not generated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await expect(flow.executeFullFlow()).rejects.toThrow(NexoraError);
    });

    it('should execute full flow with generated account', async () => {
      const restore = mockFetchSuccess({
        swap: {
          id: 'swap-arb-123',
          created_date: '2024-01-01T00:00:00Z',
          status: 'user_transfer_pending',
          source_network: { name: 'ARBITRUM_MAINNET' },
          source_token: { symbol: 'ETH' },
          destination_network: { name: 'STARKNET_MAINNET' },
          destination_token: { symbol: 'ETH' },
          destination_address: '0xstarknet',
          requested_amount: 0.1,
          fail_reason: null,
          use_deposit_address: true,
          metadata: { deposit_address: '0xarb-deposit', sequence_number: 1 },
          transactions: [],
        },
        deposit_actions: [
          {
            type: 'transfer',
            to_address: '0xarb-deposit',
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
        quote: { total_fee: 0.001, blockchain_fee: 0.0005, service_fee: 0.0005 },
        refuel: null,
        reward: null,
      });

      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await flow.generateFreshStarknetAccount('0x534e5f4d41494e', '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');
      const receipt = await flow.executeFullFlow('0xrefund', 'ref-123');

      expect(receipt.leg1.swapId).toBe('swap-arb-123');
      expect(receipt.leg2.swapId).toBeDefined();
      expect(receipt.starknetAccount).toBeDefined();
      expect(receipt.status).toBe('awaiting_deposit');
      restore();
    });
  });

  describe('getLeg1Status', () => {
    it('should throw if leg1 not initiated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await expect(flow.getLeg1Status()).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getLeg2Status', () => {
    it('should throw if leg2 not initiated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await expect(flow.getLeg2Status()).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getFullStatus', () => {
    it('should return pending when no swaps initiated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      const status = await flow.getFullStatus();
      expect(status.status).toBe('pending');
      expect(status.leg1).toBeNull();
      expect(status.leg2).toBeNull();
    });
  });

  describe('speedUpLeg1', () => {
    it('should throw if leg1 not initiated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await expect(flow.speedUpLeg1('0xtx')).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('speedUpLeg2', () => {
    it('should throw if leg2 not initiated', async () => {
      const flow = new CrossChainFlow({
        arbitrumAdapter: { apiKey: 'arb-key' },
        baseAdapter: { apiKey: 'base-key' },
        amount: 0.1,
        destinationAddress: '0xbase',
      });

      await expect(flow.speedUpLeg2('0xtx')).rejects.toThrow(InvalidArgumentError);
    });
  });
});
