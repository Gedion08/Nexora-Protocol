import type { RelayerConfig, IntentStatus, DepositAction, ChainId } from '@nexora-protocol/shared';
import type { Database } from '../db/connection';
import { IntentRepository, SwapRepository, DepositRepository, ShieldTxRepository } from '../db/repositories';
import type { LayerSwapRelayer } from '../bridge/layerswap-relayer';
import type { RelayerPrivacyHubClient } from '../privacy/privacy-hub-client';
import type { InventoryManager } from '../bridge/inventory';

export interface IntentSubmission {
  userId: string;
  sourceChain: ChainId;
  sourceToken: string;
  destinationChain: ChainId;
  destinationToken: string;
  amount: string;
  amountInBaseUnits: string;
  sourceAddress?: string;
  destinationAddress: string;
  privacyLevel: 'none' | 'standard' | 'maximum';
  refundAddress?: string;
  viewingKey?: {
    publicKey: string;
    privateKey: string;
  };
}

export interface IntentResult {
  intentId: string;
  status: IntentStatus;
  depositAddress: string;
  depositActions: DepositAction[];
  fee: number;
  estimatedArrival?: string;
  referenceId?: string;
}

export interface IntentStatusInfo {
  intentId: string;
  status: IntentStatus;
  swapId?: string;
  deposit?: {
    sourceTxHash?: string;
    amount: string;
    blockNumber?: number;
  };
  shieldTx?: {
    txHash: string;
    noteHash: string;
  };
  failReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundInfo {
  intentId: string;
  swapId: string;
  status: string;
  refundTxHash?: string;
}

export class E2EOrchestrator {
  private config: RelayerConfig;
  private db: Database;
  private intentRepo: IntentRepository;
  private swapRepo: SwapRepository;
  private depositRepo: DepositRepository;
  private shieldRepo: ShieldTxRepository;
  readonly bridge: LayerSwapRelayer;
  readonly privacyHub: RelayerPrivacyHubClient;
  readonly inventory: InventoryManager;

  constructor(
    config: RelayerConfig,
    db: Database,
    intentRepo: IntentRepository,
    swapRepo: SwapRepository,
    depositRepo: DepositRepository,
    shieldRepo: ShieldTxRepository,
    bridge: LayerSwapRelayer,
    privacyHub: RelayerPrivacyHubClient,
    inventory: InventoryManager
  ) {
    this.config = config;
    this.db = db;
    this.intentRepo = intentRepo;
    this.swapRepo = swapRepo;
    this.depositRepo = depositRepo;
    this.shieldRepo = shieldRepo;
    this.bridge = bridge;
    this.privacyHub = privacyHub;
    this.inventory = inventory;
  }

  async initialize(): Promise<void> {
    await this.privacyHub.initialize();
    console.log('E2E Orchestrator initialized');
  }

  async processIntent(submission: IntentSubmission): Promise<IntentResult> {
    const intentId = this.generateIntentId();

    await this.db.executeInTransaction(async (client) => {
      const repo = new IntentRepository(client);
      await repo.create({
        id: intentId,
        userId: submission.userId,
        sourceChain: submission.sourceChain,
        destinationChain: submission.destinationChain,
        sourceToken: submission.sourceToken,
        destinationToken: submission.destinationToken,
        amount: submission.amount,
        amountInBaseUnits: submission.amountInBaseUnits,
        sourceAddress: submission.sourceAddress,
        destinationAddress: submission.destinationAddress,
        privacyLevel: submission.privacyLevel,
        viewingKey: submission.viewingKey,
        refundAddress: submission.refundAddress,
        referenceId: intentId,
        status: 'pending',
      });
    });

    console.log(`Processing intent ${intentId} for ${submission.amount} ${submission.sourceToken}`);

    try {
      await this.inventory.reserve('starknet', 'USDC', BigInt(submission.amountInBaseUnits));

      await this.intentRepo.updateStatus(intentId, 'inventory_reserved');

      const limits = await this.bridge.getLimits(
        submission.sourceToken,
        submission.destinationToken,
        Number(submission.amount)
      );

      if (Number(submission.amount) < limits.min || (limits.max > 0 && Number(submission.amount) > limits.max)) {
        throw new Error(
          `Amount ${submission.amount} outside bridge limits [${limits.min}, ${limits.max}]`
        );
      }

      await this.intentRepo.updateStatus(intentId, 'bridge_reserved');

      const reservation = await this.bridge.reserveBridge(
        intentId,
        submission.sourceToken,
        submission.destinationToken,
        Number(submission.amount),
        submission.sourceAddress,
        submission.refundAddress,
        intentId
      );

      console.log(`Bridge reserved for intent ${intentId}: swap ${reservation.swapId}`);

      return {
        intentId,
        status: 'awaiting_deposit',
        depositAddress: reservation.depositAddress,
        depositActions: reservation.depositActions,
        fee: reservation.fee,
        estimatedArrival: this.estimateArrival(),
        referenceId: intentId,
      };
    } catch (error) {
      console.error(`Failed to process intent ${intentId}:`, error);
      await this.intentRepo.updateStatus(
        intentId,
        'failed',
        (error as Error).message
      );
      await this.inventory.release('starknet', 'USDC', BigInt(submission.amountInBaseUnits)).catch(() => {});
      throw error;
    }
  }

  async onDepositReceived(deposit: any): Promise<void> {
    console.log(`Processing deposit for intent ${deposit.intentId}`);

    const swap = await this.swapRepo.getBySwapId(deposit.swapId);
    if (!swap) {
      console.error(`No swap found for deposit: ${deposit.swapId}`);
      return;
    }

    await this.intentRepo.updateStatus(deposit.intentId, 'detected');

    const bridgeStatus = await this.bridge.getBridgeStatus(deposit.swapId);
    if (bridgeStatus.status !== 'completed' && bridgeStatus.status !== 'processing') {
      console.warn(`Bridge not completed yet for swap ${deposit.swapId}, status: ${bridgeStatus.status}`);
      return;
    }

    try {
      await this.intentRepo.updateStatus(deposit.intentId, 'shielding');

      const poolTokenAddress = this.config.poolAddress;
      const amount = deposit.amount;

      const intent = await this.intentRepo.getById(deposit.intentId);
      const viewingKey = intent?.viewing_key_pub
        ? { publicKey: intent.viewing_key_pub, privateKey: intent?.viewing_key_priv ?? '' }
        : undefined;

      const shieldResult = await this.privacyHub.shield(
        deposit.intentId,
        deposit.swapId,
        poolTokenAddress,
        amount,
        viewingKey
      );

      console.log(`Shield completed for intent ${deposit.intentId}: ${shieldResult.transactionHash}`);

      await this.shieldRepo.updateStatus(shieldResult.transactionHash, 'completed');
      await this.depositRepo.updateStatus(deposit.id, 'processed', shieldResult.transactionHash);
      await this.swapRepo.updateStatus(deposit.swapId, 'completed');
      await this.intentRepo.updateStatus(deposit.intentId, 'completed');
      await this.inventory.release('starknet', 'USDC', amount).catch(() => {});
    } catch (error) {
      console.error(`Shield failed for intent ${deposit.intentId}:`, error);
      await this.intentRepo.updateStatus(
        deposit.intentId,
        'failed',
        (error as Error).message
      );
    }
  }

  async processPendingDeposits(): Promise<void> {
    const pendingSwaps = await this.swapRepo.getPendingByDestinationAddress(this.config.relayerStarknetAddress);

    if (pendingSwaps.length === 0) return;

    await Promise.allSettled(
      pendingSwaps.map(async (swap) => {
        try {
          const bridgeStatus = await this.bridge.getBridgeStatus(swap.swap_id);
          if (bridgeStatus.status === 'completed') {
            const deposits = await this.depositRepo.getByIntentId(swap.intent_id);
            for (const deposit of deposits) {
              if (!deposit.shield_tx_hash) {
                await this.onDepositReceived({
                  id: deposit.id,
                  intentId: deposit.intent_id,
                  swapId: deposit.swap_id,
                  amount: BigInt(deposit.amount),
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing swap ${swap.swap_id}:`, error);
        }
      })
    );
  }

  async processFailedSwaps(): Promise<void> {
    const pendingSwaps = await this.swapRepo.getPendingByDestinationAddress(this.config.relayerStarknetAddress);

    if (pendingSwaps.length === 0) return;

    await Promise.allSettled(
      pendingSwaps.map(async (swap) => {
        try {
          const bridgeStatus = await this.bridge.getBridgeStatus(swap.swap_id);
          if (bridgeStatus.status === 'failed' || bridgeStatus.status === 'expired' || bridgeStatus.status === 'cancelled') {
            await this.refundIntent(swap.intent_id, swap.swap_id);
          }
        } catch (error) {
          console.error(`Error checking swap ${swap.swap_id} for refund:`, error);
        }
      })
    );
  }

  async refundIntent(intentId: string, swapId: string): Promise<RefundInfo> {
    console.log(`Refunding intent ${intentId}, swap ${swapId}`);

    await this.intentRepo.updateStatus(intentId, 'refunding');

    const refundResult = await this.bridge.refundBridge(swapId);

    const intent = await this.intentRepo.getById(intentId);
    if (intent?.refund_address) {
      console.log(`Refund processed for intent ${intentId}: ${refundResult.refundTxHash ?? 'pending'}`);
    }

    await this.inventory.release('starknet', 'USDC', BigInt(intent?.amount_in_base_units ?? '0')).catch(() => {});

    await this.intentRepo.updateStatus(intentId, 'refunded');

    return {
      intentId,
      swapId,
      status: 'refunded',
      refundTxHash: refundResult.refundTxHash,
    };
  }

  async cancelIntent(intentId: string): Promise<{ intentId: string; status: string }> {
    const intent = await this.intentRepo.getById(intentId);
    if (!intent) {
      throw new Error('Intent not found');
    }

    const nonCancellable = new Set(['completed', 'failed', 'cancelled', 'refunded']);
    if (nonCancellable.has(intent.status)) {
      throw new Error(`Cannot cancel intent in status: ${intent.status}`);
    }

    await this.inventory.release('starknet', 'USDC', BigInt(intent.amount_in_base_units)).catch(() => {});

    await this.intentRepo.updateStatus(intentId, 'cancelled');

    return { intentId, status: 'cancelled' };
  }

  async getIntentStatus(intentId: string): Promise<IntentStatusInfo | null> {
    const intent = await this.intentRepo.getById(intentId);
    if (!intent) return null;

    const swap = await this.swapRepo.getByIntentId(intentId);
    const deposits = await this.depositRepo.getByIntentId(intentId);

    let shieldTx: { txHash: string; noteHash: string } | undefined;
    if (swap) {
      const shield = await this.shieldRepo.getByIntentId(intentId);
      if (shield) {
        shieldTx = { txHash: shield.tx_hash, noteHash: shield.note_hash ?? '' };
      }
    }

    return {
      intentId,
      status: intent.status as IntentStatus,
      swapId: swap?.swap_id,
      deposit: deposits.length > 0
        ? {
            sourceTxHash: deposits[0].source_tx_hash,
            amount: deposits[0].amount,
            blockNumber: parseInt(deposits[0].block_number, 10),
          }
        : undefined,
      shieldTx,
      failReason: intent.fail_reason ?? undefined,
      createdAt: intent.created_at,
      updatedAt: intent.updated_at,
    };
  }

  async getHealth(): Promise<{
    database: boolean;
    bridge: boolean;
    inventory: boolean;
    account: boolean;
  }> {
    const dbHealthy = await this.db.healthCheck();
    let bridgeHealthy = false;
    try {
      await this.bridge.checkHealth();
      bridgeHealthy = true;
    } catch {
      bridgeHealthy = false;
    }
    const inventoryHealthy = await this.inventory.isHealthy();
    const accountHealthy = this.privacyHub.isInitialized();

    return {
      database: dbHealthy,
      bridge: bridgeHealthy,
      inventory: inventoryHealthy,
      account: accountHealthy,
    };
  }

  private generateIntentId(): string {
    return `intent_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private estimateArrival(): string {
    const now = Date.now();
    return new Date(now + 120_000).toISOString();
  }
}
