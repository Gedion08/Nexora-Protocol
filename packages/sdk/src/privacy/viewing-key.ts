import { Account, TypedData } from 'starknet';
import { num } from 'starknet';
import {
  ViewingKeyData,
  TransactionResult,
  ViewingKeyRegisteredEvent,
} from '../types';
import { PoolClient, PrivacyHubClient } from '../core/client';
import { deriveViewingKey } from '../utils/poseidon';
import { DEFAULT_BLOCK_IDENTIFIER, DOMAIN_NAME } from '../constants';
import {
  ViewingKeyError,
  InvalidArgumentError,
  isErrorCode,
  ErrorCode,
} from '../utils/errors';

export interface StarknetWalletLike {
  account?: Account;
}

export class ViewingKey {
  readonly publicKey: bigint;
  readonly privateKey: bigint;
  readonly chainId: string;
  readonly poolAddress: string;

  private constructor(
    publicKey: bigint,
    privateKey: bigint,
    chainId: string,
    poolAddress: string
  ) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.chainId = chainId;
    this.poolAddress = poolAddress;
  }

  static deriveFromSignature(
    r: bigint | string,
    s: bigint | string,
    chainId: string,
    poolAddress: string
  ): ViewingKey {
    if (!chainId) {
      throw new InvalidArgumentError('chainId is required for viewing key derivation');
    }
    if (!poolAddress) {
      throw new InvalidArgumentError('poolAddress is required for viewing key derivation');
    }

    try {
      const { publicKey, privateKey } = deriveViewingKey(r, s, chainId, poolAddress);

      if (publicKey === 0n) {
        throw new ViewingKeyError('Derived viewing key public key is zero');
      }

      return new ViewingKey(publicKey, privateKey, chainId, poolAddress);
    } catch (error) {
      if (error instanceof ViewingKeyError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new ViewingKeyError('Failed to derive viewing key from signature', error);
    }
  }

  static fromPublicKey(
    publicKey: bigint | string,
    chainId: string,
    poolAddress: string
  ): ViewingKey {
    if (!chainId) {
      throw new InvalidArgumentError('chainId is required');
    }
    if (!poolAddress) {
      throw new InvalidArgumentError('poolAddress is required');
    }
    const pk = typeof publicKey === 'bigint' ? publicKey : num.toBigInt(publicKey);
    if (pk === 0n) {
      throw new InvalidArgumentError('publicKey must be non-zero');
    }
    return new ViewingKey(pk, pk, chainId, poolAddress);
  }

  static async deriveFromWallet(
    account: Account,
    chainId?: string,
    poolAddress?: string
  ): Promise<ViewingKey> {
    const resolvedChainId = chainId ?? (await ViewingKey.resolveAccountChainId(account));
    if (!resolvedChainId) {
      throw new ViewingKeyError('Could not resolve chain ID from wallet or parameter');
    }

    if (!poolAddress) {
      throw new ViewingKeyError('poolAddress is required to derive viewing key from wallet');
    }

    try {
      const message = resolvedChainId + ':' + poolAddress;
      const typedData: TypedData = {
        domain: { chainId: resolvedChainId, name: DOMAIN_NAME },
        types: {
          Starknet: [{ name: 'message', type: 'short_string' }],
        },
        primaryType: 'Starknet',
        message: { message },
      };

      const sig = await account.signMessage(typedData);
      const { r, s } = parseSignature(sig);

      return ViewingKey.deriveFromSignature(r, s, resolvedChainId, poolAddress);
    } catch (error) {
      if (error instanceof ViewingKeyError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new ViewingKeyError('Failed to derive viewing key from wallet', error);
    }
  }

  static async deriveFromStarknetWindow(
    wallet: StarknetWalletLike,
    chainId: string,
    poolAddress: string
  ): Promise<ViewingKey> {
    if (!wallet.account) {
      throw new ViewingKeyError('No Starknet wallet account available');
    }

    return ViewingKey.deriveFromWallet(wallet.account, chainId, poolAddress);
  }

  private static async resolveAccountChainId(account: Account): Promise<string | undefined> {
    const anyAccount = account as any;

    try {
      if (anyAccount.provider && typeof anyAccount.provider.getChainId === 'function') {
        return await anyAccount.provider.getChainId();
      }
    } catch {
      // Fall through to chainId property
    }

    try {
      return anyAccount.chainId as string | undefined;
    } catch {
      return undefined;
    }
  }

  toJSON(): Record<string, string> {
    return {
      publicKey: this.publicKey.toString(),
      privateKey: this.privateKey.toString(),
      chainId: this.chainId,
      poolAddress: this.poolAddress,
    };
  }

  static fromJSON(json: Record<string, string>): ViewingKey {
    return new ViewingKey(
      BigInt(json.publicKey),
      BigInt(json.privateKey),
      json.chainId,
      json.poolAddress
    );
  }

  serialize(): string {
    return JSON.stringify(this.toJSON());
  }

  static deserialize(data: string): ViewingKey {
    return ViewingKey.fromJSON(JSON.parse(data));
  }

  getPublic(): bigint {
    return this.publicKey;
  }

  getPrivate(): bigint {
    return this.privateKey;
  }
}

function parseSignature(
  sig: { r?: string | bigint; s?: string | bigint; recovery?: number } | (string | bigint)[]
): { r: bigint; s: bigint } {
  if (Array.isArray(sig)) {
    const r = sig[0];
    const s = sig[1];
    if (r === undefined || s === undefined) {
      throw new ViewingKeyError('Signature array does not contain r and s components');
    }
    return {
      r: typeof r === 'bigint' ? r : num.toBigInt(r),
      s: typeof s === 'bigint' ? s : num.toBigInt(s),
    };
  }
  if (sig && typeof sig === 'object') {
    if (sig.r !== undefined && sig.s !== undefined) {
      return {
        r: typeof sig.r === 'bigint' ? sig.r : num.toBigInt(sig.r),
        s: typeof sig.s === 'bigint' ? sig.s : num.toBigInt(sig.s),
      };
    }
  }
  throw new ViewingKeyError('Could not parse signature components from wallet response');
}

export class ViewingKeyManager {
  constructor(
    private client: PoolClient | PrivacyHubClient
  ) {}

  async deriveFromWallet(
    account: Account,
    chainId?: string,
    poolAddress?: string
  ): Promise<ViewingKey> {
    return ViewingKey.deriveFromWallet(account, chainId, poolAddress);
  }

  async register(
    account: Account,
    viewingKey: ViewingKey
  ): Promise<TransactionResult & { event?: ViewingKeyRegisteredEvent }> {
    if (!viewingKey) {
      throw new ViewingKeyError('Viewing key is required for registration');
    }

    try {
      const result = await this.client.registerViewingKey(account, viewingKey.publicKey);
      const receipt = await result.wait();
      const event: ViewingKeyRegisteredEvent = {
        user: account.address,
        publicKey: viewingKey.publicKey,
        timestamp: receipt.timestamp ?? Date.now(),
      };
      return { ...result, event };
    } catch (error) {
      if (isErrorCode(error, ErrorCode.VIEWING_KEY_NOT_REGISTERED)) {
        throw error;
      }
      throw new ViewingKeyError('Failed to register viewing key', error);
    }
  }

  async isRegistered(
    account: Account,
    _viewingKey: ViewingKey,
    blockIdentifier: string = DEFAULT_BLOCK_IDENTIFIER
  ): Promise<boolean> {
    try {
      void blockIdentifier;
      const contract = await this.client.getContract();
      const hasKey = await contract.has_viewing_key(account.address, { blockIdentifier });
      return Boolean(hasKey);
    } catch {
      return false;
    }
  }
}

export type { ViewingKeyData as ViewingKeyComponents };
