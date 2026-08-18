import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewingKey, ViewingKeyManager } from '../src/privacy/viewing-key';
import { deriveViewingKey } from '../src/utils/poseidon';
import { PoolClient, PrivacyHubClient } from '../src/core/client';
import { ViewingKeyError, InvalidArgumentError } from '../src/utils/errors';
import { ErrorCode } from '../src/utils/errors';

describe('ViewingKey.deriveFromSignature', () => {
  const r = 123456789012345678901234567890123456789012345678901234567890n;
  const s = 987654321098765432109876543210987654321098765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should derive a viewing key from signature components', () => {
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const derived = deriveViewingKey(r, s, chainId, poolAddress);
    expect(vk).toBeInstanceOf(ViewingKey);
    expect(vk.publicKey).toBe(derived.publicKey);
    expect(vk.privateKey).toBe(derived.privateKey);
    expect(vk.chainId).toBe(chainId);
    expect(vk.poolAddress).toBe(poolAddress);
  });

  it('should compute public/private keys correctly', () => {
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const { publicKey, privateKey } = deriveViewingKey(r, s, chainId, poolAddress);
    expect(vk.publicKey).toBe(publicKey);
    expect(vk.privateKey).toBe(privateKey);
  });

  it('should be deterministic', () => {
    const a = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const b = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.privateKey).toBe(b.privateKey);
  });

  it('should accept string r and s', () => {
    const fromStrings = ViewingKey.deriveFromSignature(r.toString(), s.toString(), chainId, poolAddress);
    const fromBigints = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    expect(fromStrings.publicKey).toBe(fromStrings.publicKey);
  });

  it('should accept hex string r and s', () => {
    const fromHex = ViewingKey.deriveFromSignature('0x' + r.toString(16), '0x' + s.toString(16), chainId, poolAddress);
    const fromBigints = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    expect(fromHex.publicKey).toBe(fromBigints.publicKey);
  });
});

describe('ViewingKey.deriveFromSignature error cases', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;

  it('should throw if chainId is empty', () => {
    expect(() => ViewingKey.deriveFromSignature(r, s, '', '0xabc')).toThrow(InvalidArgumentError);
  });

  it('should throw if poolAddress is empty', () => {
    expect(() => ViewingKey.deriveFromSignature(r, s, '0x534e', '')).toThrow(InvalidArgumentError);
  });
});

describe('ViewingKey serialization', () => {
  const r = 123456789012345678901234567890123456789012345678901234567890n;
  const s = 987654321098765432109876543210987654321098765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should serialize and deserialize correctly', () => {
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const serialized = vk.serialize();
    const deserialized = ViewingKey.deserialize(serialized);
    expect(deserialized.publicKey).toBe(vk.publicKey);
    expect(deserialized.privateKey).toBe(vk.privateKey);
    expect(deserialized.chainId).toBe(vk.chainId);
    expect(deserialized.poolAddress).toBe(vk.poolAddress);
  });

  it('should toJSON and fromJSON correctly', () => {
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const json = vk.toJSON();
    expect(json.publicKey).toBe(vk.publicKey.toString());
    expect(json.privateKey).toBe(vk.privateKey.toString());
    expect(json.chainId).toBe(chainId);
    expect(json.poolAddress).toBe(poolAddress);

    const restored = ViewingKey.fromJSON(json);
    expect(restored.publicKey).toBe(vk.publicKey);
    expect(restored.privateKey).toBe(vk.privateKey);
  });
});

describe('ViewingKey getPublic/getPrivate', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should return the correct public and private keys', () => {
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    expect(vk.getPublic()).toBe(vk.publicKey);
    expect(vk.getPrivate()).toBe(vk.privateKey);
  });
});

describe('ViewingKey.fromPublicKey', () => {
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should construct a symmetric key from a public key', () => {
    const vk = ViewingKey.fromPublicKey(123456789n, chainId, poolAddress);
    expect(vk.publicKey).toBe(123456789n);
    expect(vk.privateKey).toBe(123456789n);
    expect(vk.chainId).toBe(chainId);
    expect(vk.poolAddress).toBe(poolAddress);
  });

  it('should accept hex string public key', () => {
    const vk = ViewingKey.fromPublicKey('0x75bcd15', chainId, poolAddress);
    expect(vk.publicKey).toBe(123456789n);
  });

  it('should throw if public key is zero', () => {
    expect(() => ViewingKey.fromPublicKey(0n, chainId, poolAddress)).toThrow();
  });

  it('should throw if chainId or poolAddress is missing', () => {
    expect(() => ViewingKey.fromPublicKey(1n, '', poolAddress)).toThrow();
    expect(() => ViewingKey.fromPublicKey(1n, chainId, '')).toThrow();
  });
});

describe('ViewingKeyManager', () => {
  const mockClient = {
    poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    chainId: '0x534e5f4d41494e',
    registerViewingKey: vi.fn(),
    getContract: vi.fn(),
  };

  const r = 123456789012345678901234567890123456789012345678901234567890n;
  const s = 987654321098765432109876543210987654321098765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct with a PoolClient', () => {
    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    expect(manager).toBeInstanceOf(ViewingKeyManager);
  });

  it('should register a viewing key', async () => {
    const txResult = {
      transactionHash: '0xabc123',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: Date.now() }),
    };
    mockClient.registerViewingKey.mockResolvedValue(txResult);

    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const account = { address: '0xuser123' } as any;

    const result = await manager.register(account, vk);

    expect(mockClient.registerViewingKey).toHaveBeenCalledWith(account, vk.publicKey);
    expect(result.transactionHash).toBe('0xabc123');
    expect(result.event).toBeDefined();
    expect(result.event?.publicKey).toBe(vk.publicKey);
    expect(result.event?.user).toBe('0xuser123');
  });

  it('should register with PrivacyHubClient', async () => {
    const hubMock = {
      privacyHubAddress: '0xhub',
      poolAddress: poolAddress,
      chainId,
      registerViewingKey: vi.fn().mockResolvedValue({
        transactionHash: '0xhubtx',
        wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' }),
      }),
    };

    const manager = new ViewingKeyManager(hubMock as any as PrivacyHubClient);
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const account = { address: '0xuser123' } as any;

    const result = await manager.register(account, vk);

    expect(hubMock.registerViewingKey).toHaveBeenCalledWith(account, vk.publicKey);
    expect(result.transactionHash).toBe('0xhubtx');
  });

  it('should throw ViewingKeyError if viewing key is null', async () => {
    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    const account = { address: '0xuser123' } as any;

    await expect(manager.register(account, null as any)).rejects.toThrow(ViewingKeyError);
  });

  it('should propagate registration errors', async () => {
    mockClient.registerViewingKey.mockRejectedValue(new Error('on-chain error'));

    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const account = { address: '0xuser123' } as any;

    await expect(manager.register(account, vk)).rejects.toThrow('Failed to register viewing key');
  });

  it('should check isRegistered (fallback to false on error)', async () => {
    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const account = { address: '0xuser123' } as any;

    mockClient.getContract.mockResolvedValue({
      has_viewing_key: vi.fn().mockResolvedValue(true),
    });

    const result = await manager.isRegistered(account, vk);
    expect(result).toBe(true);
  });

  it('should return false for isRegistered when contract call fails', async () => {
    const manager = new ViewingKeyManager(mockClient as any as PoolClient);
    const vk = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
    const account = { address: '0xuser123' } as any;

    mockClient.getContract.mockRejectedValue(new Error('RPC error'));

    const result = await manager.isRegistered(account, vk);
    expect(result).toBe(false);
  });

  it('should derive from wallet with mocked account', async () => {
    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue({ r: '0x' + r.toString(16), s: '0x' + s.toString(16) }),
      provider: {
        getChainId: vi.fn().mockResolvedValue(chainId),
      },
    } as any;

    const vk = await ViewingKey.deriveFromWallet(mockAccount, chainId, poolAddress);
    expect(vk.publicKey).toBeGreaterThan(0n);
    expect(vk.chainId).toBe(chainId);
    expect(vk.poolAddress).toBe(poolAddress);
    expect(mockAccount.signMessage).toHaveBeenCalled();
  });

  it('should throw if deriveFromWallet has no poolAddress', async () => {
    const mockAccount = {
      signMessage: vi.fn(),
      provider: { getChainId: vi.fn().mockResolvedValue(chainId) },
    } as any;

    await expect(ViewingKey.deriveFromWallet(mockAccount, chainId, undefined)).rejects.toThrow(ViewingKeyError);
  });
});

describe('ViewingKeyManager edge cases', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  it('should delegate deriveFromWallet to ViewingKey.deriveFromWallet', async () => {
    const mockClient = {
      poolAddress,
      chainId,
    };
    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue({ r: '0x' + r.toString(16), s: '0x' + s.toString(16) }),
      provider: { getChainId: vi.fn().mockResolvedValue(chainId) },
    } as any;

    const manager = new ViewingKeyManager(mockClient as any);
    const result = await manager.deriveFromWallet(mockAccount, chainId, poolAddress);
    expect(result.publicKey).toBe(viewingKey.publicKey);
    expect(mockAccount.signMessage).toHaveBeenCalled();
  });

  it('should rethrow VIEWING_KEY_NOT_REGISTERED errors', async () => {
    const mockClient = {
      poolAddress,
      chainId,
      registerViewingKey: vi.fn().mockRejectedValue(
        Object.assign(new Error('Not registered'), { code: ErrorCode.VIEWING_KEY_NOT_REGISTERED })
      ),
    };
    const manager = new ViewingKeyManager(mockClient as any);
    const account = { address: '0xuser' } as any;

    await expect(manager.register(account, viewingKey)).rejects.toThrow();
  });

  it('should return false for isRegistered when has_viewing_key returns false', async () => {
    const mockClient = {
      poolAddress,
      chainId,
      getContract: vi.fn().mockResolvedValue({
        has_viewing_key: vi.fn().mockResolvedValue(false),
      }),
    };
    const manager = new ViewingKeyManager(mockClient as any);
    const account = { address: '0xuser' } as any;

    const result = await manager.isRegistered(account, viewingKey);
    expect(result).toBe(false);
  });

  it('should return false for isRegistered when has_viewing_key returns undefined', async () => {
    const mockClient = {
      poolAddress,
      chainId,
      getContract: vi.fn().mockResolvedValue({
        has_viewing_key: vi.fn().mockResolvedValue(undefined),
      }),
    };
    const manager = new ViewingKeyManager(mockClient as any);
    const account = { address: '0xuser' } as any;

    const result = await manager.isRegistered(account, viewingKey);
    expect(result).toBe(false);
  });

  it('should throw ViewingKeyError on unknown registration error', async () => {
    const mockClient = {
      poolAddress,
      chainId,
      registerViewingKey: vi.fn().mockRejectedValue(new Error('Blockchain error')),
    };
    const manager = new ViewingKeyManager(mockClient as any);
    const account = { address: '0xuser' } as any;

    await expect(manager.register(account, viewingKey)).rejects.toThrow('Failed to register viewing key');
  });
});

describe('parseSignature edge cases', () => {
  it('should throw for invalid signature format', async () => {
    const r = 12345678901234567890n;
    const s = 98765432109876543210n;
    const chainId = '0x534e5f4d41494e';
    const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue('invalid-signature' as any),
      provider: { getChainId: vi.fn().mockResolvedValue(chainId) },
    } as any;

    await expect(
      ViewingKey.deriveFromWallet(mockAccount, chainId, poolAddress)
    ).rejects.toThrow(ViewingKeyError);
  });

  it('should handle array signature from wallet', async () => {
    const r = 12345678901234567890n;
    const s = 98765432109876543210n;
    const chainId = '0x534e5f4d41494e';
    const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue(['0x' + r.toString(16), '0x' + s.toString(16)]),
      provider: { getChainId: vi.fn().mockResolvedValue(chainId) },
    } as any;

    const vk = await ViewingKey.deriveFromWallet(mockAccount, chainId, poolAddress);
    expect(vk.publicKey).toBeGreaterThan(0n);
  });
});

describe('ViewingKey.deriveFromStarknetWindow', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should throw if wallet has no account', async () => {
    const wallet = { account: undefined };
    await expect(
      ViewingKey.deriveFromStarknetWindow(wallet, chainId, poolAddress)
    ).rejects.toThrow(ViewingKeyError);
  });

  it('should derive from wallet via starknet window', async () => {
    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue({ r: '0x' + r.toString(16), s: '0x' + s.toString(16) }),
      provider: { getChainId: vi.fn().mockResolvedValue(chainId) },
    } as any;

    const wallet = { account: mockAccount };
    const vk = await ViewingKey.deriveFromStarknetWindow(wallet, chainId, poolAddress);
    expect(vk.publicKey).toBeGreaterThan(0n);
    expect(mockAccount.signMessage).toHaveBeenCalled();
  });
});

describe('ViewingKey.resolveAccountChainId fallback', () => {
  it('should use chainId property when provider.getChainId fails', async () => {
    const r = 12345678901234567890n;
    const s = 98765432109876543210n;
    const chainId = '0x534e5f4d41494e';
    const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

    const mockAccount = {
      address: '0xabc',
      signMessage: vi.fn().mockResolvedValue({ r: '0x' + r.toString(16), s: '0x' + s.toString(16) }),
      chainId: chainId,
      provider: {
        getChainId: vi.fn().mockRejectedValue(new Error('RPC error')),
      },
    } as any;

    const vk = await ViewingKey.deriveFromWallet(mockAccount, undefined, poolAddress);
    expect(vk.chainId).toBe(chainId);
  });
});
