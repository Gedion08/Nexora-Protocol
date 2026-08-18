"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Shield, Lock, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAccount } from "@starknet-react/core";
import { getPrivateBalances, isIndexerConfigured } from "@/lib/privacy-client";

export function PrivateBalance() {
  const { balances, setBalances, viewingKeys } = useAppStore();
  const { account, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<"demo" | "indexer">("demo");

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

  const hasActiveViewingKey = viewingKeys.some((k) => k.isActive);

  useEffect(() => {
    const activeKey = viewingKeys.find((k) => k.isActive);

    if (
      isConnected &&
      account &&
      activeKey &&
      isIndexerConfigured()
    ) {
      let cancelled = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(true);

      getPrivateBalances(account as never, activeKey)
        .then((realBalances) => {
          if (cancelled || realBalances.length === 0) return;

          const mapped = realBalances.map((b) => {
            const raw = Number(b.amount) / 1e6;
            const total = raw >= 1000 ? raw.toLocaleString(undefined, { minimumFractionDigits: 2 }) : raw.toFixed(4);
            return {
              asset: b.token,
              symbol: b.token,
              shieldedBalance: total,
              viewingKeyBalance: "0.00",
              totalBalance: total,
            };
          });

          setBalances(mapped);
          setSource("indexer");
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    return undefined;
  }, [isConnected, account, viewingKeys, setBalances]);

  const displayBalances = balances.length > 0 ? balances : demoBalances;

  return (
    <div className="panel space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Private Balances
        </h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          )}
          {source === "indexer" ? (
            <span className="flex items-center gap-1.5 text-[11px] text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-500/10 px-2.5 py-1 rounded-full mono">
              Demo
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {displayBalances.map((balance) => (
          <div
            key={balance.asset}
            className="flex items-center justify-between p-4 bg-[#0f0f0f] border border-[#262626] rounded"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm mono">
                  {balance.symbol.slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-medium text-white text-sm">{balance.symbol}</p>
                <p className="text-xs text-zinc-500 mono">SHIELDED + VK</p>
              </div>
            </div>

            <div className="text-right">
              <p className="mono text-white text-base">
                {hasActiveViewingKey ? balance.totalBalance : "****"}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500">
                  {hasActiveViewingKey ? balance.shieldedBalance : "****"}
                </span>
                {hasActiveViewingKey && (
                  <span className="text-zinc-600">+</span>
                )}
                {hasActiveViewingKey && (
                  <span className="text-zinc-500">
                    {balance.viewingKeyBalance}
                  </span>
                )}
              </div>
            </div>

            <div className="ml-4">
              {hasActiveViewingKey ? (
                <Eye className="w-4 h-4 text-blue-500" />
              ) : (
                <EyeOff className="w-4 h-4 text-zinc-700" />
              )}
            </div>
          </div>
        ))}
      </div>

      {!hasActiveViewingKey && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded">
          <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-zinc-300 font-medium">
              Balances are hidden
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Register a viewing key to reveal your shielded balances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
