# STRK20 Integration

Detailed integration guide for the STRK20 privacy pool, Starknet Wallet API, and Privacy SDK.

---

## Pool Contract Addresses

### Mainnet

| Component | Address |
|-----------|---------|
| STRK20 Pool | `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` |
| Nexora PrivacyHub (TBD) | Deploy during Phase 1 |

### Sepolia

| Component | Address |
|-----------|---------|
| STRK20 Pool | `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` |

---

## Integration Routes

STRK20 provides three integration routes. Nexora Protocol uses all three at different layers.

| Route | Use Case | Nexora Protocol Usage |
|-------|----------|------------|
| **Starknet Wallet API** | Private dapp via wallet | Not used directly (Nexora Protocol is a relayer service) |
| **Privacy SDK** | Direct SDK control | Primary integration path for Privacy Core |
| **Anonymizer contracts** | DeFi within private state | Stretch goal for Phase 5 |
| **Own prover** | Self-hosted proving | Not used (use hosted prover for speed) |

---

## Privacy SDK Integration

### Installation

```bash
npm install @starkware-libs/starknet-privacy
```

### Core SDK Classes

```typescript
import { 
  PoolClient,
  ViewingKeyManager,
  NoteDiscovery,
  ProvingService,
  ShieldBuilder,
  UnshieldBuilder,
  TransferBuilder
} from "@starkware-libs/starknet-privacy";
```

### Viewing Key Registration

```typescript
const client = new PoolClient({
  rpc: process.env.NEXT_PUBLIC_RPC_URL,
  poolAddress: process.env.NEXT_PUBLIC_POOL_ADDRESS,
});

const vkManager = new ViewingKeyManager(client);

// Derive viewing key from wallet signature
const viewingKey = await vkManager.deriveFromWallet(starknetAccount);

// Register on-chain
const tx = await vkManager.register(viewingKey);
await tx.wait();
```

### Shielding

```typescript
const shieldBuilder = new ShieldBuilder(client);

const shieldTx = await shieldBuilder.shield({
  token: usdcTokenAddress,
  amount: 5_000_000n, // 5000 USDC (6 decimals)
  viewingKey: viewingKey,
});

await shieldTx.wait();
```

### Note Discovery

```typescript
const discovery = new NoteDiscovery(client, process.env.NEXT_PUBLIC_INDEXER_URL);

const notes = await discovery.discoverNotes(
  BigInt(starknetAccount.address),
  viewingKey,
  {
    tokens: [usdcTokenAddress],
    blockIdentifier: "pre_confirmed",
  }
);

const privateBalance = notes.get(usdcTokenAddress).reduce(
  (sum, note) => sum + note.amount,
  0n
);
```

### Unshielding

```typescript
const unshieldBuilder = new UnshieldBuilder(client);

const unshieldTx = await unshieldBuilder.unshield({
  token: usdcTokenAddress,
  amount: 5_000_000n,
  recipient: freshBaseAddress,
  note: selectedNote,
});

await unshieldTx.wait();
```

### Private Transfer

```typescript
const transferBuilder = new TransferBuilder(client);

const transferTx = await transferBuilder.transfer({
  token: usdcTokenAddress,
  amount: 1_000_000n,
  recipient: recipientViewingKey,
});

await transferTx.wait();
```

---

## Prover Service

The prover service generates zero-knowledge proofs for withdrawals and transfers.

### Configuration

```typescript
const prover = new ProvingService({
  url: process.env.NEXT_PUBLIC_PROVER_URL,
  // For production, run your own prover
  // url: "https://prover.starknet.starkware.dev"
});
```

### Generating a Withdrawal Proof

```typescript
const proof = await prover.generateUnshieldProof({
  note: selectedNote,
  viewingKey: viewingKey,
  poolAddress: poolAddress,
  chainId: "SN_MAIN",
});

// Submit proof with unshield transaction
const tx = await poolClient.unshield(
  token,
  amount,
  recipient,
  proof
);
```

---

## Indexer / Discovery

The indexer is required for note discovery. Without it, you cannot query private balances.

### Configuration

```typescript
const indexer = new IndexerDiscoveryProvider(
  process.env.NEXT_PUBLIC_INDEXER_URL,
  process.env.NEXT_PUBLIC_POOL_ADDRESS
);
```

### Querying Notes

```typescript
const { notes } = await indexer.discoverNotes(
  BigInt(userAddress),
  viewingKey,
  { 
    tokens: [usdcTokenAddress],
    blockIdentifier: "pre_confirmed" 
  }
);
```

**Note:** Do not persist the indexer registry between sessions. Rebuild with `discoverNotes` each time to avoid reorg and cursor-drift bugs.

---

## Anonymizer Contracts (Stretch)

Anonymizer contracts enable private DeFi within the pool. For example, private swaps through Ekubo or AVNU.

```typescript
import { PrivacyInvokeHelper } from "@starkware-libs/starknet-privacy";

const helper = new PrivacyInvokeHelper(poolClient);

// Private swap: USDC → ETH
const swapTx = await helper.privateSwap({
  fromToken: usdcTokenAddress,
  toToken: ethTokenAddress,
  amount: 5_000_000n,
  minReceived: 1_000_000_000_000_000n, // 0.001 ETH
});

await swapTx.wait();
```

---

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Wrong chain ID in message hash | Use `SN_MAIN` for mainnet, not Sepolia |
| Missing deposit screening | FPI screening is mandatory; do not bypass |
| Viewing key not registered | Register before trying to discover notes |
| Prover timeout | Increase timeout or use fallback prover |
| Relayer sender address | Private transactions are relayed; sender is a relayer, not the user |
| Reorg on indexer | Use `pre_confirmed` block identifier for fresh data |

---

## Mainnet Values

Use these verified values:

```bash
CHAIN_ID=SN_MAIN                  # 0x534e5f4d41494e
RPC_URL=https://rpc.starknet.lava.build
POOL_ADDRESS=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

**Missing values:**
- Mainnet discovery/indexer URL (check STRK20 docs before Aug 14)
- Mainnet prover service URL (check STRK20 docs before Aug 14)

Do not guess at endpoints. A wrong prover will fail in ways that look like your bug.

---

## Next Steps

- [Architecture Overview](docs/architecture/overview.md)
- [Bridge Integrations](docs/integration/bridges.md)
- [Wallet Integrations](docs/integration/wallets.md)
