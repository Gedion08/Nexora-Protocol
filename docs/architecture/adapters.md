# Source & Destination Adapters

Adapters normalize interactions with external chains and bridges into Nexora Protocol's internal format. They are the only components that need chain-specific logic.

---

## Adapter Interface

```typescript
interface ChainAdapter {
  readonly chainId: ChainId;
  readonly chainName: string;
  
  // Deposit side
  createDeposit(intent: DepositIntent): Promise<DepositReceipt>;
  getDepositStatus(txHash: string): Promise<DepositStatus>;
  estimateDepositFee(token: string, amount: bigint): Promise<bigint>;
  
  // Withdrawal side
  executeWithdrawal(params: WithdrawalParams): Promise<WithdrawalReceipt>;
  getWithdrawalStatus(txHash: string): Promise<WithdrawalStatus>;
  estimateWithdrawalFee(token: string, amount: bigint, recipient: string): Promise<bigint>;
  
  // Address generation
  generateFreshAddress(): Promise<string>;
  
  // Inventory
  getInventory(token: string): Promise<bigint>;
  refreshInventory(): Promise<void>;
}
```

---

## Layer 1 — Source Adapters

Source adapters handle deposits from the user's home chain into Nexora Protocol.

### ArbitrumAdapter (MVP)

**Bridge:** LayerSwap  
**Supported tokens:** USDC, USDT, ETH  
**Direction:** Arbitrum → Starknet

```typescript
class ArbitrumAdapter implements ChainAdapter {
  readonly chainId = "arbitrum";
  readonly chainName = "Arbitrum One";
  
  async createDeposit(intent: DepositIntent): Promise<DepositReceipt> {
    // 1. Reserve LayerSwap slot
    const reservation = await layerswap.reserve({
      source: "ARBITRUM",
      destination: "STARKNET",
      token: intent.sourceToken,
      amount: intent.amount,
      recipient: relayerStarknetAddress,
    });
    
    // 2. User (or relayer) executes LayerSwap deposit
    const txHash = await relayer.executeLayerSwapDeposit(reservation);
    
    return {
      bridgeTxHash: txHash,
      estimatedArrival: Date.now() + 120_000, // ~2 min
      fee: reservation.fee,
      status: { state: "pending" },
    };
  }
  
  async getDepositStatus(txHash: string): Promise<DepositStatus> {
    // Poll LayerSwap API
    const status = await layerswap.getStatus(txHash);
    return mapLayerSwapStatus(status);
  }
}
```

### StarkGateAdapter (Alternative)

**Bridge:** StarkGate Canonical Bridge  
**Supported tokens:** ETH, USDC, USDT, WBTC, DAI  
**Direction:** Ethereum / Arbitrum / Optimism → Starknet

StarkGate requires the user to initiate the bridge themselves. Nexora Protocol monitors for deposits.

```typescript
class StarkGateAdapter implements ChainAdapter {
  async createDeposit(intent: DepositIntent): Promise<DepositReceipt> {
    // Return bridge instructions to user
    return {
      bridgeTxHash: "", // User will provide this
      estimatedArrival: Date.now() + 600_000, // ~10 min
      fee: estimateStarkGateFee(intent.sourceToken, intent.amount),
      status: { state: "pending" },
      instructions: {
        type: "user_executed",
        to: starkGateBridgeAddress,
        data: encodeStarkGateDeposit(relayerStarknetAddress),
      },
    };
  }
}
```

**Trade-off:** More trustless, worse UX. For MVP, prefer LayerSwap.

---

## Layer 4 — Destination Adapters

Destination adapters handle withdrawals from Starknet to the user's chosen destination.

### BaseAdapter (MVP)

**Bridge:** LayerSwap  
**Supported tokens:** USDC, USDT, ETH  
**Direction:** Starknet → Base

```typescript
class BaseAdapter implements ChainAdapter {
  readonly chainId = "base";
  readonly chainName = "Base";
  
  async executeWithdrawal(params: WithdrawalParams): Promise<WithdrawalReceipt> {
    // 1. Generate fresh Base address
    const freshAddress = await this.generateFreshAddress();
    
    // 2. Call PrivacyHub.unshield() on Starknet
    const unshieldTx = await privacyHub.unshield(
      params.token,
      params.amount,
      freshAddress
    );
    
    // 3. Execute LayerSwap bridge
    const bridgeTx = await layerswap.execute({
      source: "STARKNET",
      destination: "BASE",
      token: params.token,
      amount: params.amount,
      recipient: freshAddress,
    });
    
    return {
      starknetTxHash: unshieldTx.transaction_hash,
      bridgeTxHash: bridgeTx.transaction_hash,
      recipient: freshAddress,
      estimatedArrival: Date.now() + 120_000,
    };
  }
  
  async generateFreshAddress(): Promise<string> {
    // Generate a new random Ethereum address
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }
}
```

### StarknetAdapter (Future)

For users who want to withdraw to their own Starknet wallet.

```typescript
class StarknetAdapter implements ChainAdapter {
  async executeWithdrawal(params: WithdrawalParams): Promise<WithdrawalReceipt> {
    // User provides Starknet address
    const recipient = params.recipient as string;
    
    // Call PrivacyHub.unshield()
    const tx = await privacyHub.unshield(
      params.token,
      params.amount,
      recipient
    );
    
    return {
      starknetTxHash: tx.transaction_hash,
      recipient,
    };
  }
}
```

---

## Bridge Comparison

| Bridge | Supported Chains | Speed | Fee | Reliability | UX | Notes |
|--------|-----------------|-------|-----|-------------|-----|-------|
| LayerSwap | Arbitrum, Base, Optimism, Ethereum, Starknet | ~2 min | 0.1-0.5% | High | Good | Relayer-friendly API |
| StarkGate | Ethereum, Arbitrum, Optimism, Starknet | ~10 min | Gas + small fee | High | User-initiated | Canonical bridge |
| Orbiter | Multi-chain | ~1-3 min | 0.1-0.3% | Medium | Good | Fast, but smaller inventory |

**Recommendation:** Use LayerSwap as primary bridge for MVP. Keep StarkGate as a fallback for ETH deposits.

---

## Relayer Inventory Management

The relayer pre-funds bridge inventories to ensure smooth UX.

```typescript
class InventoryManager {
  private inventories: Map<string, bigint> = new Map();
  
  async getAvailableInventory(token: string, chain: ChainId): Promise<bigint> {
    return this.inventories.get(`${chain}:${token}`) || 0n;
  }
  
  async reserveInventory(token: string, chain: ChainId, amount: bigint): Promise<void> {
    const current = await this.getAvailableInventory(token, chain);
    if (current < amount) {
      throw new Error(`Insufficient inventory on ${chain} for ${token}`);
    }
    this.inventories.set(`${chain}:${token}`, current - amount);
  }
  
  async rebalance(): Promise<void> {
    // Monitor bridge pools and rebalance hot wallets
  }
}
```

**Inventory considerations:**
- Relayer holds funds temporarily; risk is limited and transparent
- Inventory is replenished from the relayer's own funds
- Low inventory triggers automatic rebalancing
- This is a feature, not a bug — it improves UX by eliminating bridge dependency

---

## Fresh Address Generation

```typescript
class FreshAddressGenerator {
  async generateForChain(chainId: ChainId): Promise<string> {
    switch (chainId) {
      case "base":
      case "arbitrum":
      case "ethereum":
      case "optimism":
        return this.generateEVMAddress();
      case "solana":
        return this.generateSolanaAddress();
      case "starknet":
        return this.generateStarknetAddress();
      default:
        throw new Error(`Unsupported chain: ${chainId}`);
    }
  }
  
  private generateEVMAddress(): string {
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }
  
  private generateSolanaAddress(): string {
    const keypair = Keypair.generate();
    return keypair.publicKey.toBase58();
  }
}
```

Fresh addresses are generated deterministically from the user's intent to ensure they can be recovered if needed (via viewing key association).

---

## Error Handling

| Error | Recovery |
|-------|----------|
| Bridge API down | Fallback to alternative bridge |
| Insufficient inventory | Pause deposits, alert ops, rebalance |
| Invalid token | Reject with clear error |
| Network congestion | Retry with higher gas |

---

## Next Steps

- [Routing Engine](docs/architecture/routing-engine.md)
- [STRK20 Integration](docs/integration/strk20.md)
- [Bridge Integrations](docs/integration/bridges.md)
