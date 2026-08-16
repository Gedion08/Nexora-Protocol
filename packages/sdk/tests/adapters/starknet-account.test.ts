import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StarknetAccountGenerator } from '../../src/adapters/starknet-account';
import { ec, num } from 'starknet';

describe('StarknetAccountGenerator', () => {
  describe('generateRandom', () => {
    it('should generate a valid Starknet account', () => {
      const account = StarknetAccountGenerator.generateRandom();

      expect(account.privateKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
      expect(account.publicKey).toMatch(/^0x[0-9a-fA-F]{130}$/);
      expect(account.address).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
    });

    it('should generate different accounts on each call', () => {
      const account1 = StarknetAccountGenerator.generateRandom();
      const account2 = StarknetAccountGenerator.generateRandom();

      expect(account1.privateKey).not.toBe(account2.privateKey);
      expect(account1.address).not.toBe(account2.address);
    });

    it('should have valid private key within curve order', () => {
      const account = StarknetAccountGenerator.generateRandom();
      const sk = num.toBigInt(account.privateKey);
      expect(sk > 0n).toBe(true);
      expect(sk < ec.starkCurve.CURVE.n).toBe(true);
    });

    it('should compute matching public key from private key', () => {
      const account = StarknetAccountGenerator.generateRandom();
      const expectedPk = ec.starkCurve.getPublicKey(account.privateKey);
      const expectedPkHex = '0x' + Buffer.from(expectedPk).toString('hex');
      expect(account.publicKey).toBe(expectedPkHex);
    });

    it('should compute matching address from private key', () => {
      const account = StarknetAccountGenerator.generateRandom();
      const expectedAddr = ec.starkCurve.getStarkKey(account.privateKey);
      const expectedAddrHex = typeof expectedAddr === 'string' ? expectedAddr : num.toHex(expectedAddr);
      expect(account.address).toBe(expectedAddrHex);
    });
  });

  describe('fromSignature', () => {
    const chainId = '0x534e5f4d41494e';
    const poolAddress = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';

    it('should generate deterministic account from signature components', () => {
      const r = 123456789012345678901234567890123456789012345678901234567890n;
      const s = 987654321098765432109876543210987654321098765432109876543210n;

      const account = StarknetAccountGenerator.fromSignature({ r, s, chainId, poolAddress });

      expect(account.privateKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
      expect(account.publicKey).toMatch(/^0x[0-9a-fA-F]{130}$/);
      expect(account.address).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
    });

    it('should be deterministic for same inputs', () => {
      const r = 123456789012345678901234567890123456789012345678901234567890n;
      const s = 987654321098765432109876543210987654321098765432109876543210n;

      const account1 = StarknetAccountGenerator.fromSignature({ r, s, chainId, poolAddress });
      const account2 = StarknetAccountGenerator.fromSignature({ r, s, chainId, poolAddress });

      expect(account1.privateKey).toBe(account2.privateKey);
      expect(account1.address).toBe(account2.address);
      expect(account1.publicKey).toBe(account2.publicKey);
    });

    it('should differ for different inputs', () => {
      const r1 = 123456789012345678901234567890123456789012345678901234567890n;
      const s1 = 987654321098765432109876543210987654321098765432109876543210n;
      const r2 = 111111111111111111111111111111111111111111111111111111111111n;
      const s2 = 222222222222222222222222222222222222222222222222222222222222n;

      const account1 = StarknetAccountGenerator.fromSignature({ r: r1, s: s1, chainId, poolAddress });
      const account2 = StarknetAccountGenerator.fromSignature({ r: r2, s: s2, chainId, poolAddress });

      expect(account1.privateKey).not.toBe(account2.privateKey);
      expect(account1.address).not.toBe(account2.address);
    });

    it('should accept string inputs', () => {
      const account1 = StarknetAccountGenerator.fromSignature({ r: '123', s: '456', chainId, poolAddress });
      const account2 = StarknetAccountGenerator.fromSignature({ r: 123n, s: 456n, chainId, poolAddress });

      expect(account1.privateKey).toBe(account2.privateKey);
      expect(account1.address).toBe(account2.address);
    });

    it('should throw for missing chainId', () => {
      expect(() => StarknetAccountGenerator.fromSignature({ r: 1n, s: 2n, chainId: '', poolAddress })).toThrow();
    });

    it('should throw for missing poolAddress', () => {
      expect(() => StarknetAccountGenerator.fromSignature({ r: 1n, s: 2n, chainId, poolAddress: '' })).toThrow();
    });
  });

  describe('fromSeed', () => {
    it('should generate deterministic account from seed', () => {
      const account1 = StarknetAccountGenerator.fromSeed('test-seed-123');
      const account2 = StarknetAccountGenerator.fromSeed('test-seed-123');

      expect(account1.privateKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
      expect(account2.privateKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/);
      expect(account1.privateKey).toBe(account2.privateKey);
      expect(account1.address).toBe(account2.address);
    });

    it('should differ for different seeds', () => {
      const account1 = StarknetAccountGenerator.fromSeed('seed-a');
      const account2 = StarknetAccountGenerator.fromSeed('seed-b');

      expect(account1.privateKey).not.toBe(account2.privateKey);
      expect(account1.address).not.toBe(account2.address);
    });

    it('should throw for empty seed', () => {
      expect(() => StarknetAccountGenerator.fromSeed('')).toThrow();
    });
  });

  describe('isValidPrivateKey', () => {
    it('should return true for valid private key', () => {
      const account = StarknetAccountGenerator.generateRandom();
      expect(StarknetAccountGenerator.isValidPrivateKey(account.privateKey)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(StarknetAccountGenerator.isValidPrivateKey('0x0')).toBe(false);
    });

    it('should return false for negative', () => {
      expect(StarknetAccountGenerator.isValidPrivateKey('-0x1')).toBe(false);
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid address', () => {
      const account = StarknetAccountGenerator.generateRandom();
      expect(StarknetAccountGenerator.isValidAddress(account.address)).toBe(true);
      expect(StarknetAccountGenerator.isValidAddress('0x' + 'a'.repeat(63))).toBe(true);
    });

    it('should return false for short address', () => {
      expect(StarknetAccountGenerator.isValidAddress('0x1234')).toBe(false);
      expect(StarknetAccountGenerator.isValidAddress('0x' + 'a'.repeat(60))).toBe(false);
    });
  });
});
