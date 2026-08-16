import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivateTransferBuilder } from '../src/privacy/private-transfer';
import { ViewingKey } from '../src/privacy/viewing-key';
import { TransferError, InvalidArgumentError, ViewingKeyError } from '../src/utils/errors';
import { TransferParams, TransferResult } from '../src/types';

describe('PrivateTransferBuilder', () => {
  const mockClient = {
    poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    chainId: '0x534e5f4d41494e',
    privateTransfer: vi.fn(),
  };
  const mockProver = {
    generateTransferProof: vi.fn(),
    healthCheck: vi.fn(),
    url: 'http://localhost:8080',
    timeoutMs: 120000,
  };

  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const token = '0x04718f5a0fc34cc1af16a5747e8a71d7545e1d59b4d1a2c3e4f5a6b7c8d9e0f1';
  const recipient = 0x123456789abcdefn;
  const account = { address: '0xuserAddress' } as any;

  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  const testProof = {
    nullifier: '0xnullifier123',
    proof: '0xproofdata',
    publicInputs: ['0xinput1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeParams = (overrides: Partial<TransferParams> = {}): TransferParams => ({
    account,
    token,
    amount: 5_000_000n,
    recipient,
    viewingKey,
    poolAddress,
    chainId,
    ...overrides,
  });

  it('should construct with a client and prover', () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    expect(builder).toBeInstanceOf(PrivateTransferBuilder);
  });

  it('should transfer successfully with valid proof', async () => {
    mockProver.generateTransferProof.mockResolvedValue(testProof);
    mockClient.privateTransfer.mockResolvedValue({
      transactionHash: '0xtransfertx789',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: Date.now() }),
    });

    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    const result = await builder.transfer(makeParams());

    expect(mockProver.generateTransferProof).toHaveBeenCalledWith({
      token,
      amount: '5000000',
      recipient: '0x123456789abcdef',
      viewing_key: { public_key: viewingKey.publicKey.toString(), private_key: viewingKey.privateKey.toString() },
      pool_address: poolAddress,
      chain_id: chainId,
    });
    expect(mockClient.privateTransfer).toHaveBeenCalledWith(account, '0x123456789abcdef', token, 5_000_000n, ['0xproofdata']);
    expect(result.transactionHash).toBe('0xtransfertx789');
    expect(result.nullifier).toBe('0xnullifier123');
    expect(result.amount).toBe(5_000_000n);
    expect(result.token).toBe(token);
    expect(result.recipient).toBe('0x123456789abcdef');
  });

  it('should wait for transfer transaction confirmation', async () => {
    mockProver.generateTransferProof.mockResolvedValue(testProof);
    mockClient.privateTransfer.mockResolvedValue({
      transactionHash: '0xtransfertx',
      wait: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2', timestamp: 1234567890000 }),
    });

    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    const result = await builder.transfer(makeParams());

    const receipt = await result.wait();
    expect(receipt.status).toBe('ACCEPTED_ON_L2');
    expect(receipt.timestamp).toBe(1234567890000);
  });
});

describe('PrivateTransferBuilder validation', () => {
  const mockClient = { privateTransfer: vi.fn() };
  const mockProver = { generateTransferProof: vi.fn() };
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

  const makeParams = (overrides: Partial<TransferParams> = {}): TransferParams => ({
    account,
    token,
    amount: 1000000n,
    recipient: 0x123456789n,
    viewingKey,
    poolAddress,
    chainId,
    ...overrides,
  });

  it('should throw if account is missing', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams({ account: undefined as any }))).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw if token is empty', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams({ token: '' }))).rejects.toThrow(TransferError);
  });

  it('should throw if amount is zero', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams({ amount: 0n }))).rejects.toThrow(TransferError);
  });

  it('should throw if recipient is zero', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams({ recipient: 0n }))).rejects.toThrow(TransferError);
  });

  it('should throw if viewingKey is missing', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams({ viewingKey: null as any }))).rejects.toThrow(ViewingKeyError);
  });

  it('should throw if viewingKey.publicKey is zero', async () => {
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(
      builder.transfer(makeParams({ viewingKey: { publicKey: 0n, privateKey: 0n } }))
    ).rejects.toThrow(ViewingKeyError);
  });

  it('should throw if proof has no proof data', async () => {
    mockProver.generateTransferProof.mockResolvedValue({ nullifier: '', proof: '', publicInputs: [] });
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams())).rejects.toThrow(TransferError);
  });

  it('should wrap unexpected errors in TransferError', async () => {
    mockProver.generateTransferProof.mockRejectedValue(new Error('Prover down'));
    const builder = new PrivateTransferBuilder(mockClient as any, mockProver as any);
    await expect(builder.transfer(makeParams())).rejects.toThrow(TransferError);
  });
});
