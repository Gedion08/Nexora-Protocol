"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { relayerApi } from "@/lib/relayer-api";

const STATUS_STEPS = [
  { key: "draft", label: "Draft" },
  { key: "routing", label: "Routing" },
  { key: "building", label: "Building" },
  { key: "signing", label: "Signing" },
  { key: "submitted_onchain", label: "Submitted" },
  { key: "confirmed", label: "Confirmed" },
];

export function TxTracker() {
  const { intent, updateIntent } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (intent?.status === "submitted_onchain" && intent.txHash && !pollRef.current) {
      setIsPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const status = await relayerApi.getIntent(intent.txHash!);
          if (status.status === "completed" || status.status === "shielded") {
            updateIntent({ status: "confirmed" });
            setIsPolling(false);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          } else if (status.status === "failed" || status.status === "refunded" || status.status === "cancelled") {
            updateIntent({ status: "failed" });
            setIsPolling(false);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          // Silently continue polling on error
        }
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [intent?.status, intent?.txHash, updateIntent]);

  if (!intent || intent.status === "draft") return null;

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === intent.status);

  const getStatusIcon = (stepKey: string, index: number) => {
    if (index < currentStepIndex) {
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    }
    if (index === currentStepIndex) {
      if (intent.status === "failed") {
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      }
      return <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />;
    }
    return <Circle className="w-5 h-5 text-zinc-600" />;
  };

  const getStatusLabel = (stepKey: string, index: number) => {
    if (index < currentStepIndex) {
      return "text-green-400";
    }
    if (index === currentStepIndex) {
      if (intent.status === "failed") {
        return "text-red-400";
      }
      return "text-indigo-400";
    }
    return "text-zinc-500";
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transaction Status</h3>
        <div className="flex items-center gap-3">
          {isPolling && (
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Polling...
            </span>
          )}
          {intent.txHash && (
            <a
              href={`https://starkscan.co/tx/${intent.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
            >
              View on Starkscan <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {STATUS_STEPS.map((step, index) => (
          <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
            <div className="relative">
              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={`absolute top-1/2 left-1/2 w-full h-0.5 -translate-y-1/2 ${
                    index < currentStepIndex ? "bg-green-400" : "bg-zinc-700"
                  }`}
                  style={{ width: "100%", left: "50%", zIndex: 0 }}
                />
              )}
              <div className="relative z-10 flex items-center justify-center">
                {getStatusIcon(step.key, index)}
              </div>
            </div>
            <span className={`text-xs font-medium ${getStatusLabel(step.key, index)}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {intent.status === "failed" && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            Transaction failed. Please try again or contact support.
          </p>
        </div>
      )}

      {intent.status === "confirmed" && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-sm text-green-300 font-medium">Transaction Confirmed</p>
            {intent.txHash && (
              <p className="text-xs text-green-400/80 font-mono mt-1">
                {intent.txHash.slice(0, 20)}...
              </p>
            )}
          </div>
        </div>
      )}

      {(intent.status === "submitted_onchain" || intent.status === "building" || intent.status === "signing") && (
        <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
          <p className="text-sm text-indigo-300">
            {intent.status === "building" && "Building transaction..."}
            {intent.status === "signing" && "Awaiting signature..."}
            {intent.status === "submitted_onchain" && "Transaction submitted. Waiting for confirmation..."}
          </p>
        </div>
      )}

      <button
        onClick={() => {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          updateIntent({ status: "draft" });
        }}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        New Intent
      </button>
    </div>
  );
}
