import { describe, it, expect } from 'vitest';
import {
  deriveViewingKey,
  deriveDeterministicAccountKey,
  computePoseidonHashOnElements,
  starknetKeccak,
  reduceToField,
  hexToBigInt,
  bigIntToHex,
  STARK_CURVE_ORDER,
} from '../src/utils/poseidon';
import { ec, hash } from 'starknet';

describe('starknetKeccak', () => {
  it('should hash a string message to a bigint', () => {
    const result = starknetKeccak('test message');
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  it('should produce deterministic results', () => {
    const a = starknetKeccak('hello');
    const b = starknetKeccak('hello');
    expect(a).toBe(b);
  });

  it('should differ for different inputs', () => {
    const a = starknetKeccak('hello');
    const b = starknetKeccak('world');
    expect(a).not.toBe(b);
  });

  it('should match hash.starknetKeccak from starknet.js', () => {
    const message = 'SN_MAIN:0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
    const expected = BigInt(hash.starknetKeccak(message));
    const result = starknetKeccak(message);
    expect(result).toBe(expected);
  });
});

describe('computePoseidonHashOnElements', () => {
  it('should compute a Poseidon hash and return a bigint', () => {
    const result = computePoseidonHashOnElements([123n, 456n]);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  it('should produce deterministic results', () => {
    const a = computePoseidonHashOnElements([123n, 456n]);
    const b = computePoseidonHashOnElements([123n, 456n]);
    expect(a).toBe(b);
  });

  it('should differ for different inputs', () => {
    const a = computePoseidonHashOnElements([123n, 456n]);
    const b = computePoseidonHashOnElements([456n, 123n]);
    expect(a).not.toBe(b);
  });

  it('should handle a single element', () => {
    const result = computePoseidonHashOnElements([1n]);
    expect(typeof result).toBe('bigint');
    expect(result).toBeGreaterThan(0n);
  });

  it('should handle empty array', () => {
    const result = computePoseidonHashOnElements([]);
    expect(typeof result).toBe('bigint');
  });
});

describe('reduceToField', () => {
  it('should reduce a value modulo the given modulus', () => {
    const result = reduceToField(100n, 7n);
    expect(result).toBe(2n);
  });

  it('should handle negative values correctly', () => {
    const result = reduceToField(-1n, 7n);
    expect(result).toBe(6n);
  });

  it('should use STARK_CURVE_ORDER by default', () => {
    const largeValue = STARK_CURVE_ORDER * 2n + 42n;
    const result = reduceToField(largeValue);
    expect(result).toBe(42n);
  });

  it('should throw on zero modulus', () => {
    expect(() => reduceToField(100n, 0n)).toThrow(RangeError);
  });
});

describe('deriveViewingKey', () => {
  const r = 123456789012345678901234567890123456789012345678901234567890n;
  const s = 987654321098765432109876543210987654321098765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should derive a viewing key with matching public and private keys', () => {
    const { publicKey, privateKey } = deriveViewingKey(r, s, chainId, poolAddress);
    expect(publicKey).toBe(privateKey);
    expect(publicKey).toBeGreaterThan(0n);
  });

  it('should be deterministic for the same inputs', () => {
    const a = deriveViewingKey(r, s, chainId, poolAddress);
    const b = deriveViewingKey(r, s, chainId, poolAddress);
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.privateKey).toBe(b.privateKey);
  });

  it('should differ for different inputs', () => {
    const a = deriveViewingKey(r, s, chainId, poolAddress);
    const b = deriveViewingKey(s, r, chainId, poolAddress);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it('should accept string inputs', () => {
    const a = deriveViewingKey(r, s, chainId, poolAddress);
    const b = deriveViewingKey(r.toString(), s.toString(), chainId, poolAddress);
    expect(a.publicKey).toBe(b.publicKey);
  });

  it('should produce values within the curve order', () => {
    const { publicKey } = deriveViewingKey(r, s, chainId, poolAddress);
    expect(publicKey).toBeGreaterThan(0n);
    expect(publicKey).toBeLessThan(STARK_CURVE_ORDER);
  });
});

describe('deriveDeterministicAccountKey', () => {
  const r = 123456789012345678901234567890123456789012345678901234567890n;
  const s = 987654321098765432109876543210987654321098765432109876543210n;
  const chainId = '0x534e5f4d41494e';
  const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

  it('should derive account key pair', () => {
    const result = deriveDeterministicAccountKey(r, s, chainId, poolAddress);
    expect(result.publicKey).toBeGreaterThan(0n);
    expect(result.privateKey).toBeGreaterThan(0n);
  });

  it('should be deterministic', () => {
    const a = deriveDeterministicAccountKey(r, s, chainId, poolAddress);
    const b = deriveDeterministicAccountKey(r, s, chainId, poolAddress);
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.privateKey).toBe(b.privateKey);
  });
});

describe('hexToBigInt', () => {
  it('should convert hex string to bigint', () => {
    expect(hexToBigInt('0x123')).toBe(291n);
  });

  it('should convert decimal string to bigint', () => {
    expect(hexToBigInt('291')).toBe(291n);
  });

  it('should convert bigint to bigint (identity)', () => {
    expect(hexToBigInt(291n)).toBe(291n);
  });
});

describe('bigIntToHex', () => {
  it('should convert bigint to hex string', () => {
    expect(bigIntToHex(291n)).toBe('0x123');
  });
});

describe('STARK_CURVE_ORDER', () => {
  it('should match the curve order from ec.starkCurve', () => {
    expect(STARK_CURVE_ORDER).toBe(ec.starkCurve.CURVE.n);
  });

  it('should be a large prime', () => {
    expect(STARK_CURVE_ORDER).toBeGreaterThan(2n ** 250n);
  });
});
