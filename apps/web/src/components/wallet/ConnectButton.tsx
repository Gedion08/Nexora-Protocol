"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState, useRef, useEffect } from "react";
import { Wallet, LogOut, ChevronDown, Copy, ExternalLink, Check } from "lucide-react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableConnectors = connectors.filter((c) => c.available);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isConnected || !address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="wallet-btn"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
          <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        <div className={`wallet-dropdown ${isDropdownOpen ? "open" : ""}`}>
          <div className="px-3 py-2 mb-1">
            <p className="mono-label text-[10px]">Select Wallet</p>
          </div>
          {availableConnectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                setIsDropdownOpen(false);
              }}
              className="wallet-option"
            >
              <span className="dot" />
              {connector.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-transparent border border-[#262626] hover:border-blue-600/50 rounded text-white transition-all"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
        <span className="mono text-xs">{formatAddress(address)}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
      </button>

      <div className={`wallet-dropdown ${isDropdownOpen ? "open" : ""}`}>
        <div className="p-3 border-b border-[#262626]">
          <p className="mono-label text-[10px] mb-1">Connected</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white mono break-all flex-1">
              {address}
            </code>
            <button
              onClick={() => handleCopy(address)}
              className="text-zinc-500 hover:text-white transition-colors shrink-0"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <div className="p-1.5">
          <a
            href={`https://starkscan.co/contract/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="wallet-option"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            View on Starkscan
          </a>
          <button
            onClick={() => disconnect()}
            className="wallet-option text-red-400 hover:text-red-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
