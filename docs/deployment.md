# Deployment

Deployment guide for Nexora Protocol components.

---

## Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Sepolia | Testing | https://nexora-protocol-sepolia.vercel.app |
| Mainnet | Production | https://nexora-protocol.xyz |
| Staging | Pre-production | https://staging.nexora-protocol.xyz |

---

## Contracts

### PrivacyHub (Cairo)

**Deploy with Scarb + Starkli:**

```bash
# Build
cd packages/contracts
scarb build

# Deploy to Sepolia
starkli deploy \
  --rpc https://rpc.starknet.sepolia.build \
  --account deployer_account \
  target/dev/nexora-protocol_router_PrivacyHub.contract_class.json

# Verify on Starkscan
starkli declare \
  --rpc https://rpc.starknet.sepolia.build \
  --account deployer_account \
  target/dev/nexora-protocol_router_PrivacyHub.contract_class.json
```

### Deterministic Account (Cairo)

```bash
# Deploy account implementation
starkli deploy \
  --rpc https://rpc.starknet.sepolia.build \
  --account deployer_account \
  target/dev/nexora-protocol_router_DeterministicAccount.contract_class.json
```

---

## Relayer

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .

RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start:relayer"]
```

### Deploy to Fly.io

```bash
fly launch
fly deploy
```

### Deploy to Render

```bash
# Connect GitHub repo
# Set environment variables
# Deploy
```

---

## Frontend

### Vercel

```bash
vercel --prod
```

### GitHub Pages

```bash
pnpm build
pnpm export
# Deploy to gh-pages branch
```

---

## Database

### PostgreSQL

```sql
-- Schema
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  route_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  intent JSONB NOT NULL,
  steps JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE deposits (
  id SERIAL PRIMARY KEY,
  bridge_tx_hash VARCHAR(255) UNIQUE NOT NULL,
  source_chain VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  token VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE withdrawals (
  id SERIAL PRIMARY KEY,
  starknet_tx_hash VARCHAR(255) UNIQUE,
  destination_chain VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  token VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
```

---

## Environment Variables

### Production

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_CHAIN_ID` | `SN_MAIN` | |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc.starknet.lava.build` | |
| `NEXT_PUBLIC_POOL_ADDRESS` | `0x0403...` | Mainnet pool |
| `RELAYER_DB_URL` | `postgres://...` | Production DB |
| `RELAYER_PRIVATE_KEY` | `0x...` | Relayer hot wallet (encrypted) |

---

## Monitoring

### Health Checks

```typescript
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    services: {
      database: checkDatabase(),
      bridge: checkBridgeAPI(),
      starknet: checkStarknetRPC(),
      prover: checkProverService(),
    },
  });
});
```

### Alerts

- Bridge API down
- Inventory low (< 24h supply)
- Prover service down
- Database connection lost
- High error rate (> 5%)

---

## Rollback

### Frontend

```bash
vercel rollback
```

### Contracts

Cairo contracts are immutable after deployment. If a bug is found:
1. Deploy new contract version
2. Update PrivacyHub address in frontend
3. Migrate state if necessary

### Relayer

```bash
# Rollback to previous version
fly deploy --image fly-registry.example/nexora-protocol-relayer:previous
```

---

## Next Steps

- [Sprint Roadmap](docs/roadmap.md)
- [Demo Plan](docs/demo.md)
- [Risk Register](docs/risks.md)
