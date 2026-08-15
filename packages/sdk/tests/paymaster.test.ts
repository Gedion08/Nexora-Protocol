import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymasterClient } from '../src/core/paymaster';
import { InvalidArgumentError, PaymasterError } from '../src/utils/errors';

const mockRpcProvider = {
  getChainId: vi.fn().mockResolvedValue('0x534e5f4d41494e'),
};

const mockContractInstance: Record<string, any> = {};

vi.mock('starknet', () => ({
  Account: class MockAccount {},
  Contract: vi.fn().mockImplementation(() => mockContractInstance),
  RpcProvider: vi.fn().mockImplementation(() => mockRpcProvider),
  num: {
    toHex: (v: bigint) => '0x' + v.toString(16),
  },
}));

describe('PaymasterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct with valid config', () => {
    const client = new PaymasterClient({
      rpcUrl: 'http://localhost:5050',
      paymasterAddress: '0xabc',
    });
    expect(client.rpcUrl).toBe('http://localhost:5050');
    expect(client.paymasterAddress).toBe('0xabc');
  });

  it('should throw if rpcUrl is empty', () => {
    expect(() => new PaymasterClient({ rpcUrl: '' })).toThrow(InvalidArgumentError);
  });

  it('should check health of RPC endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: '0x534e5f4d41494e' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    const healthy = await client.isHealthy();
    expect(healthy).toBe(true);
  });

  it('should return false if RPC health check fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    const healthy = await client.isHealthy();
    expect(healthy).toBe(false);
  });

  it('should return false on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    const healthy = await client.isHealthy();
    expect(healthy).toBe(false);
  });
});

describe('PaymasterClient sponsorship', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
  });

  it('should throw if account is missing', async () => {
    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    await expect(
      client.sponsorTransaction(null as any, '0xcontract', 'entrypoint', [])
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw if contractAddress is zero', async () => {
    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    const account = { address: '0xuser' } as any;
    await expect(
      client.sponsorTransaction(account, '0x0', 'entrypoint', [])
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw if entrypoint is empty', async () => {
    const client = new PaymasterClient({ rpcUrl: 'http://localhost:5050' });
    const account = { address: '0xuser' } as any;
    await expect(
      client.sponsorTransaction(account, '0xcontract', '', [])
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should call paymaster contract and return paymaster data', async () => {
    mockContractInstance.sponsor_transaction = vi.fn().mockResolvedValue({
      paymaster_data: ['0xdata1', '0xdata2'],
      tip: 1000,
    });

    const client = new PaymasterClient({
      rpcUrl: 'http://localhost:5050',
      paymasterAddress: '0xpaymaster',
    });
    const account = { address: '0xuser' } as any;
    const result = await client.sponsorTransaction(account, '0xcontract', 'entrypoint', ['0xcalldata']);

    expect(result.paymasterData).toEqual(['0xdata1', '0xdata2']);
    expect(result.tip).toBe(1000);
  });

  it('should handle empty paymaster data', async () => {
    mockContractInstance.sponsor_transaction = vi.fn().mockResolvedValue({
      paymaster_data: [],
      tip: 0,
    });

    const client = new PaymasterClient({
      rpcUrl: 'http://localhost:5050',
      paymasterAddress: '0xpaymaster',
    });
    const account = { address: '0xuser' } as any;
    const result = await client.sponsorTransaction(account, '0xcontract', 'entrypoint', ['0xcalldata']);

    expect(result.paymasterData).toEqual([]);
    expect(result.tip).toBeUndefined();
  });

  it('should wrap contract errors in PaymasterError', async () => {
    mockContractInstance.sponsor_transaction = vi.fn().mockRejectedValue(new Error('RPC error'));

    const client = new PaymasterClient({
      rpcUrl: 'http://localhost:5050',
      paymasterAddress: '0xpaymaster',
    });
    const account = { address: '0xuser' } as any;
    await expect(
      client.sponsorTransaction(account, '0xcontract', 'entrypoint', ['0xcalldata'])
    ).rejects.toThrow(PaymasterError);
  });
});
