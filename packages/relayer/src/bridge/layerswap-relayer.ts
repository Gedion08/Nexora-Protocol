import type { RelayerConfig } from '@nexora-protocol/shared';
import { ArbitrumAdapter, type BridgeQuote, type DepositStatusResult, type DepositAction } from '@nexora-protocol/sdk';
import { withRetry, OperationTimeoutError, MAX_RETRIES, RETRY_BACKOFF_MS } from '@nexora-protocol/shared';
import type { Database } from '../db/connection';
import { SwapRepository } from '../db/repositories';

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

export class LayerSwapRelayer {
  private config: RelayerConfig;
  private adapter: ArbitrumAdapter;
  private db: Database;

  constructor(config: RelayerConfig, db: Database) {
    this.config = config;
    this.db = db;
    this.adapter = new ArbitrumAdapter({
      apiKey: config.layerSwapApiKey,
      baseUrl: config.layerSwapApiUrl,
      environment: config.environment,
      timeoutMs: config.txWaitTimeoutMs,
    });
  }

  async getAdapter(): Promise<ArbitrumAdapter> {
    return withRetry(
      () => this.adapter.checkHealth().then(() => this.adapter),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async estimateFee(sourceToken: string, destinationToken: string, amount: number): Promise<BridgeQuote> {
    return withRetry(
      () => this.adapter.estimateFee(sourceToken, destinationToken, amount),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async getLimits(sourceToken: string, destinationToken: string, amount: number): Promise<{ min: number; max: number }> {
    return withRetry(
      () => this.adapter.getLimits(sourceToken, destinationToken, amount),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async reserveBridge(
    intentId: string,
    sourceToken: string,
    destinationToken: string,
    amount: number,
    sourceAddress?: string,
    refundAddress?: string,
    referenceId?: string
  ): Promise<BridgeReservationResult> {
    const destinationAddress = this.config.relayerStarknetAddress;

      const reservation = await withRetry(
        () => this.adapter.reserveBridge(
          sourceToken,
          destinationToken,
          amount,
          destinationAddress,
          sourceAddress,
          refundAddress,
          referenceId ?? intentId
        ),
        {
          maxRetries: MAX_RETRIES,
          baseDelayMs: RETRY_BACKOFF_MS,
          timeoutMs: this.config.txWaitTimeoutMs,
        },
        (error) => error.name !== 'InvalidArgumentError'
      );

    await this.db.executeInTransaction(async (client) => {
      const repo = new SwapRepository(client);
      await repo.create({
        swap_id: reservation.swapId,
        intent_id: intentId,
        source_network: reservation.sourceNetwork,
        source_token: reservation.sourceToken,
        destination_network: reservation.destinationNetwork,
        destination_token: reservation.destinationToken,
        amount: String(reservation.amount),
        destination_address: reservation.destinationAddress,
        deposit_address: reservation.depositAddress,
        status: 'awaiting_deposit',
        fee: String(reservation.fee),
      });
    });

    return {
      swapId: reservation.swapId,
      depositAddress: reservation.depositAddress,
      depositActions: reservation.depositActions,
      fee: reservation.fee,
      amount: reservation.amount,
      sourceToken: reservation.sourceToken,
      destinationToken: reservation.destinationToken,
      status: reservation.status,
    };
  }

  async getBridgeStatus(swapId: string): Promise<DepositStatusResult> {
    return withRetry(
      () => this.adapter.getBridgeStatus(swapId),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async getDepositActions(swapId: string, sourceAddress?: string): Promise<DepositAction[]> {
    return withRetry(
      () => this.adapter.getDepositActions(swapId, sourceAddress),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async waitForBridgeCompletion(
    swapId: string,
    timeoutMs: number = this.config.txWaitTimeoutMs,
    onUpdate?: (status: DepositStatusResult) => void
  ): Promise<DepositStatusResult> {
    const pollInterval = 15_000;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new OperationTimeoutError(timeoutMs));
          return;
        }

        try {
          const remainingTimeout = timeoutMs - (Date.now() - startTime);
          const status = await withRetry(
            () => this.getBridgeStatus(swapId),
            {
              maxRetries: 2,
              baseDelayMs: RETRY_BACKOFF_MS,
              timeoutMs: remainingTimeout,
            },
            (error) => error.name !== 'InvalidArgumentError'
          );
          onUpdate?.(status);

          if (status.status === 'completed') {
            resolve(status);
            return;
          }

          if (status.status === 'failed' || status.status === 'expired' || status.status === 'cancelled') {
            reject(new Error(`Bridge ${status.status}: ${status.failReason ?? 'unknown reason'}`));
            return;
          }

          setTimeout(poll, pollInterval);
        } catch (error) {
          if (error instanceof OperationTimeoutError) {
            reject(error);
            return;
          }
          setTimeout(poll, pollInterval);
        }
      };

      poll();
    });
  }

  async refundBridge(swapId: string): Promise<RefundResult> {
    const refundStatus = await withRetry(
      () => this.adapter.getBridgeStatus(swapId),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );

    await this.db.executeInTransaction(async (client) => {
      const repo = new SwapRepository(client);
      await repo.updateStatus(swapId, 'refunded');
    });

    return {
      swapId,
      status: 'refunded',
      refundTxHash: refundStatus.outputTransactionHash,
    };
  }

  async speedUpDepositDetection(swapId: string, transactionHash: string): Promise<void> {
    await withRetry(
      () => this.adapter.speedUpDepositDetection(swapId, transactionHash),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  async checkHealth(): Promise<void> {
    await withRetry(
      () => this.adapter.checkHealth(),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      },
      (error) => error.name !== 'InvalidArgumentError'
    );
  }

  getUnderlyingAdapter(): ArbitrumAdapter {
    return this.adapter;
  }
}
