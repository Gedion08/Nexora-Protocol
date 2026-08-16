export interface RelayerConfig {
  port: number;
  dbUrl: string;
  layerSwapApiKey: string;
  layerSwapApiUrl: string;
  starknetRpcUrl: string;
  starknetSepoliaRpcUrl: string;
  poolAddress: string;
  privacyHubAddress?: string;
  relayerPrivateKey: string;
  relayerStarknetAddress: string;
  relayerInventoryAddress: string;
  environment: 'MAINNET' | 'SEPOLIA';
  proverUrl?: string;
  indexerUrl?: string;
  paymasterRpcUrl?: string;
  paymasterAddress?: string;
  usdcTokenAddress: string;
  logLevel: string;
  pollIntervalMs: number;
  txWaitTimeoutMs: number;
  maxRetries: number;
}

export interface SharedConfig {
  relayer: RelayerConfig;
  starknet: {
    chainId: string;
    rpcUrl: string;
    poolAddress: string;
  };
  bridges: {
    layerSwapApiKey: string;
    layerSwapApiUrl: string;
  };
  database: {
    url: string;
  };
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): RelayerConfig {
  const environment = (process.env.NEXORA_ENV as 'MAINNET' | 'SEPOLIA') ?? 'MAINNET';

  const starknetRpcUrl =
    environment === 'SEPOLIA'
      ? getOptionalEnv('NEXT_PUBLIC_STARKNET_SEPOLIA_RPC_URL', 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44')
      : getOptionalEnv('NEXT_PUBLIC_STARKNET_RPC_URL', 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44');

  const poolAddress =
    environment === 'SEPOLIA'
      ? getOptionalEnv('NEXT_PUBLIC_SEPOLIA_POOL_ADDRESS', '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a')
      : getOptionalEnv('NEXT_PUBLIC_POOL_ADDRESS', '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');

  return {
    port: parseInt(getOptionalEnv('RELAYER_PORT', '3001'), 10),
    dbUrl: getOptionalEnv('RELAYER_DB_URL', 'postgres://postgres:postgres@localhost:5432/nexora_relayer'),
    layerSwapApiKey: getRequiredEnv('LAYERSWAP_API_KEY'),
    layerSwapApiUrl: getOptionalEnv('LAYERSWAP_API_URL', 'https://api.layerswap.io'),
    starknetRpcUrl,
    starknetSepoliaRpcUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44',
    poolAddress,
    privacyHubAddress: process.env.PRIVACY_HUB_ADDRESS,
    relayerPrivateKey: getRequiredEnv('RELAYER_PRIVATE_KEY'),
    relayerStarknetAddress: getRequiredEnv('RELAYER_STARKNET_ADDRESS'),
    relayerInventoryAddress: getOptionalEnv('RELAYER_INVENTORY_ADDRESS', ''),
    environment,
    proverUrl: process.env.NEXT_PUBLIC_PROVER_URL,
    indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL,
    paymasterRpcUrl: process.env.PAYMASTER_RPC_URL,
    paymasterAddress: process.env.PAYMASTER_ADDRESS,
    usdcTokenAddress: getOptionalEnv(
      'USDC_TOKEN_ADDRESS',
      environment === 'SEPOLIA'
        ? '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b8b'
        : '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b'
    ),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
    pollIntervalMs: parseInt(getOptionalEnv('POLL_INTERVAL_MS', '15000'), 10),
    txWaitTimeoutMs: parseInt(getOptionalEnv('TX_WAIT_TIMEOUT_MS', '120000'), 10),
    maxRetries: parseInt(getOptionalEnv('MAX_RETRIES', '3'), 10),
  };
}
