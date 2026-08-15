# Developer Setup

Setup guide for Nexora Protocol. Works on macOS and Linux.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.0.0 | Runtime |
| pnpm | >= 8.0.0 | Package manager |
| Git | >= 2.0.0 | Version control |
| Docker | >= 24.0.0 | Local Starknet node (optional) |
| Cairo | >= 2.0.0 | Smart contracts |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/nexora-protocol/nexora.git
cd nexora

# 2. Install dependencies
pnpm install

# 3. Copy environment
cp .env.example .env.local

# 4. Start all services
pnpm dev

# 5. Open browser
open http://localhost:3000
```

---

## Package Structure

```
nexora/
├── apps/
│   ├── web/           # Next.js frontend (port 3000)
│   └── docs/          # Documentation site
├── packages/
│   ├── contracts/     # Cairo smart contracts
│   ├── sdk/           # TypeScript SDK
│   ├── relayer/       # Backend relayer service (port 3001)
│   └── shared/        # Shared types and configs
├── infra/             # Docker, K8s, Terraform
└── scripts/           # Deploy, test, demo scripts
```

---

## Environment Variables

See [`.env.example`](../.env.example) for the full list.

### Required for Development

```bash
# STRK20
NEXT_PUBLIC_RPC_URL=https://rpc.starknet.sepolia.build
NEXT_PUBLIC_POOL_ADDRESS=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a

# Bridges
NEXT_PUBLIC_LAYERSWAP_API_URL=https://api.layerswap.io

# Database (relayer)
RELAYER_DB_URL=postgres://postgres:postgres@localhost:5432/nexora-protocol_relayer
```

---

## Local Development

### Frontend

```bash
pnpm dev:web
```

Opens Next.js on `http://localhost:3000`.

### Relayer

```bash
pnpm dev:relayer
```

Opens Express API on `http://localhost:3001`.

### Contracts

```bash
cd packages/contracts
snforge test
```

### SDK

```bash
cd packages/sdk
pnpm test
```

### All Services

```bash
pnpm dev
```

Starts all packages in watch mode via turborepo.

---

## Starknet Development

### Katana (Local Node)

```bash
docker run -p 5050:5050 \
  --rm \
  --name katana \
  --entrypoint sh \
  -e KATANA_GAS_PRICE=0 \
  -e KATANA_BLOCK_TIME=1 \
  dojoengine/katana:latest \
  -c "katana --dev --disable-fee"
```

### Account Funding (Sepolia)

```bash
# Using the official Starknet faucet
curl -X POST https://starknet-faucet.vercel.app/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "0xYOUR_ADDRESS"}'
```

---

## Testing

```bash
# All tests
pnpm test

# Frontend only
pnpm --filter web test

# Contracts only
pnpm --filter contracts test

# SDK only
pnpm --filter @nexora-protocol/sdk test

# E2E tests
pnpm test:e2e
```

---

## Linting

```bash
pnpm lint
pnpm format
```

---

## Deployment

```bash
# Deploy contracts to Sepolia
bash scripts/deploy/contracts.sh sepolia

# Deploy contracts to mainnet
bash scripts/deploy/contracts.sh mainnet

# Deploy frontend
bash scripts/deploy/demo.sh

# Deploy relayer
bash scripts/deploy/relayer.sh
```

---

## Troubleshooting

### "Pool address not found"

Verify `NEXT_PUBLIC_POOL_ADDRESS` matches the mainnet/Sepolia address exactly.

### "Prover service unavailable"

The mainnet prover URL was not published at sprint start. Use Sepolia prover until mainnet endpoint is available.

### "Indexer timeout"

Increase timeout in `.env.local`:
```bash
NEXT_PUBLIC_INDEXER_TIMEOUT=30000
```

### "Relayer inventory depleted"

The relayer hot wallet needs rebalancing. This is a known limitation of MVP.

---

## IDE Setup

### VS Code

Recommended extensions:
- **Cairo** (cairolang.cairo)
- **Tailwind CSS IntelliSense**
- **Prettier**
- **ESLint**

### Vim / Neovim

Add to `.vimrc` or `init.lua`:
```lua
-- Cairo syntax
-- (install cairo-tree-sitter or equivalent)
```

---

## Next Steps

- [Architecture Overview](docs/architecture/overview.md)
- [Sprint Roadmap](docs/roadmap.md)
- [STRK20 Integration](docs/integration/strk20.md)
