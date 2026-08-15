import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoteDiscovery, IndexerDiscoveryProvider, IndexerNote } from '../src/privacy/discovery';
import { ViewingKey } from '../src/privacy/viewing-key';
import { ShieldedNote, PrivateBalance, DiscoverNotesOptions } from '../src/types';
import { DiscoveryError, InvalidArgumentError } from '../src/utils/errors';

describe('IndexerDiscoveryProvider', () => {
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const indexerUrl = 'http://localhost:8080';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct with valid config', () => {
    const provider = new IndexerDiscoveryProvider({
      url: indexerUrl,
      poolAddress,
    });
    expect(provider.url).toBe(indexerUrl);
    expect(provider.poolAddress).toBe(poolAddress);
  });

  it('should strip trailing slash from url', () => {
    const provider = new IndexerDiscoveryProvider({
      url: 'http://localhost:8080/',
      poolAddress,
    });
    expect(provider.url).toBe('http://localhost:8080');
  });

  it('should throw if url is empty', () => {
    expect(() => new IndexerDiscoveryProvider({ url: '', poolAddress })).toThrow(InvalidArgumentError);
  });

  it('should throw if poolAddress is empty', () => {
    expect(() => new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress: '' })).toThrow(InvalidArgumentError);
  });

  describe('discoverNotes', () => {
    it('should query indexer and return decrypted notes', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x7b2cbb8a',
          encryptedNullifier: '0x6e756c6c696669657231',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1234567890,
        },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const result = await provider.discoverNotes(12345n, 67890n, {
        tokens: ['0xtoken1'],
        blockIdentifier: 'pre_confirmed',
      });

      expect(mockFetch).toHaveBeenCalled();
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('viewing_key=12345');
      expect(callUrl).toContain('pool_address=' + poolAddress);
      expect(callUrl).toContain('block_identifier=pre_confirmed');
      expect(callUrl).toContain('tokens=0xtoken1');

      expect(result.size).toBe(1);
      expect(result.has('0xtoken1')).toBe(true);
    });

    it('should throw if publicKey is zero', async () => {
      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      await expect(
        provider.discoverNotes(0n, 12345n, {})
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw if privateKey is zero', async () => {
      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      await expect(
        provider.discoverNotes(12345n, 0n, {})
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle empty notes from indexer', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      }));

      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const result = await provider.discoverNotes(12345n, 67890n, {});
      expect(result.size).toBe(0);
    });

    it('should handle missing notes field in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }));

      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const result = await provider.discoverNotes(12345n, 67890n, {});
      expect(result.size).toBe(0);
    });

    it('should handle indexer error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      }));

      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      await expect(provider.discoverNotes(12345n, 67890n, {})).rejects.toThrow(DiscoveryError);
    });

    it('should include multiple tokens as repeated query params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      await provider.discoverNotes(12345n, 67890n, {
        tokens: ['0xtoken1', '0xtoken2'],
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('tokens=0xtoken1');
      expect(callUrl).toContain('tokens=0xtoken2');
    });
  });

  describe('decryptNote', () => {
    it('should decrypt a note with hex-encoded values', () => {
      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const note: IndexerNote = {
        noteHash: '0xnote',
        token: '0xtoken',
        encryptedAmount: '0x100000',
        encryptedNullifier: '0xnullifier',
        nullifier: '0xnullifier',
        blockNumber: 100,
        timestamp: 1000,
      };

      const result = provider['decryptNote'](note, 12345n);
      expect(result).not.toBeNull();
      expect(result!.amount).toBe(BigInt('0x100000'));
      expect(result!.nullifier).toBe('0xnullifier');
      expect(result!.token).toBe('0xtoken');
    });

    it('should return null for undecryptable note', () => {
      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const note: IndexerNote = {
        noteHash: '0xnote',
        token: '0xtoken',
        encryptedAmount: '',
        encryptedNullifier: '0xnullifier',
        nullifier: '0xnullifier',
        blockNumber: 100,
        timestamp: 1000,
      };

      const result = provider['decryptNote'](note, 12345n);
      expect(result).toBeNull();
    });

    it('should return null if privateKey is zero', () => {
      const provider = new IndexerDiscoveryProvider({ url: indexerUrl, poolAddress });
      const note: IndexerNote = {
        noteHash: '0xnote',
        token: '0xtoken',
        encryptedAmount: '0x100000',
        encryptedNullifier: '0xnullifier',
        nullifier: '0xnullifier',
        blockNumber: 100,
        timestamp: 1000,
      };

      const result = provider['decryptNote'](note, 0n);
      expect(result).toBeNull();
    });
  });
});

describe('NoteDiscovery', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const indexerUrl = 'http://localhost:8080';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  const mockClient = {
    poolAddress,
    chainId,
    provider: {},
    getChainId: vi.fn().mockResolvedValue(chainId),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('discoverNotes', () => {
    it('should discover notes via the indexer', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x7b2cbb8a',
          encryptedNullifier: '0x6e756c6c696669657231',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1234567890,
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      }));

      const discovery = new NoteDiscovery(
        mockClient as any,
        indexerUrl
      );

      const notes = await discovery.discoverNotes(12345n, viewingKey, {
        tokens: ['0xtoken1'],
        blockIdentifier: 'pre_confirmed',
      });

      expect(notes.size).toBe(1);
      expect(notes.has('0xtoken1')).toBe(true);
      const tokenNotes = notes.get('0xtoken1')!;
      expect(tokenNotes.length).toBe(1);
      expect(tokenNotes[0].token).toBe('0xtoken1');
    });

    it('should throw if userAddress is missing', async () => {
      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      await expect(
        discovery.discoverNotes(0n, viewingKey, {})
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw if viewingKey is missing', async () => {
      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      await expect(
        discovery.discoverNotes(12345n, null as any, {})
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw if viewingKey.publicKey is zero', async () => {
      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      await expect(
        discovery.discoverNotes(12345n, { publicKey: 0n, privateKey: 0n }, {})
      ).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('getPrivateBalance', () => {
    it('should compute total balance from unspent notes', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x64',
          encryptedNullifier: '0xnonce1',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1000,
        },
        {
          noteHash: '0xnote2',
          token: '0xtoken1',
          encryptedAmount: '0x32',
          encryptedNullifier: '0xnonce2',
          nullifier: '0xnullifier2',
          blockNumber: 101,
          timestamp: 1001,
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      }));

      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      const balance = await discovery.getPrivateBalance(12345n, viewingKey, '0xtoken1');

      expect(balance.token).toBe('0xtoken1');
      expect(balance.amount).toBe(100n + 50n);
      expect(balance.noteCount).toBe(2);
      expect(balance.notes.length).toBe(2);
    });

    it('should return zero balance when no notes exist', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      }));

      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      const balance = await discovery.getPrivateBalance(12345n, viewingKey, '0xtoken1');

      expect(balance.amount).toBe(0n);
      expect(balance.noteCount).toBe(0);
      expect(balance.notes).toHaveLength(0);
    });
  });

  describe('selectSpendableNotes', () => {
    it('should select notes that cover the requested amount', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x64',
          encryptedNullifier: '0xnonce1',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1000,
        },
        {
          noteHash: '0xnote2',
          token: '0xtoken1',
          encryptedAmount: '0x32',
          encryptedNullifier: '0xnonce2',
          nullifier: '0xnullifier2',
          blockNumber: 101,
          timestamp: 1001,
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      }));

      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      const notes = await discovery.selectSpendableNotes(12345n, viewingKey, '0xtoken1', 100n);

      expect(notes.length).toBe(1);
      expect(notes[0].amount).toBe(100n);
    });

    it('should select multiple notes if needed', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x32',
          encryptedNullifier: '0xnonce1',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1000,
        },
        {
          noteHash: '0xnote2',
          token: '0xtoken1',
          encryptedAmount: '0x32',
          encryptedNullifier: '0xnonce2',
          nullifier: '0xnullifier2',
          blockNumber: 101,
          timestamp: 1001,
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      }));

      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      const notes = await discovery.selectSpendableNotes(12345n, viewingKey, '0xtoken1', 100n);

      expect(notes.length).toBe(2);
    });

    it('should throw if insufficient balance', async () => {
      const encryptedNotes: IndexerNote[] = [
        {
          noteHash: '0xnote1',
          token: '0xtoken1',
          encryptedAmount: '0x0a',
          encryptedNullifier: '0xnonce1',
          nullifier: '0xnullifier1',
          blockNumber: 100,
          timestamp: 1000,
        },
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notes: encryptedNotes }),
      }));

      const discovery = new NoteDiscovery(mockClient as any, indexerUrl);
      await expect(
        discovery.selectSpendableNotes(12345n, viewingKey, '0xtoken1', 1000n)
      ).rejects.toThrow(DiscoveryError);
    });
  });
});
