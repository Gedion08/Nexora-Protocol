import 'dotenv/config';
import process from 'process';
import { loadConfig } from '@nexora-protocol/shared';
import { Database } from './db/connection';
import { MigrationRunner } from './db/migrate';
import { InventoryManager } from './bridge/inventory';
import { DepositEventListener } from './bridge/deposit-listener';
import { LayerSwapRelayer } from './bridge/layerswap-relayer';
import { BaseAdapter } from '@nexora-protocol/sdk';
import { RelayerPrivacyHubClient } from './privacy/privacy-hub-client';
import { E2EOrchestrator } from './flow/e2e-flow';
import { WithdrawalService } from './flow/withdrawal-flow';
import { RelayerApiServer } from './api/server';
import { IntentRepository, SwapRepository, DepositRepository, ShieldTxRepository, InventoryRepository } from './db/repositories';

let shuttingDown = false;

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('=== Nexora Protocol Relayer ===');
  console.log(`Environment: ${config.environment}`);
  console.log(`Starknet RPC: ${config.starknetRpcUrl}`);
  console.log(`Pool: ${config.poolAddress}`);
  console.log(`Relayer: ${config.relayerStarknetAddress}`);

  const db = new Database(config);

  const migrationRunner = new MigrationRunner(db);
  const migrationResult = await migrationRunner.up();
  if (migrationResult.applied.length > 0) {
    console.log(`Migrations applied: ${migrationResult.applied.join(', ')}`);
  }

  const txClient = await db.getClient();

  const intentRepo = new IntentRepository(txClient);
  const swapRepo = new SwapRepository(txClient);
  const depositRepo = new DepositRepository(txClient);
  const shieldRepo = new ShieldTxRepository(txClient);
  const inventoryRepo = new InventoryRepository(txClient);

  const inventory = new InventoryManager(config, db, inventoryRepo);
  await inventory.initialize();

  const privacyHub = new RelayerPrivacyHubClient(config, db);
  await privacyHub.initialize();

  const bridge = new LayerSwapRelayer(config, db);
  await bridge.checkHealth();
  console.log('LayerSwap bridge connected');

  const baseAdapter = new BaseAdapter({
    apiKey: config.layerSwapApiKey,
    baseUrl: config.layerSwapApiUrl,
    environment: config.environment,
    timeoutMs: config.txWaitTimeoutMs,
  });

  const depositListener = new DepositEventListener(config, db, depositRepo, swapRepo);

  const orchestrator = new E2EOrchestrator(
    config,
    db,
    intentRepo,
    swapRepo,
    depositRepo,
    shieldRepo,
    bridge,
    privacyHub,
    inventory
  );

  const withdrawalService = new WithdrawalService(config, db, baseAdapter, privacyHub);

  depositListener.setCallback(async (deposit) => {
    console.log(`Deposit callback: ${deposit.amount} USDC for intent ${deposit.intentId}`);
    try {
      await orchestrator.onDepositReceived({
        id: deposit.id,
        intentId: deposit.intentId,
        swapId: deposit.swapId,
        amount: deposit.amount,
      });
    } catch (error) {
      console.error('Failed to process deposit via callback:', error);
    }
  });

  await depositListener.start();
  console.log('Deposit listener started');

  const server = new RelayerApiServer({
    config,
    db,
    orchestrator,
    depositListener,
    inventory,
    baseAdapter,
    withdrawalService,
  });

  server.listen();

  setInterval(() => {
    orchestrator.processPendingDeposits().catch((err) => {
      console.error('Background deposit processing error:', err);
    });
  }, 30_000);

  setInterval(() => {
    orchestrator.processFailedSwaps().catch((err) => {
      console.error('Background refund processing error:', err);
    });
  }, 60_000);

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down...`);

    try {
      await depositListener.stop();
      inventory.stopAutoRefresh();
      await server.close();
      await db.close();
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
