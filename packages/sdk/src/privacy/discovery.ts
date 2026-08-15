import {
  ShieldedNote,
  PrivateBalance,
  ViewingKeyData,
  DiscoverNotesOptions,
  IndexerConfig,
} from '../types';
import { DiscoveryError, InvalidArgumentError } from '../utils/errors';
import { PoolClient } from '../core/client';

export interface IndexerNote {
  noteHash: string;
  token: string;
  encryptedAmount: string;
  encryptedNullifier: string;
  nullifier: string;
  blockNumber: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Decryptor {
  decrypt(note: IndexerNote, privateKey: bigint): Promise<ShieldedNote | null>;
}

export interface DiscovererConfig {
  indexerUrl: string;
  poolAddress: string;
  timeoutMs?: number;
}

export class IndexerDiscoveryProvider {
  readonly url: string;
  readonly poolAddress: string;
  readonly timeoutMs: number;

  constructor(config: IndexerConfig) {
    if (!config.url) {
      throw new InvalidArgumentError('indexer url is required');
    }
    if (!config.poolAddress) {
      throw new InvalidArgumentError('poolAddress is required');
    }
    this.url = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    this.poolAddress = config.poolAddress;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async discoverNotes(
    publicKey: bigint | string,
    privateKey: bigint | string,
    options: DiscoverNotesOptions & { blockIdentifier?: string }
  ): Promise<Map<string, ShieldedNote[]>> {
    if (!publicKey || publicKey === 0n) {
      throw new InvalidArgumentError('publicKey must be a non-zero bigint');
    }
    if (!privateKey || privateKey === 0n) {
      throw new InvalidArgumentError('privateKey must be a non-zero bigint');
    }

    const pubKey = typeof publicKey === 'bigint' ? publicKey.toString() : publicKey;
    const privKey = typeof privateKey === 'bigint' ? privateKey.toString() : privateKey;

    const queryParams = new URLSearchParams({
      viewing_key: pubKey,
      pool_address: this.poolAddress,
      block_identifier: options.blockIdentifier ?? 'pre_confirmed',
    });

    if (options.tokens && options.tokens.length > 0) {
      options.tokens.forEach(token => queryParams.append('tokens', token));
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.url}/notes?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new DiscoveryError(
          'Indexer returned HTTP ' + response.status + ': ' + (response.statusText || '')
        );
      }

      const data = (await response.json()) as {
        notes?: IndexerNote[];
        encrypted_notes?: IndexerNote[];
      };

      const notes: IndexerNote[] = data.notes ?? data.encrypted_notes ?? [];

      const decryptedNotes = await this.decryptNotes(notes, privKey);

      const result = new Map<string, ShieldedNote[]>();

      for (const note of decryptedNotes) {
        if (note.spent && !options.includeSpent) continue;
        if (!note.spent && options.includeSpent === false) {
          const existing = result.get(note.token) ?? [];
          existing.push(note);
          result.set(note.token, existing);
        } else {
          const existing = result.get(note.token) ?? [];
          existing.push(note);
          result.set(note.token, existing);
        }
      }

      return result;
    } catch (error) {
      if (error instanceof InvalidArgumentError) throw error;
      throw new DiscoveryError('Indexer discovery failed: ' + (error as Error).message, error);
    }
  }

  private async decryptNotes(notes: IndexerNote[], privateKey: string): Promise<ShieldedNote[]> {
    const decrypted: ShieldedNote[] = [];
    const privKey = BigInt(privateKey);

    for (const note of notes) {
      const shieldedNote = this.decryptNote(note, privKey);
      if (shieldedNote) {
        decrypted.push(shieldedNote);
      }
    }

    return decrypted;
  }

  private decryptNote(note: IndexerNote, privateKey: bigint): ShieldedNote | null {
    try {
      const decryptedAmount = this.decryptValue(note.encryptedAmount, privateKey);
      const decryptedNullifier = this.decryptValue(note.encryptedNullifier, privateKey);

      if (!decryptedAmount || !decryptedNullifier) {
        return null;
      }

      return {
        noteHash: note.noteHash,
        token: note.token,
        amount: BigInt(decryptedAmount),
        nullifier: decryptedNullifier,
        spent: false,
        createdAt: note.timestamp,
        metadata: note.metadata,
      };
    } catch {
      return null;
    }
  }

  private decryptValue(encrypted: string, privateKey: bigint): string | null {
    if (!encrypted || encrypted === '') return null;
    if (!privateKey || privateKey === 0n) return null;

    try {
      const hexStr = encrypted.startsWith('0x') ? encrypted.slice(2) : encrypted;
      const decoded = Buffer.from(hexStr, 'hex').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.value === 'string') {
        return parsed.value;
      }
    } catch {
      // Not JSON-encoded, try other methods
    }

    try {
      return BigInt(encrypted).toString();
    } catch {
      return encrypted;
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

export class NoteDiscovery {
  constructor(
    private readonly client: PoolClient,
    private readonly indexerUrl: string,
  ) {}

  async discoverNotes(
    userAddress: bigint | string,
    viewingKey: ViewingKeyData,
    options: DiscoverNotesOptions = {}
  ): Promise<Map<string, ShieldedNote[]>> {
    if (!userAddress) {
      throw new InvalidArgumentError('userAddress is required');
    }
    if (!viewingKey) {
      throw new InvalidArgumentError('viewingKey is required');
    }
    if (!viewingKey.publicKey || viewingKey.publicKey === 0n) {
      throw new InvalidArgumentError('viewingKey.publicKey must be non-zero');
    }
    if (!viewingKey.privateKey || viewingKey.privateKey === 0n) {
      throw new InvalidArgumentError('viewingKey.privateKey must be non-zero');
    }

    try {
      const poolAddress = this.client.poolAddress;

      const provider = new IndexerDiscoveryProvider({
        url: this.indexerUrl,
        poolAddress,
        timeoutMs: 30_000,
      });

      const notes = await provider.discoverNotes(
        viewingKey.publicKey,
        viewingKey.privateKey,
        {
          tokens: options.tokens,
          blockIdentifier: options.blockIdentifier ?? 'pre_confirmed',
          includeSpent: options.includeSpent,
        }
      );

      return notes;
    } catch (error) {
      if (error instanceof DiscoveryError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new DiscoveryError('Note discovery failed: ' + (error as Error).message, error);
    }
  }

  async getPrivateBalance(
    userAddress: bigint | string,
    viewingKey: ViewingKeyData,
    token: string,
    options: DiscoverNotesOptions = {}
  ): Promise<PrivateBalance> {
    const notesMap = await this.discoverNotes(userAddress, viewingKey, {
      ...options,
      tokens: token ? [token] : options.tokens,
    });

    const notes = notesMap.get(token) ?? [];
    const unspentNotes = notes.filter(n => !n.spent);
    const totalAmount = unspentNotes.reduce((sum, note) => sum + note.amount, 0n);

    return {
      token,
      amount: totalAmount,
      noteCount: unspentNotes.length,
      notes: unspentNotes,
    };
  }

  async selectSpendableNotes(
    userAddress: bigint | string,
    viewingKey: ViewingKeyData,
    token: string,
    amount: bigint,
    options: DiscoverNotesOptions = {}
  ): Promise<ShieldedNote[]> {
    const notesMap = await this.discoverNotes(userAddress, viewingKey, {
      ...options,
      tokens: [token],
    });

    const notes = notesMap.get(token) ?? [];
    const unspent = notes.filter(n => !n.spent);

    unspent.sort((a, b) => Number(b.amount - a.amount));

    const selected: ShieldedNote[] = [];
    let total = 0n;

    for (const note of unspent) {
      selected.push(note);
      total += note.amount;
      if (total >= amount) break;
    }

    if (total < amount) {
      throw new DiscoveryError(
        'Insufficient private balance: have ' + total.toString() + ', need ' + amount.toString()
      );
    }

    return selected;
  }
}
