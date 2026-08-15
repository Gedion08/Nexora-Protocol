import {
  Account,
  Contract,
  RpcProvider,
  num,
} from 'starknet';
import {
  PoolClientConfig,
  PrivacyHubClientConfig,
  TransactionResult,
  TransactionReceipt,
} from '../types';
import { DEFAULT_TX_WAIT_TIMEOUT_MS, DEFAULT_BLOCK_IDENTIFIER } from '../constants';
import { PRIVACY_HUB_ABI, STRK20_POOL_ABI } from './abis';
import {
  ShieldError,
  UnshieldError,
  InvalidArgumentError,
  NexoraError,
  ErrorCode,
  ViewingKeyError,
} from '../utils/errors';
import { ErrorCodeValue } from '../utils/errors';

type ContractResponse = { transaction_hash?: string } | string;

function extractTxHash(response: ContractResponse): string {
  if (typeof response === 'string') return response;
  const hash = response.transaction_hash;
  if (!hash) {
    throw new ShieldError('Transaction response did not contain a transaction hash');
  }
  return hash;
}

function createTxResult(
  txHash: string,
  provider: RpcProvider,
  timeoutMs: number
): TransactionResult {
  return {
    transactionHash: txHash,
    wait: async (waitTimeoutMs?: number): Promise<TransactionReceipt> => {
      const timeout = waitTimeoutMs ?? timeoutMs;
      const raceResult = await Promise.race([
        provider.waitForTransaction(txHash, { retryInterval: 2000 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new ShieldError('Transaction ' + txHash + ' timed out after ' + timeout + 'ms')), timeout)
        ),
      ]);
      return normalizeReceipt(txHash, raceResult);
    },
  };
}

function normalizeReceipt(txHash: string, receipt: any): TransactionReceipt {
  const status = (receipt.finality_status ?? receipt.finalityStatus ?? 'PENDING') as TransactionReceipt['status'];
  return {
    transactionHash: txHash,
    status,
    blockHash: receipt.block_hash ?? receipt.blockHash,
    blockNumber: receipt.block_number ?? receipt.blockNumber,
    gasUsed: receipt.actual_fee?.amount?.toString() ?? receipt.gasUsed?.toString(),
    timestamp: receipt.timestamp,
  };
}

export class PoolClient {
  readonly provider: RpcProvider;
  readonly poolAddress: string;
  readonly chainId: string;
  readonly timeoutMs: number;

  private poolContract: Contract | null = null;
  private providerChainId: string | null = null;

  constructor(config: PoolClientConfig) {
    if (!config.rpcUrl) {
      throw new InvalidArgumentError('rpcUrl is required');
    }
    if (!config.poolAddress) {
      throw new InvalidArgumentError('poolAddress is required');
    }
    this.poolAddress = config.poolAddress;
    this.chainId = config.chainId ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TX_WAIT_TIMEOUT_MS;
    this.provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  }

  async getContract(): Promise<Contract> {
    if (!this.poolContract) {
      const parsedAbi = STRK20_POOL_ABI as any;
      await this.resolveChainId();
      this.poolContract = new Contract(parsedAbi, this.poolAddress, this.provider);
    }
    return this.poolContract;
  }

  private async resolveChainId(): Promise<string> {
    if (this.chainId) return this.chainId;
    if (this.providerChainId) return this.providerChainId;
    const chainId = await this.provider.getChainId();
    this.providerChainId = chainId;
    return chainId;
  }

  async getChainId(): Promise<string> {
    return this.resolveChainId();
  }

  supportsToken(token: string, blockIdentifier: string = DEFAULT_BLOCK_IDENTIFIER): Promise<boolean> {
    return this.withError(async () => {
      const contract = await this.getContract();
      const supported = await contract.supports_token(token, { blockIdentifier });
      return Boolean(supported);
    }, ErrorCode.UNSUPPORTED_TOKEN);
  }

  isNullifierSpent(nullifier: string, blockIdentifier: string = DEFAULT_BLOCK_IDENTIFIER): Promise<boolean> {
    return this.withError(async () => {
      const contract = await this.getContract();
      const spent = await contract.get_nullifier_spent(nullifier, { blockIdentifier });
      return Boolean(spent);
    }, ErrorCode.INVALID_ARGUMENT);
  }

  registerViewingKey(account: Account, publicKey: bigint | string): Promise<TransactionResult> {
    return this.withError(async () => {
      const pk = num.toHex(typeof publicKey === 'bigint' ? publicKey : num.toBigInt(publicKey));
      const contract = await this.getContract();
      const response: ContractResponse = await contract.register_viewing_key(pk, {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.VIEWING_KEY_NOT_REGISTERED);
  }

  shield(
    account: Account,
    token: string,
    amount: bigint | string,
    viewingKey: bigint | string,
    proof?: unknown[]
  ): Promise<TransactionResult> {
    return this.withError(async () => {
      const amountHex = typeof amount === 'bigint' ? num.toHex(amount) : amount;
      const vk = typeof viewingKey === 'bigint' ? num.toHex(viewingKey) : viewingKey;
      const contract = await this.getContract();
      const response: ContractResponse = await contract.shield(
        token, amountHex, account.address, vk, proof ?? [],
        { from: account.address }
      );
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.SHIELD_FAILED);
  }

  unshield(
    account: Account,
    token: string,
    amount: bigint | string,
    recipient: string,
    proof: unknown[]
  ): Promise<TransactionResult> {
    return this.withError(async () => {
      const amountHex = typeof amount === 'bigint' ? num.toHex(amount) : amount;
      const contract = await this.getContract();
      const response: ContractResponse = await contract.unshield(
        token, amountHex, recipient, proof,
        { from: account.address }
      );
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.UNSHIELD_FAILED);
  }

  transfer(
    account: Account,
    to: string,
    token: string,
    amount: bigint | string,
    proof: unknown[]
  ): Promise<TransactionResult> {
    return this.withError(async () => {
      const amountHex = typeof amount === 'bigint' ? num.toHex(amount) : amount;
      const contract = await this.getContract();
      const response: ContractResponse = await contract.transfer(
        to, token, amountHex, proof,
        { from: account.address }
      );
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.TRANSFER_FAILED);
  }

  private async withError<T>(fn: () => Promise<T>, code: ErrorCodeValue): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof NexoraError) throw error;
      throw new NexoraError(code + ': ' + (error as Error).message, code, error);
    }
  }
}

export class PrivacyHubClient {
  readonly provider: RpcProvider;
  readonly privacyHubAddress: string;
  readonly poolAddress: string;
  readonly chainId: string;
  readonly timeoutMs: number;

  private privacyHubContract: Contract | null = null;
  private resolvedChainId: string | null = null;

  constructor(config: PrivacyHubClientConfig) {
    if (!config.rpcUrl) {
      throw new InvalidArgumentError('rpcUrl is required');
    }
    if (!config.privacyHubAddress) {
      throw new InvalidArgumentError('privacyHubAddress is required');
    }
    this.privacyHubAddress = config.privacyHubAddress;
    this.poolAddress = config.poolAddress;
    this.chainId = config.chainId ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TX_WAIT_TIMEOUT_MS;
    this.provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  }

  async getContract(): Promise<Contract> {
    if (!this.privacyHubContract) {
      const parsedAbi = PRIVACY_HUB_ABI as any;
      await this.resolveChainId();
      this.privacyHubContract = new Contract(parsedAbi, this.privacyHubAddress, this.provider);
    }
    return this.privacyHubContract;
  }

  private async resolveChainId(): Promise<string> {
    if (this.chainId) return this.chainId;
    if (this.resolvedChainId) return this.resolvedChainId;
    const chainId = await this.provider.getChainId();
    this.resolvedChainId = chainId;
    return chainId;
  }

  async getChainId(): Promise<string> {
    return this.resolveChainId();
  }

  registerViewingKey(account: Account, publicKey: bigint | string): Promise<TransactionResult> {
    return this.withError(async () => {
      const pk = num.toHex(typeof publicKey === 'bigint' ? publicKey : num.toBigInt(publicKey));
      const contract = await this.getContract();
      const response: ContractResponse = await contract.register_viewing_key(pk, {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.VIEWING_KEY_NOT_REGISTERED);
  }

  shield(account: Account, token: string, amount: bigint | string): Promise<TransactionResult> {
    return this.withError(async () => {
      if (!token) throw new InvalidArgumentError('Token address is required');
      const amountBig = typeof amount === 'bigint' ? amount : num.toBigInt(amount);
      if (amountBig <= 0n) throw new InvalidArgumentError('Amount must be greater than zero');

      const contract = await this.getContract();
      const response: ContractResponse = await contract.shield(token, num.toHex(amountBig), {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.SHIELD_FAILED);
  }

  unshield(account: Account, token: string, amount: bigint | string, recipient: string): Promise<TransactionResult> {
    return this.withError(async () => {
      if (!token) throw new InvalidArgumentError('Token address is required');
      if (!recipient) throw new InvalidArgumentError('Recipient address is required');
      const amountBig = typeof amount === 'bigint' ? amount : num.toBigInt(amount);
      if (amountBig <= 0n) throw new InvalidArgumentError('Amount must be greater than zero');

      const contract = await this.getContract();
      const response: ContractResponse = await contract.unshield(token, num.toHex(amountBig), recipient, {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.UNSHIELD_FAILED);
  }

  privateTransfer(account: Account, to: string, token: string, amount: bigint | string): Promise<TransactionResult> {
    return this.withError(async () => {
      if (!to) throw new InvalidArgumentError('Recipient address is required');
      if (!token) throw new InvalidArgumentError('Token address is required');
      const amountBig = typeof amount === 'bigint' ? amount : num.toBigInt(amount);
      if (amountBig <= 0n) throw new InvalidArgumentError('Amount must be greater than zero');

      const contract = await this.getContract();
      const response: ContractResponse = await contract.private_transfer(to, token, num.toHex(amountBig), {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.TRANSFER_FAILED);
  }

  addSupportedToken(account: Account, token: string): Promise<TransactionResult> {
    return this.withError(async () => {
      if (!token) throw new InvalidArgumentError('Token address is required');
      const contract = await this.getContract();
      const response: ContractResponse = await contract.add_supported_token(token, {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.INVALID_ARGUMENT);
  }

  setPool(account: Account, poolAddress: string): Promise<TransactionResult> {
    return this.withError(async () => {
      if (!poolAddress) throw new InvalidArgumentError('Pool address is required');
      const contract = await this.getContract();
      const response: ContractResponse = await contract.set_pool(poolAddress, {
        from: account.address,
      });
      const txHash = extractTxHash(response);
      return createTxResult(txHash, this.provider, this.timeoutMs);
    }, ErrorCode.INVALID_ARGUMENT);
  }

  private async withError<T>(fn: () => Promise<T>, code: ErrorCodeValue): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof NexoraError) throw error;
      throw new NexoraError(code + ': ' + (error as Error).message, code, error);
    }
  }
}

export {
  DEFAULT_BLOCK_IDENTIFIER,
  ShieldError,
  UnshieldError,
  ViewingKeyError,
  InvalidArgumentError,
  ErrorCode,
};
export type { ContractResponse };
