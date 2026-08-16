import {
  CrossChainFlow,
  CrossChainFlowConfig,
  StarknetAccountGenerator,
} from '../src';

const LAYERSWAP_API_KEY = process.env.LAYERSWAP_API_KEY || 'your-api-key';
const ARBITRUM_RPC = process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
const BASE_RPC = process.env.BASE_RPC || 'https://mainnet.base.org';
const STARKNET_RPC = process.env.STARKNET_RPC || 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44';
const POOL_ADDRESS = '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
const CHAIN_ID = '0x534e5f4d41494e';

async function main() {
  console.log('=== Nexora Cross-Chain Flow Demo ===\n');
  console.log('Flow: Arbitrum → Starknet → Base\n');

  const destinationAddress = process.argv[2] || '0xYourBaseAddress';
  const amount = parseFloat(process.argv[3] || '0.01');
  const useDeterministic = process.argv[4] === '--deterministic';

  console.log('Configuration:');
  console.log(`  Amount: ${amount} ETH`);
  console.log(`  Destination: ${destinationAddress}`);
  console.log(`  Deterministic account: ${useDeterministic ? 'yes (from MetaMask signature)' : 'no (random)'}`);
  console.log();

  const flowConfig: CrossChainFlowConfig = {
    arbitrumAdapter: {
      apiKey: LAYERSWAP_API_KEY,
      environment: 'MAINNET',
      sourceNetwork: 'ARBITRUM',
      destinationNetwork: 'STARKNET',
      defaultToken: 'ETH',
    },
    baseAdapter: {
      apiKey: LAYERSWAP_API_KEY,
      environment: 'MAINNET',
      sourceNetwork: 'STARKNET',
      destinationNetwork: 'BASE',
      defaultToken: 'USDC',
    },
    amount,
    destinationAddress,
  };

  const flow = new CrossChainFlow(flowConfig);

  try {
    let starknetAccount;
    if (useDeterministic) {
      console.log('Step 1: Generating deterministic Starknet account from MetaMask signature...');
      console.log('  (In production, this would use r,s from a MetaMask signature)');
      const mockR = 123456789012345678901234567890123456789012345678901234567890n;
      const mockS = 987654321098765432109876543210987654321098765432109876543210n;
      starknetAccount = await flow.generateFreshStarknetAccount(CHAIN_ID, POOL_ADDRESS, mockR, mockS);
    } else {
      console.log('Step 1: Generating fresh Starknet account...');
      starknetAccount = await flow.generateFreshStarknetAccount(CHAIN_ID, POOL_ADDRESS);
    }

    console.log(`  Starknet Address: ${starknetAccount.address}`);
    console.log(`  Public Key: ${starknetAccount.publicKey.slice(0, 20)}...`);
    console.log(`  Private Key: ${starknetAccount.privateKey.slice(0, 20)}...`);
    console.log();

    console.log('Step 2: Estimating fees for full flow...');
    const estimate = await flow.estimateFullFlow();
    console.log(`  Leg 1 (Arbitrum → Starknet):`);
    console.log(`    Receive Amount: ${estimate.leg1.receiveAmount} ${estimate.leg1.destinationToken}`);
    console.log(`    Fee: ${estimate.leg1.totalFee}`);
    console.log(`    Completion: ${estimate.leg1.avgCompletionTime}`);
    console.log(`  Leg 2 (Starknet → Base):`);
    console.log(`    Receive Amount: ${estimate.leg2.receiveAmount} ${estimate.leg2.destinationToken}`);
    console.log(`    Fee: ${estimate.leg2.totalFee}`);
    console.log(`    Completion: ${estimate.leg2.avgCompletionTime}`);
    console.log(`  Total Fee: ${estimate.totalFee}`);
    console.log();

    console.log('Step 3: Reserving bridge swaps...');
    const receipt = await flow.executeFullFlow(undefined, `demo-${Date.now()}`);
    console.log(`  Leg 1 Swap ID: ${receipt.leg1.swapId}`);
    console.log(`  Leg 1 Deposit Address: ${receipt.leg1.depositAddress}`);
    console.log(`  Leg 1 Destination: ${receipt.leg1.destinationAddress}`);
    console.log(`  Leg 2 Swap ID: ${receipt.leg2.swapId}`);
    console.log(`  Leg 2 Deposit Address: ${receipt.leg2.depositAddress}`);
    console.log(`  Leg 2 Destination: ${receipt.leg2.destinationAddress}`);
    console.log(`  Status: ${receipt.status}`);
    console.log();

    console.log('Step 4: Waiting for deposits...');
    console.log(`  Send ${amount} ${receipt.leg1.token} to: ${receipt.leg1.depositAddress}`);
    console.log(`  Expected arrival on Starknet: ${receipt.leg1.estimatedArrival}`);
    console.log(`  Expected arrival on Base: ${receipt.leg2.estimatedArrival}`);
    console.log();

    console.log('Step 5: Monitoring status...');
    const pollStatus = async () => {
      const status = await flow.getFullStatus();
      console.log(`  Overall: ${status.status}`);
      if (status.leg1) {
        console.log(`  Leg 1: ${status.leg1.status} (confirmations: ${status.leg1.confirmations}/${status.leg1.maxConfirmations})`);
      }
      if (status.leg2) {
        console.log(`  Leg 2: ${status.leg2.status} (confirmations: ${status.leg2.confirmations}/${status.leg2.maxConfirmations})`);
      }
      return status.status;
    };

    const checkStatus = async () => {
      const status = await pollStatus();
      if (status === 'completed') {
        console.log('\n=== Flow Complete ===');
        console.log(`  Starknet Account: ${starknetAccount.address}`);
        console.log(`  Base Destination: ${receipt.leg2.destinationAddress}`);
        process.exit(0);
      } else if (status === 'failed') {
        console.log('\n=== Flow Failed ===');
        process.exit(1);
      }
      setTimeout(checkStatus, 30000);
    };

    await checkStatus();
  } catch (error) {
    console.error('Flow error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
