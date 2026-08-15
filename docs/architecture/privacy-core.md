# Privacy Core

Privacy Core is the Starknet-side module that manages all interactions with the STRK20 privacy pool. It is the only module that needs to understand STRK20 primitives; the rest of the protocol treats it as a black box.

---

## STRK20 Pool Overview

The STRK20 pool is a Cairo smart contract on Starknet mainnet that:

- Holds ERC-20 assets as encrypted **notes**
- Supports **shielding** (deposit → encrypted note)
- Supports **unshielding** (encrypted note → withdrawal)
- Supports **private transfers** (note-to-note, emits nullifier)
- Requires **viewing key registration** for note discovery
- Enforces **mandatory compliance screening** (FPI) on all deposits

**Mainnet pool address:** `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`

**Chain ID:** `SN_MAIN` (`0x534e5f4d41494e`)

---

## What Is Private vs Public

This is critical for documentation and judging. Be precise.

| Operation | Public | Private |
|-----------|--------|---------|
| Shielding (deposit) | User address, token, amount | — |
| Private transfer | Nullifier event | Amount, sender, recipient |
| Unshielding (withdrawal) | Destination address, amount | Source note |
| Swap via anonymizer | Amount, timing | Who performed swap |
| Lending via anonymizer | Amount, timing | Who borrowed |

**Key insight:** Shielding is **not** private. Privacy is in what happens *after* shielding (private transfers). A product whose privacy claim depends on the deposit being hidden is flawed.

---

## Core Abstractions

### ViewingKey

A symmetric key derived from the user's Starknet wallet signature. Used to decrypt notes and query the indexer.

```typescript
class ViewingKey {
  readonly publicKey: bigint;
  readonly privateKey: bigint;
  
  static async fromStarknetWallet(
    wallet: StarknetWindowObject,
    chainId: string,
    poolAddress: string
  ): Promise<ViewingKey> {
    const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
    const { r, s } = await account.signMessage({ 
      domain: { chainId, name: "Nexora Protocol" },
      types: { StarkNetMsg: [{ name: "message", type: "felt" }] },
      message: { message: messageHash }
    });
    
    const folded = BigInt(hash.computePoseidonHashOnElements([r, s]));
    const reduced = folded % ec.starkCurve.CURVE.n;
    
    return new ViewingKey(reduced);
  }
  
  async register(poolAddress: string): Promise<TransactionResponse> {
    // Call pool.register_viewing_key(publicKey)
  }
}
```

### ShieldedNote

An encrypted note representing a shielded balance.

```typescript
interface ShieldedNote {
  noteHash: string;
  token: string;
  amount: bigint;
  nullifier: string;
  spent: boolean;
  createdAt: number;
  metadata?: Record<string, any>;
}
```

### PrivateBalance

The user's shielded balance for a given token.

```typescript
interface PrivateBalance {
  token: string;
  amount: bigint;
  noteCount: number;
  notes: ShieldedNote[];
}
```

---

## PrivacyHub Contract

The `PrivacyHub` is a Cairo helper contract that wraps the STRK20 pool for Nexora Protocol-specific flows.

### Contract Interface

```cairo
#[starknet::contract]
mod nexora_privacy_hub {
    use starknet::{ClassHash, ContractAddress, storage::*};
    use super::strk20::IStrt20PoolDispatcher;
    
    #[storage]
    struct Storage {
        pool: IStrt20PoolDispatcher,
        user_registry: LegacyMap<ContractAddress, bool>,
        supported_tokens: StorageMap<ContractAddress, bool>,
    }
    
    // User Operations
    #[external(v0)]
    fn register_viewing_key(ref self: ContractState, public_key: felt252) {
        // Verify caller owns the viewing key derivation
        // Forward to pool.register_viewing_key(public_key)
    }
    
    #[external(v0)]
    fn shield(ref self: ContractState, token: ContractAddress, amount: u256) {
        // ERC-20 transferFrom(user, hub, amount) — pre-approved
        // pool.shield(token, amount, user)
        // Emit Shielded { user, token, amount }
    }
    
    #[external(v0)]
    fn unshield(
        ref self: ContractState, 
        token: ContractAddress, 
        amount: u256, 
        recipient: ContractAddress
    ) {
        // pool.unshield(token, amount, recipient, proof)
        // Emit Unshielded { user, token, amount, recipient }
    }
    
    #[external(v0)]
    fn private_transfer(
        ref self: ContractState,
        to: ContractAddress,
        token: ContractAddress,
        amount: u256
    ) {
        // pool.transfer(to, token, amount, proof)
        // Emit PrivateTransferred { from, to, token, amount }
    }
    
    // Admin Operations
    #[external(v0)]
    fn add_supported_token(ref self: ContractState, token: ContractAddress) {
        assert(is_admin(), "Unauthorized");
        self.supported_tokens.write(token, true);
    }
    
    #[external(v0)]
    fn set_pool(ref self: ContractState, pool: ContractAddress) {
        assert(is_admin(), "Unauthorized");
        self.pool.write(pool.into());
    }
}
```

### Deterministic Account Pattern

Nexora Protocol generates Starknet accounts for users who don't have them, using the same pattern as `earn-contracts`.

```typescript
// derive-account.ts
import { stark, ec } from "starknet";

function deriveAccountFromSignature(
  evmAddress: string,
  signature: { r: string; s: string; v: number },
  chainId: string,
  poolAddress: string
): { address: string; publicKey: bigint } {
  // 1. Sign the domain-separated message
  const messageHash = computeStarknetKeccak(`${chainId}:${poolAddress}`);
  
  // 2. Fold signature with Poseidon
  const { r, s } = signature;
  const folded = BigInt(stark.computePoseidonHashOnElements([BigInt(r), BigInt(s)]));
  
  // 3. Reduce to curve order
  const reduced = folded % ec.starkCurve.CURVE.n;
  
  // 4. Compute account address
  const address = computeAccountAddress(reduced);
  
  return { address, publicKey: reduced };
}
```

The account contract class hash is fixed. The address is deterministic from the signature. The Paymaster pre-funds the account so the user never holds STRK.

---

## Relayer Integration

The relayer is the off-chain component that executes PrivacyHub operations on behalf of users.

### Relayer Responsibilities

1. **Bridge monitoring:** Watch source-chain bridge events
2. **Shielding:** Call `PrivacyHub.shield()` when funds arrive
3. **Note management:** Track notes issued to users (encrypted, stored in DB)
4. **Withdrawal processing:** Call `PrivacyHub.unshield()` when user requests withdrawal
5. **Proof generation:** Coordinate with prover service for withdrawal proofs
6. **Gas sponsorship:** Use Paymaster for all Starknet transactions

### Note Indexing

```typescript
class PrivacyNoteIndexer {
  constructor(
    private indexerUrl: string,
    private poolAddress: string
  ) {}
  
  async discoverNotes(
    viewingKey: ViewingKey,
    tokens: string[]
  ): Promise<Map<string, ShieldedNote[]>> {
    const indexer = new IndexerDiscoveryProvider(
      this.indexerUrl,
      this.poolAddress
    );
    
    const notes = await indexer.discoverNotes(
      BigInt(viewingKey.publicKey),
      viewingKey.privateKey,
      { tokens, blockIdentifier: "pre_confirmed" }
    );
    
    return notes;
  }
}
```

**Important:** Do not persist note registry between sessions. Rebuild with `discoverNotes` each time to avoid reorg and cursor-drift bugs.

---

## Compliance

STRK20 enforces mandatory deposit screening via FPI (Financial Privacy Inc). Every deposit is screened before the pool accepts it.

**Nexora Protocol's compliance path:**
1. All source-chain addresses are screened before shielding
2. Viewing keys enable audit under legal process
3. Selective disclosure lets users prove specific facts without revealing everything
4. No KYC at the Nexora Protocol layer — compliance is handled by the STRK20 pool

**What Nexora Protocol does NOT do:**
- Collect KYC data
- Run its own compliance screening (relies on FPI)
- Guarantee "zero link" (claims are limited to "minimized linkability")

---

## Testing

### Testnet First

All Privacy Core operations should be tested on Sepolia before mainnet.

### Test Checklist

- [ ] Viewing key registration
- [ ] Shielding (testnet tokens)
- [ ] Private balance discovery
- [ ] Private transfer
- [ ] Unshielding
- [ ] Deterministic account derivation
- [ ] Paymaster gas sponsorship
- [ ] Error cases (insufficient balance, invalid proof, expired deadline)

### Mainnet Checklist

- [ ] Real STRK for gas
- [ ] Real ERC-20 on mainnet
- [ ] Three verified mainnet transactions in `strk20.json`
- [ ] Pool events verified on Voyager

---

## Next Steps

- [Source & Destination Adapters](docs/architecture/adapters.md)
- [Routing Engine](docs/architecture/routing-engine.md)
- [Selective Disclosure](docs/architecture/disclosure.md)
- [STRK20 Integration](docs/integration/strk20.md)
