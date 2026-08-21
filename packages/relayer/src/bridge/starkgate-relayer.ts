import type { RelayerConfig } from '@nexora-protocol/shared';
import { RpcProvider, num } from 'starknet';
import { withRetry, withTimeout, MAX_RETRIES, RETRY_BACKOFF_MS } from '@nexora-protocol/shared';
import type { BridgeQuote, DepositStatusResult, DepositAction } from '@nexora-protocol/sdk';
import { createHash } from 'crypto';

export interface BridgeReservationResult {
  swapId: string;
  depositAddress: string;
  depositActions: DepositAction[];
  fee: number;
  amount: number;
  sourceToken: string;
  destinationToken: string;
  status: string;
  estimatedArrival?: string;
}

export interface RefundResult {
  swapId: string;
  status: string;
  refundTxHash?: string;
}

const STARKGATE_ARBITRUM_BRIDGE = '0x09E60Cc7CD219636D0a1B6Da8CDc182813787419';
const POLL_INTERVAL_MS = 15_000;

export class StarkGateRelayer {
  private config: RelayerConfig;
  private provider: RpcProvider;
  private arbitrumProvider: RpcProvider;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });
    this.arbitrumProvider = new RpcProvider({ nodeUrl: 'https://arb1.arbitrum.io/rpc' });
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.provider.getChainId().catch(() => 'unknown'),
      this.arbitrumProvider.getChainId().catch(() => 'unknown'),
    ]);
    console.log('StarkGate relayer initialized');
  }

  async checkHealth(): Promise<void> {
    await withRetry(
      () => withTimeout(() => this.provider.getChainId(), 10_000, 'Starknet RPC timed out'),
      { maxRetries: MAX_RETRIES, baseDelayMs: RETRY_BACKOFF_MS, timeoutMs: 30_000 }
    );
    await withRetry(
      () => withTimeout(() => this.arbitrumProvider.getChainId(), 10_000, 'Arbitrum RPC timed out'),
      { maxRetries: MAX_RETRIES, baseDelayMs: RETRY_BACKOFF_MS, timeoutMs: 30_000 }
    );
  }

  async estimateFee(sourceToken: string, destinationToken: string, amount: number): Promise<BridgeQuote> {
    const receiveAmount = amount * 0.995;
    const totalFee = amount * 0.005;

    return {
      sourceToken,
      destinationToken,
      sourceNetwork: 'ARBITRUM',
      destinationNetwork: 'STARKNET',
      amount,
      receiveAmount,
      totalFee,
      blockchainFee: 0,
      serviceFee: totalFee,
      avgCompletionTime: '600000',
      minAmount: 10,
      maxAmount: amount * 1.5,
    };
  }

  async getLimits(_sourceToken: string, _destinationToken: string, amount: number): Promise<{ min: number; max: number }> {
    if (amount <= 0) {
      return { min: 0, max: 0 };
    }
    return {
      min: Math.max(10, amount * 0.01),
      max: amount * 1.5,
    };
  }

  async reserveBridge(
    intentId: string,
    _sourceToken: string,
    destinationToken: string,
    amount: number,
    _sourceAddress?: string,
    _refundAddress?: string,
    referenceId?: string
  ): Promise<BridgeReservationResult> {
    const swapId = referenceId ?? `starkgate_${intentId}_${Date.now().toString(36)}`;

    const depositActions: DepositAction[] = [
      {
        type: 'manual_transfer',
        toAddress: STARKGATE_ARBITRUM_BRIDGE,
        amount,
        amountInBaseUnits: this.toBaseUnits(amount, destinationToken),
        order: 1,
        network: 'arbitrum',
        token: destinationToken,
        feeToken: 'ETH',
        callData: this.buildStarkGateCalldata(destinationToken, amount, this.config.relayerStarknetAddress),
        gasLimit: '300000',
      },
    ];

    return {
      swapId,
      depositAddress: STARKGATE_ARBITRUM_BRIDGE,
      depositActions,
      fee: 0,
      amount,
      sourceToken: destinationToken,
      destinationToken,
      status: 'awaiting_deposit',
      estimatedArrival: new Date(Date.now() + 600_000).toISOString(),
    };
  }

  async getBridgeStatus(swapId: string): Promise<DepositStatusResult> {
    const sourceEvents = await this.fetchStarkGateSourceEvents(swapId);
    const destEvents = await this.fetchStarkGateDestEvents(swapId);

    if (destEvents.length > 0) {
      return {
        swapId,
        status: 'completed',
        inputTransactionHash: sourceEvents[0]?.transaction_hash,
        outputTransactionHash: destEvents[0]?.transaction_hash,
        confirmations: 1,
        maxConfirmations: 1,
      };
    }

    if (sourceEvents.length > 0) {
      return {
        swapId,
        status: 'processing',
        inputTransactionHash: sourceEvents[0]?.transaction_hash,
        confirmations: 0,
        maxConfirmations: 1,
      };
    }

    return {
      swapId,
      status: 'pending',
      confirmations: 0,
      maxConfirmations: 1,
    };
  }

  async getDepositActions(swapId: string, _sourceAddress?: string): Promise<DepositAction[]> {
    const status = await this.getBridgeStatus(swapId);
    if (status.status === 'completed' || status.status === 'processing') {
      return [];
    }
    return [
      {
        type: 'manual_transfer',
        toAddress: STARKGATE_ARBITRUM_BRIDGE,
        amount: 0,
        amountInBaseUnits: '0',
        order: 1,
        network: 'arbitrum',
        token: 'ETH',
        feeToken: 'ETH',
        callData: this.buildStarkGateCalldata('ETH', 0, this.config.relayerStarknetAddress),
        gasLimit: '300000',
      },
    ];
  }

  async speedUpDepositDetection(swapId: string, transactionHash: string): Promise<void> {
    console.debug(`StarkGate speed-up requested for ${swapId}: ${transactionHash}`);
  }

  async refundBridge(swapId: string): Promise<RefundResult> {
    return {
      swapId,
      status: 'refunded',
    };
  }

  async waitForBridgeCompletion(
    swapId: string,
    timeoutMs: number = 600_000,
    onUpdate?: (status: DepositStatusResult) => void
  ): Promise<DepositStatusResult> {
    const startTime = Date.now();
    const pollInterval = POLL_INTERVAL_MS;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`StarkGate bridge ${swapId} timed out after ${timeoutMs}ms`));
          return;
        }

        try {
          const status = await this.getBridgeStatus(swapId);
          onUpdate?.(status);

          if (status.status === 'completed') {
            resolve(status);
            return;
          }

          if (status.status === 'failed' || status.status === 'expired' || status.status === 'cancelled') {
            reject(new Error(`StarkGate bridge ${status.status}`));
            return;
          }

          setTimeout(poll, pollInterval);
        } catch {
          setTimeout(poll, pollInterval);
        }
      };

      poll();
    });
  }

  async monitorForDeposits(onDeposit: (swapId: string, txHash: string, amount: bigint) => void): Promise<() => void> {
    let running = true;
    let lastBlock = await this.getCurrentArbitrumBlock();

    const poll = async () => {
      if (!running) return;

      try {
        const currentBlock = await this.getCurrentArbitrumBlock();
        if (currentBlock > lastBlock) {
          const events = await this.fetchStarkGateSourceEventsByBlock(lastBlock, currentBlock);
          for (const event of events) {
            const amount = this.extractAmount(event.data ?? []);
            const txHash = event.transaction_hash ?? event.tx_hash ?? '';
            if (txHash && amount > 0n) {
              onDeposit(event.reference_id ?? '', txHash, amount);
            }
          }
          lastBlock = currentBlock;
        }
      } catch (error) {
        console.error('StarkGate deposit monitor error:', error);
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      running = false;
    };
  }

  private async fetchStarkGateSourceEvents(swapId: string): Promise<any[]> {
    try {
      const result = await this.arbitrumProvider.getEvents({
        from_block: { block_number: '0' },
        to_block: { block_number: 'latest' },
        address: STARKGATE_ARBITRUM_BRIDGE,
        keys: [[num.toHex(this.keccak256('WithdrawalInitiated()'))]],
        follow_removed: false,
      } as any);

      return (result.events ?? []).filter((event: any) => {
        return event.reference_id === swapId || event.referenceId === swapId;
      });
    } catch {
      return [];
    }
  }

  private async fetchStarkGateDestEvents(swapId: string): Promise<any[]> {
    try {
      const result = await this.provider.getEvents({
        from_block: { block_number: '0' },
        to_block: { block_number: 'latest' },
        address: this.config.poolAddress,
        keys: [],
        follow_removed: false,
      } as any);

      return (result.events ?? []).filter((event: any) => {
        return event.reference_id === swapId || event.referenceId === swapId;
      });
    } catch {
      return [];
    }
  }

  private async fetchStarkGateSourceEventsByBlock(fromBlock: number, toBlock: number): Promise<any[]> {
    try {
      const result = await this.arbitrumProvider.getEvents({
        from_block: { block_number: fromBlock.toString() },
        to_block: { block_number: toBlock.toString() },
        address: STARKGATE_ARBITRUM_BRIDGE,
        keys: [[num.toHex(this.keccak256('WithdrawalInitiated()'))]],
        follow_removed: false,
      } as any);

      return result.events ?? [];
    } catch {
      return [];
    }
  }

  private async getCurrentArbitrumBlock(): Promise<number> {
    const block = await this.arbitrumProvider.getBlock('latest');
    return parseInt(String(block.block_number ?? '0'), 10);
  }

  private buildStarkGateCalldata(token: string, amount: number, recipient: string): string {
    const tokenAddr = this.padAddress(token === 'ETH' ? '0x0000000000000000000000000000000000000000' : token);
    const recipientAddr = this.padAddress(recipient);
    const amountHex = num.toHex(BigInt(Math.round(amount * 1e6)));

    return `${tokenAddr}${recipientAddr}${amountHex}`;
  }

  private padAddress(address: string): string {
    return address.replace('0x', '').padStart(64, '0');
  }

  private keccak256(data: string): string {
    return '0x' + createHash('sha3-256').update(data).digest('hex');
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
    if (typeof raw === 'number') return BigInt(raw);
    if (Array.isArray(raw)) {
      const low = BigInt(raw[0] ?? 0);
      const high = BigInt(raw[1] ?? 0);
      return (high << 128n) + low;
    }
    return 0n;
  }

  private toBaseUnits(amount: number, token: string): string {
    const decimals = token.toUpperCase() === 'USDC' || token.toUpperCase() === 'USDT' ? 6 : 18;
    const factor = BigInt(10) ** BigInt(decimals);
    return (BigInt(Math.round(amount * Number(factor)))).toString();
  }
}
