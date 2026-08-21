import type { RelayerConfig } from '@nexora-protocol/shared';
import type { PoolClient } from 'pg';
import { IntentRepository } from '../db/repositories';
import type { RelayerPrivacyHubClient } from '../privacy/privacy-hub-client';

export interface PrivateTransferSubmission {
  userId: string;
  token: string;
  amount: string;
  viewingKey: {
    publicKey: string;
    privateKey: string;
  };
  recipient: string;
  referenceId?: string;
}

export interface PrivateTransferResult {
  transferId: string;
  status: string;
  txHash: string;
  nullifier: string;
  amount: string;
  token: string;
  recipient: string;
  referenceId?: string;
}

export interface PrivateTransferStatus {
  transferId: string;
  status: string;
  txHash?: string;
  nullifier?: string;
  recipient?: string;
  failReason?: string;
  createdAt: string;
  updatedAt: string;
}

export class PrivateTransferService {
  private db: any;
  private privacyHub: RelayerPrivacyHubClient;

  constructor(_config: RelayerConfig, db: any, privacyHub: RelayerPrivacyHubClient) {
    this.db = db;
    this.privacyHub = privacyHub;
  }

  async processTransfer(submission: PrivateTransferSubmission): Promise<PrivateTransferResult> {
    const transferId = this.generateTransferId();
    const amountBaseUnits = this.toBaseUnits(submission.amount, submission.token);

    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      await repo.create({
        id: transferId,
        userId: submission.userId,
        sourceChain: 'starknet',
        destinationChain: 'starknet',
        sourceToken: submission.token,
        destinationToken: submission.token,
        amount: submission.amount,
        amountInBaseUnits: amountBaseUnits,
        sourceAddress: '',
        destinationAddress: submission.recipient,
        privacyLevel: 'maximum',
        viewingKey: submission.viewingKey,
        referenceId: submission.referenceId ?? transferId,
        status: 'pending',
      });
    });

    console.log(`Processing private transfer ${transferId} for ${submission.amount} ${submission.token}`);

    try {
      const amountBigInt = BigInt(amountBaseUnits);
      const hubResult = await this.privacyHub.privateTransfer(
        submission.token,
        amountBigInt,
        submission.recipient,
        submission.viewingKey
      );

      await this.db.executeInTransaction(async (client: PoolClient) => {
        const repo = new IntentRepository(client);
        await repo.updateStatus(transferId, 'completed');
      });

      return {
        transferId,
        status: 'completed',
        txHash: hubResult.transactionHash,
        nullifier: hubResult.nullifier,
        amount: submission.amount,
        token: submission.token,
        recipient: submission.recipient,
        referenceId: submission.referenceId ?? transferId,
      };
    } catch (error) {
      console.error(`Private transfer ${transferId} failed:`, error);
      await this.db.executeInTransaction(async (client: PoolClient) => {
        const repo = new IntentRepository(client);
        await repo.updateStatus(transferId, 'failed', (error as Error).message);
      });
      throw error;
    }
  }

  async getTransferStatus(transferId: string): Promise<PrivateTransferStatus | null> {
    let intent: any = null;
    await this.db.executeInTransaction(async (client: PoolClient) => {
      const repo = new IntentRepository(client);
      intent = await repo.getById(transferId);
    });

    if (!intent) return null;

    return {
      transferId,
      status: intent.status,
      recipient: intent.destination_address,
      failReason: intent.fail_reason ?? undefined,
      createdAt: intent.created_at,
      updatedAt: intent.updated_at,
    };
  }

  private generateTransferId(): string {
    return `transfer_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private toBaseUnits(amount: string, token: string): string {
    const decimals = token.toUpperCase() === 'USDC' || token.toUpperCase() === 'USDT' ? 6 : 18;
    const factor = BigInt(10) ** BigInt(decimals);
    const numAmount = parseFloat(amount);
    return (BigInt(Math.round(numAmount * Number(factor)))).toString();
  }
}
