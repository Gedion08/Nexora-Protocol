# Nexora Protocol Protocol

The formal specification of the four-layer Nexora Protocol protocol.

---

## Layer 1 — Source Adapters

Source adapters normalize deposit operations across different chains into a common `DepositIntent` format.

### DepositIntent

```typescript
interface DepositIntent {
  sourceChain: ChainId;        // "arbitrum" | "base" | "ethereum" | "solana"
  sourceToken: string;         // ERC-20 / SPL token address
  amount: bigint;              // Atomic units
  recipient: string;           // Nexora Protocol internal recipient (deterministic Starknet address or viewing key)
  userId: string;              // Internal user identifier
  metadata?: Record<string, any>;
}
```

### SourceAdapter Interface

```typescript
interface SourceAdapter {
  readonly chainId: ChainId;
  readonly supportedTokens: string[];
  
  createDeposit(intent: DepositIntent): Promise<DepositReceipt>;
  getStatus(txHash: string): Promise<DepositStatus>;
  estimateFee(token: string, amount: bigint): Promise<bigint>;
  refreshInventory(): Promise<void>;
}
```

### DepositReceipt

```typescript
interface DepositReceipt {
  bridgeTxHash: string;        // Transaction on source chain
  estimatedArrival: number;    // Unix timestamp (ms)
  fee: bigint;
  status: DepositStatus;
}
```

### DepositStatus

```typescript
type DepositStatus = 
  | { state: "pending" }
  | { state: "confirming"; confirmations: number }
  | { state: "completed"; starknetTxHash: string }
  | { state: "failed"; reason: string };
```

### Adapter Implementations (MVP)

#### ArbitrumAdapter
- Uses LayerSwap API for Arbitrum → Starknet bridging
- Deposits USDC, USDT, ETH
- Relayer pre-funds LayerSwap source address
- Polls LayerSwap status API
- On completion, relayer calls `PrivacyHub.shield()` on Starknet

#### StarkGateAdapter (Alternative)
- Uses StarkGate canonical bridge
- Requires user to initiate StarkGate deposit directly
- Nexora Protocol monitors StarkGate events
- More trustless, less UX-friendly

**Decision point:** See [Bridge Integrations](docs/integration/bridges.md).

---

## Layer 2 — Privacy Core

Privacy Core is the Starknet-side interface to the STRK20 pool. It does not replace the pool; it wraps it with application-specific logic.

### Core Responsibilities

1. **Viewing Key Management**
   - Derive viewing key from wallet signature
   - Register viewing key with STRK20 pool (once per address)
   - Store encrypted viewing keys off-chain (relayer DB)

2. **Shielding**
   - Accept ERC-20 deposit from relayer
   - Call pool `shield()` function
   - Receive encrypted note
   - Store note metadata (encrypted, indexed by viewing key hash)

3. **Private State Discovery**
   - Query indexer for unspent notes
   - Decrypt notes with viewing key
   - Compute private balance

4. **Private Transfer**
   - Construct note-to-note transfer proof
   - Submit to pool via relayer
   - Receive nullifier event

5. **Unshielding**
   - Select note to spend
   - Construct withdrawal proof
   - Call pool `unshield()`
   - Tokens sent to recipient address

### PrivacyHub Contract (Cairo)

The `PrivacyHub` is a helper contract that orchestrates operations on Starknet.

```cairo
#[starknet::contract]
mod nexora_privacy_hub {
    use starknet::{ClassHash, ContractAddress};
    
    #[storage]
    struct Storage {
        pool_address: ContractAddress,
        registered_users: LegacyMap<ContractAddress, bool>,
    }
    
    #[external(v0)]
    fn shield(ref self: ContractState, token: ContractAddress, amount: u256) {
        // ERC-20 transfer from relayer to hub
        // Call pool.shield(token, amount)
        // Emit Shielded event
    }
    
    #[external(v0)]
    fn unshield(ref self: ContractState, token: ContractAddress, amount: u256, recipient: ContractAddress) {
        // Construct withdrawal proof via relayer
        // Call pool.unshield(token, amount, recipient)
        // Emit Unshielded event
    }
    
    #[external(v0)]
    fn private_transfer(ref self: ContractState, to: ContractAddress, token: ContractAddress, amount: u256) {
        // Note-to-note transfer
        // Emit PrivateTransferred event
    }
    
    #[external(v0)]
    fn register_viewing_key(ref self: ContractState, public_key: felt252) {
        // Verify signature
        // Call pool.register_viewing_key(public_key)
        // Mark user as registered
    }
}
```

### Deterministic Account Generation

For users without Starknet wallets, Nexora Protocol generates a deterministic Starknet account derived from the source-chain signature.

```typescript
// Pattern: reuse earn-contracts deterministic account derivation
function deriveStarknetAccountFromEVM(
  evmAddress: string,
  evmSignature: { r: string; s: string; v: number },
  chainId: string,
  poolAddress: string
): StarknetAccount {
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  const folded = BigInt(hash.computePoseidonHashOnElements([r, s]));
  const reduced = folded % ec.starkCurve.CURVE.n;
  
  // Derive account address from reduced scalar
  const accountAddress = computeAccountAddress(reduced);
  
  return {
    address: accountAddress,
    privateKey: null, // User never holds this
    publicKey: reduced,
  };
}
```

The account is funded via Paymaster so the user never needs STRK.

---

## Layer 3 — Routing Engine

The Routing Engine converts user intent into an executable route.

### Intent Schema

```typescript
interface PrivacyIntent {
  from: ChainId;
  asset: string;               // "USDC" | "ETH" | "STRK"
  amount: string;              // Human-readable, e.g. "5000"
  to: ChainId;
  recipient: "fresh" | string; // "fresh" = generate new address
  privacy: "maximum" | "standard" | "basic";
  maxFee?: string;             // Optional fee cap
  deadline?: number;           // Unix timestamp (ms)
}
```

### Route Representation

```typescript
interface Route {
  steps: RouteStep[];
  estimatedTime: number;       // ms
  estimatedFee: bigint;
  privacyScore: number;        // 0-100
  steps: RouteStep[];
}

interface RouteStep {
  type: "bridge" | "shield" | "unshield" | "transfer";
  chain: ChainId;
  adapter: string;
  contract?: string;
  estimatedTime: number;
}
```

### Route Selection Algorithm

```
1. Filter adapters by source and destination chain
2. Filter adapters by supported asset
3. Rank by:
   - Fee (lower is better)
   - Estimated time (faster is better)
   - Reliability score (historical success rate)
   - Privacy score (number of hops, shared pool usage)
4. Select top-ranked route
5. Validate inventory availability
6. Return route with fallback options
```

### Atomicity Considerations

Full atomicity (bridge → shield → unshield → bridge in one transaction) is not possible across chains. Nexora Protocol uses:

- **Relayer guarantees:** The relayer commits inventory and is economically incentivized to complete the route.
- **Timeout escrows:** If a step fails, the relayer refunds the user via a pre-funded hot wallet on the source chain.
- **Idempotency keys:** Each intent gets a unique idempotency key to prevent duplicate execution.

---

## Layer 4 — Selective Disclosure

Selective Disclosure lets users prove specific facts about their private transactions without revealing everything.

### Disclosure Types

| Type | Reveals | Hides |
|------|---------|-------|
| `full` | Everything | Nothing |
| `partial` | User-selected fields | Everything else |
| `amount` | Amount above threshold | Exact amount, parties, timing |
| `source` | Source wallet address | Destination, intermediate steps |
| `auditor` | Complete history to auditor | Nothing (auditor is trusted) |
| `none` | Minimal public data | Amount, parties, timing |

### Proof Generation

```typescript
interface DisclosureProof {
  type: DisclosureType;
  statement: string;
  proof: string;               // ZK proof hex
  publicInputs: string[];
  verifiedAt: number;
}
```

### Implementation Path

1. **Day 13-14:** Basic viewing key sharing (user shares viewing key with auditor)
2. **Day 15-16:** Prover service integration for selective disclosure proofs
3. **Stretch:** Custom Cairo circuits for specific disclosure predicates

### Privacy Health Score

For every transaction, Nexora Protocol computes a Privacy Health Score:

```typescript
interface PrivacyHealth {
  score: number;               // 0-100
  factors: {
    poolSize: number;          // Current anonymity set size
    amountUniqueness: number;  // How unique the amount is
    timingUniqueness: number;  // How unique the timing is
    sourceReuse: number;       // Has source been used before?
    destinationReuse: number;  // Has destination been used before?
  };
}
```

**Display:**
```
Privacy Health
████████████████░░░░ 82/100
```

**Important:** This is a heuristic, not a mathematical guarantee. It should be labeled as such.

---

## Protocol State Machines

### Deposit State Machine

```
IDLE → BRIDGING → CONFIRMING → SHIELDING → COMPLETED
                  │                       │
                  ▼                       ▼
              FAILED                  FAILED
```

### Withdrawal State Machine

```
IDLE → SELECTING_NOTES → PROVING → UNSHIELDING → BRIDGING → COMPLETED
                          │                    │
                          ▼                    ▼
                       FAILED               FAILED
```

### Route State Machine

```
IDLE → SELECTING_ROUTE → EXECUTING → MONITORING → COMPLETED
                         │                      │
                         ▼                      ▼
                     FAILED (RETRY)          FAILED (REFUND)
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| Bridge timeout | Relayer refunds via hot wallet; user retries |
| Shield failure | Relayer retries with backoff; alerts if pool is down |
| Unshield failure | Relayer retries; user can also unshield directly |
| Prover unavailable | Fallback to hosted prover; queue locally if needed |
| Paymaster rejection | Relayer uses fallback paymaster or requests user STRK |

---

## Next Steps

- [Privacy Core](docs/architecture/privacy-core.md) — STRK20 integration details
- [Adapters](docs/architecture/adapters.md) — Source and destination adapter specs
- [Routing Engine](docs/architecture/routing-engine.md) — Route selection and execution
- [Selective Disclosure](docs/architecture/disclosure.md) — Disclosure types and implementation
