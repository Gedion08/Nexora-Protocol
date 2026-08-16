"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState } from "react";
import { Wallet, LogOut, ChevronDown, Copy, ExternalLink } from "lucide-react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const availableConnectors = connectors.filter((c) => c.available);
  const isConnecting = !!variables?.connector;

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {availableConnectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? "Connecting..." : `Connect ${connector.name}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-medium text-white transition-colors"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full" />
        {formatAddress(address)}
        <ChevronDown className="w-4 h-4" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-zinc-700">
            <p className="text-xs text-zinc-400 mb-1">Connected Address</p>
            <div className="flex items-center gap-2">
              <code className="text-sm text-white font-mono break-all">
                {address}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="text-zinc-400 hover:text-white shrink-0"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-2">
            <a
              href={`https://starkscan.co/contract/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Starkscan
            </a>
            <button
              onClick={() => disconnect()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
