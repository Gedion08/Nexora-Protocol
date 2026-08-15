# Glossary

Terms and definitions used throughout Nexora Protocol documentation.

---

## A

### Account Abstraction (AA)
A Starknet feature that allows smart contracts to control user accounts, enabling features like multisig, social recovery, and paymaster-sponsored transactions.

### Anonymity Set
The group of users whose shielded transactions are indistinguishable from each other. A larger anonymity set provides stronger privacy.

### Anonymizer Contract
A STRK20 helper contract that enables private DeFi operations (swaps, lending) within the privacy pool.

---

## B

### Bridge
A protocol that moves assets between blockchains. Nexora Protocol uses LayerSwap and StarkGate as bridges.

---

## C

### Cairo
The native smart contract and proving language for Starknet. Nexora Protocol's PrivacyHub contract is written in Cairo.

### Compliance
Regulatory requirements including sanctions screening (FPI), viewing keys for audit, and selective disclosure for tax and regulatory reporting.

---

## D

### Deterministic Account
A Starknet account derived from a source-chain wallet signature, so the user does not need a separate Starknet wallet.

### Disclosure
A zero-knowledge proof that reveals a specific fact about a private transaction without revealing the entire transaction.

---

## E

### Earn-Contracts
An existing Starknet pattern for cross-chain yield that uses deterministic account generation. Nexora Protocol reuses this pattern for privacy onboarding.

### ERC-20
Ethereum token standard. Also used on Starknet via token bridges.

---

## F

### FPI (Financial Privacy Inc)
The compliance provider that screens all STRK20 deposits against sanctions lists before the pool accepts them.

### Fresh Address
A newly generated address with no prior transaction history. Used as the destination for withdrawals to minimize linkability.

---

## G

### Gas
The fee paid to execute transactions on a blockchain. On Starknet, gas is paid in STRK (ETH equivalent).

---

## H

### Hub
See PrivacyHub.

---

## I

### Idempotency Key
A unique key for each intent that prevents duplicate execution if the same request is submitted multiple times.

### Indexer
A service that scans the STRK20 pool and indexes private notes so users can discover their balances.

---

## J

---

## K

### Katana
A local Starknet node for development and testing.

---

## L

### LayerSwap
A cross-chain bridge API that supports Arbitrum, Base, Ethereum, Optimism, and Starknet.

---

## M

### MetaMask
A popular EVM wallet browser extension. Used as the source-chain wallet in Nexora Protocol's MVP.

### Multisig
A wallet that requires multiple signatures to authorize transactions. Used for relayer inventory security.

---

## N

### Note
An encrypted representation of a shielded balance in the STRK20 pool. Notes are transferred privately via nullifiers.

### Nullifier
A unique identifier emitted when a note is spent. Prevents double-spending while keeping the transaction private.

---

## O

### OFAC
U.S. Treasury's Office of Foreign Assets Control. Sanctions compliance is enforced via FPI deposit screening.

---

## P

### Paymaster
A Starknet account abstraction feature that sponsors gas fees for users. Nexora Protocol uses Paymaster so users never hold STRK.

### Phantom
A popular Solana wallet browser extension. Planned for stretch goals.

### Poseidon Hash
A ZK-friendly hash function used in STRK20 for viewing key derivation and note commitments.

### Privacy Health Score
A heuristic score (0-100) that indicates how private a transaction is based on pool size, amount uniqueness, timing, and address reuse.

### PrivacyHub
The Cairo smart contract that wraps the STRK20 pool for Nexora Protocol flows.

### Prover
A service that generates zero-knowledge proofs for STRK20 operations (unshield, transfer).

---

## Q

### Queue
The relayer's internal queue for pending bridge and privacy operations.

---

## R

### Relayer
An off-chain service that executes PrivacyHub operations on behalf of users. Relayers pay gas and hold bridge inventory.

### RFP-09
The STRK20 Request for Startups entry that defines the Cross-Chain Privacy Hub idea. Nexora Protocol implements RFP-09.

---

## S

### Sanctions Screening
The process of checking addresses against OFAC and other regulatory lists. Enforced by FPI on all STRK20 deposits.

### Scarb
The Cairo package manager and build tool.

### Selective Disclosure
The ability to prove specific facts about a private transaction without revealing everything.

### Sepolia
The Starknet testnet. Used for development and testing before mainnet.

### Shield
The act of depositing tokens into the STRK20 pool and receiving a private note.

### Shielding
See Shield.

### Snforge
The Cairo testing framework.

### StarkGate
The canonical Starknet bridge for moving assets between Ethereum L1 and Starknet L2.

### Starknet
A Layer 2 scaling solution for Ethereum that uses ZK-Rollups and Cairo smart contracts.

### StarkWare
The company behind Starknet and Cairo.

### STRK
The native token of Starknet. Used for gas and governance.

### STRK20
The privacy layer on Starknet. Provides shielded balances, private transfers, and private DeFi via the STRK20 pool.

---

## T

### Testnet
A blockchain used for testing. See Sepolia.

### Transaction Hash
A unique identifier for a blockchain transaction. Used to verify mainnet transactions in `strk20.json`.

### Trust Model
The set of assumptions about which parties are trusted and to what degree.

### Turbo
A monorepo build system for JavaScript/TypeScript projects.

---

## U

### Unshield
The act of redeeming a private note for tokens on a destination address.

### Unshielding
See Unshield.

---

## V

### Nexora Protocol
The product name for this project. A cross-chain privacy routing protocol that uses Starknet as the privacy layer.

### Viewing Key
A key derived from a wallet signature that allows the holder to decrypt private notes and discover private balances.

### Voyager
A Starknet block explorer. Used to verify mainnet transactions.

---

## W

### Wallet
A software application that stores cryptographic keys and interacts with blockchains. Examples: MetaMask, Phantom, Argent, Braavos.

---

## Z

### Zero-Knowledge Proof
A cryptographic proof that a statement is true without revealing the statement itself. STRK20 uses ZK proofs for private transfers and withdrawals.

---

## Next Steps

- [Architecture Overview](docs/architecture/overview.md)
- [Sprint Roadmap](docs/roadmap.md)
- [STRK20 Integration](docs/integration/strk20.md)
