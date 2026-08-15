# Sprint Roadmap

An 18-day sprint plan from August 14 to August 31, 2026. All times are in UTC.

**Current date:** August 15, 2026  
**Days remaining:** 16

---

## Phase 0: Foundation (Days 1–2)

**Goal:** Understand every STRK20 primitive independently. No product code yet.

### Day 1 (Aug 15)

**Morning (4h):**
- [ ] Fork and clone STRK20 starter kit
- [ ] Read STRK20 by Example cover-to-cover
- [ ] Run privacy_invoke demo on Sepolia
- [ ] Understand: viewing keys, shielding, unshielding, note discovery, nullifiers

**Afternoon (4h):**
- [ ] Read Privacy SDK source code
- [ ] Understand earn-contracts deterministic account derivation
- [ ] Run first mainnet transaction (Day 0 guide)
- [ ] Register viewing key on mainnet
- [ ] Complete first shield on mainnet

**Deliverable:** Three mainnet transaction hashes (or progress toward them). Working knowledge of all STRK20 primitives.

### Day 2 (Aug 16)

**Morning (4h):**
- [ ] Run private transfer on mainnet
- [ ] Run unshield on mainnet
- [ ] Verify transactions on Voyager
- [ ] Read Privacy SDK prover configuration

**Afternoon (4h):**
- [ ] Set up monorepo structure (pnpm + turborepo)
- [ ] Initialize contracts, sdk, relayer, web packages
- [ ] Configure CI/CD (GitHub Actions)
- [ ] Set up Vercel preview deployments for web

**Deliverable:** Monorepo skeleton. Four mainnet transactions. Verified on Voyager.

---

## Phase 1: Privacy Core (Days 3–5)

**Goal:** Build PrivacyHub.cairo and get shield → unshield working end-to-end.

### Day 3 (Aug 17)

**Morning (4h):**
- [ ] Write PrivacyHub.cairo contract interface
- [ ] Implement shield() function
- [ ] Implement unshield() function
- [ ] Implement register_viewing_key()
- [ ] Write unit tests for each function

**Afternoon (4h):**
- [ ] Write PrivacyHub.t.s Cairo tests
- [ ] Run tests in local Katana / Sepolia fork
- [ ] Document contract interface
- [ ] Create contract deployment script

**Deliverable:** PrivacyHub.cairo with unit tests. Deployed to Sepolia.

### Day 4 (Aug 18)

**Morning (4h):**
- [ ] Deploy PrivacyHub to Sepolia
- [ ] Verify contract on Starkscan
- [ ] Write TypeScript SDK wrapper for PrivacyHub
- [ ] Implement viewing key derivation in SDK

**Afternoon (4h):**
- [ ] Implement shield flow in SDK
- [ ] Implement unshield flow in SDK
- [ ] Implement note discovery in SDK
- [ ] Write SDK unit tests

**Deliverable:** SDK with shield/unshield/note discovery. Working on Sepolia.

### Day 5 (Aug 19)

**Morning (4h):**
- [ ] Implement private transfer in SDK
- [ ] Implement Paymaster integration (gas sponsorship)
- [ ] Test end-to-end shield → private transfer → unshield on Sepolia

**Afternoon (4h):**
- [ ] Deploy PrivacyHub to mainnet (small test amount)
- [ ] Execute shield → unshield on mainnet
- [ ] Verify transactions on Voyager
- [ ] Update strk20.json with contract address

**Deliverable:** PrivacyHub deployed to mainnet. Shield/unshield working on mainnet. Contract address in strk20.json.

---

## Phase 2: EVM → Starknet (Days 6–8)

**Goal:** Build source adapter for Arbitrum → Starknet.

### Day 6 (Aug 20)

**Morning (4h):**
- [ ] Research LayerSwap API documentation
- [ ] Build LayerSwap client SDK wrapper
- [ ] Implement ArbitrumAdapter skeleton
- [ ] Write adapter unit tests

**Afternoon (4h):**
- [ ] Implement bridge reservation flow
- [ ] Implement deposit status polling
- [ ] Implement fee estimation
- [ ] Test against LayerSwap sandbox / testnet

**Deliverable:** ArbitrumAdapter with LayerSwap integration. Tested on testnet.

### Day 7 (Aug 21)

**Morning (4h):**
- [ ] Implement relayer inventory management
- [ ] Build relayer service skeleton (Express/Fastify)
- [ ] Set up PostgreSQL for relayer state
- [ ] Implement deposit event listener

**Afternoon (4h):**
- [ ] Connect ArbitrumAdapter to PrivacyHub
- [ ] Implement end-to-end flow: deposit → bridge → shield
- [ ] Test on Sepolia with test USDC
- [ ] Test with real USDC on mainnet (small amount)

**Deliverable:** Arbitrum → Starknet flow working on mainnet. Two transactions touching STRK20 pool.

### Day 8 (Aug 22)

**Morning (4h):**
- [ ] Implement error handling and retries
- [ ] Add timeout handling for bridge operations
- [ ] Implement refund path for failed deposits
- [ ] Write integration tests

**Afternoon (4h):**
- [ ] Deploy relayer to cloud (Vercel / Fly.io / Render)
- [ ] Configure environment variables
- [ ] Set up monitoring (basic health checks)
- [ ] Update strk20.json with second transaction hash

**Deliverable:** Relayer running in production. Third mainnet transaction. All three required transactions in strk20.json.

---

## Phase 3: Starknet → EVM (Days 9–10)

**Goal:** Build destination adapter for Starknet → Base.

### Day 9 (Aug 23)

**Morning (4h):**
- [ ] Implement BaseAdapter skeleton
- [ ] Implement fresh address generation for Base
- [ ] Implement withdrawal flow: unshield → bridge → fund
- [ ] Write adapter unit tests

**Afternoon (4h):**
- [ ] Connect BaseAdapter to PrivacyHub
- [ ] Implement end-to-end flow: unshield → bridge → fund fresh address
- [ ] Test on Sepolia
- [ ] Test with real USDC on mainnet

**Deliverable:** Starknet → Base flow working on mainnet.

### Day 10 (Aug 24)

**Morning (4h):**
- [ ] Connect full flow: Arbitrum → Starknet → Base
- [ ] Test end-to-end on Sepolia
- [ ] Test end-to-end on mainnet (small amount)
- [ ] Verify all transactions on Voyager

**Afternoon (4h):**
- [ ] Implement deterministic account generation for Starknet
- [ ] Test with MetaMask on Arbitrum → fresh Starknet account → Base
- [ ] Document the flow
- [ ] Create demo script

**Deliverable:** Full Arbitrum → Starknet → Base flow on mainnet. Demo script drafted.

---

## Phase 4: Frontend & UX (Days 11–12)

**Goal:** Build Next.js frontend with intent-based UI.

### Day 11 (Aug 25)

**Morning (4h):**
- [ ] Scaffold Next.js app with TypeScript + Tailwind
- [ ] Install Starknet.js and wallet connectors
- [ ] Build wallet connection UI (MetaMask)
- [ ] Build intent form (from, asset, amount, to, recipient, privacy)

**Afternoon (4h):**
- [ ] Implement route selection UI (show estimated fee, time, privacy score)
- [ ] Build transaction status tracker
- [ ] Build private balance display
- [ ] Implement viewing key registration flow

**Deliverable:** Functional Next.js frontend. User can connect MetaMask and submit intent.

### Day 12 (Aug 26)

**Morning (4h):**
- [ ] Connect frontend to relayer API
- [ ] Implement transaction history
- [ ] Build privacy health score display
- [ ] Implement selective disclosure UI (basic)

**Afternoon (4h):**
- [ ] Deploy frontend to Vercel / GitHub Pages
- [ ] Test end-to-end from frontend
- [ ] Fix bugs
- [ ] Write README with screenshots

**Deliverable:** Live demo at public URL. README with screenshots.

---

## Phase 5: Polish (Days 13–16)

**Goal:** Selective disclosure, analytics, mainnet hardening.

### Day 13 (Aug 27)

- [ ] Implement selective disclosure proofs
- [ ] Build disclosure UI (share viewing key, generate proof)
- [ ] Add privacy health score calculation
- [ ] Add pool activity metrics (deposits, volume)

### Day 14 (Aug 28)

- [ ] Deploy to mainnet with larger test amounts
- [ ] Generate 3+ mainnet transactions (if not already done)
- [ ] Verify all transactions on Voyager
- [ ] Update strk20.json with all transactions and demo URL

### Day 15 (Aug 29)

- [ ] Record demo video (3 minutes)
- [ ] Upload demo video to YouTube
- [ ] Update README with architecture diagrams
- [ ] Add API documentation

### Day 16 (Aug 30)

**IMPORTANT: This is a buffer day. Do NOT add new features.**

- [ ] Fix all bugs
- [ ] Verify all URLs (demo, video, repo)
- [ ] Verify strk20.json is correct
- [ ] Verify registry.json is correct
- [ ] Test demo from a fresh browser
- [ ] Polish README
- [ ] Final code review

### Day 17 (Aug 31)

**Submission day. Do NOT build anything.**

- [ ] Final strk20.json verification
- [ ] Final demo URL check
- [ ] Final README review
- [ ] Final video check
- [ ] SUBMIT (nothing to submit — repo is the submission)

---

## Critical Milestones

| Milestone | Deadline | Required for Scoring |
|-----------|----------|---------------------|
| Hackathon registration (registry.json PR) | Aug 16 | Yes |
| PrivacyHub deployed to mainnet | Aug 19 | Yes (30% innovation + 30% integration) |
| 3 mainnet transactions | Aug 22 | Yes (30% mainnet product) |
| Arbitrum → Base flow working | Aug 24 | Yes (25% innovation) |
| Live demo URL | Aug 26 | Yes (documentation + demo) |
| Demo video | Aug 29 | Yes (documentation + demo) |
| strk20.json complete | Aug 31 | Yes (all scoring) |

---

## Parallel Work Streams

If you have a team, split into these streams:

| Stream | Owner | Days 1-5 | Days 6-10 | Days 11-16 |
|--------|-------|----------|-----------|------------|
| Contracts & Privacy Core | Cairo dev | Phase 1 | Support | Support |
| Backend / Relayer | Backend dev | Support | Phase 2-3 | Support |
| Frontend | Frontend dev | Support | Support | Phase 4-5 |
| Documentation | Technical writer | Phase 1 | Phase 1-3 | Phase 5 |

If you are solo, follow the roadmap linearly. Use the parallel streams as a checklist for what you might delegate.

---

## Contingency

If behind schedule:
- **Day 5 behind:** Drop Solana adapter. Focus on Arbitrum → Starknet → Base only.
- **Day 10 behind:** Drop selective disclosure. Ship basic withdrawal.
- **Day 14 behind:** Drop fresh address generation. Allow existing addresses.
- **Day 16 behind:** Drop frontend polish. Ship working demo with basic UI.

The judging criteria prioritize a working mainnet product over polished UX.

---

## Next Steps

- [Architecture Overview](docs/architecture/overview.md)
- [STRK20 Integration](docs/integration/strk20.md)
- [Setup Guide](docs/setup.md)
