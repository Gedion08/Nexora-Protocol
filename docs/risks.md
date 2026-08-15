# Risk Register

Identified risks, mitigations, and owners for Nexora Protocol.

---

## Risk Summary

| ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|----|------|-------------|--------|------------|-------|--------|
| R1 | Bridge UX fragility | High | High | Pre-funded relayer inventory; LayerSwap primary | Backend | Open |
| R2 | Deterministic account derivation finicky | Medium | High | Start EVM-only; Solana is stretch | Contracts | Open |
| R3 | Small anonymity set at launch | High | Medium | Network-effects narrative; document growth curve | All | Open |
| R4 | STRK20 mainnet prover endpoint missing | Medium | High | Use Sepolia until published; don't guess | Backend | Open |
| R5 | STRK20 mainnet indexer endpoint missing | Medium | High | Use Sepolia until published; don't guess | Backend | Open |
| R6 | Paymaster not configured | Medium | High | Pre-fund accounts manually as fallback | Contracts | Open |
| R7 | FPI screening blocks deposits | Low | High | Monitor sanctions lists; inform users upfront | All | Open |
| R8 | Smart contract bug | Low | Critical | Extensive testing; audit post-hackathon | Contracts | Open |
| R9 | Bridge API downtime | Medium | High | Fallback bridge (StarkGate); retry logic | Backend | Open |
| R10 | Relayer hot wallet compromise | Low | Critical | Multisig; limited inventory; monitoring | Backend | Open |

---

## Detailed Risk Analysis

### R1: Bridge UX Fragility

**Description:** LayerSwap, StarkGate, and Orbiter APIs can be flaky. Bridge delays or failures break the user experience.

**Impact:** High — users see failures and abandon the product.

**Probability:** High — external APIs are unreliable by nature.

**Mitigation:**
1. **Pre-funded relayer inventory** (primary): The relayer holds inventory and executes bridges on behalf of users. If LayerSwap is down, the relayer can fall back to StarkGate.
2. **Inventory management:** Keep 24h worth of bridging capacity in hot wallets.
3. **Fallback routes:** Always have a secondary bridge ready.
4. **User communication:** Show clear status updates ("Bridging...", "This may take 2 minutes").

**Residual Risk:** Low. Relayer inventory absorbs most bridge flakiness.

---

### R2: Deterministic Account Derivation

**Description:** Deriving Starknet accounts from EVM/Solana signatures is finicky across chains. Poseidon hashing, curve arithmetic, and account class hash must all align.

**Impact:** High — if accounts don't work, users can't receive funds on Starknet.

**Probability:** Medium — earn-contracts pattern works, but edge cases exist.

**Mitigation:**
1. **Start EVM-only:** MetaMask on Arbitrum → fresh Starknet account → Base. Solana is stretch.
2. **Reuse earn-contracts code:** The pattern is already shipped and tested.
3. **Extensive testing:** Test on Sepolia before mainnet.
4. **Fallback:** If deterministic account fails, fall back to user-provided Starknet address.

**Residual Risk:** Low. EVM derivation is well-understood.

---

### R3: Small Anonymity Set

**Description:** At launch, Nexora Protocol is the only user of the STRK20 pool (or one of few). The anonymity set is small.

**Impact:** Medium — judges may question the value proposition.

**Probability:** High — this is a new product.

**Mitigation:**
1. **Narrative framing:** Position Nexora Protocol as the onboarding funnel that grows the set. "The product is the funnel."
2. **Document growth curve:** In README, show expected anonymity set growth as adoption increases.
3. **Network effects:** Emphasize that every user strengthens every other user's privacy.
4. **Pool metrics:** Show total pool deposits, not just Nexora Protocol-specific ones.

**Residual Risk:** Acceptable. The hackathon judges understand this is a prototype.

---

### R4: Missing Mainnet Prover Endpoint

**Description:** The STRK20 mainnet prover URL was not published at sprint start.

**Impact:** High — cannot generate proofs on mainnet.

**Probability:** Medium — based on Day 0 guide.

**Mitigation:**
1. **Use Sepolia prover:** Build and test on Sepolia first.
2. **Open issue:** Ask STRK20 team for mainnet prover URL.
3. **Fallback:** If mainnet prover is unavailable, use hosted prover from STRK20 team.
4. **Don't guess:** Wrong prover URL causes silent failures.

**Residual Risk:** Low. STRK20 team publishes endpoints before deadline.

---

### R5: Missing Mainnet Indexer Endpoint

**Description:** The STRK20 mainnet indexer URL was not published at sprint start.

**Impact:** High — cannot discover notes on mainnet.

**Probability:** Medium — based on Day 0 guide.

**Mitigation:**
1. **Use Sepolia indexer:** Build and test on Sepolia first.
2. **Open issue:** Ask STRK20 team for mainnet indexer URL.
3. **Fallback:** If indexer is unavailable, use event scanning as fallback (slower, less reliable).

**Residual Risk:** Low. STRK20 team publishes endpoints before deadline.

---

### R6: Paymaster Not Configured

**Description:** The Paymaster is required to sponsor gas for deterministic accounts. If it's not configured, users can't execute Starknet transactions.

**Impact:** High — product is unusable without Paymaster.

**Probability:** Medium — Paymaster setup is non-trivial.

**Mitigation:**
1. **Manual funding:** Pre-fund deterministic accounts with STRK as fallback.
2. **User-funded fallback:** Ask user to hold STRK (worse UX, but works).
3. **Starknet.js paymaster support:** Use built-in paymaster integration.

**Residual Risk:** Low. Manual funding is a viable fallback.

---

### R7: FPI Screening Blocks Deposits

**Description:** FPI (Financial Privacy Inc) screens all deposits. If the source address is on a sanctions list, the deposit is rejected.

**Impact:** High — legitimate users may be blocked.

**Probability:** Low — most users are not on sanctions lists.

**Mitigation:**
1. **Inform users upfront:** Show compliance notice before deposit.
2. **Error messaging:** Clear message if deposit is screened out.
3. **Support channel:** Provide way for users to appeal.

**Residual Risk:** Acceptable. Compliance is a feature, not a bug.

---

### R8: Smart Contract Bug

**Description:** PrivacyHub or other Cairo contracts have a bug that leads to lost or stolen funds.

**Impact:** Critical — user funds at risk.

**Probability:** Low — contracts are simple wrappers around STRK20 pool.

**Mitigation:**
1. **Extensive testing:** Unit tests, integration tests, fuzz tests.
2. **Formal verification:** Where possible.
3. **Audit:** Post-hackathon audit.
4. **Bug bounty:** Post-hackathon.
5. **Immutable contracts:** Once deployed, cannot be changed.

**Residual Risk:** Acceptable for hackathon. Production requires audit.

---

### R9: Bridge API Downtime

**Description:** LayerSwap or StarkGate API is down when user needs to bridge.

**Impact:** High — user cannot complete transaction.

**Probability:** Medium — external APIs have downtime.

**Mitigation:**
1. **Fallback bridge:** StarkGate as fallback for LayerSwap.
2. **Retry logic:** Exponential backoff with max retries.
3. **Health checks:** Monitor bridge API status.
4. **User notification:** Alert user if bridge is down.

**Residual Risk:** Low. Multiple bridges + retry logic.

---

### R10: Relayer Hot Wallet Compromise

**Description:** Relayer hot wallet is compromised and funds are stolen.

**Impact:** Critical — inventory loss.

**Probability:** Low — with proper security.

**Mitigation:**
1. **Multisig:** 2-of-3 Gnosis Safe for inventory wallets.
2. **Limited inventory:** Only 24h worth of funds in hot wallet.
3. **Real-time monitoring:** Alerts for unusual outflows.
4. **Key rotation:** Monthly rotation of keys.
5. **Insurance:** Consider bridge insurance (post-hackathon).

**Residual Risk:** Low. Multisig + limited inventory + monitoring.

---

## Risk Heatmap

```
Impact
  High │ R8 │ R1,R4,R5,R6 │ R1 │ R1
       │    │             │    │
  Med  │    │ R3          │    │
       │    │             │    │
   Low │ R7 │ R9          │    │ R2
       │    │             │    │
       └────┴─────────────┴────┴──── Prob
            Low            Med   High
```

---

## Next Steps

- [Sprint Roadmap](docs/roadmap.md)
- [Demo Plan](docs/demo.md)
- [Security](docs/security.md)
