'use client';

import { ReactNode } from "react";
import { StarknetConfig, jsonRpcProvider } from "@starknet-react/core";
import { InjectedConnector } from "@starknet-react/core";
import { mainnet, sepolia } from "@starknet-react/chains";

const provider = jsonRpcProvider({
  rpc: (chain) => {
    switch (chain.id) {
      case mainnet.id:
        return { nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc" };
      case sepolia.id:
        return { nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc" };
      default:
        return { nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc" };
    }
  },
});

const connectors = [
  new InjectedConnector({ options: { id: "metamask", name: "MetaMask" } }),
  new InjectedConnector({ options: { id: "argentX", name: "Argent X" } }),
  new InjectedConnector({ options: { id: "braavos", name: "Braavos" } }),
];

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={provider}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
