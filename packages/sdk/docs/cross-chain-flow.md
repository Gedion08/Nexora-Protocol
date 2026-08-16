# Arbitrum → Starknet → Base Flow

## Overview

The Nexora cross-chain flow enables seamless bridging of assets from Arbitrum through Starknet to Base using the LayerSwap API. This document describes the full flow, deterministic Starknet account generation, and usage instructions.

## Architecture

```
┌─────────────┐     LayerSwap      ┌─────────────┐     LayerSwap      ┌─────────────┐
│   Arbitrum   │ ──────────────────▶│   Starknet  │ ──────────────────▶│     Base    │
│   (EVM)     │    Leg 1 Bridge    │  (Account)  │    Leg 2 Bridge    │   (EVM)     │
└─────────────┘                    └─────────────┘                    └─────────────┘
```

## Components

### 1. Arbitrum Adapter (`ArbitrumAdapter`)

Handles bridging from Arbitrum to Starknet via LayerSwap.

- **Source Network**: `ARBITRUM_MAINNET` / `ARBITRUM_SEPOLIA`
- **Destination Network**: `STARKNET_MAINNET` / `STARKNET_SEPOLIA`
- **Default Token**: `ETH`

### 2. Starknet Account Generator (`StarknetAccountGenerator`)

Generates deterministic or random Starknet accounts for use as intermediate destinations.

#### Deterministic Generation (MetaMask Compatible)

Given an EVM signature `(r, s)` from MetaMask on Arbitrum, a deterministic Starknet account can be derived:

```typescript
import { StarknetAccountGenerator } from '@nexora-protocol/sdk';

const account = StarknetAccountGenerator.fromSignature({
  r: signature.r,
  s: signature.s,
  chainId: '0x534e5f4d41494e', // Starknet MAINNET
  poolAddress: '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
});

console.log(account.address);    // 0x...
console.log(account.publicKey);   // 0x...
console.log(account.privateKey);  // 0x...
```

The derivation uses `keccak256(r:s:chainId:poolAddress)` as the private key seed, ensuring the same MetaMask signature always produces the same Starknet account.

#### Random Generation

For testing or non-MetaMask flows:

```typescript
const account = StarknetAccountGenerator.generateRandom();
```

### 3. Base Adapter (`BaseAdapter`)

Handles bridging from Starknet to Base via LayerSwap.

- **Source Network**: `STARKNET_MAINNET` / `STARKNET_SEPOLIA`
- **Destination Network**: `BASE_MAINNET` / `BASE_SEPOLIA`
- **Default Token**: `USDC`

### 4. Cross-Chain Flow (`CrossChainFlow`)

Orchestrates the complete Arbitrum → Starknet → Base bridge.

```typescript
import { CrossChainFlow } from '@nexora-protocol/sdk';

const flow = new CrossChainFlow({
  arbitrumAdapter: {
    apiKey: process.env.LAYERSWAP_API_KEY!,
    environment: 'MAINNET',
  },
  baseAdapter: {
    apiKey: process.env.LAYERSWAP_API_KEY!,
    environment: 'MAINNET',
  },
  amount: 0.01,
  destinationAddress: '0xYourBaseAddress',
});

// Option A: Deterministic account from MetaMask signature
const account = await flow.generateFreshStarknetAccount(
  CHAIN_ID,
  POOL_ADDRESS,
  metaMaskSignature.r,
  metaMaskSignature.s
);

// Option B: Random account
const account = await flow.generateFreshStarknetAccount(CHAIN_ID, POOL_ADDRESS);

// Execute the full flow
const receipt = await flow.executeFullFlow(undefined, `ref-${Date.now()}`);
console.log(receipt.leg1.depositAddress); // Send ETH here on Arbitrum
console.log(receipt.leg2.depositAddress); // LayerSwap internal

// Monitor progress
const status = await flow.getFullStatus();
```

## Flow Steps

### 1. Generate Starknet Account

Create a fresh Starknet account that will receive funds from Arbitrum and serve as the source for the Base bridge.

- **Random**: `StarknetAccountGenerator.generateRandom()`
- **Deterministic**: `StarknetAccountGenerator.fromSignature({ r, s, chainId, poolAddress })`

### 2. Estimate Fees

```typescript
const estimate = await flow.estimateFullFlow();
// {
//   leg1: BridgeQuote,
//   leg2: BridgeQuote,
//   totalFee: number
// }
```

### 3. Execute Full Flow

Reserves both bridge legs simultaneously:

```typescript
const receipt = await flow.executeFullFlow(refundAddress, referenceId);
```

Returns:
- `leg1.swapId` - LayerSwap swap ID for Arbitrum → Starknet
- `leg1.depositAddress` - Send funds here on Arbitrum
- `leg1.destinationAddress` - Starknet account receiving funds
- `leg2.swapId` - LayerSwap swap ID for Starknet → Base
- `leg2.depositAddress` - LayerSwap internal deposit on Starknet
- `leg2.destinationAddress` - Your final Base address
- `starknetAccount` - The generated Starknet account
- `status` - Current flow status

### 4. Send Funds on Arbitrum

Use MetaMask (or any wallet) to send `amount` of `ETH` to `receipt.leg1.depositAddress`.

### 5. Monitor Status

```typescript
// Poll for updates
const status = await flow.getFullStatus();
// status: 'pending' | 'awaiting_deposit' | 'bridging' | 'completed' | 'failed'

// Check individual legs
const leg1 = await flow.getLeg1Status();
const leg2 = await flow.getLeg2Status();
```

### 6. Speed Up Detection (Optional)

If deposit confirmation is slow:

```typescript
await flow.speedUpLeg1(arbitrumTxHash);
await flow.speedUpLeg2(starknetTxHash);
```

## Testing

### Sepolia Testnet

```bash
LAYERSWAP_API_KEY=your-sandbox-key \
  npx tsx demo/cross-chain-flow.ts 0xBaseAddress 0.001 --deterministic
```

### Mainnet

```bash
LAYERSWAP_API_KEY=your-mainnet-key \
  npx tsx demo/cross-chain-flow.ts 0xBaseAddress 0.01 --deterministic
```

## Verification

Verify all transactions on [Voyager](https://voyager.online):

1. **Arbitrum Deposit**: Search for `leg1.depositAddress` on Arbitrum
2. **Starknet Receipt**: Search for `starknetAccount.address` on Starknet
3. **Base Receipt**: Search for `destinationAddress` on Base

## Security Considerations

- **Private Keys**: The Starknet private key is generated deterministically from the MetaMask signature. Store it securely.
- **Refund Address**: Always provide a refund address when creating swaps.
- **Test First**: Always test with small amounts on Sepolia before mainnet.
- **API Keys**: Never commit LayerSwap API keys to version control.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LAYERSWAP_API_KEY` | LayerSwap API key (required) |
| `ARBITRUM_RPC` | Arbitrum RPC URL |
| `BASE_RPC` | Base RPC URL |
| `STARKNET_RPC` | Starknet RPC URL |
