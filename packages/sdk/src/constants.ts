export const CHAIN_IDS = {
  MAINNET: '0x534e5f4d41494e',
  SEPOLIA: '0x534e5f5345504f4c4941',
} as const;

export const DEFAULT_RPC_URLS = {
  MAINNET: 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44',
  SEPOLIA: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44',
} as const;

export const POOL_ADDRESSES = {
  MAINNET: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
  SEPOLIA: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
} as const;

export const DOMAIN_NAME = 'Nexora Protocol';

export const BLOCK_IDENTIFIERS = ['latest', 'pending', 'pre_confirmed'] as const;

export type BlockIdentifier = (typeof BLOCK_IDENTIFIERS)[number];

export const DEFAULT_BLOCK_IDENTIFIER: BlockIdentifier = 'pre_confirmed';

export const DEFAULT_PROVER_TIMEOUT_MS = 120_000;
export const DEFAULT_INDEXER_TIMEOUT_MS = 30_000;
export const DEFAULT_TX_WAIT_TIMEOUT_MS = 120_000;

export function isChainId(value: string): value is keyof typeof CHAIN_IDS {
  return Object.values(CHAIN_IDS).includes(value as any);
}

export function getDefaultPoolAddress(chainId: string): string {
  if (chainId === CHAIN_IDS.MAINNET) return POOL_ADDRESSES.MAINNET;
  if (chainId === CHAIN_IDS.SEPOLIA) return POOL_ADDRESSES.SEPOLIA;
  return POOL_ADDRESSES.MAINNET;
}

export function getDefaultRpcUrl(chainId: string): string {
  if (chainId === CHAIN_IDS.SEPOLIA) return DEFAULT_RPC_URLS.SEPOLIA;
  return DEFAULT_RPC_URLS.MAINNET;
}
