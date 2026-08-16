"use client";

import { Eye, EyeOff, Shield, Lock } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function PrivateBalance() {
  const { balances, viewingKeys } = useAppStore();

  const demoBalances = [
    {
      asset: "ETH",
      symbol: "ETH",
      shieldedBalance: "2.4500",
      viewingKeyBalance: "0.7500",
      totalBalance: "3.2000",
    },
    {
      asset: "USDC",
      symbol: "USDC",
      shieldedBalance: "1,250.00",
      viewingKeyBalance: "500.00",
      totalBalance: "1,750.00",
    },
    {
      asset: "STRK",
      symbol: "STRK",
      shieldedBalance: "500.00",
      viewingKeyBalance: "0.00",
      totalBalance: "500.00",
    },
  ];

  const displayBalances = balances.length > 0 ? balances : demoBalances;
  const hasActiveViewingKey = viewingKeys.some((k) => k.isActive);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          Private Balances
        </h3>
        {hasActiveViewingKey && (
          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
            <Eye className="w-3 h-3" />
            Viewing Key Active
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {displayBalances.map((balance) => (
          <div
            key={balance.asset}
            className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                <span className="text-indigo-400 font-bold text-sm">
                  {balance.symbol.slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-medium text-white">{balance.symbol}</p>
                <p className="text-xs text-zinc-400">Shielded + Viewing</p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-mono text-white text-lg">
                {hasActiveViewingKey ? balance.totalBalance : "****"}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500">
                  Shielded: {hasActiveViewingKey ? balance.shieldedBalance : "****"}
                </span>
                {hasActiveViewingKey && (
                  <span className="text-zinc-500">
                    + VK: {balance.viewingKeyBalance}
                  </span>
                )}
              </div>
            </div>

            <div className="ml-4">
              {hasActiveViewingKey ? (
                <Eye className="w-5 h-5 text-green-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-zinc-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {!hasActiveViewingKey && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Lock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-300 font-medium">
              Balances are hidden
            </p>
            <p className="text-xs text-yellow-400/80 mt-1">
              Register a viewing key to reveal your shielded balances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
