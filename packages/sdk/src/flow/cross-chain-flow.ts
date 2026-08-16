import {
  InvalidArgumentError,
  NexoraError,
  ErrorCode,
} from '../utils/errors';
import type {
  ArbitrumAdapterConfig,
  BaseAdapterConfig,
  BridgeQuote,
  DepositStatusResult,
  DepositAction,
} from '../adapters/types';
import { ArbitrumAdapter } from '../adapters/arbitrum-adapter';
import { BaseAdapter } from '../adapters/base-adapter';
import { StarknetAccountGenerator, StarknetAccount } from '../adapters/starknet-account';

export interface CrossChainFlowConfig {
  arbitrumAdapter: ArbitrumAdapterConfig;
  baseAdapter: BaseAdapterConfig;
  sourceToken?: string;
  destinationToken?: string;
  amount: number;
  destinationAddress: string;
  refundAddress?: string;
  referenceId?: string;
  recipient?: string;
}

export interface CrossChainReceipt {
  leg1: {
    swapId: string;
    depositAddress: string;
    destinationAddress: string;
    status: string;
    fee: number;
    amount: number;
    token: string;
    estimatedArrival?: string;
  };
  leg2: {
    swapId: string;
    depositAddress: string;
    destinationAddress: string;
    status: string;
    fee: number;
    amount: number;
    token: string;
    estimatedArrival?: string;
  };
  starknetAccount: StarknetAccount;
  totalFee: number;
  status: string;
}

export interface CrossChainStatus {
  leg1: DepositStatusResult | null;
  leg2: DepositStatusResult | null;
  status: string;
}

const DEFAULT_ARB_TOKEN = 'ETH';
const DEFAULT_BASE_TOKEN = 'USDC';

export class CrossChainFlow {
  readonly arbitrumAdapter: ArbitrumAdapter;
  readonly baseAdapter: BaseAdapter;
  readonly sourceToken: string;
  readonly destinationToken: string;
  readonly amount: number;
  readonly destinationAddress: string;

  private leg1SwapId: string | null = null;
  private leg2SwapId: string | null = null;
  private starknetAccount: StarknetAccount | null = null;

  constructor(config: CrossChainFlowConfig) {
    if (!config.amount || config.amount <= 0) {
      throw new InvalidArgumentError('Amount must be greater than zero');
    }
    if (!config.destinationAddress) {
      throw new InvalidArgumentError('Destination address is required');
    }

    this.arbitrumAdapter = new ArbitrumAdapter(config.arbitrumAdapter);
    this.baseAdapter = new BaseAdapter(config.baseAdapter);
    this.sourceToken = config.sourceToken ?? DEFAULT_ARB_TOKEN;
    this.destinationToken = config.destinationToken ?? DEFAULT_BASE_TOKEN;
    this.amount = config.amount;
    this.destinationAddress = config.destinationAddress;
  }

  async generateFreshStarknetAccount(chainId: string, poolAddress: string, r?: bigint | string, s?: bigint | string): Promise<StarknetAccount> {
    if (r !== undefined && s !== undefined) {
      this.starknetAccount = StarknetAccountGenerator.fromSignature({
        r,
        s,
        chainId,
        poolAddress,
      });
    } else {
      this.starknetAccount = StarknetAccountGenerator.generateRandom();
    }
    return this.starknetAccount;
  }

  async estimateFullFlow(): Promise<{ leg1: BridgeQuote; leg2: BridgeQuote; totalFee: number }> {
    try {
      const leg1Quote = await this.arbitrumAdapter.estimateFee(
        this.sourceToken,
        this.sourceToken,
        this.amount
      );
      const leg2Quote = await this.baseAdapter.estimateFee(
        this.sourceToken,
        this.destinationToken,
        leg1Quote.receiveAmount
      );

      return {
        leg1: leg1Quote,
        leg2: leg2Quote,
        totalFee: leg1Quote.totalFee + leg2Quote.totalFee,
      };
    } catch (error) {
      if (error instanceof NexoraError) throw error;
      throw new NexoraError('Failed to estimate full flow: ' + (error as Error).message, ErrorCode.CONNECTIVITY_ERROR, error);
    }
  }

  async executeFullFlow(refundAddress?: string, referenceId?: string): Promise<CrossChainReceipt> {
    if (!this.starknetAccount) {
      throw new NexoraError('Starknet account not generated. Call generateFreshStarknetAccount first.', ErrorCode.INVALID_ARGUMENT);
    }

    try {
      const leg1Reservation = await this.arbitrumAdapter.reserveBridge(
        this.sourceToken,
        this.sourceToken,
        this.amount,
        this.starknetAccount.address,
        undefined,
        refundAddress,
        referenceId
      );
      this.leg1SwapId = leg1Reservation.swapId;

      const leg2Reservation = await this.baseAdapter.reserveBridge(
        this.sourceToken,
        this.destinationToken,
        leg1Reservation.amount,
        this.destinationAddress,
        this.starknetAccount.address,
        refundAddress,
        referenceId
      );
      this.leg2SwapId = leg2Reservation.swapId;

      return {
        leg1: {
          swapId: leg1Reservation.swapId,
          depositAddress: leg1Reservation.depositAddress,
          destinationAddress: leg1Reservation.destinationAddress,
          status: leg1Reservation.status,
          fee: leg1Reservation.fee,
          amount: leg1Reservation.amount,
          token: leg1Reservation.sourceToken,
          estimatedArrival: new Date(Date.now() + 180_000).toISOString(),
        },
        leg2: {
          swapId: leg2Reservation.swapId,
          depositAddress: leg2Reservation.depositAddress,
          destinationAddress: leg2Reservation.destinationAddress,
          status: leg2Reservation.status,
          fee: leg2Reservation.fee,
          amount: leg2Reservation.amount,
          token: leg2Reservation.destinationToken,
          estimatedArrival: new Date(Date.now() + 300_000).toISOString(),
        },
        starknetAccount: this.starknetAccount,
        totalFee: leg1Reservation.fee + leg2Reservation.fee,
        status: 'awaiting_deposit',
      };
    } catch (error) {
      if (error instanceof NexoraError) throw error;
      throw new NexoraError('Failed to execute full flow: ' + (error as Error).message, ErrorCode.TRANSACTION_FAILED, error);
    }
  }

  async getLeg1Status(): Promise<DepositStatusResult> {
    if (!this.leg1SwapId) {
      throw new InvalidArgumentError('Leg 1 swap has not been initiated');
    }
    return this.arbitrumAdapter.getBridgeStatus(this.leg1SwapId);
  }

  async getLeg2Status(): Promise<DepositStatusResult> {
    if (!this.leg2SwapId) {
      throw new InvalidArgumentError('Leg 2 swap has not been initiated');
    }
    return this.baseAdapter.getBridgeStatus(this.leg2SwapId);
  }

  async getFullStatus(): Promise<CrossChainStatus> {
    const leg1 = this.leg1SwapId ? await this.getLeg1Status() : null;
    const leg2 = this.leg2SwapId ? await this.getLeg2Status() : null;

    let overallStatus = 'pending';
    if (leg1?.status === 'completed' && leg2?.status === 'completed') {
      overallStatus = 'completed';
    } else if (leg1?.status === 'failed' || leg2?.status === 'failed') {
      overallStatus = 'failed';
    } else if (leg1?.status === 'processing' || leg2?.status === 'processing') {
      overallStatus = 'bridging';
    } else if (leg1?.status === 'pending') {
      overallStatus = 'awaiting_deposit';
    }

    return {
      leg1,
      leg2,
      status: overallStatus,
    };
  }

  async getDepositActions(sourceAddress?: string): Promise<{ leg1: DepositAction[]; leg2: DepositAction[] }> {
    const leg1 = this.leg1SwapId
      ? await this.arbitrumAdapter.getDepositActions(this.leg1SwapId, sourceAddress)
      : [];
    const leg2 = this.leg2SwapId
      ? await this.baseAdapter.getDepositActions(this.leg2SwapId, this.starknetAccount?.address)
      : [];

    return {
      leg1,
      leg2,
    };
  }

  async speedUpLeg1(transactionHash: string): Promise<void> {
    if (!this.leg1SwapId) {
      throw new InvalidArgumentError('Leg 1 swap has not been initiated');
    }
    return this.arbitrumAdapter.speedUpDepositDetection(this.leg1SwapId, transactionHash);
  }

  async speedUpLeg2(transactionHash: string): Promise<void> {
    if (!this.leg2SwapId) {
      throw new InvalidArgumentError('Leg 2 swap has not been initiated');
    }
    return this.baseAdapter.speedUpDepositDetection(this.leg2SwapId, transactionHash);
  }

  getStarknetAccount(): StarknetAccount | null {
    return this.starknetAccount;
  }
}
