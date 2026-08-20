import { describe, it, expect } from 'vitest';
import {
  CHAIN_IDS,
  DEFAULT_RPC_URLS,
  POOL_ADDRESSES,
  DOMAIN_NAME,
  DEFAULT_BLOCK_IDENTIFIER,
  DEFAULT_PROVER_TIMEOUT_MS,
  DEFAULT_INDEXER_TIMEOUT_MS,
  DEFAULT_TX_WAIT_TIMEOUT_MS,
  BLOCK_IDENTIFIERS,
  isChainId,
  getDefaultPoolAddress,
  getDefaultRpcUrl,
} from '../src/constants';

describe('CHAIN_IDS', () => {
  it('should have MAINNET chain ID', () => {
    expect(CHAIN_IDS.MAINNET).toBe('0x534e5f4d41494e');
  });

  it('should have SEPOLIA chain ID', () => {
    expect(CHAIN_IDS.SEPOLIA).toBe('0x534e5f5345504f4c4941');
  });
});

describe('DEFAULT_RPC_URLS', () => {
  it('should have mainnet RPC URL', () => {
    expect(DEFAULT_RPC_URLS.MAINNET).toContain('starknet');
  });

  it('should have sepolia RPC URL', () => {
    expect(DEFAULT_RPC_URLS.SEPOLIA).toContain('sepolia');
  });
});

describe('POOL_ADDRESSES', () => {
  it('should have mainnet pool address', () => {
    expect(POOL_ADDRESSES.MAINNET).toBe('0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');
  });

  it('should have sepolia pool address', () => {
    expect(POOL_ADDRESSES.SEPOLIA).toBe('0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');
  });
});

describe('DOMAIN_NAME', () => {
  it('should be Nexora Protocol', () => {
    expect(DOMAIN_NAME).toBe('Nexora Protocol');
  });
});

describe('DEFAULT_BLOCK_IDENTIFIER', () => {
  it('should be pre_confirmed', () => {
    expect(DEFAULT_BLOCK_IDENTIFIER).toBe('pre_confirmed');
  });
});

describe('Timeout constants', () => {
  it('should have prover timeout', () => {
    expect(DEFAULT_PROVER_TIMEOUT_MS).toBe(120000);
  });

  it('should have indexer timeout', () => {
    expect(DEFAULT_INDEXER_TIMEOUT_MS).toBe(30000);
  });

  it('should have tx wait timeout', () => {
    expect(DEFAULT_TX_WAIT_TIMEOUT_MS).toBe(120000);
  });
});

describe('BLOCK_IDENTIFIERS', () => {
  it('should contain latest, pending, pre_confirmed', () => {
    expect(BLOCK_IDENTIFIERS).toContain('latest');
    expect(BLOCK_IDENTIFIERS).toContain('pending');
    expect(BLOCK_IDENTIFIERS).toContain('pre_confirmed');
  });
});

describe('isChainId', () => {
  it('should return true for MAINNET', () => {
    expect(isChainId(CHAIN_IDS.MAINNET)).toBe(true);
  });

  it('should return true for SEPOLIA', () => {
    expect(isChainId(CHAIN_IDS.SEPOLIA)).toBe(true);
  });

  it('should return false for unknown chain ID', () => {
    expect(isChainId('0xunknown')).toBe(false);
  });
});

describe('getDefaultPoolAddress', () => {
  it('should return mainnet pool address for SN_MAIN', () => {
    const result = getDefaultPoolAddress(CHAIN_IDS.MAINNET);
    expect(result).toBe(POOL_ADDRESSES.MAINNET);
  });

  it('should return sepolia pool address for SN_SEPOLIA', () => {
    const result = getDefaultPoolAddress(CHAIN_IDS.SEPOLIA);
    expect(result).toBe(POOL_ADDRESSES.SEPOLIA);
  });

  it('should throw for unknown chain', () => {
    expect(() => getDefaultPoolAddress('0xunknown')).toThrow('Unsupported chain ID: 0xunknown');
  });
});

describe('getDefaultRpcUrl', () => {
  it('should return mainnet RPC for SN_MAIN', () => {
    const result = getDefaultRpcUrl(CHAIN_IDS.MAINNET);
    expect(result).toBe(DEFAULT_RPC_URLS.MAINNET);
  });

  it('should return sepolia RPC for SN_SEPOLIA', () => {
    const result = getDefaultRpcUrl(CHAIN_IDS.SEPOLIA);
    expect(result).toBe(DEFAULT_RPC_URLS.SEPOLIA);
  });

  it('should throw for unknown chain', () => {
    expect(() => getDefaultRpcUrl('0xunknown')).toThrow('Unsupported chain ID: 0xunknown');
  });
});
