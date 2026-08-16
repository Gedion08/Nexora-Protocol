import { randomUUID } from 'crypto';
import type { RelayerConfig, IntentStatus } from '@nexora-protocol/shared';
import type { PoolClient } from 'pg';
import { IntentRepository, SwapRepository, UnshieldTxRepository } from '../db/repositories';
import type { BaseAdapter } from '@nexora-protocol/sdk';
import type { RelayerPrivacyHubClient, UnshieldResult } from '../privacy/privacy-hub-client';

export interface WithdrawalSubmission {
  userId: string;
  token: string;
  amount: string;
  amountInBaseUnits: string;
  destinationChain: string;
  destinationToken: string;
  privacyLevel: 'none' | 'standard' | 'maximum';
  viewingKey?: {
    publicKey: string;
    privateKey: string;
  };
  recipient?: string;
  referenceId?: string;
}

export interface WithdrawalResult {
  withdrawalId: string;
  status: IntentStatus;
  swapId: string;
  depositAddress: string;
  destinationAddress: string;
  depositActions: any[];
  fee: number;
  amount: string;
  estimatedArrival?: string;
  freshAddress: string;
  referenceId?: string;
}

export interface WithdrawalStatusInfo {
  withdrawalId: string;
  status: IntentStatus;
  swapId?: string;
  unshieldTx?: {
    txHash: string;
    noteHash: string;
    recipient: string;
  };
  bridgeTx?: {
    swapId: string;
    status: string;
  };
  failReason?: string;
  createdAt: string;
  updatedAt: string;
}

export class WithdrawalService {
  private db: any;
  private baseAdapter: BaseAdapter;
  private privacyHub: RelayerPrivacyHubClient;

  constructor(
    _config: RelayerConfig,
    db: any,
    baseAdapter: BaseAdapter,
    privacyHub: RelayerPrivacyHubClient
  ) {
    this.db = db;
    this.baseAdapter = baseAdapter;
    this.privacyHub = privacyHub;
  }

  async processWithdrawal(submission: WithdrawalSubmission): Promise<WithdrawalResult> {
    const withdrawalId = this.generateWithdrawalId();

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      await repo.create({
        id: withdrawalId,
        userId: submission.userId,
        sourceChain: 'starknet',
        destinationChain: submission.destinationChain as any,
        sourceToken: submission.token,
        destinationToken: submission.destinationToken,
        amount: submission.amount,
        amountInBaseUnits: submission.amountInBaseUnits,
        destinationAddress: '',
        privacyLevel: submission.privacyLevel,
        viewingKey: submission.viewingKey,
        referenceId: submission.referenceId ?? withdrawalId,
        status: 'withdrawal_pending',
      });
    });

    console.log(`Processing withdrawal ${withdrawalId} for ${submission.amount} ${submission.token} to ${submission.destinationChain}`);

    try {
      const receipt = await this.baseAdapter.executeWithdrawal({
        token: submission.token,
        amount: Number(submission.amount),
        recipient: submission.recipient,
        privacyLevel: submission.privacyLevel,
        referenceId: submission.referenceId ?? withdrawalId,
      });

      await this.db.executeInTransaction(async (client: PoolClient) => {
        const repo = new IntentRepository(client);
        await repo.updateStatus(withdrawalId, 'awaiting_deposit');

        const swapRepo = new SwapRepository(client);
        await swapRepo.create({
          swap_id: receipt.swapId,
          intent_id: withdrawalId,
          source_network: 'STARKNET',
          source_token: receipt.sourceToken,
          destination_network: submission.destinationChain.toUpperCase(),
          destination_token: receipt.destinationToken,
          amount: String(receipt.amount),
          destination_address: receipt.destinationAddress,
          deposit_address: receipt.depositAddress,
          status: 'awaiting_deposit',
          fee: String(receipt.fee),
        });
      });

      return {
        withdrawalId,
        status: 'awaiting_deposit',
        swapId: receipt.swapId,
        depositAddress: receipt.depositAddress,
        destinationAddress: receipt.destinationAddress,
        depositActions: receipt.depositActions,
        fee: receipt.fee,
        amount: submission.amount,
        estimatedArrival: receipt.estimatedArrival,
        freshAddress: receipt.freshAddress,
        referenceId: submission.referenceId ?? withdrawalId,
      };
    } catch (error) {
      console.error(`Failed to process withdrawal ${withdrawalId}:`, error);
      await this.db.executeInTransaction(async (client: PoolClient) => {
        const repo = new IntentRepository(client);
        await repo.updateStatus(withdrawalId, 'failed', (error as Error).message);
      });
      throw error;
    }
  }

  async executeUnshield(withdrawalId: string, swapId: string): Promise<UnshieldResult> {
    let swap: any = null;
    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new SwapRepository(client);
      swap = await repo.getBySwapId(swapId);
    });

    if (!swap) {
      throw new Error(`Swap not found: ${swapId}`);
    }

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      await repo.updateStatus(withdrawalId, 'unshielding');
    });

    const amount = BigInt(swap.amount);
    const depositAddress = swap.deposit_address;
    const token = swap.source_token;

    const unshieldResult = await this.privacyHub.unshield(token, amount, depositAddress);

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new UnshieldTxRepository(client);
      await repo.create({
        id: randomUUID(),
        intent_id: withdrawalId,
        swap_id: swapId,
        token,
        amount: amount.toString(),
        tx_hash: unshieldResult.transactionHash,
        note_hash: unshieldResult.noteHash,
        recipient: depositAddress,
      });
    });

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new SwapRepository(client);
      await repo.updateStatus(swapId, 'awaiting_bridge');
    });

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      await repo.updateStatus(withdrawalId, 'bridging_out');
    });

    console.log(`Unshield completed for withdrawal ${withdrawalId}: ${unshieldResult.transactionHash}`);

    return unshieldResult;
  }

  async getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalStatusInfo | null> {
    let intent: any = null;
    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      intent = await repo.getById(withdrawalId);
    });

    if (!intent) return null;

    let swap: any = null;
    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new SwapRepository(client);
      swap = await repo.getByIntentId(withdrawalId);
    });

    let unshieldTx: { txHash: string; noteHash: string; recipient: string } | undefined;
    if (swap) {
      await this.db.executeInTransaction(async (client: PoolClient) => {
        const repo = new UnshieldTxRepository(client);
        const unshield = await repo.getByIntentId(withdrawalId);
        if (unshield) {
          unshieldTx = {
            txHash: unshield.tx_hash,
            noteHash: unshield.note_hash ?? '',
            recipient: unshield.recipient,
          };
        }
      });
    }

    return {
      withdrawalId,
      status: intent.status as IntentStatus,
      swapId: swap?.swap_id,
      unshieldTx,
      bridgeTx: swap
        ? {
            swapId: swap.swap_id,
            status: swap.status,
          }
        : undefined,
      failReason: intent.fail_reason ?? undefined,
      createdAt: intent.created_at,
      updatedAt: intent.updated_at,
    };
  }

  private generateWithdrawalId(): string {
    return `withdrawal_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }
}
