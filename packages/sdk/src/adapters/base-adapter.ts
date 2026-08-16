import { keccak256 } from 'js-sha3';
import crypto from 'crypto';
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
  DepositAction,
} from './types';
import { LayerSwapClient, LayerSwapApiError } from './layerswap-client';

export interface BaseAdapterConfig extends AdapterConfig {
  sourceNetwork?: 'STARKNET';
  destinationNetwork?: 'BASE';
  defaultToken?: string;
}

export interface FreshAddressResult {
  address: string;
  privateKey: string;
}

export interface WithdrawalParams {
  token: string;
  amount: number;
  recipient?: string;
  privacyLevel?: 'none' | 'standard' | 'maximum';
  referenceId?: string;
}

export interface WithdrawalReceipt {
  swapId: string;
  depositAddress: string;
  destinationAddress: string;
  depositActions: DepositAction[];
  fee: number;
  amount: number;
  sourceToken: string;
  destinationToken: string;
  status: string;
  unshieldTxHash?: string;
  bridgeTxHash?: string;
  estimatedArrival?: string;
  freshAddress: string;
}

const DEFAULT_BASE_TOKEN = 'USDC';
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;

export class BaseAdapter {
  readonly sourceNetwork: string;
  readonly destinationNetwork: string;
  readonly defaultToken: string;
  readonly client: LayerSwapClient;
  readonly timeoutMs: number;

  private activePolls = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: BaseAdapterConfig) {
    if (!config.apiKey) {
      throw new InvalidArgumentError('LayerSwap API key is required for BaseAdapter');
    }
    this.sourceNetwork = config.sourceNetwork ?? 'STARKNET';
    this.destinationNetwork = config.destinationNetwork ?? 'BASE';
    this.defaultToken = config.defaultToken ?? DEFAULT_BASE_TOKEN;
    this.client = new LayerSwapClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      environment: config.environment,
      timeoutMs: config.timeoutMs,
    });
    this.timeoutMs = config.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  async generateFreshAddress(): Promise<FreshAddressResult> {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
    });

    const publicKeyBuffer = Buffer.from(publicKey.export({ type: 'spki', format: 'der' }));
    const hash = keccak256(publicKeyBuffer);
    const address = '0x' + hash.slice(-40);

    const privateKeyHex = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'der' })).toString('hex');

    return { address, privateKey: privateKeyHex };
  }

  async getSupportedTokens(): Promise<BridgeToken[]> {
    try {
      const networks = await this.client.getNetworks();
      const envSuffix = this.client['environment'] === 'SEPOLIA' ? '_SEPOLIA' : '_MAINNET';
      const targetName = `${this.sourceNetwork}${envSuffix}`;
      const sourceNetwork = networks.find((n) => n.name === targetName);
      return sourceNetwork?.tokens ?? [];
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

  async reserveBridge(sourceToken: string, destinationToken: string, amount: number, destinationAddress: string, sourceAddress?: string, refundAddress?: string, referenceId?: string): Promise<BridgeReservation> {
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
        sourceAddress,
        false,
        refundAddress,
        referenceId
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

  async getDepositActions(swapId: string, sourceAddress?: string): Promise<DepositAction[]> {
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

  async executeWithdrawal(params: WithdrawalParams): Promise<WithdrawalReceipt> {
    if (!params.token) {
      throw new InvalidArgumentError('Token is required for withdrawal');
    }
    if (params.amount <= 0) {
      throw new InvalidArgumentError('Amount must be greater than zero');
    }

    const freshAddressResult = await this.generateFreshAddress();
    const destinationAddress = params.recipient ?? freshAddressResult.address;

    const reservation = await this.reserveBridge(
      params.token,
      params.token,
      params.amount,
      destinationAddress,
      undefined,
      undefined,
      params.referenceId
    );

    return {
      swapId: reservation.swapId,
      depositAddress: reservation.depositAddress,
      destinationAddress,
      depositActions: reservation.depositActions,
      fee: reservation.fee,
      amount: reservation.amount,
      sourceToken: reservation.sourceToken,
      destinationToken: reservation.destinationToken,
      status: reservation.status,
      freshAddress: freshAddressResult.address,
      estimatedArrival: new Date(Date.now() + 120_000).toISOString(),
    };
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
