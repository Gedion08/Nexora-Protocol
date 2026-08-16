"use client";

import { useState } from "react";
import { Shield, Zap, Clock, ArrowRight, Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { relayerApi } from "@/lib/relayer-api";

export function RouteSelector() {
  const { routes, selectRoute, intent, updateIntent } = useAppStore();
  const selectedRoute = intent?.selectedRoute;
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState("");

  if (routes.length === 0) return null;

  const getPrivacyColor = (score: number) => {
    if (score >= 90) return "text-blue-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getPrivacyBg = (score: number) => {
    if (score >= 90) return "border-blue-500/30 bg-blue-500/5";
    if (score >= 70) return "border-yellow-500/30 bg-yellow-500/5";
    return "border-red-500/30 bg-red-500/5";
  };

  const handleExecute = async () => {
    if (!selectedRoute || !intent) return;
    setIsExecuting(true);
    setError("");

    try {
      updateIntent({ status: "building" });
      await new Promise((r) => setTimeout(r, 500));
      updateIntent({ status: "signing" });
      await new Promise((r) => setTimeout(r, 1000));

      const payload = {
        userId: "user-" + (intent.recipient.slice(-8) || "demo"),
        sourceChain: intent.fromChain,
        sourceToken: intent.asset,
        destinationChain: intent.toChain,
        destinationToken: intent.asset,
        amount: intent.amount,
        sourceAddress: intent.recipient,
        destinationAddress: intent.recipient,
        privacyLevel: (intent.privacyLevel === "public" ? "none" : intent.privacyLevel === "private" ? "standard" : "maximum") as "none" | "standard" | "maximum",
      };

      const result = await relayerApi.submitIntent(payload);
      updateIntent({
        status: "submitted_onchain",
        txHash: result.referenceId || result.intentId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute intent");
      updateIntent({ status: "failed" });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="panel space-y-5">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Zap className="w-5 h-5 text-blue-500" />
        Available Routes
      </h3>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 mono">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {routes.map((route) => (
          <button
            key={route.id}
            onClick={() => selectRoute(route)}
            className={`w-full p-4 rounded border text-left transition-all ${
              selectedRoute?.id === route.id
                ? "border-blue-500 bg-blue-500/5"
                : "border-[#262626] bg-[#0f0f0f] hover:border-zinc-700"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white text-sm">{route.name}</h4>
                  {selectedRoute?.id === route.id && (
                    <Check className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mb-3 mono">{route.bridge}</p>

                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-zinc-600" />
                    {route.estimatedTime}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                    {route.hops} hop{route.hops > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400 mono">
                    Fee: {route.estimatedFee}
                  </div>
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded border ${getPrivacyBg(route.privacyScore)}`}>
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-4 h-4 ${getPrivacyColor(route.privacyScore)}`} />
                  <span className={`text-sm font-medium ${getPrivacyColor(route.privacyScore)}`}>
                    {route.privacyScore}%
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedRoute && (
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-medium transition-colors"
        >
          {isExecuting ? (
            "Processing..."
          ) : (
            <>
              Execute Intent <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
