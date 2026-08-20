import { randomUUID } from 'crypto';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../db/connection';
import { ShieldTxRepository } from '../db/repositories';
import { RpcProvider, Account, Contract, num } from 'starknet';
import { PoolClient, PrivacyHubClient, computeNoteHash } from '@nexora-protocol/sdk';
import {
  MAX_RETRIES,
  RETRY_BACKOFF_MS,
} from '@nexora-protocol/shared';
import { withRetry, withTimeout } from '@nexora-protocol/shared';

export interface ShieldResult {
  transactionHash: string;
  noteHash: string;
  amount: bigint;
  token: string;
  status: string;
}

export interface UnshieldResult {
  transactionHash: string;
  noteHash: string;
  amount: bigint;
  token: string;
  recipient: string;
  status: string;
}

export class RelayerPrivacyHubClient {
  private config: RelayerConfig;
  private db: Database;
  private provider: RpcProvider;
  private poolClient: PoolClient;
  private privacyHubClient: PrivacyHubClient;
  private relayerAccount: Account | null = null;

  constructor(config: RelayerConfig, db: Database) {
    this.config = config;
    this.db = db;
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });

    this.poolClient = new PoolClient({
      rpcUrl: config.starknetRpcUrl,
      poolAddress: config.poolAddress,
      chainId: config.environment === 'SEPOLIA'
        ? '0x534e5f5345504f4c4941'
        : '0x534e5f4d41494e',
      timeoutMs: config.txWaitTimeoutMs,
    });

    this.privacyHubClient = new PrivacyHubClient({
      rpcUrl: config.starknetRpcUrl,
      privacyHubAddress: config.privacyHubAddress ?? config.poolAddress,
      poolAddress: config.poolAddress,
      chainId: config.environment === 'SEPOLIA'
        ? '0x534e5f5345504f4c4941'
        : '0x534e5f4d41494e',
      timeoutMs: config.txWaitTimeoutMs,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.relayerPrivateKey) {
      throw new Error('RELAYER_PRIVATE_KEY is required');
    }

    this.relayerAccount = new Account(
      this.provider,
      this.config.relayerStarknetAddress,
      this.config.relayerPrivateKey
    );

    try {
      await this.getAccount();
    } catch (error) {
      throw new Error(`Failed to initialize relayer account: ${(error as Error).message}`);
    }

    console.log(`Relayer account initialized: ${this.config.relayerStarknetAddress}`);
  }

  async getAccount(): Promise<Account> {
    if (!this.relayerAccount) {
      throw new Error('Relayer account not initialized. Call initialize() first.');
    }

    return withRetry(
      () => withTimeout(
        () => this.relayerAccount!.getNonce().then(() => this.relayerAccount!),
        this.config.txWaitTimeoutMs,
        'Account getNonce timed out'
      ),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );
  }

  async shield(
    intentId: string,
    swapId: string,
    token: string,
    amount: bigint,
    viewingKey?: { publicKey: string; privateKey: string }
  ): Promise<ShieldResult> {
    const account = await this.getAccount();
    const amountHex = num.toHex(amount);

    let txHash = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (viewingKey && viewingKey.publicKey) {
          const vkBigInt = BigInt(viewingKey.publicKey);
          const tx = await withRetry(
            () => this.poolClient.shield(account, token, amountHex, vkBigInt, []),
            {
              maxRetries: 2,
              baseDelayMs: RETRY_BACKOFF_MS,
              timeoutMs: this.config.txWaitTimeoutMs,
            }
          );
          txHash = tx.transactionHash;
          await this.waitForTransaction(txHash);
        } else {
          const poolContract = new Contract(
            [
              {
                type: 'function',
                name: 'shield',
                inputs: [
                  { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
                  { name: 'amount', type: 'core::integer::u256' },
                  { name: 'user', type: 'core::starknet::contract_address::ContractAddress' },
                  { name: 'viewing_key', type: 'core::felt252' },
                  { name: 'proof', type: 'core::array::ArrayCore<core::felt252>' },
                ],
                outputs: [{ name: 'note_hash', type: 'core::felt252' }],
              },
            ],
            this.config.poolAddress,
            account
          );

          const vk = viewingKey?.publicKey
            ? num.toHex(BigInt(viewingKey.publicKey))
            : '0x0';
          const response = await withRetry(
            () => poolContract.shield(token, amountHex, account.address, vk, [], {
              from: account.address,
            }),
            {
              maxRetries: 2,
              baseDelayMs: RETRY_BACKOFF_MS,
              timeoutMs: this.config.txWaitTimeoutMs,
            }
          ) as any;
          txHash = response.transaction_hash ?? response;
          await this.waitForTransaction(txHash);
        }
        break;
      } catch (error: any) {
        if (attempt === MAX_RETRIES) {
          await this.recordShieldFailure(intentId, swapId, token, amount, txHash, error);
          throw error;
        }
        console.warn(`Shield attempt ${attempt + 1} failed, retrying:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * Math.pow(2, attempt)));
      }
    }

    const noteHash = computeNoteHash(txHash!, account.address, token, amount);
    const receipt = await this.waitForTransaction(txHash!);

    await this.db.executeInTransaction(async (client) => {
      const repo = new ShieldTxRepository(client);
      await repo.create({
        id: randomUUID(),
        intent_id: intentId,
        swap_id: swapId,
        token,
        amount: amount.toString(),
        tx_hash: txHash,
        note_hash: noteHash,
      });
    });

    return {
      transactionHash: txHash!,
      noteHash,
      amount,
      token,
      status: receipt.status,
    };
  }

  async unshield(
    token: string,
    amount: bigint,
    recipient: string
  ): Promise<UnshieldResult> {
    const account = await this.getAccount();
    const amountHex = num.toHex(amount);

    let txHash = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const poolContract = new Contract(
          [
            {
              type: 'function',
              name: 'unshield',
              inputs: [
                { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
                { name: 'amount', type: 'core::integer::u256' },
                { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
                { name: 'proof', type: 'core::array::ArrayCore<core::felt252>' },
              ],
              outputs: [{ name: 'note_hash', type: 'core::felt252' }],
            },
          ],
          this.config.poolAddress,
          account
        );

        const response = await withRetry(
          () => poolContract.unshield(token, amountHex, recipient, [], {
            from: account.address,
          }),
          {
            maxRetries: 2,
            baseDelayMs: RETRY_BACKOFF_MS,
            timeoutMs: this.config.txWaitTimeoutMs,
          }
        ) as any;
        txHash = response.transaction_hash ?? response;
        await this.waitForTransaction(txHash);
        break;
      } catch (error: any) {
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        console.warn(`Unshield attempt ${attempt + 1} failed, retrying:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * Math.pow(2, attempt)));
      }
    }

    const noteHash = computeNoteHash(txHash!, account.address, token, amount);
    const receipt = await this.waitForTransaction(txHash!);

    return {
      transactionHash: txHash!,
      noteHash,
      amount,
      token,
      recipient,
      status: receipt.status,
    };
  }

  async registerViewingKey(viewingKey: { publicKey: string; privateKey: string }): Promise<string> {
    const account = await this.getAccount();
    const tx = await withRetry(
      () => this.poolClient.registerViewingKey(account, BigInt(viewingKey.publicKey)),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );
    await this.waitForTransaction(tx.transactionHash);
    return tx.transactionHash;
  }

  async getBalance(tokenAddress: string): Promise<bigint> {
    return withRetry(
      () => withTimeout(
        () => this.fetchBalance(tokenAddress),
        this.config.txWaitTimeoutMs,
        'getBalance timed out'
      ),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );
  }

  private async fetchBalance(tokenAddress: string): Promise<bigint> {
    try {
      const contract = new Contract(
        [
          {
            type: 'function',
            name: 'balance_of',
            inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
            outputs: [{ name: 'balance', type: 'core::integer::u256' }],
          },
        ],
        tokenAddress,
        this.provider
      );

      const result = await contract.balance_of(this.config.relayerStarknetAddress);
      return BigInt(result.toString());
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return 0n;
    }
  }

  async waitForTransaction(
    txHash: string,
    timeoutMs: number = this.config.txWaitTimeoutMs
  ): Promise<any> {
    const raceResult = (await withTimeout(
      () => this.provider.waitForTransaction(txHash, { retryInterval: 2000 }),
      timeoutMs,
      `Transaction ${txHash} timed out after ${timeoutMs}ms`
    )) as any;

    return {
      transactionHash: txHash,
      status: raceResult.finality_status ?? raceResult.status ?? 'ACCEPTED_ON_L2',
      blockHash: raceResult.block_hash ?? raceResult.blockHash,
      blockNumber: raceResult.block_number ?? raceResult.blockNumber,
      gasUsed: raceResult.actual_fee?.amount?.toString(),
      timestamp: raceResult.timestamp,
    };
  }

  private async recordShieldFailure(
    intentId: string,
    swapId: string,
    token: string,
    amount: bigint,
    txHash: string,
    _error: Error
  ): Promise<void> {
    try {
      await this.db.executeInTransaction(async (client) => {
        const repo = new ShieldTxRepository(client);
        await repo.create({
          id: randomUUID(),
          intent_id: intentId,
          swap_id: swapId,
          token,
          amount: amount.toString(),
          tx_hash: txHash,
          note_hash: null,
        });
      });
    } catch (dbError) {
      console.error('Failed to record shield failure:', dbError);
    }
  }

  isInitialized(): boolean {
    return this.relayerAccount !== null;
  }

  getPoolClient(): PoolClient {
    return this.poolClient;
  }

  getPrivacyHubClient(): PrivacyHubClient {
    return this.privacyHubClient;
  }
}
