export const CHAIN_IDS = {
  ARBITRUM: 'arbitrum',
  STARKNET: 'starknet',
  BASE: 'base',
  ETHEREUM: 'ethereum',
  OPTIMISM: 'optimism',
} as const;

export const STRK20_POOL_ADDRESSES = {
  MAINNET: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
  SEPOLIA: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
} as const;

export const STRK20_CHAIN_IDS = {
  MAINNET: '0x534e5f4d41494e',
  SEPOLIA: '0x534e5f5345504f4c4941',
} as const;

export const DEFAULT_RPC_URLS = {
  STARKNET_MAINNET: 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44',
  STARKNET_SEPOLIA: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44',
  ARBITRUM_MAINNET: 'https://arb1.arbitrum.io/rpc',
  ARBITRUM_SEPOLIA: 'https://sepolia-rollup.arbitrum.com/rpc',
  BASE_MAINNET: 'https://mainnet.base.org',
  BASE_SEPOLIA: 'https://sepolia.base.org',
} as const;

export const TOKEN_ADDRESSES = {
  USDC: {
    ARBITRUM: '0xff970a64a88692d896ac9c78042d8b95b8d7c77e8d0a0a8b8b8b8b8b8b8b8b8',
    BASE: '0xdac11d5e5ebf6e6e7f8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b',
    STARKNET: '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b',
    STARKNET_SEPOLIA: '0x053c91253bc9682c04929ca02ed00b3e42340039d10f12a9d86e898b8b8b8b8b',
  },
  ETH: {
    ARBITRUM: '0x0000000000000000000000000000000000000000',
    BASE: '0x0000000000000000000000000000000000000000',
    STARKNET: '0x04718f8d74f5c5e8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8d8',
  },
} as const;

export const POLL_INTERVAL_MS = 10_000;
export const DEFAULT_POLL_TIMEOUT_MS = 600_000;
export const DEFAULT_BRIDGE_POLL_INTERVAL_MS = 15_000;
export const DEFAULT_DEPOSIT_POLL_INTERVAL_MS = 20_000;
export const DEFAULT_INVENTORY_REFRESH_INTERVAL_MS = 30_000;
export const DEFAULT_TX_WAIT_TIMEOUT_MS = 120_000;
export const MAX_RETRIES = 3;
export const RETRY_BACKOFF_MS = 1_000;

export const DOMAIN_NAME = 'Nexora Protocol';

export const EVENT_SIGNATURES = {
  ERC20_TRANSFER: '0xddf252ad1be2c89b69c2e6beef576e30d1b0ad6f2861348d0b5b6e9f5a4a4a4a',
  USDC_TRANSFER: '0xc1ecd2b9e2d3b5a4e5c1a3b4e1b7e2e9c4d6a7f8e9c0b3a4b5c6d7e8f9a0b1c2',
} as const;
