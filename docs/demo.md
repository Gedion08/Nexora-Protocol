# Demo Plan

The demo video is a 3-minute recording required by the hackathon. This document specifies the script, shot list, and production notes.

---

## Demo Requirements

- **Length:** 3 minutes maximum
- **Format:** Screen recording + voiceover
- **Upload:** YouTube (unlisted)
- **Reference:** `demo_video` in `strk20.json`

---

## Demo Script

### Shot 1: The Problem (0:00–0:20)

**Visual:** Browser showing a typical DeFi dashboard (Uniswap, Aave) with the user's wallet address clearly visible. Show transactions linked to the user.

**Voiceover:**
> "Today, every on-chain transaction is public. Your wallet address, your balances, your activity — all visible to anyone who looks. For most people, this isn't a problem. But sometimes it is."

**Text on screen:** "Your wallet is public."

---

### Shot 2: The Solution (0:20–0:40)

**Visual:** Switch to Nexora Protocol homepage. Clean, minimal interface. Single form with "From", "Asset", "Amount", "To", "Recipient", "Privacy".

**Voiceover:**
> "Nexora Protocol turns Starknet into the privacy layer for crypto. You deposit from any chain, hold privately, and withdraw to any chain. No new wallet. No STRK. No complexity."

**Text on screen:** "Nexora Protocol — Privacy for the multichain economy."

---

### Shot 3: The Flow (0:40–1:20)

**Visual:** Screen recording of the actual product.

1. Connect MetaMask (Arbitrum)
2. Fill intent: "From: Arbitrum, Asset: USDC, Amount: 5,000, To: Base, Privacy: Maximum"
3. Click "Send Privately"
4. Show route summary: 5 steps, estimated time, fee, privacy score 85/100
5. Confirm transaction
6. Show status updates: "Bridging...", "Shielding...", "Private"
7. Show dashboard: "5,000 USDC (private)"
8. Click "Withdraw"
9. Show fresh Base address generated
10. Confirm withdrawal
11. Show "Private transfer complete"

**Voiceover:**
> "Here's how it works. I connect my Arbitrum wallet. I select USDC, choose Base as my destination, and set privacy to maximum. Nexora Protocol handles the rest. My funds bridge to Starknet, shield into the STRK20 pool, and later withdraw to a fresh Base address. No link. No trace."

**Text on screen (during flow):**
- "Step 1: Bridge Arbitrum → Starknet"
- "Step 2: Shield into STRK20 pool"
- "Step 3: Private state"
- "Step 4: Unshield to fresh address"
- "Step 5: Bridge Starknet → Base"

---

### Shot 4: The Privacy (1:20–1:50)

**Visual:** Side-by-side comparison. Left side shows transparent chain (Etherscan) with full transaction history. Right side shows Nexora Protocol with privacy score, pool activity, and selective disclosure options.

**Voiceover:**
> "After shielding, your assets are private notes. Only you can see them. But Nexora Protocol isn't just anonymous — it's compliant. You can prove specific facts to auditors or tax authorities without revealing everything."

**Show:** Disclosure UI — "Generate proof: I control this transaction. Amount >= $10,000."

---

### Shot 5: The Transactions (1:50–2:20)

**Visual:** Open three Voyager links in separate tabs. Show three successful mainnet transactions touching the STRK20 pool.

**Voiceover:**
> "This isn't a prototype. These are three real mainnet transactions against the live STRK20 pool."

**Text on screen:** "3 mainnet transactions verified on Voyager"

---

### Shot 6: The Architecture (2:20–2:40)

**Visual:** Quick animation of the four-layer architecture.

1. Source Adapter (Arbitrum)
2. Privacy Core (STRK20 pool)
3. Routing Engine (Nexora Protocol)
4. Selective Disclosure

**Voiceover:**
> "Nexora Protocol is a four-layer protocol. Source adapters handle deposits. Privacy Core manages STRK20 state. The Routing Engine selects bridges. Selective Disclosure makes it compliance-friendly."

**Text on screen:** "Four layers. One privacy layer for crypto."

---

### Shot 7: The Call to Action (2:40–3:00)

**Visual:** Return to Nexora Protocol homepage. Show GitHub repo, demo URL, and STRK20 integration.

**Voiceover:**
> "Built for the STRK20 Private Sprint. Open source. On mainnet. Try it at nexora-protocol.xyz."

**Text on screen:**
- "GitHub: github.com/nexora-protocol/nexora"
- "Demo: nexora-protocol.xyz"
- "STRK20: strk20.starknet.io"

---

## Production Notes

### Recording

- Use OBS Studio or Loom
- Record at 1080p, 60fps
- Use a good microphone (Blue Yeti or better)
- Record in a quiet room

### Editing

- Use DaVinci Resolve (free) or Premiere Pro
- Add text overlays for key points
- Add background music (low volume)
- Keep cuts minimal; let the flow speak

### Voiceover

- Practice the script 3-5 times before recording
- Speak slowly and clearly
- Record in a closet (sound dampening)
- Use pop filter on microphone

### DO NOT

- Use stock footage
- Add flashy transitions
- Speak too fast
- Show private keys
- Claim "impossible to link" (use "minimized linkability")

---

## Demo Checklist

- [ ] Script finalized
- [ ] Product working on mainnet
- [ ] Three mainnet transactions verified
- [ ] Fresh address generation working
- [ ] Selective disclosure working
- [ ] Demo URL live
- [ ] Screenshots taken
- [ ] Video recorded
- [ ] Video edited
- [ ] Video uploaded to YouTube (unlisted)
- [ ] `strk20.json` updated with `demo_video` URL
- [ ] Video shared with team for review

---

## Next Steps

- [Sprint Roadmap](docs/roadmap.md)
- [Risk Register](docs/risks.md)
