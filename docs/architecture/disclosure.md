# Selective Disclosure

Selective Disclosure lets users prove specific facts about their private transactions without revealing their entire private state.

---

## Why Selective Disclosure Matters

Privacy without compliance is a dead end. Tornado Cash learned this the hard way. Nexora Protocol's competitive advantage is that privacy and compliance are not opposites — they are composable.

**Use cases:**
- Tax reporting: "I received $10,000 in crypto this year"
- Audit: "None of our funds touched sanctioned addresses"
- Legal: "This transaction was not related to activity X"
- DeFi: "I have sufficient collateral" without revealing total balance

---

## Disclosure Types

### Full Disclosure

Everything is visible. Equivalent to unshielding fully.

```typescript
const fullDisclosure = await disclosureService.generate({
  type: "full",
  viewingKey: viewingKey,
});
```

**Use when:** User wants complete transparency. E.g., migrating to a compliant platform.

### Partial Disclosure

User selects which fields to disclose.

```typescript
const partialDisclosure = await disclosureService.generate({
  type: "partial",
  viewingKey: viewingKey,
  fields: ["amount", "timestamp", "token"],
});
```

**Use when:** User wants to share specific information with a counterparty.

### Amount Disclosure

Proves transaction value is above/below a threshold without revealing the exact amount.

```typescript
const amountDisclosure = await disclosureService.generate({
  type: "amount",
  transactionHash: "0x...",
  threshold: 10_000, // USD
  operator: ">=",
});
```

**Use when:** Tax authority needs to know if transaction exceeds reporting threshold.

### Source Disclosure

Proves funds originated from a specific wallet.

```typescript
const sourceDisclosure = await disclosureService.generate({
  type: "source",
  viewingKey: viewingKey,
  sourceAddress: "0x...",
});
```

**Use when:** Proving funds came from a known source (e.g., employer, CEX withdrawal).

### Auditor Disclosure

Grants a designated auditor complete decryption access.

```typescript
const auditorDisclosure = await disclosureService.generate({
  type: "auditor",
  viewingKey: viewingKey,
  auditorPublicKey: auditorPublicKey,
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
});
```

**Use when:** Company needs annual audit; regulator needs investigation access.

### No Disclosure

Minimal public data only. Default for all transactions.

```typescript
const noDisclosure = await disclosureService.generate({
  type: "none",
  transactionHash: "0x...",
});
```

**Use when:** User wants maximum privacy.

---

## Implementation

### Proof Generation

```typescript
interface DisclosureProof {
  type: DisclosureType;
  statement: string;
  proof: string;               // ZK proof hex
  publicInputs: string[];
  verifiedAt: number;
  expiresAt?: number;
}

class DisclosureService {
  async generate(params: GenerateDisclosureParams): Promise<DisclosureProof> {
    switch (params.type) {
      case "full":
        return this.generateFullDisclosure(params);
      case "partial":
        return this.generatePartialDisclosure(params);
      case "amount":
        return this.generateAmountDisclosure(params);
      case "source":
        return this.generateSourceDisclosure(params);
      case "auditor":
        return this.generateAuditorDisclosure(params);
      case "none":
        return this.generateNoDisclosure(params);
    }
  }
  
  async verify(proof: DisclosureProof): Promise<boolean> {
    // Verify ZK proof on-chain or off-chain
    const isValid = await this.prover.verifyProof(proof.proof, proof.publicInputs);
    return isValid && (!proof.expiresAt || proof.expiresAt > Date.now());
  }
}
```

### Viewing Key Sharing

For `auditor` type disclosure, the viewing key is shared directly (encrypted).

```typescript
async function shareViewingKeyWithAuditor(
  viewingKey: ViewingKey,
  auditorPublicKey: string
): Promise<string> {
  const encryptedKey = encrypt(
    viewingKey.serialize(),
    auditorPublicKey
  );
  
  // Store in relayer DB (auditor can decrypt with their key)
  await db.auditorKeys.insert({
    auditorPublicKey,
    encryptedViewingKey: encryptedKey,
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });
  
  return encryptedKey;
}
```

---

## Privacy Health Score

For every transaction, Nexora Protocol computes a Privacy Health Score that helps users understand their exposure.

```typescript
interface PrivacyHealth {
  score: number;               // 0-100
  factors: {
    poolSize: number;          // Current anonymity set size
    amountUniqueness: number;  // How unique the amount is (0-100)
    timingUniqueness: number;  // How unique the timing is (0-100)
    sourceReuse: number;       // Has source been used before? (0-100)
    destinationReuse: number;  // Has destination been used before? (0-100)
  };
}

function calculatePrivacyHealth(route: Route): PrivacyHealth {
  const poolSize = getCurrentPoolSize();
  const amount = BigInt(route.intent.amount);
  
  return {
    score: Math.round(
      poolSize * 0.2 +
      amountUniqueness(amount) * 0.2 +
      timingUniqueness() * 0.2 +
      sourceReuse(route.intent.from) * 0.2 +
      destinationReuse(route.intent.to) * 0.2
    ),
    factors: {
      poolSize,
      amountUniqueness: amountUniqueness(amount),
      timingUniqueness: timingUniqueness(),
      sourceReuse: sourceReuse(route.intent.from),
      destinationReuse: destinationReuse(route.intent.to),
    },
  };
}
```

**Display:**

```
PRIVACY HEALTH
████████████████░░░░ 82/100

Factors:
• Anonymity set: 1,284 deposits
• Amount uniqueness: 65/100
• Timing uniqueness: 90/100
• Source reuse: First use
• Destination reuse: Fresh address
```

**Important:** This is a heuristic, not a mathematical guarantee. Label it as such.

---

## UI Components

### Disclosure Manager

```typescript
function DisclosureManager({ viewingKey }: { viewingKey: ViewingKey }) {
  const [proofs, setProofs] = useState<DisclosureProof[]>([]);
  
  return (
    <div>
      <h3>Disclosures</h3>
      <DisclosureForm viewingKey={viewingKey} onGenerated={setProofs} />
      <DisclosureList proofs={proofs} />
    </div>
  );
}
```

### Privacy Health Display

```typescript
function PrivacyHealth({ health }: { health: PrivacyHealth }) {
  return (
    <div>
      <div className="text-2xl font-bold">{health.score}/100</div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${health.score}%` }}
        />
      </div>
      <div className="mt-2 text-sm text-gray-600">
        {health.factors.poolSize} in pool
      </div>
    </div>
  );
}
```

---

## Next Steps

- [Privacy Core](docs/architecture/privacy-core.md)
- [Compliance](docs/compliance.md)
- [Architecture Overview](docs/architecture/overview.md)
