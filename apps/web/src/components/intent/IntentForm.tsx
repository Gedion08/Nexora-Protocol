"use client";

import { useState } from "react";
import { ArrowRight, Shield, Zap, Globe } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { relayerApi } from "@/lib/relayer-api";
import type { RouteOption } from "@/store/useAppStore";

const CHAINS = [
  { id: "ethereum", name: "Ethereum", icon: "Ξ" },
  { id: "starknet", name: "Starknet", icon: "⚡" },
  { id: "arbitrum", name: "Arbitrum", icon: "🔷" },
  { id: "optimism", name: "Optimism", icon: "🔴" },
  { id: "base", name: "Base", icon: "🔵" },
];

const ASSETS = [
  { id: "ETH", name: "Ether", symbol: "ETH" },
  { id: "USDC", name: "USD Coin", symbol: "USDC" },
  { id: "USDT", name: "Tether", symbol: "USDT" },
  { id: "DAI", name: "Dai", symbol: "DAI" },
  { id: "WBTC", name: "Wrapped BTC", symbol: "WBTC" },
  { id: "STRK", name: "Starknet", symbol: "STRK" },
];

const PRIVACY_LEVELS = [
  { id: "public", label: "Public", icon: Globe, description: "Transparent on-chain" },
  { id: "private", label: "Private", icon: Shield, description: "Shielded amounts" },
  { id: "shielded", label: "Shielded", icon: Zap, description: "Full privacy pool" },
];

function mapPrivacyLevel(level: string): "none" | "standard" | "maximum" {
  switch (level) {
    case "public":
      return "none";
    case "private":
      return "standard";
    case "shielded":
      return "maximum";
    default:
      return "standard";
  }
}

export function IntentForm() {
  const { intent, updateIntent, setRoutes, selectRoute } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!intent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.amount || !intent.recipient) return;

    setIsSubmitting(true);
    setError("");

    try {
      updateIntent({ status: "routing" });

      const routes = await buildRoutesFromRelayer();
      setRoutes(routes);
      selectRoute(routes[1]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch routes");
      updateIntent({ status: "draft" });
    } finally {
      setIsSubmitting(false);
    }
  };

  async function buildRoutesFromRelayer(): Promise<RouteOption[]> {
    if (!intent) return [];

    const amount = parseFloat(intent.amount);
    const sourceToken = intent.asset;
    const destinationToken = intent.asset;

    try {
      const quote = await relayerApi.getQuote(sourceToken, destinationToken, amount);

      const routes = [
        {
          id: "route-1",
          name: "Direct Bridge",
          bridge: "StarkGate",
          estimatedFee: `${quote.quote.totalFee.toFixed(4)} ${sourceToken}`,
          estimatedTime: `~${Math.max(1, Math.round(quote.quote.avgCompletionTime / 60))} min`,
          privacyScore: 85,
          hops: 1,
        },
        {
          id: "route-2",
          name: "Privacy Route",
          bridge: "Nexora Pool",
          estimatedFee: `${(quote.quote.totalFee * 1.2).toFixed(4)} ${sourceToken}`,
          estimatedTime: `~${Math.max(2, Math.round(quote.quote.avgCompletionTime / 50))} min`,
          privacyScore: 98,
          hops: 2,
        },
        {
          id: "route-3",
          name: "Optimized Route",
          bridge: "AVNU + STRK20",
          estimatedFee: `${(quote.quote.totalFee * 0.8).toFixed(4)} ${sourceToken}`,
          estimatedTime: `~${Math.max(1, Math.round(quote.quote.avgCompletionTime / 80))} min`,
          privacyScore: 72,
          hops: 3,
        },
      ];

      return routes;
    } catch {
      return [
        {
          id: "route-1",
          name: "Direct Bridge",
          bridge: "StarkGate",
          estimatedFee: "0.0012 ETH",
          estimatedTime: "~2 min",
          privacyScore: 85,
          hops: 1,
        },
        {
          id: "route-2",
          name: "Privacy Route",
          bridge: "Nexora Pool",
          estimatedFee: "0.0025 ETH",
          estimatedTime: "~3 min",
          privacyScore: 98,
          hops: 2,
        },
        {
          id: "route-3",
          name: "Optimized Route",
          bridge: "AVNU + STRK20",
          estimatedFee: "0.0008 ETH",
          estimatedTime: "~1.5 min",
          privacyScore: 72,
          hops: 3,
        },
      ];
    }
  }

  return (
    <div className="panel">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">From Chain</label>
            <select
              value={intent.fromChain}
              onChange={(e) => updateIntent({ fromChain: e.target.value })}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            >
              {CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">To Chain</label>
            <select
              value={intent.toChain}
              onChange={(e) => updateIntent({ toChain: e.target.value })}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            >
              {CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.icon} {chain.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Asset</label>
            <select
              value={intent.asset}
              onChange={(e) => updateIntent({ asset: e.target.value })}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            >
              {ASSETS.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} - {asset.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">Amount</label>
            <input
              type="number"
              step="0.0001"
              placeholder="0.0"
              value={intent.amount}
              onChange={(e) => updateIntent({ amount: e.target.value })}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-2">Recipient Address</label>
          <input
            type="text"
            placeholder="0x..."
            value={intent.recipient}
            onChange={(e) => updateIntent({ recipient: e.target.value })}
            className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-3">Privacy Level</label>
          <div className="grid grid-cols-3 gap-3">
            {PRIVACY_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => updateIntent({ privacyLevel: level.id as "public" | "private" | "shielded" })}
                className={`p-4 rounded border transition-all ${
                  intent.privacyLevel === level.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#262626] bg-[#0f0f0f] hover:border-zinc-700"
                }`}
              >
                <level.icon className={`w-5 h-5 mx-auto mb-2 ${intent.privacyLevel === level.id ? "text-blue-500" : "text-zinc-500"}`} />
                <p className="text-sm font-medium text-white">{level.label}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{level.description}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !intent.amount || !intent.recipient}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-medium transition-colors"
        >
          {isSubmitting ? (
            "Finding routes..."
          ) : (
            <>
              Find Routes <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
