import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShieldBuilder } from '../src/privacy/shield';
import { ViewingKey } from '../src/privacy/viewing-key';
import { ShieldError, ViewingKeyError, InvalidArgumentError } from '../src/utils/errors';
import { ShieldParams, ShieldResult } from '../src/types';

describe('ShieldBuilder', () => {
  const mockClient = {
    poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    chainId: '0x534e5f4d41494e',
    shield: vi.fn(),
    getContract: vi.fn(),
  };

  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const token = '0x04718f5a0fc34cc1af16a5747e8a71d7545e1d59b4d1a2c3e4f5a6b7c8d9e0f1';
  const account = { address: '0xuserAddress' } as any;

  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeParams = (overrides: Partial<ShieldParams> = {}): ShieldParams => ({
    account,
    token,
    amount: 5_000_000n,
    viewingKey,
    ...overrides,
  });

  it('should construct with a PrivacyHubClient', () => {
    const builder = new ShieldBuilder(mockClient as any);
    expect(builder).toBeInstanceOf(ShieldBuilder);
  });

  it('should shield tokens successfully', async () => {
    const txResult = {
      transactionHash: '0xshieldtx123',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: Date.now() }),
    };
    mockClient.shield.mockResolvedValue(txResult);

    const builder = new ShieldBuilder(mockClient as any);
    const result = await builder.shield(makeParams());

    expect(mockClient.shield).toHaveBeenCalledWith(account, token, 5_000_000n, []);
    expect(result.transactionHash).toBe('0xshieldtx123');
    expect(result.amount).toBe(5_000_000n);
    expect(result.token).toBe(token);
    expect(result.noteHash).toBeDefined();
    expect(typeof result.noteHash).toBe('string');
  });

  it('should forward a provided proof to the hub', async () => {
    const txResult = {
      transactionHash: '0xshieldtxproof',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: Date.now() }),
    };
    mockClient.shield.mockResolvedValue(txResult);

    const builder = new ShieldBuilder(mockClient as any);
    const result = await builder.shield(makeParams({ proof: ['0xaa', '0xbb'] }));

    expect(mockClient.shield).toHaveBeenCalledWith(account, token, 5_000_000n, ['0xaa', '0xbb']);
    expect(result.transactionHash).toBe('0xshieldtxproof');
  });

  it('should wait for transaction confirmation', async () => {
    const txResult = {
      transactionHash: '0xwaitfortx',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: 1234567890000 }),
    };
    mockClient.shield.mockResolvedValue(txResult);

    const builder = new ShieldBuilder(mockClient as any);
    const result = await builder.shield(makeParams());

    const receipt = await result.wait();
    expect(receipt.status).toBe('ACCEPTED_ON_L2');
    expect(receipt.timestamp).toBe(1234567890000);
  });

  it('should derive a deterministic note hash', () => {
    const builder = new ShieldBuilder(mockClient as any);
    const noteHash1 = builder.deriveNoteHash(
      '0xtxhash',
      '0xuser',
      '0xtoken',
      1000000n
    );
    const noteHash2 = builder.deriveNoteHash(
      '0xtxhash',
      '0xuser',
      '0xtoken',
      1000000n
    );
    expect(noteHash1).toBe(noteHash2);
    expect(noteHash1).toMatch(/^0x[0-9a-f]{8}$/);
  });

  it('should produce different note hashes for different inputs', () => {
    const builder = new ShieldBuilder(mockClient as any);
    const hash1 = builder.deriveNoteHash('0xabc', '0xuser1', '0xtoken', 1000n);
    const hash2 = builder.deriveNoteHash('0xabc', '0xuser1', '0xtoken', 2000n);
    const hash3 = builder.deriveNoteHash('0xdef', '0xuser1', '0xtoken', 1000n);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });
});

describe('ShieldBuilder validation', () => {
  const mockClient = {
    poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    shield: vi.fn(),
  };
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);
  const account = { address: '0xuserAddress' } as any;
  const token = '0x04718f5a0fc34cc1af16a5747e8a71d7545e1d59b4d1a2c3e4f5a6b7c8d9e0f1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw if account is missing', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ token, amount: 1000000n, viewingKey } as any)
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw if token is empty', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token: '', amount: 1000000n, viewingKey })
    ).rejects.toThrow(ShieldError);
  });

  it('should throw if token is zero address', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token: '0x0', amount: 1000000n, viewingKey })
    ).rejects.toThrow(ShieldError);
  });

  it('should throw if amount is zero', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token, amount: 0n, viewingKey })
    ).rejects.toThrow(ShieldError);
  });

  it('should throw if amount is negative', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token, amount: -1n, viewingKey })
    ).rejects.toThrow(ShieldError);
  });

  it('should throw if viewingKey is missing', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token, amount: 1000000n, viewingKey: null as any })
    ).rejects.toThrow(ViewingKeyError);
  });

  it('should throw if viewingKey.publicKey is zero', async () => {
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token, amount: 1000000n, viewingKey: { publicKey: 0n, privateKey: 0n } })
    ).rejects.toThrow(ViewingKeyError);
  });

  it('should wrap unexpected errors in ShieldError', async () => {
    mockClient.shield.mockRejectedValue(new Error('RPC connection failed'));
    const builder = new ShieldBuilder(mockClient as any);
    await expect(
      builder.shield({ account, token, amount: 1000000n, viewingKey })
    ).rejects.toThrow(ShieldError);
  });
});
