# Nexora Protocol

**Starknet as the privacy layer for the multichain economy.**

Nexora Protocol is a cross-chain privacy protocol that lets users deposit assets on any supported chain (Arbitrum, Base, Ethereum, Solana), hold them privately as STRK20 shielded notes, and withdraw to any destination chain through a fresh address — with minimized public linkability.

Built for the STRK20 Private Sprint (August 14–31, 2026). Target: first place.

---

## Live Demo

> **Frontend:** https://nexora-protocol.vercel.app  
> **Relayer API:** https://nexora-relayer.onrender.com  
> **Status:** Live (read-only demo mode)

---

## Screenshots

### Intent Submission
![Submit Intent](docs/screenshots/intent-submit.png)
*Users select source chain, asset, amount, destination, and privacy level.*

### Route Selection
![Route Selection](docs/screenshots/route-selection.png)
*Multiple routes with privacy scores, fees, and estimated times.*

### Transaction Tracker
![Transaction Tracker](docs/screenshots/tx-tracker.png)
*Real-time status updates as the transaction progresses through the relayer.*

### Privacy Health Score
![Privacy Health Score](docs/screenshots/privacy-health.png)
*Comprehensive privacy posture metrics based on viewing keys, balances, and transaction history.*

### Selective Disclosure
![Selective Disclosure](docs/screenshots/selective-disclosure.png)
*Share viewing keys with auditors or counterparties without revealing full identity.*

---

## What This Is

Nexora Protocol abstracts away the complexity of Starknet privacy. Users do not need to know what STRK20 is, install a new wallet, or hold STRK for gas. They connect their existing wallet (MetaMask, Phantom), specify source, asset, amount, destination, and Nexora Protocol handles the rest.

The product is positioned as a **cross-chain privacy routing protocol**, not merely a bridge wrapper. Starknet and the STRK20 pool act as the privacy engine underneath.

---

## Status

| Component | Status |
|-----------|--------|
| Registration (strk20-hackathon) | Complete |
| Architecture | Defined |
| Contract design | Tested (5 unit tests, Cairo 2.20) |
| Frontend | Complete |
| SDK | Complete (334 tests) |
| Relayer | Complete (96 tests) |
| Mainnet transactions | 3 of 3 required (hashes pending) |
| Demo video | Pending |
| Demo URL | Live |

---

## Quick Links

- [Hackathon](https://strk20.starknet.io/hackathon)
- [STRK20 Docs](https://strk20.starknet.io/build)
- [STRK20 by Example](https://strk20-by-example.org/what-is-strk20)
- [Privacy SDK](https://github.com/starkware-libs/starknet-privacy)
- [Starter Kit](https://github.com/Akashneelesh/strk20-starter-kit)

---

## Deployment

### Prerequisites

- Node.js >= 18
- pnpm >= 8.15.0
- PostgreSQL (for relayer)
- Vercel account (for frontend)

### Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web app directory
cd apps/web
vercel --prod
```

Set the following environment variables in Vercel:
- `NEXT_PUBLIC_RELAYER_URL` — Your relayer API URL
- `NEXT_PUBLIC_CHAIN_ID` — `SN_MAIN` or `SN_SEPOLIA`
- `NEXT_PUBLIC_RPC_URL` — Starknet RPC endpoint
- `NEXT_PUBLIC_POOL_ADDRESS` — STRK20 pool contract address
- `NEXT_PUBLIC_PRIVACY_HUB_ADDRESS` — Nexora PrivacyHub contract address (for unshield calls)
- `NEXT_PUBLIC_INDEXER_URL` — STRK20 indexer endpoint (enables live balances/withdrawals)
- `NEXT_PUBLIC_PROVER_URL` — STRK20 prover endpoint (enables real proofs)

### Deploy Relayer to Render

The relayer is configured for Render via `render.yaml`:

```bash
# Push to main branch to trigger Render deployment
git push origin main
```

Required environment variables in Render:
- `RELAYER_DB_URL` — PostgreSQL connection string
- `RELAYER_PRIVATE_KEY` — Relayer Starknet private key
- `RELAYER_STARKNET_ADDRESS` — Relayer Starknet address
- `LAYERSWAP_API_KEY` — LayerSwap API key

---

## Documentation

See the `docs/` directory for full documentation:

- [Architecture Overview](docs/architecture/overview.md)
- [Nexora Protocol Protocol](docs/architecture/nexora-protocol.md)
- [Privacy Core](docs/architecture/privacy-core.md)
- [Source & Destination Adapters](docs/architecture/adapters.md)
- [Routing Engine](docs/architecture/routing-engine.md)
- [Selective Disclosure](docs/architecture/disclosure.md)
- [Sprint Roadmap](docs/roadmap.md)
- [STRK20 Integration](docs/integration/strk20.md)
- [Bridge Integrations](docs/integration/bridges.md)
- [Wallet Integrations](docs/integration/wallets.md)
- [Developer Setup](docs/setup.md)
- [Testing Strategy](docs/testing.md)
- [Security](docs/security.md)
- [Compliance](docs/compliance.md)
- [Deployment](docs/deployment.md)
- [Demo Plan](docs/demo.md)
- [Risk Register](docs/risks.md)
- [Glossary](docs/glossary.md)

---

## License

MIT
