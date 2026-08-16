import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvingService } from '../src/privacy/prover';
import { ViewingKey } from '../src/privacy/viewing-key';
import { ProverError, InvalidArgumentError } from '../src/utils/errors';
import { UnshieldProof, UnshieldProofParams, DisclosureProofParams } from '../src/types';
import { ShieldedNote } from '../src/types';

describe('ProvingService', () => {
  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  const testNote: ShieldedNote = {
    noteHash: '0xnotehash123',
    token: '0xtoken1',
    amount: 5_000_000n,
    nullifier: '0xnullifier123',
    spent: false,
    createdAt: 1234567890,
  };

  const validProof = {
    nullifier: '0xnullifier123',
    proof: '0xproofdata',
    public_inputs: ['0xinput1', '0xinput2'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct with valid config', () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    expect(prover.url).toBe('http://localhost:8080');
    expect(prover.timeoutMs).toBe(120000);
  });

  it('should strip trailing slash from url', () => {
    const prover = new ProvingService({ url: 'http://localhost:8080/' });
    expect(prover.url).toBe('http://localhost:8080');
  });

  it('should throw if url is empty', () => {
    expect(() => new ProvingService({ url: '' })).toThrow(InvalidArgumentError);
  });

  it('should accept custom timeout', () => {
    const prover = new ProvingService({ url: 'http://localhost:8080', timeoutMs: 30000 });
    expect(prover.timeoutMs).toBe(30000);
  });

  it('should accept API key', () => {
    const prover = new ProvingService({ url: 'http://localhost:8080', apiKey: 'my-key' });
    expect(prover.apiKey).toBe('my-key');
  });

  describe('generateUnshieldProof', () => {
    it('should send POST request with correct body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validProof),
      });
      vi.stubGlobal('fetch', mockFetch);

      const params: UnshieldProofParams = {
        note: testNote,
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      };

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const result = await prover.generateUnshieldProof(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/prove/unshield',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.note.note_hash).toBe('0xnotehash123');
      expect(body.note.amount).toBe('5000000');
      expect(body.note.nullifier).toBe('0xnullifier123');
      expect(body.viewing_key.public_key).toBe(viewingKey.publicKey.toString());
      expect(body.pool_address).toBe(poolAddress);
      expect(body.chain_id).toBe(chainId);
    });

    it('should return parsed proof', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validProof),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const result = await prover.generateUnshieldProof({
        note: testNote,
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      });

      expect(result.nullifier).toBe('0xnullifier123');
      expect(result.proof).toBe('0xproofdata');
      expect(result.publicInputs).toEqual(['0xinput1', '0xinput2']);
    });

    it('should use note nullifier as fallback when response nullifier is missing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ proof: '0xproof', public_inputs: [] }),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const result = await prover.generateUnshieldProof({
        note: testNote,
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      });

      expect(result.nullifier).toBe('0xnullifier123');
    });

    it('should include API key header when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validProof),
      });
      vi.stubGlobal('fetch', mockFetch);

      const prover = new ProvingService({ url: 'http://localhost:8080', apiKey: 'secret-key' });
      await prover.generateUnshieldProof({
        note: testNote,
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      });

      expect(mockFetch.mock.calls[0][1].headers['X-API-Key']).toBe('secret-key');
    });

    it('should throw ProverError if response missing proof', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ nullifier: '0xnull' }),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      await expect(
        prover.generateUnshieldProof({
          note: testNote,
          viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
          poolAddress,
          chainId,
        })
      ).rejects.toThrow(ProverError);
    });

    it('should throw ProverError on non-OK response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      await expect(
        prover.generateUnshieldProof({
          note: testNote,
          viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
          poolAddress,
          chainId,
        })
      ).rejects.toThrow(ProverError);
    });

    it('should throw on missing note', async () => {
      const prover = new ProvingService({ url: 'http://localhost:8080' });
      await expect(
        prover.generateUnshieldProof({
          note: null as any,
          viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
          poolAddress,
          chainId,
        })
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing viewingKey', async () => {
      const prover = new ProvingService({ url: 'http://localhost:8080' });
      await expect(
        prover.generateUnshieldProof({
          note: testNote,
          viewingKey: null as any,
          poolAddress,
          chainId,
        })
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw on missing poolAddress', async () => {
      const prover = new ProvingService({ url: 'http://localhost:8080' });
      await expect(
        prover.generateUnshieldProof({
          note: testNote,
          viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
          poolAddress: '',
          chainId,
        })
      ).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('healthCheck', () => {
    it('should return true when prover is healthy', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const healthy = await prover.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when prover is unhealthy', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'error' }),
      }));

      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const healthy = await prover.healthCheck();
      expect(healthy).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const prover = new ProvingService({ url: 'http://localhost:8080' });
      const healthy = await prover.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});

describe('ProvingService generateTransferProof', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate a transfer proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        nullifier: '0xtransfernullifier',
        proof: '0xtransferproof',
        public_inputs: ['0xinput1'],
      }),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.generateTransferProof({
      to: '0xrecipient',
      token: '0xtoken',
      amount: '5000000',
    });

    expect(result.nullifier).toBe('0xtransfernullifier');
    expect(result.proof).toBe('0xtransferproof');
    expect(result.publicInputs).toEqual(['0xinput1']);
  });

  it('should wrap transfer proof errors in ProverError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve('Bad request'),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateTransferProof({ to: '0xrecipient' })
    ).rejects.toThrow(ProverError);
  });
});

describe('ProvingService request errors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle network errors in generateUnshieldProof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateUnshieldProof({
        note: { noteHash: '0xnote', token: '0xtoken', amount: 1000n, nullifier: '0xnull', spent: false, createdAt: 0 },
        viewingKey: { publicKey: 123n, privateKey: 456n },
        poolAddress: '0xpoll',
        chainId: 'SN_MAIN',
      })
    ).rejects.toThrow('Proof generation failed');
  });

  it('should handle timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        } else {
          signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    }));
    const prover = new ProvingService({ url: 'http://localhost:8080', timeoutMs: 100 });
    await expect(
      prover.generateUnshieldProof({
        note: { noteHash: '0xnote', token: '0xtoken', amount: 1000n, nullifier: '0xnull', spent: false, createdAt: 0 },
        viewingKey: { publicKey: 123n, privateKey: 456n },
        poolAddress: '0xpoll',
        chainId: 'SN_MAIN',
      })
    ).rejects.toThrow('timed out');
  });
});

describe('ProvingService validation', () => {
  it('should throw InvalidArgumentError if note is missing noteHash and nullifier', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateUnshieldProof({
        note: { noteHash: '', token: '0xtoken', amount: 1000n, nullifier: '', spent: false, createdAt: 0 },
        viewingKey: { publicKey: 123n, privateKey: 456n },
        poolAddress: '0xpoll',
        chainId: 'SN_MAIN',
      })
    ).rejects.toThrow(InvalidArgumentError);
  });
});

describe('ProvingService generateDisclosureProof', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  const validDisclosureResponse = {
    proof: '0xdisclosureproof',
    public_inputs: ['0xinput1'],
    statement: 'Prover owns a shielded note in the specified pool',
  };

  it('should generate a full disclosure proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validDisclosureResponse),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.generateDisclosureProof({
      type: 'full',
      viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
      poolAddress,
      chainId,
    });

    expect(result.type).toBe('full');
    expect(result.proof).toBe('0xdisclosureproof');
    expect(result.publicInputs).toEqual(['0xinput1']);
    expect(result.statement).toBe('Prover owns a shielded note in the specified pool');
    expect(result.verifiedAt).toBeGreaterThan(0);
  });

  it('should generate an amount disclosure proof with threshold', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        proof: '0xamountproof',
        public_inputs: ['0xamtinput'],
        statement: 'Prover proves amount >= 1000000000000000000',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.generateDisclosureProof({
      type: 'amount',
      viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
      poolAddress,
      chainId,
      threshold: 1000000000000000000n,
      operator: '>=',
    });

    expect(result.type).toBe('amount');
    expect(result.proof).toBe('0xamountproof');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.threshold).toBe('1000000000000000000');
    expect(body.operator).toBe('>=');
  });

  it('should generate an auditor disclosure proof with expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        proof: '0xauditorproof',
        public_inputs: [],
        statement: 'Prover grants auditor access until 2027-08-16T00:00:00.000Z',
      }),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const result = await prover.generateDisclosureProof({
      type: 'auditor',
      viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
      poolAddress,
      chainId,
      auditorPublicKey: '0xauditor',
      expiresAt,
    });

    expect(result.type).toBe('auditor');
    expect(result.expiresAt).toBe(expiresAt);
  });

  it('should throw InvalidArgumentError for amount disclosure without threshold', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateDisclosureProof({
        type: 'amount',
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      })
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw InvalidArgumentError for source disclosure without sourceAddress', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateDisclosureProof({
        type: 'source',
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      })
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw InvalidArgumentError for auditor disclosure without auditorPublicKey', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateDisclosureProof({
        type: 'auditor',
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      })
    ).rejects.toThrow(InvalidArgumentError);
  });

  it('should throw ProverError when prover response is missing proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ statement: 'test' }),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    await expect(
      prover.generateDisclosureProof({
        type: 'none',
        viewingKey: { publicKey: viewingKey.publicKey, privateKey: viewingKey.privateKey },
        poolAddress,
        chainId,
      })
    ).rejects.toThrow(ProverError);
  });
});

describe('ProvingService verifyDisclosureProof', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const r = 12345678901234567890n;
  const s = 98765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
  const viewingKey = ViewingKey.deriveFromSignature(r, s, chainId, poolAddress);

  it('should return true for valid proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: true }),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.verifyDisclosureProof({
      type: 'full',
      statement: 'test',
      proof: '0xvalidproof',
      publicInputs: ['0xinput'],
      verifiedAt: Date.now(),
    });

    expect(result).toBe(true);
  });

  it('should return false for expired proof', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.verifyDisclosureProof({
      type: 'auditor',
      statement: 'test',
      proof: '0xproof',
      publicInputs: [],
      verifiedAt: Date.now(),
      expiresAt: Date.now() - 1000,
    });

    expect(result).toBe(false);
  });

  it('should return false for missing proof', async () => {
    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.verifyDisclosureProof({
      type: 'none',
      statement: 'test',
      proof: '',
      publicInputs: [],
      verifiedAt: Date.now(),
    });

    expect(result).toBe(false);
  });

  it('should return false when prover returns invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: false }),
    }));

    const prover = new ProvingService({ url: 'http://localhost:8080' });
    const result = await prover.verifyDisclosureProof({
      type: 'full',
      statement: 'test',
      proof: '0xproof',
      publicInputs: [],
      verifiedAt: Date.now(),
    });

    expect(result).toBe(false);
  });
});
