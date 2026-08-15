import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvalidArgumentError } from '../src/utils/errors';

const mockWaitForTransaction = vi.fn();
const mockGetChainId = vi.fn();
const mockContractInstance: Record<string, any> = {};

vi.mock('starknet', () => ({
  Account: class MockAccount {},
  Contract: vi.fn().mockImplementation(() => mockContractInstance),
  RpcProvider: vi.fn().mockImplementation(() => ({
    getChainId: mockGetChainId,
    waitForTransaction: mockWaitForTransaction,
  })),
  num: {
    toBigInt: (v: any) => (typeof v === 'bigint' ? v : BigInt(v)),
    toHex: (v: bigint) => '0x' + v.toString(16),
  },
}));

import { PoolClient, PrivacyHubClient } from '../src/core/client';

describe('PoolClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
  });

  it('should throw if rpcUrl is empty', () => {
    expect(() => new PoolClient({ rpcUrl: '', poolAddress: '0xabc' })).toThrow(InvalidArgumentError);
  });

  it('should throw if poolAddress is empty', () => {
    expect(() => new PoolClient({ rpcUrl: 'http://localhost:5050', poolAddress: '' })).toThrow(InvalidArgumentError);
  });

  it('should construct with valid config', () => {
    const client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f4d41494e',
    });
    expect(client.poolAddress).toBe('0xabc');
    expect(client.chainId).toBe('0x534e5f4d41494e');
    expect(client.provider).toBeDefined();
  });

  it('should resolve chain ID from provider', async () => {
    const client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
    });
    mockGetChainId.mockResolvedValue('0x534e5f5345504f4c4941');
    const chainId = await client.getChainId();
    expect(chainId).toBe('0x534e5f5345504f4c4941');
  });

  it('should use configured chainId without calling provider', async () => {
    const client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f4d41494e',
    });
    const chainId = await client.getChainId();
    expect(chainId).toBe('0x534e5f4d41494e');
    expect(mockGetChainId).not.toHaveBeenCalled();
  });
});

describe('PrivacyHubClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
  });

  it('should throw if rpcUrl is empty', () => {
    expect(() => new PrivacyHubClient({ rpcUrl: '', privacyHubAddress: '0xabc', poolAddress: '0xdef' })).toThrow(InvalidArgumentError);
  });

  it('should throw if privacyHubAddress is empty', () => {
    expect(() => new PrivacyHubClient({ rpcUrl: 'http://localhost:5050', privacyHubAddress: '', poolAddress: '0xdef' })).toThrow(InvalidArgumentError);
  });

  it('should construct with valid config', () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
      chainId: '0x534e5f4d41494e',
    });
    expect(client.privacyHubAddress).toBe('0xabc');
    expect(client.poolAddress).toBe('0xdef');
  });

  it('should resolve chain ID from provider', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    mockGetChainId.mockResolvedValue('0x534e5f5345504f4c4941');
    const chainId = await client.getChainId();
    expect(chainId).toBe('0x534e5f5345504f4c4941');
  });
});

describe('PoolClient error wrapping', () => {
  let client: PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
    client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f4d41494e',
    });
  });

  it('should extract transaction hash from string response', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue('0xtxhash123');
    const account = { address: '0xuser' } as any;
    const result = await client.shield(account, '0xtoken', 1000n, 12345n);
    expect(result.transactionHash).toBe('0xtxhash123');
  });

  it('should extract transaction hash from object response', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue({ transaction_hash: '0xtxhash456' });
    const account = { address: '0xuser' } as any;
    const result = await client.shield(account, '0xtoken', 1000n, 12345n);
    expect(result.transactionHash).toBe('0xtxhash456');
  });

  it('should throw if response has no transaction hash', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue({});
    const account = { address: '0xuser' } as any;
    await expect(client.shield(account, '0xtoken', 1000n, 12345n)).rejects.toThrow();
  });

  it('should create wait function that calls provider.waitForTransaction', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue('0xtxhash');
    mockWaitForTransaction.mockResolvedValue({
      transaction_hash: '0xtxhash',
      finality_status: 'ACCEPTED_ON_L2',
      block_hash: '0xblock',
      block_number: 100,
      actual_fee: { amount: '100', unit: 'FRI' },
      timestamp: 1234567890,
    });

    const account = { address: '0xuser' } as any;
    const result = await client.shield(account, '0xtoken', 1000n, 12345n);
    const receipt = await result.wait();

    expect(mockWaitForTransaction).toHaveBeenCalledWith('0xtxhash', { retryInterval: 2000 });
    expect(receipt.status).toBe('ACCEPTED_ON_L2');
    expect(receipt.blockHash).toBe('0xblock');
    expect(receipt.blockNumber).toBe(100);
    expect(receipt.gasUsed).toBe('100');
    expect(receipt.timestamp).toBe(1234567890);
  });

  it('should wrap contract errors', async () => {
    mockContractInstance.register_viewing_key = vi.fn().mockRejectedValue(new Error('RPC error'));
    const account = { address: '0xuser' } as any;
    await expect(client.registerViewingKey(account, 12345n)).rejects.toThrow();
  });
});

describe('PrivacyHubClient validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
  });

  it('should validate token and amount in shield', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.shield(account, '', 0n)).rejects.toThrow();
  });

  it('should validate inputs in unshield', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.unshield(account, '0xtoken', 0n, '')).rejects.toThrow();
    await expect(client.unshield(account, '', 1000n, '0xrecipient')).rejects.toThrow();
    await expect(client.unshield(account, '0xtoken', 1000n, '')).rejects.toThrow();
  });

  it('should validate inputs in privateTransfer', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.privateTransfer(account, '', '0xtoken', 1000n)).rejects.toThrow();
    await expect(client.privateTransfer(account, '0xto', '', 0n)).rejects.toThrow();
  });

  it('should validate token in addSupportedToken', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.addSupportedToken(account, '')).rejects.toThrow();
  });

  it('should validate poolAddress in setPool', async () => {
    const client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.setPool(account, '')).rejects.toThrow();
  });
});

describe('PoolClient read methods', () => {
  let client: PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
    client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f4d41494e',
    });
  });

  it('should call supports_token on the contract', async () => {
    mockContractInstance.supports_token = vi.fn().mockResolvedValue(true);
    const result = await client.supportsToken('0xtoken');
    expect(result).toBe(true);
    expect(mockContractInstance.supports_token).toHaveBeenCalledWith('0xtoken', { blockIdentifier: 'pre_confirmed' });
  });

  it('should call get_nullifier_spent on the contract', async () => {
    mockContractInstance.get_nullifier_spent = vi.fn().mockResolvedValue(false);
    const result = await client.isNullifierSpent('0xnullifier');
    expect(result).toBe(false);
    expect(mockContractInstance.get_nullifier_spent).toHaveBeenCalledWith('0xnullifier', { blockIdentifier: 'pre_confirmed' });
  });

  it('should wrap errors from supports_token', async () => {
    mockContractInstance.supports_token = vi.fn().mockRejectedValue(new Error('RPC error'));
    await expect(client.supportsToken('0xtoken')).rejects.toThrow();
  });

  it('should wrap errors from isNullifierSpent', async () => {
    mockContractInstance.get_nullifier_spent = vi.fn().mockRejectedValue(new Error('RPC error'));
    await expect(client.isNullifierSpent('0xnullifier')).rejects.toThrow();
  });

  it('should handle false return from supports_token', async () => {
    mockContractInstance.supports_token = vi.fn().mockResolvedValue(false);
    const result = await client.supportsToken('0xtoken');
    expect(result).toBe(false);
  });
});

describe('PoolClient unshield and transfer', () => {
  let client: PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
    client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f4d41494e',
    });
  });

  it('should call unshield on the pool contract', async () => {
    mockContractInstance.unshield = vi.fn().mockResolvedValue('0xtxhash');
    const account = { address: '0xuser' } as any;
    const result = await client.unshield(account, '0xtoken', 1000n, '0xrecipient', []);
    expect(result.transactionHash).toBe('0xtxhash');
    expect(mockContractInstance.unshield).toHaveBeenCalled();
  });

  it('should call transfer on the pool contract', async () => {
    mockContractInstance.transfer = vi.fn().mockResolvedValue('0xtxhash');
    const account = { address: '0xuser' } as any;
    const result = await client.transfer(account, '0xto', '0xtoken', 1000n, []);
    expect(result.transactionHash).toBe('0xtxhash');
    expect(mockContractInstance.transfer).toHaveBeenCalled();
  });
});

describe('PrivacyHubClient methods', () => {
  let client: PrivacyHubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f4d41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
    client = new PrivacyHubClient({
      rpcUrl: 'http://localhost:5050',
      privacyHubAddress: '0xabc',
      poolAddress: '0xdef',
    });
  });

  it('should call register_viewing_key on PrivacyHub', async () => {
    mockContractInstance.register_viewing_key = vi.fn().mockResolvedValue('0xregtx');
    const account = { address: '0xuser' } as any;
    const result = await client.registerViewingKey(account, 12345n);
    expect(result.transactionHash).toBe('0xregtx');
  });

  it('should call shield on PrivacyHub', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue('0xshieldtx');
    const account = { address: '0xuser' } as any;
    const result = await client.shield(account, '0xtoken', 1000n);
    expect(result.transactionHash).toBe('0xshieldtx');
    expect(mockContractInstance.shield).toHaveBeenCalledWith('0xtoken', '0x3e8', { from: '0xuser' });
  });

  it('should call unshield on PrivacyHub', async () => {
    mockContractInstance.unshield = vi.fn().mockResolvedValue('0xunshieldtx');
    const account = { address: '0xuser' } as any;
    const result = await client.unshield(account, '0xtoken', 1000n, '0xrecipient');
    expect(result.transactionHash).toBe('0xunshieldtx');
    expect(mockContractInstance.unshield).toHaveBeenCalledWith('0xtoken', '0x3e8', '0xrecipient', { from: '0xuser' });
  });

  it('should call private_transfer on PrivacyHub', async () => {
    mockContractInstance.private_transfer = vi.fn().mockResolvedValue('0xtransfertx');
    const account = { address: '0xuser' } as any;
    const result = await client.privateTransfer(account, '0xto', '0xtoken', 500n);
    expect(result.transactionHash).toBe('0xtransfertx');
    expect(mockContractInstance.private_transfer).toHaveBeenCalledWith('0xto', '0xtoken', '0x1f4', { from: '0xuser' });
  });

  it('should call add_supported_token on PrivacyHub', async () => {
    mockContractInstance.add_supported_token = vi.fn().mockResolvedValue('0xaddtoken');
    const account = { address: '0xadmin' } as any;
    const result = await client.addSupportedToken(account, '0xtoken');
    expect(result.transactionHash).toBe('0xaddtoken');
  });

  it('should call set_pool on PrivacyHub', async () => {
    mockContractInstance.set_pool = vi.fn().mockResolvedValue('0xsetpool');
    const account = { address: '0xadmin' } as any;
    const result = await client.setPool(account, '0xnewpool');
    expect(result.transactionHash).toBe('0xsetpool');
  });
});

describe('PoolClient unshield error wrapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue('0x534e5f41494e');
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
  });

  it('should wrap unshield errors', async () => {
    mockContractInstance.unshield = vi.fn().mockRejectedValue(new Error('Pool error'));
    const client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f41494e',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.unshield(account, '0xtoken', 1000n, '0xrecipient', [])).rejects.toThrow();
  });

  it('should wrap transfer errors', async () => {
    mockContractInstance.transfer = vi.fn().mockRejectedValue(new Error('Pool error'));
    const client = new PoolClient({
      rpcUrl: 'http://localhost:5050',
      poolAddress: '0xabc',
      chainId: '0x534e5f41494e',
    });
    const account = { address: '0xuser' } as any;
    await expect(client.transfer(account, '0xto', '0xtoken', 1000n, [])).rejects.toThrow();
  });
});
