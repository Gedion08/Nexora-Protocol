# Routing Engine

The Routing Engine converts user privacy intents into executable, multi-step routes. It is the brain of Nexora Protocol.

---

## Intent Schema

The user interface collects minimal information. The rest is computed.

```typescript
interface PrivacyIntent {
  from: ChainId;                // Source chain
  asset: string;                // Asset symbol (e.g. "USDC")
  amount: string;               // Human-readable amount
  to: ChainId;                  // Destination chain
  recipient: "fresh" | string;  // Fresh address or existing address
  privacy: PrivacyLevel;        // "maximum" | "standard" | "basic"
  maxFee?: string;              // Optional fee cap
  deadline?: number;            // Unix timestamp (ms)
  metadata?: Record<string, any>;
}

type PrivacyLevel = "maximum" | "standard" | "basic";
```

### Privacy Levels

| Level | Behavior |
|-------|----------|
| `maximum` | Fresh destination address, max bridge hops, min amount correlation, delay jitter |
| `standard` | Fresh destination if available, standard bridge, normal timing |
| `basic` | Allow existing address, fastest bridge, minimal extra privacy |

---

## Route Schema

```typescript
interface Route {
  id: string;
  intent: PrivacyIntent;
  steps: RouteStep[];
  estimatedTime: number;        // Total estimated time in ms
  estimatedFee: bigint;
  privacyScore: number;         // 0-100
  status: RouteStatus;
  fallbackRoutes: Route[];
}

interface RouteStep {
  order: number;
  type: RouteStepType;
  chain: ChainId;
  adapter: string;
  contract?: string;
  estimatedTime: number;
  description: string;
}

type RouteStepType = "bridge_in" | "shield" | "private_transfer" | "unshield" | "bridge_out";
```

### Example Route: Arbitrum → Base

```json
{
  "id": "route_abc123",
  "estimatedTime": 240000,
  "estimatedFee": "5000000",
  "privacyScore": 85,
  "steps": [
    {
      "order": 1,
      "type": "bridge_in",
      "chain": "arbitrum",
      "adapter": "layerswap",
      "description": "Bridge USDC from Arbitrum to Starknet via LayerSwap"
    },
    {
      "order": 2,
      "type": "shield",
      "chain": "starknet",
      "adapter": "privacy_hub",
      "contract": "0x0403...",
      "description": "Shield USDC into STRK20 private pool"
    },
    {
      "order": 3,
      "type": "private_transfer",
      "chain": "starknet",
      "adapter": "privacy_hub",
      "description": "Internal private transfer (optional)"
    },
    {
      "order": 4,
      "type": "unshield",
      "chain": "starknet",
      "adapter": "privacy_hub",
      "contract": "0x0403...",
      "description": "Unshield USDC to fresh Base address"
    },
    {
      "order": 5,
      "type": "bridge_out",
      "chain": "base",
      "adapter": "layerswap",
      "description": "Bridge USDC from Starknet to Base via LayerSwap"
    }
  ]
}
```

---

## Route Selection Algorithm

```typescript
class RouteSelector {
  private adapters: Map<string, ChainAdapter> = new Map();
  private reliabilityScores: Map<string, number> = new Map();
  
  async selectRoute(intent: PrivacyIntent): Promise<Route> {
    // 1. Get all valid adapters for source and destination
    const sourceAdapters = this.getAdaptersForChain(intent.from);
    const destAdapters = this.getAdaptersForChain(intent.to);
    
    // 2. Generate candidate routes
    const candidates = await this.generateCandidates(intent, sourceAdapters, destAdapters);
    
    // 3. Score each candidate
    const scored = candidates.map(route => ({
      route,
      score: this.scoreRoute(route, intent),
    }));
    
    // 4. Sort by score (higher is better)
    scored.sort((a, b) => b.score - a.score);
    
    // 5. Validate top route
    const top = scored[0];
    const validated = await this.validateRoute(top.route);
    
    if (!validated.valid) {
      // Try fallback
      return this.selectFallbackRoute(intent, scored);
    }
    
    return {
      ...top.route,
      fallbackRoutes: scored.slice(1, 3).map(s => s.route),
    };
  }
  
  private scoreRoute(route: Route, intent: PrivacyIntent): number {
    const weights = {
      fee: 0.3,
      time: 0.2,
      reliability: 0.2,
      privacy: 0.3,
    };
    
    const feeScore = this.normalizeFee(route.estimatedFee, intent.maxFee);
    const timeScore = this.normalizeTime(route.estimatedTime);
    const reliabilityScore = this.getAverageReliability(route);
    const privacyScore = route.privacyScore / 100;
    
    return (
      weights.fee * feeScore +
      weights.time * timeScore +
      weights.reliability * reliabilityScore +
      weights.privacy * privacyScore
    );
  }
}
```

---

## Route Execution

```typescript
class RouteExecutor {
  async execute(route: Route): Promise<RouteResult> {
    const results: RouteStepResult[] = [];
    
    for (const step of route.steps) {
      try {
        const result = await this.executeStep(step, route);
        results.push(result);
        
        if (result.status === "failed") {
          return await this.handleFailure(route, results);
        }
      } catch (error) {
        return await this.handleFailure(route, results);
      }
    }
    
    return {
      status: "completed",
      results,
      proof: this.generateReceipt(route, results),
    };
  }
  
  private async executeStep(step: RouteStep, route: Route): Promise<RouteStepResult> {
    switch (step.type) {
      case "bridge_in":
        return this.executeBridgeIn(step, route);
      case "shield":
        return this.executeShield(step, route);
      case "private_transfer":
        return this.executePrivateTransfer(step, route);
      case "unshield":
        return this.executeUnshield(step, route);
      case "bridge_out":
        return this.executeBridgeOut(step, route);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }
}
```

---

## Route State Machine

```
IDLE → SELECTING_ROUTE → EXECUTING → MONITORING → COMPLETED
                         │                      │
                         ▼                      ▼
                     FAILED (RETRY)          FAILED (REFUND)
```

### Route Status Values

```typescript
type RouteStatus = 
  | { state: "idle" }
  | { state: "selecting_route" }
  | { state: "executing"; currentStep: number }
  | { state: "monitoring" }
  | { state: "completed"; txHashes: string[] }
  | { state: "failed"; reason: string; refunded: boolean };
```

---

## Fallback Logic

```typescript
async function selectFallbackRoute(
  intent: PrivacyIntent,
  scored: ScoredRoute[]
): Promise<Route> {
  for (let i = 1; i < scored.length; i++) {
    const candidate = scored[i];
    const validated = await validateRoute(candidate.route);
    if (validated.valid) {
      return candidate.route;
    }
  }
  throw new Error("No valid fallback route available");
}
```

---

## Privacy Score Calculation

```typescript
function calculatePrivacyScore(route: Route): number {
  let score = 0;
  
  // Bridge diversity (0-30)
  const bridges = new Set(route.steps.filter(s => s.type === "bridge").map(s => s.adapter));
  score += Math.min(bridges.size * 15, 30);
  
  // Fresh address (0-25)
  if (route.intent.recipient === "fresh") {
    score += 25;
  }
  
  // Private transfer (0-20)
  if (route.steps.some(s => s.type === "private_transfer")) {
    score += 20;
  
```
