import express, { type Express, type Request, type Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import type { RelayerConfig } from '@nexora-protocol/shared';
import type { Database } from '../db/connection';
import { SwapRepository } from '../db/repositories';
import type { E2EOrchestrator } from '../flow/e2e-flow';
import type { DepositEventListener } from '../bridge/deposit-listener';
import type { InventoryManager } from '../bridge/inventory';
import type { BaseAdapter } from '@nexora-protocol/sdk';
import type { WithdrawalService } from '../flow/withdrawal-flow';
import { randomUUID } from 'crypto';

export interface ApiDependencies {
  config: RelayerConfig;
  db: Database;
  orchestrator: E2EOrchestrator;
  depositListener: DepositEventListener;
  inventory: InventoryManager;
  baseAdapter: BaseAdapter;
  withdrawalService: WithdrawalService;
}

export class RelayerApiServer {
  private app: Express;
  private config: RelayerConfig;
  private deps: ApiDependencies;
  private isShuttingDown = false;

  constructor(deps: ApiDependencies) {
    this.config = deps.config;
    this.deps = deps;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: true,
    }));
    this.app.use(helmet());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(morgan(this.config.logLevel === 'debug' ? 'dev' : 'combined'));
  }

  private setupRoutes(): void {
    this.app.get('/health', this.handleHealth.bind(this));
    this.app.get('/health/live', this.handleLiveness.bind(this));
    this.app.get('/health/ready', this.handleReadiness.bind(this));

    this.app.post('/intents', this.handleSubmitIntent.bind(this));
    this.app.get('/intents/:id', this.handleGetIntent.bind(this));
    this.app.post('/intents/:id/cancel', this.handleCancelIntent.bind(this));
    this.app.post('/intents/:id/refund', this.handleRefundIntent.bind(this));

    this.app.get('/inventory', this.handleGetInventory.bind(this));
    this.app.get('/inventory/:token', this.handleGetTokenInventory.bind(this));

    this.app.post('/withdrawals', this.handleSubmitWithdrawal.bind(this));
    this.app.get('/withdrawals/:id', this.handleGetWithdrawal.bind(this));
    this.app.post('/withdrawals/:id/unshield', this.handleExecuteUnshield.bind(this));

    this.app.post('/webhooks/layerswap', this.handleLayerSwapWebhook.bind(this));

    this.app.get('/quotes', this.handleGetQuote.bind(this));

    this.app.get('/info/tokens', this.handleGetTokens.bind(this));

    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'Nexora Protocol Relayer',
        version: '0.1.0',
        status: 'running',
        endpoints: {
          health: '/health',
          intents: '/intents',
          withdrawals: '/withdrawals',
          inventory: '/inventory',
          quotes: '/quotes',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'internal_server_error',
        message: err.message,
        requestId: randomUUID(),
      });
    });
  }

  private async handleHealth(_req: Request, res: Response): Promise<void> {
    const health = await this.deps.orchestrator.getHealth();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: health,
    });
  }

  private async handleLiveness(_req: Request, res: Response): Promise<void> {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
  }

  private async handleReadiness(_req: Request, res: Response): Promise<void> {
    if (this.isShuttingDown) {
      res.status(503).json({ status: 'shutting_down' });
      return;
    }
    const health = await this.deps.orchestrator.getHealth();
    if (health.database && health.account) {
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not_ready', services: health });
    }
  }

  private async handleSubmitIntent(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        sourceChain,
        sourceToken,
        destinationChain,
        destinationToken,
        amount,
        amountInBaseUnits,
        sourceAddress,
        destinationAddress,
        privacyLevel,
        refundAddress,
        viewingKey,
      } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'user_id is required' });
        return;
      }
      if (!sourceChain || !sourceToken) {
        res.status(400).json({ error: 'sourceChain and sourceToken are required' });
        return;
      }
      if (!amount || Number(amount) <= 0) {
        res.status(400).json({ error: 'amount must be greater than zero' });
        return;
      }
      if (!destinationChain || !destinationToken) {
        res.status(400).json({ error: 'destinationChain and destinationToken are required' });
        return;
      }
      if (!destinationAddress) {
        res.status(400).json({ error: 'destinationAddress is required' });
        return;
      }

      const result = await this.deps.orchestrator.processIntent({
        userId,
        sourceChain,
        sourceToken,
        destinationChain,
        destinationToken,
        amount: String(amount),
        amountInBaseUnits: amountInBaseUnits ? String(amountInBaseUnits) : this.toBaseUnits(amount, sourceToken),
        sourceAddress,
        destinationAddress,
        privacyLevel: privacyLevel ?? 'standard',
        refundAddress,
        viewingKey,
      });

      res.status(201).json({
        intentId: result.intentId,
        status: result.status,
        depositAddress: result.depositAddress,
        depositActions: result.depositActions,
        fee: result.fee,
        estimatedArrival: result.estimatedArrival,
        referenceId: result.referenceId,
      });
    } catch (error: any) {
      console.error('Failed to submit intent:', error);
      res.status(400).json({
        error: 'intent_submission_failed',
        message: error.message,
      });
    }
  }

  private async handleGetIntent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const status = await this.deps.orchestrator.getIntentStatus(id);

      if (!status) {
        res.status(404).json({ error: 'intent_not_found', intentId: id });
        return;
      }

      res.json(status);
    } catch (error: any) {
      console.error('Failed to get intent:', error);
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  }

  private async handleRefundIntent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const intent = await this.deps.orchestrator.getIntentStatus(id);

      if (!intent) {
        res.status(404).json({ error: 'intent_not_found', intentId: id });
        return;
      }

      if (intent.status === 'refunded') {
        res.status(400).json({ error: 'intent_already_refunded', intentId: id });
        return;
      }

      const refundInfo = await this.deps.orchestrator.refundIntent(id, intent.swapId ?? '');

      res.json({
        intentId: refundInfo.intentId,
        status: refundInfo.status,
        refundTxHash: refundInfo.refundTxHash,
      });
    } catch (error: any) {
      console.error('Failed to refund intent:', error);
      res.status(500).json({ error: 'refund_failed', message: error.message });
    }
  }

  private async handleCancelIntent(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    res.status(501).json({
      error: 'not_implemented',
      message: 'Intent cancellation is not yet supported',
      intentId: id,
    });
  }

  private async handleGetInventory(_req: Request, res: Response): Promise<void> {
    try {
      const inventories = await this.deps.inventory.getAllInventories();
      res.json({
        inventories: inventories.map((inv) => ({
          chain: inv.chain,
          token: inv.token,
          totalBalance: inv.totalBalance.toString(),
          reservedBalance: inv.reservedBalance.toString(),
          availableBalance: inv.availableBalance.toString(),
          tokenAddress: inv.tokenAddress,
          lastRefreshed: inv.lastRefreshed,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  }

  private async handleGetTokenInventory(req: Request, res: Response): Promise<void> {
    const { token } = req.params;
    try {
      const available = await this.deps.inventory.getAvailable('starknet', token.toUpperCase());
      const total = await this.deps.inventory.getTotal('starknet', token.toUpperCase());
      const reserved = await this.deps.inventory.getReserved('starknet', token.toUpperCase());
      res.json({
        chain: 'starknet',
        token: token.toUpperCase(),
        totalBalance: total.toString(),
        reservedBalance: reserved.toString(),
        availableBalance: available.toString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  }

  private async handleLayerSwapWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { swap_id, status, output_transaction_hash } = req.body;

      if (!swap_id) {
        res.status(400).json({ error: 'swap_id is required' });
        return;
      }

      const swap = await this.deps.db.executeInTransaction(async (client) => {
      const repo = new SwapRepository(client);
        const s = await repo.getBySwapId(swap_id);
        if (s) {
          await repo.updateStatus(swap_id, status);
        }
        return s;
      });

      if (!swap) {
        res.status(404).json({ error: 'swap_not_found', swapId: swap_id });
        return;
      }

      if (status === 'completed' && output_transaction_hash) {
        res.json({ message: 'deposit_processing_started' });
        return;
      }

      res.json({ swapId: swap_id, status: status ?? 'unknown' });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'webhook_error', message: error.message });
    }
  }

  private async handleGetQuote(req: Request, res: Response): Promise<void> {
    try {
      const { sourceToken, destinationToken, amount } = req.query;

      if (!sourceToken || !destinationToken || !amount) {
        res.status(400).json({ error: 'sourceToken, destinationToken, and amount are required' });
        return;
      }

      const numAmount = Number(amount);
      const quote = await this.deps.orchestrator['bridge'].estimateFee(
        String(sourceToken),
        String(destinationToken),
        numAmount
      );

      const limits = await this.deps.orchestrator['bridge'].getLimits(
        String(sourceToken),
        String(destinationToken),
        numAmount
      );

      res.json({
        quote,
        limits,
        amount: numAmount,
        receiveAmount: quote.receiveAmount,
        totalFee: quote.totalFee,
        estimatedTime: quote.avgCompletionTime,
      });
    } catch (error: any) {
      console.error('Quote error:', error);
      res.status(500).json({ error: 'quote_error', message: error.message });
    }
  }

  private async handleGetTokens(_req: Request, res: Response): Promise<void> {
    res.json({
      source: {
        chain: 'arbitrum',
        tokens: ['USDC', 'USDT', 'ETH'],
      },
      destination: {
        chain: 'starknet',
        tokens: ['USDC', 'ETH'],
      },
    });
  }

  private async handleSubmitWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        token,
        amount,
        amountInBaseUnits,
        destinationChain,
        destinationToken,
        privacyLevel,
        viewingKey,
        recipient,
        referenceId,
      } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'user_id is required' });
        return;
      }
      if (!token || !amount || Number(amount) <= 0) {
        res.status(400).json({ error: 'token and amount are required' });
        return;
      }
      if (!destinationChain || !destinationToken) {
        res.status(400).json({ error: 'destinationChain and destinationToken are required' });
        return;
      }

      const result = await this.deps.withdrawalService.processWithdrawal({
        userId,
        token,
        amount: String(amount),
        amountInBaseUnits: amountInBaseUnits ? String(amountInBaseUnits) : this.toBaseUnits(amount, token),
        destinationChain,
        destinationToken,
        privacyLevel: privacyLevel ?? 'standard',
        viewingKey,
        recipient,
        referenceId,
      });

      res.status(201).json({
        withdrawalId: result.withdrawalId,
        status: result.status,
        swapId: result.swapId,
        depositAddress: result.depositAddress,
        destinationAddress: result.destinationAddress,
        depositActions: result.depositActions,
        fee: result.fee,
        estimatedArrival: result.estimatedArrival,
        freshAddress: result.freshAddress,
        referenceId: result.referenceId,
      });
    } catch (error: any) {
      console.error('Failed to submit withdrawal:', error);
      res.status(400).json({
        error: 'withdrawal_submission_failed',
        message: error.message,
      });
    }
  }

  private async handleGetWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const status = await this.deps.withdrawalService.getWithdrawalStatus(id);

      if (!status) {
        res.status(404).json({ error: 'withdrawal_not_found', withdrawalId: id });
        return;
      }

      res.json(status);
    } catch (error: any) {
      console.error('Failed to get withdrawal:', error);
      res.status(500).json({ error: 'internal_error', message: error.message });
    }
  }

  private async handleExecuteUnshield(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { swapId } = req.body;

      if (!swapId) {
        res.status(400).json({ error: 'swapId is required' });
        return;
      }

      const unshieldResult = await this.deps.withdrawalService.executeUnshield(id, swapId);

      res.json({
        withdrawalId: id,
        unshieldTxHash: unshieldResult.transactionHash,
        noteHash: unshieldResult.noteHash,
        recipient: unshieldResult.recipient,
        status: 'unshielded',
      });
    } catch (error: any) {
      console.error('Failed to execute unshield:', error);
      res.status(500).json({ error: 'unshield_failed', message: error.message });
    }
  }

  private toBaseUnits(amount: string | number, token: string): string {
    const numAmount = Number(amount);
    const decimals = token.toUpperCase() === 'USDC' || token.toUpperCase() === 'USDT' ? 6 : 18;
    return (numAmount * Math.pow(10, decimals)).toString();
  }

  listen(): void {
    const port = this.config.port;
    this.app.listen(port, () => {
      console.log(`Relayer API server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
    });
  }

  getApp(): Express {
    return this.app;
  }

  async close(): Promise<void> {
    this.isShuttingDown = true;
  }
}
