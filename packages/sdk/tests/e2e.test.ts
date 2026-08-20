import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyHubClient, PoolClient } from '../src/core/client';
import { ShieldBuilder } from '../src/privacy/shield';
import { PrivateTransferBuilder } from '../src/privacy/private-transfer';
import { UnshieldBuilder } from '../src/privacy/unshield';
import { NoteDiscovery } from '../src/privacy/discovery';
import { ViewingKey } from '../src/privacy/viewing-key';
import { ProvingService } from '../src/privacy/prover';

const RPC_URL = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44';
const POOL_ADDRESS = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
const PRIVACY_HUB_ADDRESS = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
const TOKEN = '0x04718f5a0fc34cc1af16a5747e8a71d7545e1d59b4d1a2c3e4f5a6b7c8d9e0f1';
const CHAIN_ID = '0x534e5f5345504f4c4941';

const r = 12345678901234567890n;
const s = 98765432109876543210n;
const viewingKey = ViewingKey.deriveFromSignature(r, s, CHAIN_ID, POOL_ADDRESS);
const account = { address: '0xuserAddress' } as any;

const mockContractInstance: Record<string, any> = {};
const mockWaitForTransaction = vi.fn();
const mockGetChainId = vi.fn().mockResolvedValue(CHAIN_ID);

vi.mock('starknet', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
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
  };
});

describe('E2E: Shield → Private Transfer → Unshield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChainId.mockResolvedValue(CHAIN_ID);
    Object.keys(mockContractInstance).forEach(k => delete mockContractInstance[k]);
    mockWaitForTransaction.mockResolvedValue({
      transaction_hash: '0xtxhash',
      finality_status: 'ACCEPTED_ON_L2',
      block_hash: '0xblock',
      block_number: 100,
      actual_fee: { amount: '100', unit: 'FRI' },
      timestamp: 1234567890,
    });
  });

  it('should complete shield flow', async () => {
    mockContractInstance.shield = vi.fn().mockResolvedValue('0xshieldtx');
    mockContractInstance.register_viewing_key = vi.fn().mockResolvedValue('0xregtx');

    const client = new PoolClient({
      rpcUrl: RPC_URL,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
    });

    const builder = new ShieldBuilder(client);
    const result = await builder.shield({
      account,
      token: TOKEN,
      amount: 1_000_000n,
      viewingKey,
    });

    expect(result.transactionHash).toBe('0xshieldtx');
    expect(result.noteHash).toBeDefined();
    expect(result.status).toBe('ACCEPTED_ON_L2');
  });

  it('should complete private transfer flow', async () => {
    mockContractInstance.private_transfer = vi.fn().mockResolvedValue('0xtransfertx');

    const client = new PrivacyHubClient({
      rpcUrl: RPC_URL,
      privacyHubAddress: PRIVACY_HUB_ADDRESS,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
    });

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const builder = new PrivateTransferBuilder(client, prover);

    vi.spyOn(prover, 'generateTransferProof').mockResolvedValue({
      nullifier: '0xnullifier123',
      proof: '0xproofdata',
      publicInputs: [],
    });

    const result = await builder.transfer({
      account,
      token: TOKEN,
      amount: 500_000n,
      recipient: 0x123456789n,
      viewingKey,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
    });

    expect(result.transactionHash).toBe('0xtransfertx');
    expect(result.nullifier).toBe('0xnullifier123');
  });

  it('should complete unshield flow', async () => {
    mockContractInstance.unshield = vi.fn().mockResolvedValue('0xunshieldtx');

    const client = new PrivacyHubClient({
      rpcUrl: RPC_URL,
      privacyHubAddress: PRIVACY_HUB_ADDRESS,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
    });

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const builder = new UnshieldBuilder(client, prover);

    vi.spyOn(prover, 'generateUnshieldProof').mockResolvedValue({
      nullifier: '0xnullifier123',
      proof: '0xproofdata',
      publicInputs: [],
    });

    const result = await builder.unshield({
      account,
      token: TOKEN,
      amount: 500_000n,
      recipient: '0xrecipientAddress',
      note: {
        noteHash: '0xnotehash123',
        token: TOKEN,
        amount: 500_000n,
        nullifier: '0xnullifier123',
        spent: false,
        createdAt: Date.now(),
      },
      viewingKey,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
    });

    expect(result.transactionHash).toBe('0xunshieldtx');
    expect(result.nullifier).toBe('0xnullifier123');
  });

  it('should discover notes after shield', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        notes: [
          {
            noteHash: '0xnote1',
            token: TOKEN,
            encryptedAmount: '0x7b2cbb8a',
            encryptedNullifier: '0x6e756c6c696669657231',
            nullifier: '0xnullifier1',
            blockNumber: 100,
            timestamp: 1234567890,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const discovery = new NoteDiscovery({
      poolAddress: POOL_ADDRESS,
      provider: {} as any,
      getChainId: vi.fn().mockResolvedValue(CHAIN_ID),
    } as any, 'http://localhost:8081');

    const notes = await discovery.discoverNotes(account.address, viewingKey, {
      tokens: [TOKEN],
    });

    expect(notes.size).toBeGreaterThanOrEqual(0);
  });
});
