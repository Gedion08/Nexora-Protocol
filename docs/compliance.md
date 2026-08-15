# Compliance

Nexora Protocol's compliance model. Critical for judging and long-term viability.

---

## Compliance Philosophy

Nexora Protocol is **compliance-native, not compliance-optional.**

Unlike Tornado Cash (OFAC-sanctioned), Nexora Protocol builds compliance into the protocol from day one:
- Mandatory deposit screening via FPI
- Viewing key registration for audit
- Selective disclosure for tax and regulatory reporting
- No evasion of sanctions

---

## Compliance Layers

### Layer 1: Deposit Screening (FPI)

Every deposit into the STRK20 pool is screened by Financial Privacy Inc (FPI) before the pool accepts it.

**What FPI checks:**
- Source address against sanctions lists (OFAC, EU, UN)
- Suspicious activity patterns
- High-risk jurisdictions

**What Nexora Protocol does:**
- Nexora Protocol does not bypass FPI screening
- Nexora Protocol does not collect KYC data
- Nexora Protocol relies on the pool's mandatory screening

**Important:** Deposit screening is enforced **on-chain**. If a deposit is screened out, the pool reverts. Running a custom prover does not bypass this.

---

### Layer 2: Viewing Keys

Viewing keys let authorized parties (user, auditor, regulator) decrypt private transaction history.

```typescript
// User generates viewing key
const viewingKey = await ViewingKey.fromWallet(wallet);

// User shares with auditor
const auditorProof = await generateAuditorProof(viewingKey);

// Auditor decrypts transaction history
const history = await decryptHistory(auditorProof);
```

**Use cases:**
- Tax reporting (user proves transactions to tax authority)
- Audit (company proves no sanctioned addresses)
- Legal process (court order decryption)

---

### Layer 3: Selective Disclosure

Selective disclosure lets users prove specific facts without revealing everything.

| Disclosure Type | Use Case |
|-----------------|----------|
| `full` | User wants complete transparency |
| `amount` | Prove transaction value for tax |
| `source` | Prove funds came from specific wallet |
| `auditor` | Grant auditor full access |
| `none` | Maximum privacy |

```typescript
const proof = await disclosureService.generateProof({
  type: "amount",
  transactionHash: "0x...",
  threshold: 10_000, // Prove amount >= $10,000
});

// User submits proof to tax authority
// Authority verifies without seeing full history
```

---

## What Nexora Protocol Does NOT Do

- **No KYC collection:** Nexora Protocol never asks for identity documents
- **No blacklisting:** Nexora Protocol does not maintain its own blacklist (relies on FPI)
- **No surnexora-protocollance:** Nexora Protocol does not track users beyond route execution
- **No guaranteed anonymity:** Nexora Protocol claims "minimized linkability," not "mathematically impossible to link"

---

## Regulatory Considerations

### United States

- **OFAC compliance:** FPI screening satisfies OFAC requirements
- **FinCEN:** If Nexora Protocol operates as a money transmitter, MSB registration may be required
- **State regulations:** Check state-by-state money transmission laws

### European Union

- **MiCA:** Stablecoin and crypto asset regulations apply
- **AMLD5/6:** Anti-money laundering directives
- **GDPR:** Viewing keys are personal data; ensure proper handling

### Other Jurisdictions

- Consult local counsel before operating in any jurisdiction
- Deposit screening does not replace local regulatory requirements

---

## Privacy Claims

**Correct:**
- "Privacy-preserving cross-chain transfer with minimized public linkability"
- "Funds are shielded from public view after deposit"
- "Selective disclosure available for compliance"

**Incorrect:**
- "Mathematically impossible to link" (unless the protocol proves this, which Nexora Protocol does not)
- "Zero-knowledge privacy" (overly broad)
- "Anonymous" (implies no link at all)

---

## Audit Log

Nexora Protocol maintains an internal audit log of all route executions for compliance purposes.

```typescript
interface AuditLog {
  routeId: string;
  userId: string;
  intent: PrivacyIntent;
  steps: RouteStep[];
  startTime: number;
  endTime: number;
  status: RouteStatus;
  complianceFlags: string[];
}
```

**Retention:** 7 years (standard financial record retention)

**Access:** Restricted to compliance team and legal process

---

## Next Steps

- [Security](docs/security.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Sprint Roadmap](docs/roadmap.md)
