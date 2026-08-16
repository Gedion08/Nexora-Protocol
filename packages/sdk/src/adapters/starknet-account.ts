import { ec, num } from 'starknet';
import {
  computeStarknetAddress,
  computeStarknetPublicKey,
  deriveStarknetPrivateKeyFromSignature,
  STARK_CURVE_ORDER,
} from '../utils/poseidon';
import { keccak256 } from 'js-sha3';
import { InvalidArgumentError } from '../utils/errors';

export interface StarknetAccount {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface StarknetAccountConfig {
  chainId?: string;
  poolAddress?: string;
}

export interface DeterministicAccountParams {
  r: bigint | string;
  s: bigint | string;
  chainId: string;
  poolAddress: string;
}

export class StarknetAccountGenerator {
  static generateRandom(): StarknetAccount {
    const privateKeyBytes = ec.starkCurve.utils.randomPrivateKey();
    const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
    const publicKey = computeStarknetPublicKey(privateKeyHex);
    const address = computeStarknetAddress(privateKeyHex);

    return {
      privateKey: privateKeyHex,
      publicKey,
      address,
    };
  }

  static fromSignature(params: DeterministicAccountParams): StarknetAccount {
    if (!params.chainId) {
      throw new InvalidArgumentError('chainId is required for deterministic account generation');
    }
    if (!params.poolAddress) {
      throw new InvalidArgumentError('poolAddress is required for deterministic account generation');
    }

    const privateKeyHex = deriveStarknetPrivateKeyFromSignature(
      params.r,
      params.s,
      params.chainId,
      params.poolAddress
    );

    const publicKey = computeStarknetPublicKey(privateKeyHex);
    const address = computeStarknetAddress(privateKeyHex);

    return {
      privateKey: privateKeyHex,
      publicKey,
      address,
    };
  }

  static fromSeed(seed: string): StarknetAccount {
    if (!seed) {
      throw new InvalidArgumentError('Seed is required for deterministic account generation');
    }

    const hash = keccak256(seed);
    const privateKeyInt = BigInt('0x' + hash.slice(0, 64));
    const reduced = privateKeyInt % STARK_CURVE_ORDER;
    const privateKeyHex = num.toHex(reduced);

    const publicKey = computeStarknetPublicKey(privateKeyHex);
    const address = computeStarknetAddress(privateKeyHex);

    return {
      privateKey: privateKeyHex,
      publicKey,
      address,
    };
  }

  static isValidPrivateKey(privateKey: string): boolean {
    try {
      const pk = num.toBigInt(privateKey);
      return pk > 0n && pk < ec.starkCurve.CURVE.n;
    } catch {
      return false;
    }
  }

  static isValidAddress(address: string): boolean {
    try {
      const padded = num.toHex(address);
      return /^0x[0-9a-fA-F]{62,63}$/.test(padded);
    } catch {
      return false;
    }
  }
}
