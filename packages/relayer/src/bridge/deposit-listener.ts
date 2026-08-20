import { randomUUID } from 'crypto';
import type { RelayerConfig } from '@nexora-protocol/shared';
import { RpcProvider, num } from 'starknet';
import type { Database } from '../db/connection';
import { DepositRepository, type SwapRepository } from '../db/repositories';
import {
  DEFAULT_DEPOSIT_POLL_INTERVAL_MS,
  MAX_RETRIES,
  RETRY_BACKOFF_MS,
} from '@nexora-protocol/shared';
import { withRetry, withTimeout } from '@nexora-protocol/shared';

export interface ProcessedDeposit {
  id: string;
  intentId: string;
  swapId: string;
  sourceTxHash: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  token: string;
  tokenAddress: string;
  blockNumber: number;
  blockHash: string;
}

export type OnDepositCallback = (deposit: ProcessedDeposit) => Promise<void>;

export class DepositEventListener {
  private provider: RpcProvider;
  private db: Database;
  private depositRepo: DepositRepository;
  private swapRepo: SwapRepository;
  private callback: OnDepositCallback | null = null;
  private isPolling = false;
  private currentBlock: number | null = null;
  private readonly usdcTokenAddress: string;
  private readonly relayerAddress: string;
  private readonly pollInterval: number;
  private readonly config: RelayerConfig;

  constructor(
    config: RelayerConfig,
    db: Database,
    depositRepo: DepositRepository,
    swapRepo: SwapRepository
  ) {
    this.config = config;
    this.db = db;
    this.depositRepo = depositRepo;
    this.swapRepo = swapRepo;
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });
    this.usdcTokenAddress = config.usdcTokenAddress;
    this.relayerAddress = config.relayerStarknetAddress;
    this.pollInterval = config.pollIntervalMs || DEFAULT_DEPOSIT_POLL_INTERVAL_MS;
  }

  setCallback(callback: OnDepositCallback): void {
    this.callback = callback;
  }

  async start(fromBlock?: number): Promise<void> {
    if (this.isPolling) {
      console.warn('Deposit listener is already running');
      return;
    }

    this.isPolling = true;
    this.currentBlock = fromBlock ?? (await this.getCurrentBlock());
    console.log(`Deposit listener started from block ${this.currentBlock}`);

    setImmediate(() => this.pollLoop());
  }

  async stop(): Promise<void> {
    this.isPolling = false;
    console.log('Deposit listener stopped');
  }

  private async pollLoop(): Promise<void> {
    while (this.isPolling) {
      try {
        await this.checkForDeposits();
      } catch (error) {
        console.error('Deposit poll error:', error);
      }

      if (this.isPolling) {
        await this.sleep(this.pollInterval);
      }
    }
  }

  private async checkForDeposits(): Promise<void> {
    const fromBlock = this.currentBlock ?? (await this.getCurrentBlock());
    const toBlock = await this.getCurrentBlock();

    if (toBlock < fromBlock) {
      this.currentBlock = toBlock + 1;
      return;
    }

    if (toBlock === fromBlock) {
      return;
    }

    console.debug(`Checking deposits from block ${fromBlock} to ${toBlock}`);

    const events = await this.fetchTransferEvents(fromBlock, toBlock);

    let newBlock = toBlock + 1;

    for (const event of events) {
      try {
        const processed = await this.handleDepositEvent(event);
        if (processed) {
          if (processed.blockNumber + 1 > newBlock) {
            newBlock = processed.blockNumber + 1;
          }
        }
      } catch (error) {
        console.error('Failed to handle deposit event:', error);
      }
    }

    this.currentBlock = newBlock;
  }

  private async fetchTransferEvents(fromBlock: number, toBlock: number): Promise<any[]> {
    return withRetry(
      () => withTimeout(
        () => this.provider.getEvents({
          from_block: { block_number: fromBlock },
          to_block: { block_number: toBlock },
          address: this.usdcTokenAddress,
          follow_removed: false,
        } as any).then((result: any) => result.events ?? []),
        this.config.txWaitTimeoutMs,
        'getEvents timed out'
      ),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );
  }

  private async handleDepositEvent(event: any): Promise<ProcessedDeposit | null> {
    const fromAddress = this.extractAddress(event.keys?.[1]);
    const toAddress = this.extractAddress(event.keys?.[2]);
    const txHash = event.transaction_hash ?? event.tx_hash ?? '';
    const blockNumber = this.parseBlockNumber(event.block_number ?? event.blockNumber ?? 0);
    const blockHash = event.block_hash ?? event.blockHash ?? '';

    if (!fromAddress || !txHash || !toAddress) {
      console.warn('Skipping event with missing fields:', JSON.stringify(event).substring(0, 200));
      return null;
    }

    if (toAddress !== this.relayerAddress) {
      return null;
    }

    const amount = this.extractAmount(event.data ?? event.amount ?? []);

    const exists = await this.depositRepo.exists(txHash, fromAddress, this.relayerAddress, blockNumber);
    if (exists) {
      console.debug(`Deposit already recorded: ${txHash}:${fromAddress}`);
      return null;
    }

    const swap = await this.matchDepositToSwap(amount);

    const deposit: ProcessedDeposit = {
      id: randomUUID(),
      intentId: swap?.intent_id ?? '',
      swapId: swap?.swap_id ?? '',
      sourceTxHash: txHash,
      fromAddress,
      toAddress: this.relayerAddress,
      amount,
      token: 'USDC',
      tokenAddress: this.usdcTokenAddress,
      blockNumber,
      blockHash,
    };

    await this.db.executeInTransaction(async (client) => {
      const repo = new DepositRepository(client);
      await repo.create({
        id: deposit.id,
        intent_id: deposit.intentId,
        swap_id: deposit.swapId,
        source_tx_hash: deposit.sourceTxHash,
        from_address: deposit.fromAddress,
        to_address: deposit.toAddress,
        amount: deposit.amount.toString(),
        token: deposit.token,
        block_number: deposit.blockNumber,
        block_hash: deposit.blockHash,
        status: 'detected',
      });
    });

    console.log(`Deposit detected: ${Number(amount) / 1e6} USDC from ${fromAddress} at ${txHash}`);

    if (this.callback) {
      await this.callback(deposit);
    }

    return deposit;
  }

  private async matchDepositToSwap(amount: bigint): Promise<any | null> {
    const pendingSwaps = await this.swapRepo.getPendingByDestinationAddress(this.relayerAddress);

    if (pendingSwaps.length === 0) {
      return null;
    }

    const tolerance = amount / 100n;

    for (const swap of pendingSwaps) {
      const swapAmount = BigInt(Math.round(Number(swap.amount) * 1e6));
      if (swapAmount > 0n && (amount >= swapAmount || amount >= swapAmount - tolerance)) {
        return swap;
      }
    }

    return null;
  }

  private extractAddress(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return value.startsWith('0x') ? value : '0x' + value;
    }
    if (typeof value === 'bigint') {
      return num.toHex(value);
    }
    return '';
  }

  private extractAmount(data: any[]): bigint {
    if (!data || data.length === 0) return 0n;
    const raw = data[0];
    if (typeof raw === 'bigint') return raw;
    if (typeof raw === 'string') {
      try {
        return BigInt(raw);
      } catch {
        return BigInt(parseInt(raw, 16));
      }
    }
    if (typeof raw === 'number') {
      return BigInt(raw);
    }
    if (Array.isArray(raw)) {
      const low = BigInt(raw[0] ?? 0);
      const high = BigInt(raw[1] ?? 0);
      return (high << 128n) + low;
    }
    return 0n;
  }

  private parseBlockNumber(value: string | number): number {
    if (typeof value === 'number') return value;
    if (value.startsWith('0x')) {
      return Number(BigInt(value));
    }
    return parseInt(value, 10);
  }

  private async getCurrentBlock(): Promise<number> {
    return withRetry(
      () => withTimeout(
        () => this.provider.getBlock('latest').then((block: any) => this.parseBlockNumber(block.block_number)),
        this.config.txWaitTimeoutMs,
        'getBlock timed out'
      ),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRelayerAddress(): string {
    return this.relayerAddress;
  }

  isRunning(): boolean {
    return this.isPolling;
  }
}
