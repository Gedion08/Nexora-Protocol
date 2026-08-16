import { ec, hash, num } from 'starknet';
import { keccak256 } from 'js-sha3';

export interface SignatureComponents {
  r: bigint;
  s: bigint;
}

export function starknetKeccak(message: string): bigint {
  return hash.starknetKeccak(message);
}

export function computePoseidonHashOnElements(elements: bigint[]): bigint {
  const result = hash.computePoseidonHashOnElements(elements);
  return typeof result === 'bigint' ? result : num.toBigInt(result);
}

export const STARK_CURVE_ORDER: bigint = ec.starkCurve.CURVE.n;

export function reduceToField(value: bigint, modulus: bigint = STARK_CURVE_ORDER): bigint {
  if (modulus === 0n) {
    throw new RangeError('Modulus must not be zero');
  }
  return ((value % modulus) + modulus) % modulus;
}

export function hexToBigInt(value: string | number | bigint): bigint {
  return num.toBigInt(value);
}

export function bigIntToHex(value: bigint): string {
  return num.toHex(value);
}

export function feltToString(value: string | bigint): string {
  const hex = typeof value === 'bigint' ? num.toHex(value) : value;
  return hex;
}

export interface ViewingKeyComponents {
  publicKey: bigint;
  privateKey: bigint;
}

export function deriveViewingKey(
  r: bigint | string,
  s: bigint | string,
  _chainId: string,
  _poolAddress: string
): ViewingKeyComponents {
  const rBig = typeof r === 'bigint' ? r : num.toBigInt(r);
  const sBig = typeof s === 'bigint' ? s : num.toBigInt(s);

  const folded = computePoseidonHashOnElements([rBig, sBig]);
  const reduced = reduceToField(folded);

  return {
    publicKey: reduced,
    privateKey: reduced,
  };
}

export function deriveDeterministicAccountKey(
  r: bigint | string,
  s: bigint | string,
  _chainId: string,
  _poolAddress: string
): { privateKey: bigint; publicKey: bigint } {
  const { publicKey, privateKey } = deriveViewingKey(r, s, _chainId, _poolAddress);
  return { privateKey, publicKey };
}

export function deriveStarknetPrivateKeyFromSignature(
  r: bigint | string,
  s: bigint | string,
  chainId: string,
  poolAddress: string
): string {
  const rStr = typeof r === 'bigint' ? r.toString() : r;
  const sStr = typeof s === 'bigint' ? s.toString() : s;
  const seed = `${rStr}:${sStr}:${chainId}:${poolAddress}`;
  const hash = keccak256(seed);
  const privateKeyInt = BigInt('0x' + hash.slice(0, 64));
  const reduced = privateKeyInt % STARK_CURVE_ORDER;
  return num.toHex(reduced);
}

export function computeStarknetPublicKey(privateKeyHex: string): string {
  const publicKeyBytes = ec.starkCurve.getPublicKey(privateKeyHex);
  return '0x' + Buffer.from(publicKeyBytes).toString('hex');
}

export function computeStarknetAddress(privateKeyHex: string): string {
  const address = ec.starkCurve.getStarkKey(privateKeyHex);
  return typeof address === 'string' ? address : num.toHex(address);
}
