# Testing Strategy

Testing strategy for Nexora Protocol. Tests are organized by layer and run at different stages of the sprint.

---

## Test Pyramid

```
        /\
       /  \      E2E (10%)
      /----\
     /      \    Integration (30%)
    /--------\
   /          \  Unit (60%)
  /------------\
```

---

## Unit Tests

### Contracts (Cairo)

```bash
cd packages/contracts
snforge test
```

**Test categories:**
- Shield/unshield operations
- Viewing key registration
- Private transfer logic
- Admin functions
- Edge cases (zero amount, overflow, unauthorized caller)

**Example:**

```cairo
#[test]
fn test_shield_success() {
    let mut contract = setup_contract();
    let token = get_test_token();
    let amount = 1_000_000;

    contract.shield(token, amount);

    // Verify pool received funds
    // Verify note was issued
    // Verify event was emitted
}
```

### SDK (TypeScript)

```bash
cd packages/sdk
pnpm test
```

**Test categories:**
- Viewing key derivation
- Shield/unshield building
- Note discovery
- Error handling

### Relayer (TypeScript)

```bash
cd packages/relayer
pnpm test
```

**Test categories:**
- Bridge adapter mocks
- Inventory management
- Route selection logic
- Retry logic

---

## Integration Tests

### End-to-End on Sepolia

Run against Sepolia testnet with test tokens.

```bash
pnpm test:e2e:sepolia
```

**Test flow:**
1. Register viewing key
2. Shield test USDC
3. Discover notes
4. Private transfer
5. Unshield to fresh address
6. Verify on Voyager

### Full Route Test (Sepolia)

```bash
pnpm test:route:sepolia
```

**Test flow:**
1. Simulate Arbitrum deposit (LayerSwap sandbox)
2. Shield on Starknet
3. Unshield to Base
4. Verify all transactions

---

## Mainnet Tests

### Day 0 Checklist

Before building any code, verify mainnet access:

```bash
# 1. Fund Starknet wallet
# Send STRK from CEX to your Starknet address

# 2. Register viewing key
# Use script or manual transaction

# 3. Shield
# Deposit small amount of USDC

# 4. Verify on Voyager
# Check that deposit event exists
```

### Mainnet Transaction Checklist

Each transaction must:
- Exist on-chain
- Have succeeded
- Touch the STRK20 pool
- Be verifiable on Voyager

```bash
# Verify transaction
curl "https://voyager.online/api/v1/tx/{tx_hash}"
```

### Three Required Transactions

```json
{
  "transactions": [
    "0x07c0...",  // Viewing key registration
    "0x04b2...",  // Shield
    "0x0919..."   // Private transfer or unshield
  ]
}
```

---

## Load Tests

Relayer API should handle concurrent requests.

```bash
pnpm test:load
```

**Scenarios:**
- 100 concurrent deposit requests
- 50 concurrent withdrawal requests
- Bridge API failure simulation

---

## Test Data

### Test Tokens

| Token | Sepolia Address | Mainnet Address |
|-------|----------------|-----------------|
| USDC | (check SDK docs) | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| USDT | (check SDK docs) | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| ETH | Native | Native |

### Test Addresses

Use deterministic test addresses:
- Source: `0x7e5d45561f65654d5c6e454d756e74a2a4b544f84a0e8eaf1d3e51d6c3b6a7b8`
- Destination: `0x9f4c2a8b6d5e3f1c7a9b8d2e4f6a8c0b2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2`

---

## CI/CD

### GitHub Actions

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm test
      - run: pnpm lint
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
```

---

## Security Tests

### Static Analysis

```bash
# Cairo contracts
cd packages/contracts
cairo-run --available-gas 200000000000000

# TypeScript
pnpm lint
pnpm typecheck
```

### Dependency Audit

```bash
pnpm audit
```

### Secrets Scan

```bash
# Never commit secrets
grep -r "0x[0-9a-fA-F]{64}" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "mnemonic" . --exclude-dir=node_modules --exclude-dir=.git
```

---

## Test Coverage Targets

| Component | Target |
|-----------|--------|
| Contracts | >= 90% |
| SDK | >= 85% |
| Relayer | >= 80% |
| Frontend | E2E smoke tests only |

---

## Next Steps

- [Architecture Overview](docs/architecture/overview.md)
- [Sprint Roadmap](docs/roadmap.md)
- [Security](docs/security.md)
