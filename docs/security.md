# Security

Security model, threat analysis, and best practices for Nexora Protocol.

---

## Threat Model

### Assets

| Asset | Value | Exposure |
|-------|-------|----------|
| User funds in bridge | High | Temporary (relayer hot wallet) |
| User funds in STRK20 pool | High | Long-term (shielding) |
| Relayer inventory | Medium | Hot wallet risk |
| User viewing keys | High | Database breach |
| User private notes | High | Database breach |

### Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| External attacker | Steal funds | High |
| Malicious relayer operator | Steal inventory | Medium |
| Compromised bridge | Redirect funds | Medium |
| Chain reorganizations | Double-spend | Low (Starknet finality) |
| Phishing | Steal wallet credentials | High |

---

## Attack Vectors

### 1. Relayer Theft

**Vector:** Relayer hot wallet is compromised.  
**Impact:** Loss of inventory funds.  
**Mitigation:**
- Multisig relayer wallets (2-of-3 Gnosis Safe)
- Limited inventory (24h operational needs only)
- Real-time monitoring and alerts
- Hot wallet rotation

### 2. Bridge Manipulation

**Vector:** LayerSwap or StarkGate is compromised or goes down.  
**Impact:** Funds stuck in bridge.  
**Mitigation:**
- Multiple bridge providers
- Fallback routes
- Timeout escrows
- User refund path

### 3. Smart Contract Vulnerability

**Vector:** PrivacyHub contract has a bug.  
**Impact:** User funds locked or stolen.  
**Mitigation:**
- Formal verification (where possible)
- Extensive unit tests
- Bug bounty (post-hackathon)
- Audit (post-hackathon)
- Upgradeable with timelock (or immutable after deployment)

### 4. Prover Manipulation

**Vector:** Prover service generates invalid proofs.  
**Impact:** Invalid withdrawals or transfers.  
**Mitigation:**
- Use hosted prover from STRK20 (trusted)
- Verify proofs on-chain (pool does this)
- Fallback to secondary prover

### 5. Database Breach

**Vector:** Relayer database is breached.  
**Impact:** Viewing keys and note metadata leaked.  
**Mitigation:**
- Encrypt viewing keys at rest (AES-256-GCM)
- Never store private notes in plaintext
- Database access restricted to relayer service
- Regular security audits

### 6. Phishing

**Vector:** User connects to fake Nexora Protocol site.  
**Impact:** Wallet drain.  
**Mitigation:**
- Clear branding
- ENS / DNS verification
- Warning on first visit
- EIP-191 signature verification

### 7. Metadata Leakage

**Vector:** Amount, timing, or address patterns link source to destination.  
**Impact:** Reduced privacy.  
**Mitigation:**
- Use LayerSwap (shared liquidity, less correlation)
- Time jitter on withdrawals
- Amount rounding
- Fresh addresses
- Honest privacy claims ("minimized linkability")

---

## Smart Contract Security

### PrivacyHub Design

```cairo
// Access control
mod view_only {
    // Read-only functions
}

mod admin {
    // Admin functions (add token, set pool)
}

mod user {
    // User functions (shield, unshield, transfer)
}
```

### Input Validation

```cairo
fn shield(ref self: ContractState, token: ContractAddress, amount: u256) {
    // Validate token is supported
    assert(self.supported_tokens.read(token), "Token not supported");
    
    // Validate amount > 0
    assert(amount > 0, "Amount must be positive");
    
    // Validate ERC-20 transfer succeeded
    let balance_before = IERC20Dispatcher { ... }.balance_of(self.contract_address);
    // ... transfer ...
    let balance_after = IERC20Dispatcher { ... }.balance_of(self.contract_address);
    assert(balance_after - balance_before == amount, "Transfer mismatch");
}
```

### Reentrancy Guard

Cairo has built-in reentrancy protection, but be explicit:

```cairo
#[external(v0)]
fn shield(ref self: ContractState, ...) {
    self.status.write(Status::Shielding);
    // ... logic ...
    self.status.write(Status::Idle);
}
```

---

## Operational Security

### Relayer

| Practice | Implementation |
|----------|---------------|
| Secret management | HashiCorp Vault or AWS Secrets Manager |
| Key rotation | Monthly rotation of hot wallet keys |
| Monitoring | Real-time alerts for unusual outflows |
| Backups | Encrypted database backups |
| Access control | Least-privilege IAM roles |

### Infrastructure

| Practice | Implementation |
|----------|---------------|
| HTTPS only | TLS 1.3, HSTS |
| Rate limiting | Prevent DoS |
| CORS | Whitelist domains |
| CSP | Content Security Policy headers |
| DDoS protection | Cloudflare or similar |

---

## Secrets Management

**Never commit secrets.** This includes:
- Private keys
- API keys
- Database passwords
- Prover URLs (if authenticated)
- Encryption keys

**Use:**
- Environment variables
- Secret managers (Vault, AWS Secrets Manager)
- Encrypted files (SOPS, git-crypt)

---

## Incident Response

### If a Vulnerability is Found

1. **Assess:** Determine severity and exploitability
2. **Contain:** Pause affected services
3. **Fix:** Deploy patch
4. **Disclose:** Notify users and STRK20 team
5. **Learn:** Post-mortem

### If Funds are at Risk

1. **Immediate:** Pause all withdrawals via emergency stop
2. **Investigate:** Determine root cause
3. **Recover:** Return funds if possible
4. **Communicate:** Transparent updates

---

## Security Checklist (Pre-Submission)

- [ ] All dependencies up to date
- [ ] No secrets in git history
- [ ] Contract audited (at minimum self-reviewed)
- [ ] Relayer uses multisig
- [ ] Database encrypted at rest
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Incident response plan documented
- [ ] Backup and recovery tested

---

## Next Steps

- [Compliance](docs/compliance.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Sprint Roadmap](docs/roadmap.md)
