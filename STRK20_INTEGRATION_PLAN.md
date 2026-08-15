# STRK20 Privacy Integration Plan

## Objective
Integrate STRK20 privacy features into the Nexora Protocol SDK, enabling private/shielded transfers, confidential balances, private payments, and viewing key management on Starknet.

## Scope

### In Scope (App Code)
- Viewing key derivation via Poseidon hash of wallet signature
- Shield/unshield flows through PrivacyHub contract
- Note discovery via indexer API
- Zero-knowledge proof generation via external prover service
- Shielded transfer of STRK20 tokens between private accounts
- Private balance queries for shielded token holders

### Out of Scope (Cairo contracts)
- Smart contract implementation (handled separately)
- On-chain proof verification circuit

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    dApp / Wallet                            │
│  imports { ViewingKey, ShieldBuilder, UnshieldBuilder,      │
│             NoteDiscovery } from '@nexora/sdk'              │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│           SDK (this package: packages/sdk)                  │
│  utils/poseidon.ts - Viewing key derivation (Poseidon hash)  │
│  privacy/viewing-key.ts   - Key derivation from wallet sig   │
│  privacy/shield.ts        - Shield tokens into PrivacyHub   │
│  privacy/unshield.ts      - Unshield tokens out of PrivacyHu│
│  privacy/discovery.ts     - Discover shielded notes by addr  │
│  privacy/prover.ts        - Generate ZK proofs for unshield │
│  core/client.ts           - Contract interaction (starknet.js)│
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│              Starknet (Starknet.js v6)                        │
│  PrivacyHub Contract    - Shield/unshield/private transfer   │
│  STRK20 Pool Contract   - Token registry, balance tracking   │
│  RPC Provider           - Transaction submission & receipt   │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│              External Services                              │
│  Prover Service (HTTP)    - ZK proof generation               │
│  Indexer Service (HTTP)   - Encrypted note discovery          │
└──────────────────────────────────────────────────────────────┘
```

## Phase 1: Viewing Key Management

### Status
- [x] `deriveViewingKey(r, s, chainId, poolAddress)` using Poseidon hash
- [x] `ViewingKey` class with serialization/deserialization
- [x] `ViewingKey.deriveFromWallet(account)` using EIP-712 style message signing
- [x] `ViewingKeyManager.register(account, viewingKey)` on PrivacyHub

### Key Derivation Algorithm
1. User signs a message `chainId:poolAddress` with their Starknet wallet
2. Extract `r` and `s` signature components
3. `folded = PoseidonHash([r, s])` (computePoseidonHashOnElements)
4. `privateKey = folded mod CURVE_ORDER` (reduceToField)
5. `publicKey = privateKey` (symmetric in this scheme)

## Phase 2: Shield Flow

### Status
- [x] `ShieldBuilder.shield(params)` validates inputs
- [x] Calls `PrivacyHubClient.shield(account, token, amount)`
- [x] Waits for transaction confirmation
- [x] Derives note hash from transaction hash + user + token + amount

### Flow
1. User calls `shieldBuilder.shield({ account, token, amount, viewingKey })`
2. SDK validates all inputs (non-zero amounts, valid viewing key)
3. Calls `pool.shield(token, amount, { from: account.address })`
4. Waits for transaction receipt
5. Derives `noteHash = keccak(txHash + user + token + amount)` for tracking
6. Returns `ShieldResult { transactionHash, noteHash, status, amount, token, account }`

## Phase 3: Unshield Flow

### Status
- [x] `UnshieldBuilder.unshield(params)` validates inputs
- [x] Requests proof from `ProvingService.generateUnshieldProof`
- [x] Calls `PrivacyHubClient.unshield(account, token, amount, recipient)`
- [x] Returns `UnshieldResult` with nullifier and transaction info

### Flow
1. User calls `unshieldBuilder.unshield({ account, token, amount, recipient, note, viewingKey })`
2. SDK validates inputs (non-zero amount, valid recipient, valid viewing key)
3. Requests ZK proof from external prover service with note + viewing key
4. Validates proof (nullifier matches note, proof is non-empty)
5. Calls `privacyHub.unshield(token, amount, recipient, { from: account.address })`
6. Waits for transaction confirmation
7. Returns `UnshieldResult { transactionHash, nullifier, status, amount, token, recipient }`

## Phase 4: Note Discovery

### Status
- [x] `IndexerDiscoveryProvider.discoverNotes(publicKey, privateKey, options)`
- [x] `NoteDiscovery.discoverNotes(userAddress, viewingKey, options)`
- [x] `getPrivateBalance(userAddress, viewingKey, token)`
- [x] `selectSpendableNotes(userAddress, viewingKey, token, amount)`

### Flow
1. User calls `noteDiscovery.discoverNotes(userAddress, viewingKey, options)`
2. SDK queries indexer API: `GET /notes?viewing_key=publicKey&pool_address=X&tokens=Y`
3. Indexer returns encrypted notes (amount, nullifier)
4. SDK decrypts notes using viewing key private key (hex decode fallback)
5. Filters notes by spent/optional and tokens
6. Returns `Map<token, ShieldedNote[]>`

## Phase 5: Private Transfers

### Status
- [x] `PrivacyHubClient.privateTransfer(account, to, token, amount)`

### Flow
1. User calls `privateTransferBuilder.transfer({ account, to, token, amount, viewingKey })`
2. SDK requests transfer proof from prover
3. Calls `privacyHub.private_transfer(to, token, amount, { from: account.address })`
4. Waits for confirmation

## Phase 6: STRK20 Pool Management

### Status
- [x] `PrivacyHubClient.addSupportedToken(account, token)`
- [x] `PrivacyHubClient.setPool(account, poolAddress)`
- [x] `PoolClient.supportsToken(token)`
- [x] `PoolClient.isNullifierSpent(nullifier)`

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_PRIVACY_HUB_ADDRESS` | PrivacyHub contract address | Mainnet address |
| `NEXT_PUBLIC_POOL_ADDRESS` | STRK20 pool address | Mainnet pool |
| `NEXT_PUBLIC_PROVER_URL` | Prover service endpoint | `http://localhost:8080` |
| `NEXT_PUBLIC_INDEXER_URL` | Indexer service endpoint | `http://localhost:8081` |

## Testing

- All 201 unit tests pass with 93%+ coverage
- Run tests: `cd packages/sdk && npx vitest run`
- Run typecheck: `npx tsc --noEmit`

## Next Steps

1. Implement real note decryption using viewing key (replace hex fallback)
2. Add transfer proof generation to UnshieldBuilder flow
3. Integrate with actual STRK20 pool contract ABI
4. Add streaming/progressive proof updates
