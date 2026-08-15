import { describe, it, expect } from 'vitest';
import {
  reduceToField,
  hexToBigInt,
  bigIntToHex,
  feltToString,
} from '../src/utils/poseidon';
import {
  NexoraError,
  ViewingKeyError,
  ShieldError,
  UnshieldError,
  DiscoveryError,
  ProverError,
  InvalidArgumentError,
  ErrorCode,
  isErrorCode,
} from '../src/utils/errors';

describe('feltToString', () => {
  it('should return hex string as-is for hex input', () => {
    const result = feltToString('0x123');
    expect(result).toBe('0x123');
  });

  it('should convert bigint to hex string', () => {
    const result = feltToString(291n);
    expect(result).toBe('0x123');
  });
});

describe('bigIntToHex', () => {
  it('should convert 0 to 0x0', () => {
    expect(bigIntToHex(0n)).toBe('0x0');
  });

  it('should convert large numbers', () => {
    const large = 12345678901234567890n;
    const result = bigIntToHex(large);
    expect(result).toBe('0x' + large.toString(16));
  });
});

describe('Error classes', () => {
  it('NexoraError should have code and message', () => {
    const err = new NexoraError('test message', ErrorCode.SHIELD_FAILED);
    expect(err.message).toBe('test message');
    expect(err.code).toBe(ErrorCode.SHIELD_FAILED);
    expect(err.name).toBe('NexoraError');
    expect(err instanceof Error).toBe(true);
  });

  it('NexoraError should store cause', () => {
    const cause = new Error('original');
    const err = new NexoraError('wrapper', ErrorCode.SHIELD_FAILED, cause);
    expect(err.cause).toBe(cause);
  });

  it('ViewingKeyError should set correct code', () => {
    const err = new ViewingKeyError('vk error');
    expect(err.code).toBe(ErrorCode.VIEWING_KEY_NOT_DERIVED);
    expect(err.name).toBe('ViewingKeyError');
  });

  it('ShieldError should set correct code', () => {
    const err = new ShieldError('shield error');
    expect(err.code).toBe(ErrorCode.SHIELD_FAILED);
    expect(err.name).toBe('ShieldError');
  });

  it('UnshieldError should set correct code', () => {
    const err = new UnshieldError('unshield error');
    expect(err.code).toBe(ErrorCode.UNSHIELD_FAILED);
    expect(err.name).toBe('UnshieldError');
  });

  it('DiscoveryError should set correct code', () => {
    const err = new DiscoveryError('discovery error');
    expect(err.code).toBe(ErrorCode.INDEXER_ERROR);
    expect(err.name).toBe('DiscoveryError');
  });

  it('ProverError should set correct code', () => {
    const err = new ProverError('prover error');
    expect(err.code).toBe(ErrorCode.PROVER_ERROR);
    expect(err.name).toBe('ProverError');
  });

  it('InvalidArgumentError should set correct code', () => {
    const err = new InvalidArgumentError('invalid arg');
    expect(err.code).toBe(ErrorCode.INVALID_ARGUMENT);
    expect(err.name).toBe('InvalidArgumentError');
  });

  it('subclass errors should be instances of NexoraError', () => {
    expect(new ViewingKeyError('x') instanceof NexoraError).toBe(true);
    expect(new ShieldError('x') instanceof NexoraError).toBe(true);
    expect(new UnshieldError('x') instanceof NexoraError).toBe(true);
    expect(new DiscoveryError('x') instanceof NexoraError).toBe(true);
    expect(new ProverError('x') instanceof NexoraError).toBe(true);
    expect(new InvalidArgumentError('x') instanceof NexoraError).toBe(true);
  });

  describe('isErrorCode', () => {
    it('should return true for matching error', () => {
      const err = new ShieldError('test');
      expect(isErrorCode(err, ErrorCode.SHIELD_FAILED)).toBe(true);
    });

    it('should return false for non-matching error', () => {
      const err = new ShieldError('test');
      expect(isErrorCode(err, ErrorCode.VIEWING_KEY_NOT_DERIVED)).toBe(false);
    });

    it('should return false for non-NexoraError', () => {
      const err = new Error('regular error');
      expect(isErrorCode(err, ErrorCode.SHIELD_FAILED)).toBe(false);
    });
  });
});

describe('reduceToField edge cases', () => {
  it('should handle negative values with negative modulus', () => {
    const result = reduceToField(-10n, -3n);
    expect(result).toBe(-1n);
  });

  it('should handle value already in range', () => {
    const result = reduceToField(5n, 7n);
    expect(result).toBe(5n);
  });
});
