import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it('should load default config with required env vars', () => {
    process.env.NEXORA_ENV = 'MAINNET';
    process.env.LAYERSWAP_API_KEY = 'test-key';
    process.env.RELAYER_PRIVATE_KEY = '0x123';
    process.env.RELAYER_STARKNET_ADDRESS = '0x456';

    const config = loadConfig();

    expect(config.environment).toBe('MAINNET');
    expect(config.layerSwapApiKey).toBe('test-key');
    expect(config.relayerPrivateKey).toBe('0x123');
    expect(config.relayerStarknetAddress).toBe('0x456');
    expect(config.port).toBe(3001);
    expect(config.pollIntervalMs).toBe(15000);
    expect(config.txWaitTimeoutMs).toBe(120000);
    expect(config.maxRetries).toBe(3);
  });

  it('should use SEPOLIA defaults when NEXORA_ENV is SEPOLIA', () => {
    process.env.NEXORA_ENV = 'SEPOLIA';
    process.env.LAYERSWAP_API_KEY = 'test-key';
    process.env.RELAYER_PRIVATE_KEY = '0x123';
    process.env.RELAYER_STARKNET_ADDRESS = '0x456';

    const config = loadConfig();

    expect(config.environment).toBe('SEPOLIA');
    expect(config.starknetRpcUrl).toContain('sepolia');
    expect(config.poolAddress).toBe('0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a');
  });

  it('should use custom env overrides when provided', () => {
    process.env.NEXORA_ENV = 'MAINNET';
    process.env.LAYERSWAP_API_KEY = 'custom-key';
    process.env.RELAYER_PRIVATE_KEY = '0xabc';
    process.env.RELAYER_STARKNET_ADDRESS = '0xdef';
    process.env.RELAYER_PORT = '4000';
    process.env.RELAYER_DB_URL = 'postgres://custom:pass@localhost:5432/custom';
    process.env.LAYERSWAP_API_URL = 'https://custom.layerswap.io';
    process.env.POLL_INTERVAL_MS = '5000';
    process.env.TX_WAIT_TIMEOUT_MS = '60000';
    process.env.MAX_RETRIES = '5';

    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.dbUrl).toBe('postgres://custom:pass@localhost:5432/custom');
    expect(config.layerSwapApiUrl).toBe('https://custom.layerswap.io');
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.txWaitTimeoutMs).toBe(60000);
    expect(config.maxRetries).toBe(5);
  });

  it('should throw when required env vars are missing', () => {
    process.env = {};
    delete process.env.LAYERSWAP_API_KEY;
    delete process.env.RELAYER_PRIVATE_KEY;
    delete process.env.RELAYER_STARKNET_ADDRESS;

    expect(() => loadConfig()).toThrow();
  });
});
