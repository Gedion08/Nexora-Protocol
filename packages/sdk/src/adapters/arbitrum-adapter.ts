import {
  InvalidArgumentError,
  NexoraError,
  ErrorCode,
} from '../utils/errors';
import type {
  AdapterConfig,
  BridgeQuote,
  BridgeReservation,
  DepositStatus,
  DepositStatusResult,
  BridgeToken,
} from './types';
import { LayerSwapClient, LayerSwapApiError } from './layerswap-client';

export interface ArbitrumAdapterConfig extends AdapterConfig {
  sourceNetwork?: 'ARBITRUM';
  destinationNetwork?: 'STARKNET';
  defaultToken?: string;
}

const DEFAULT_ARBITRUM_TOKEN = 'ETH';
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;

export class ArbitrumAdapter {
  readonly sourceNetwork: string;
  readonly destinationNetwork: string;
  readonly defaultToken: string;
  readonly client: LayerSwapClient;
  readonly timeoutMs: number;

  private activePolls = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: ArbitrumAdapterConfig) {
    if (!config.apiKey) {
      throw new InvalidArgumentError('LayerSwap API key is required for ArbitrumAdapter');
    }
    this.sourceNetwork = config.sourceNetwork ?? 'ARBITRUM';
    this.destinationNetwork = config.destinationNetwork ?? 'STARKNET';
    this.defaultToken = config.defaultToken ?? DEFAULT_ARBITRUM_TOKEN;
    this.client = new LayerSwapClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      environment: config.environment,
      timeoutMs: config.timeoutMs,
    });
    this.timeoutMs = config.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  async getSupportedTokens(): Promise<BridgeToken[]> {
    try {
      const networks = await this.client.getNetworks();
      const envSuffix = this.client['environment'] === 'SEPOLIA' ? '_SEPOLIA' : '_MAINNET';
      const targetName = `${this.sourceNetwork}${envSuffix}`;
      const arbNetwork = networks.find((n) => n.name === targetName);
      return arbNetwork?.tokens ?? [];
    } catch (error) {
      throw new NexoraError('Failed to fetch supported tokens: ' + (error as Error).message, ErrorCode.CONNECTIVITY_ERROR, error);
    }
  }

  async estimateFee(sourceToken: string, destinationToken: string, amount: number): Promise<BridgeQuote> {
    if (amount <= 0) {
      throw new InvalidArgumentError('Amount must be greater than zero');
    }
    try {
      return await this.client.getQuote(
        this.sourceNetwork,
        sourceToken,
        this.destinationNetwork,
        destinationToken,
        amount
      );
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Fee estimation failed: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async getLimits(sourceToken: string, destinationToken: string, amount: number): Promise<{ min: number; max: number }> {
    if (amount <= 0) {
      throw new InvalidArgumentError('Amount must be greater than zero');
    }
    try {
      const limits = await this.client.getLimits(
        this.sourceNetwork,
        sourceToken,
        this.destinationNetwork,
        destinationToken,
        amount
      );
      return { min: limits.minAmount, max: limits.maxAmount };
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Failed to fetch limits: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async reserveBridge(sourceToken: string, destinationToken: string, amount: number, destinationAddress: string, sourceAddress?: string): Promise<BridgeReservation> {
    if (amount <= 0) {
      throw new InvalidArgumentError('Amount must be greater than zero');
    }
    if (!destinationAddress) {
      throw new InvalidArgumentError('Destination address is required');
    }
    try {
      return await this.client.createSwap(
        this.sourceNetwork,
        sourceToken,
        this.destinationNetwork,
        destinationToken,
        amount,
        destinationAddress,
        sourceAddress
      );
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Bridge reservation failed: ' + error.message, ErrorCode.TRANSACTION_FAILED, error);
      }
      throw error;
    }
  }

  async getBridgeStatus(swapId: string): Promise<DepositStatusResult> {
    if (!swapId) {
      throw new InvalidArgumentError('Swap ID is required');
    }
    try {
      const reservation = await this.client.getSwap(swapId);
      return this.mapDepositStatus(reservation);
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Failed to fetch bridge status: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async getBridgeStatusByTxHash(transactionHash: string): Promise<DepositStatusResult> {
    if (!transactionHash) {
      throw new InvalidArgumentError('Transaction hash is required');
    }
    try {
      const reservation = await this.client.getSwapByTransactionHash(transactionHash);
      return this.mapDepositStatus(reservation);
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Failed to fetch bridge status by tx hash: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async getDepositActions(swapId: string, sourceAddress?: string): Promise<import('./types').DepositAction[]> {
    if (!swapId) {
      throw new InvalidArgumentError('Swap ID is required');
    }
    try {
      return await this.client.getDepositActions(swapId, sourceAddress);
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Failed to fetch deposit actions: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async speedUpDepositDetection(swapId: string, transactionHash: string): Promise<void> {
    if (!swapId) {
      throw new InvalidArgumentError('Swap ID is required');
    }
    if (!transactionHash) {
      throw new InvalidArgumentError('Transaction hash is required');
    }
    try {
      await this.client.speedUpDeposit(swapId, transactionHash);
    } catch (error) {
      if (error instanceof LayerSwapApiError) {
        throw new NexoraError('Failed to speed up deposit detection: ' + error.message, ErrorCode.CONNECTIVITY_ERROR, error);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<void> {
    try {
      await this.client.health();
    } catch (error) {
      throw new NexoraError('LayerSwap health check failed: ' + (error as Error).message, ErrorCode.CONNECTIVITY_ERROR, error);
    }
  }

  pollBridgeStatus(swapId: string, onUpdate: (status: DepositStatusResult) => void, pollIntervalMs = POLL_INTERVAL_MS): () => void {
    if (this.activePolls.has(swapId)) {
      throw new NexoraError('Already polling status for swap: ' + swapId, ErrorCode.INVALID_ARGUMENT);
    }

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      this.stopPolling(swapId);
      onUpdate({
        swapId,
        status: 'failed',
        confirmations: 0,
        maxConfirmations: 0,
        failReason: 'Polling timed out after ' + this.timeoutMs + 'ms',
      });
    }, this.timeoutMs);

    this.activePolls.set(swapId, timer);

    const poll = async () => {
      if (timedOut) return;
      try {
        const status = await this.getBridgeStatus(swapId);
        onUpdate(status);
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'expired' || status.status === 'cancelled') {
          this.stopPolling(swapId);
        }
      } catch {
        if (!timedOut) {
          setTimeout(poll, pollIntervalMs);
        }
      }
    };

    poll();

    return () => this.stopPolling(swapId);
  }

  stopPolling(swapId: string): void {
    const timer = this.activePolls.get(swapId);
    if (timer) {
      clearTimeout(timer);
      this.activePolls.delete(swapId);
    }
  }

  private mapDepositStatus(reservation: BridgeReservation): DepositStatusResult {
    const statusMap: Record<string, DepositStatus> = {
      created: 'pending',
      user_transfer_pending: 'pending',
      user_transfer_delayed: 'pending',
      ls_transfer_pending: 'processing',
      completed: 'completed',
      failed: 'failed',
      expired: 'expired',
      cancelled: 'cancelled',
      pending_refund: 'failed',
      refunded: 'failed',
    };

    return {
      swapId: reservation.swapId,
      status: statusMap[reservation.status] ?? 'pending',
      inputTransactionHash: reservation.inputTransactionHash ?? undefined,
      outputTransactionHash: reservation.outputTransactionHash ?? undefined,
      confirmations: 0,
      maxConfirmations: 0,
      failReason: reservation.status === 'failed' ? 'Bridge failed' : undefined,
    };
  }
}
