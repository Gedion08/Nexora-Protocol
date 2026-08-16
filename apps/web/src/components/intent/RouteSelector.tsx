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
    if (score >= 90) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    return "text-red-400";
  };

  const getPrivacyBg = (score: number) => {
    if (score >= 90) return "bg-green-400/10 border-green-400/30";
    if (score >= 70) return "bg-yellow-400/10 border-yellow-400/30";
    return "bg-red-400/10 border-red-400/30";
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
    } catch (err: any) {
      setError(err.message || "Failed to execute intent");
      updateIntent({ status: "failed" });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Zap className="w-5 h-5 text-indigo-400" />
        Available Routes
      </h3>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {routes.map((route) => (
          <button
            key={route.id}
            onClick={() => selectRoute(route)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedRoute?.id === route.id
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-600 bg-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white">{route.name}</h4>
                  {selectedRoute?.id === route.id && (
                    <Check className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <p className="text-sm text-zinc-400 mb-3">{route.bridge}</p>

                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1 text-zinc-300">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    {route.estimatedTime}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-300">
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                    {route.hops} hop{route.hops > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-300">
                    Fee: {route.estimatedFee}
                  </div>
                </div>
              </div>

              <div className={`px-3 py-1 rounded-full border ${getPrivacyBg(route.privacyScore)}`}>
                <div className="flex items-center gap-1">
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
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
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
