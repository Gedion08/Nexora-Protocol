# Wallet Integrations

Nexora Protocol supports multiple wallets across source and destination chains. This document specifies the integration approach for each.

---

## Source Chain Wallets

Source chain wallets are used by users to initiate deposits. Nexora Protocol interacts with them via standard EVM EIP-1193 / EIP-712 interfaces.

### MetaMask (EVM)

**Chains:** Arbitrum, Base, Ethereum, Optimism  
**Status:** MVP

```typescript
import { MetaMaskSDK } from "@metamask/sdk";

const metamask = new MetaMaskSDK({
  dappMetadata: {
    name: "Nexora Protocol",
    url: "https://nexora-protocol.xyz",
  },
});

const ethereum = metamask.getProvider();

// Connect
const accounts = await ethereum.request({ method: "eth_requestAccounts" });

// Sign message for deterministic account derivation
const signature = await ethereum.request({
  method: "personal_sign",
  params: [messageHash, accounts[0]],
});

// Send transaction (for StarkGate deposits)
const txHash = await ethereum.request({
  method: "eth_sendTransaction",
  params: [{
    from: accounts[0],
    to: bridgeAddress,
    value: "0x0",
    data: depositCalldata,
  }],
});
```

### Phantom (Solana)

**Chains:** Solana  
**Status:** Stretch (Day 16+)

```typescript
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

const phantom = new PhantomWalletAdapter();

await phantom.connect();

// Sign message
const message = new TextEncoder().encode(messageHash);
const signature = await phantom.signMessage(message);

// Send transaction
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: phantom.publicKey,
    toPubkey: bridgeAddress,
    lamports: amount,
  })
);

const { signature: txSig } = await phantom.sendTransaction(transaction);
```

---

## Destination Chain Wallets

Destination chain wallets are used to receive funds. For MVP, Nexora Protocol generates fresh addresses. Users can later import these into their own wallets.

### Fresh Address Generation

For EVM chains, Nexora Protocol generates fresh addresses that the user can import into MetaMask, Rabby, etc.

```typescript
import { Wallet } from "ethers";

const freshWallet = Wallet.createRandom();

// Return address and private key (encrypted, stored by Nexora Protocol)
return {
  address: freshWallet.address,
  encryptedPrivateKey: encrypt(freshWallet.privateKey, userKey),
};
```

**Important:** The private key is encrypted and stored by Nexora Protocol for recovery. Users can request decryption via their viewing key.

### Starknet Wallets (Stretch)

For users who want to withdraw to their own Starknet wallet:

```typescript
import { Controller, Provider } from "starknet";

const controller = new Controller({
  defaultAccount: "braavos",
  modules: [getConnectorModule()],
});

await controller.connect();
```

---

## Starknet Wallet API (Alternative)

The Starknet Wallet API lets dapps request private actions through the user's wallet, without handling viewing keys directly.

```typescript
import { WalletApi } from "starknet";

const wallet = await window.starknet_plugin?.request({ type: "starknet_wallet" });

if (wallet) {
  const result = await wallet.request({
    type: "shield",
    token: usdcTokenAddress,
    amount: 5_000_000n,
  });
}
```

**Nexora Protocol's approach:** Nexora Protocol acts as a relayer, so it uses the Privacy SDK directly rather than the Wallet API. The Wallet API is useful for future dapp integrations where Nexora Protocol provides privacy as a service.

---

## Deterministic Account Generation

For users without Starknet wallets, Nexora Protocol generates deterministic accounts derived from their source-chain signature. This pattern is already shipped in `earn-contracts`.

```typescript
function deriveStarknetAccount(
  sourceChain: ChainId,
  sourceSignature: Signature,
  poolAddress: string
): StarknetAccount {
  const chainId = getChainIdForStarknet(sourceChain);
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  
  const { r, s } = sourceSignature;
  const folded = BigInt(hash.computePoseidonHashOnElements([r, s]));
  const reduced = folded % ec.starkCurve.CURVE.n;
  
  const accountAddress = computeAccountAddress(reduced);
  
  return {
    address: accountAddress,
    publicKey: reduced,
    // Private key is never stored; account is funded by Paymaster
  };
}
```

The Paymaster pre-funds the account so the user never needs STRK.

---

## Connection Flows

### MetaMask Connection Flow

```
1. User clicks "Connect Wallet"
2. Nexora Protocol requests MetaMask connection
3. MetaMask prompts user to connect
4. Nexora Protocol detects chain (Arbitrum, Base, etc.)
5. Nexora Protocol checks if chain is supported
6. Nexora Protocol shows intent form
```

### Fresh Address Flow

```
1. User selects destination chain
2. Nexora Protocol generates fresh address
3. Nexora Protocol encrypts private key
4. Nexora Protocol shows fresh address to user
5. User can download / save private key (encrypted)
6. Nexora Protocol routes funds to fresh address
```

### Deterministic Account Flow

```
1. User connects MetaMask on Arbitrum
2. User signs domain-separated message
3. Nexora Protocol derives Starknet account from signature
4. Nexora Protocol requests Paymaster to fund account
5. Nexora Protocol executes route using derived account
6. User never sees Starknet wallet
```

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Phishing (fake MetaMask) | Warn user to verify URL; use EIP-191 verification |
| Malicious DApp | Nexora Protocol is read-only on source chain until user signs |
| Private key exposure | Fresh keys generated client-side; never sent to server |
| Session hijacking | Use short-lived tokens; refresh on activity |
| Chain ID mismatch | Verify chain ID on every transaction |

---

## Next Steps

- [STRK20 Integration](docs/integration/strk20.md)
- [Bridge Integrations](docs/integration/bridges.md)
- [Architecture Overview](docs/architecture/overview.md)
