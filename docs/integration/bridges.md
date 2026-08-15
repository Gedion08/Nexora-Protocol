# Bridge Integrations

Nexora Protocol supports multiple bridges for deposit and withdrawal. This document compares options and specifies the integration approach.

---

## Supported Bridges

| Bridge | Source Chains | Destination Chains | Speed | Fee | Reliability | API | MVP Status |
|--------|--------------|-------------------|-------|-----|-------------|-----|------------|
| LayerSwap | Arbitrum, Base, Optimism, Ethereum, Starknet | Starknet, Base, Arbitrum | ~2 min | 0.1-0.5% | High | REST | Primary |
| StarkGate | Ethereum, Arbitrum, Optimism | Starknet | ~10 min | Gas + fee | High | Events | Fallback |
| Orbiter | Multi-chain | Multi-chain | ~1-3 min | 0.1-0.3% | Medium | REST | Stretch |

---

## LayerSwap (Primary)

LayerSwap is the preferred bridge for MVP. It has a well-documented API, supports Arbitrum → Starknet and Starknet → Base, and is relayer-friendly.

### API Flow

#### 1. Reserve a Swap

```typescript
const reservation = await layerswap.reserve({
  source: "ARBITRUM",
  destination: "STARKNET",
  token: "USDC",
  amount: "5000000000", // 5000 USDC (6 decimals)
  recipient: relayerStarknetAddress,
  refund_address: relayerEVMAddress,
  reference_id: generateIdempotencyKey(),
});
```

#### 2. Execute Deposit

```typescript
// User sends tokens to LayerSwap deposit address
const depositTx = await userWallet.sendTransaction({
  to: reservation.deposit_address,
  value: 0,
  data: encodeERC20Transfer(reservation.deposit_address, reservation.amount),
});
```

#### 3. Monitor Status

```typescript
const status = await layerswap.getStatus({
  reference_id: reservation.reference_id,
});

// States: waiting, processing, completed, failed, refunded
```

#### 4. Confirm Arrival on Starknet

```typescript
// Once status is "completed", verify on Starknet
const starknetTx = await starknetProvider.waitForTransaction(
  reservation.starknet_tx_hash
);
```

### LayerSwap API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/reserve` | POST | Reserve a swap slot |
| `/api/v2/status/{reference_id}` | GET | Check swap status |
| `/api/v2/supported_networks` | GET | List supported chains |
| `/api/v2/supported_tokens` | GET | List supported tokens |

### LayerSwap Fees

Fees are dynamic. Estimate before user confirms:

```typescript
const feeEstimate = await layerswap.estimateFee({
  source: "ARBITRUM",
  destination: "STARKNET",
  token: "USDC",
  amount: "5000000000",
});
```

---

## StarkGate (Fallback)

StarkGate is the canonical Starknet bridge. It is more trustless but requires user-initiated deposits.

### User Flow

1. Nexora Protocol returns StarkGate bridge instructions to user
2. User approves and deposits via StarkGate UI
3. Nexora Protocol monitors StarkGate events on source chain
4. When deposit is confirmed on Starknet, Nexora Protocol shields

### Monitoring

```typescript
import { StarkGateBridge } from "./starkgate-monitor";

const monitor = new StarkGateBridge(sourceChainRpc);

// Monitor for deposits to relayer address
monitor.onDeposit((event) => {
  const { user, token, amount, l2TxHash } = event;
  // Trigger shield flow
  privacyHub.shield(token, amount);
});
```

### StarkGate Contracts

| Chain | Bridge Address |
|-------|---------------|
| Ethereum | `0xae0Ee0A63A2cE6B3EE89B2183b1988658a75B654` |
| Arbitrum | `0x09E60Cc7CD219636D0a1B6Da8CDc182813787419` |
| Optimism | `0xAf52E10BA79B9303206Fdf78AD6FbA9E8C990bC8` |

---

## Orbiter (Stretch)

Orbiter is a fast multi-chain bridge. It is less proven than LayerSwap but offers faster settlement.

### Integration Notes

- API is REST-based
- Supports many more chains
- Inventory is smaller; watch for availability
- Fees are generally lower but less predictable

---

## Relayer Inventory Management

The relayer maintains a small inventory of funds on each chain to ensure smooth UX.

```typescript
class RelayerInventory {
  private balances: Map<string, bigint> = new Map();
  
  async reserve(token: string, chain: ChainId, amount: bigint): Promise<void> {
    const key = `${chain}:${token}`;
    const current = this.balances.get(key) || 0n;
    
    if (current < amount) {
      throw new Error(`Insufficient ${token} inventory on ${chain}`);
    }
    
    this.balances.set(key, current - amount);
  }
  
  async getBalance(token: string, chain: ChainId): Promise<bigint> {
    return this.balances.get(`${chain}:${token}`) || 0n;
  }
  
  async rebalance(): Promise<void> {
    // Periodically top up inventories
    // Triggered by low balance alerts
  }
}
```

**Inventory addresses are hot wallets.** Security:
- Use multisig for inventory wallets
- Limit inventory to amounts needed for 24h operations
- Monitor for unusual outflows

---

## Bridge Selection Logic

```typescript
function selectBridge(
  source: ChainId,
  destination: ChainId,
  token: string,
  amount: bigint
): BridgeProvider {
  // 1. Check inventory
  if (hasInventory(source, destination, token, amount)) {
    return "layerswap";
  }
  
  // 2. Fallback
  if (destination === "starknet") {
    return "starkgate";
  }
  
  throw new Error("No bridge available");
}
```

---

## Error Handling

| Error | Bridge | Recovery |
|-------|--------|----------|
| API timeout | LayerSwap | Retry 3x with exponential backoff |
| Insufficient liquidity | LayerSwap | Fallback to StarkGate |
| User rejected | StarkGate | Return instructions to user |
| Network congestion | All | Retry with higher gas |

---

## Next Steps

- [STRK20 Integration](docs/integration/strk20.md)
- [Wallet Integrations](docs/integration/wallets.md)
- [Architecture Overview](docs/architecture/overview.md)
