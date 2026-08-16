"use client";

import { useEffect, useState } from "react";
import { History, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield } from "lucide-react";
import { relayerApi, type IntentStatus } from "@/lib/relayer-api";

type TxHistoryItem = IntentStatus & { _fetchedAt?: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-yellow-500", icon: Clock },
  inventory_reserved: { label: "Inventory Reserved", color: "text-blue-500", icon: Clock },
  bridge_reserved: { label: "Bridge Reserved", color: "text-blue-500", icon: Clock },
  awaiting_deposit: { label: "Awaiting Deposit", color: "text-yellow-500", icon: Clock },
  detected: { label: "Deposit Detected", color: "text-indigo-500", icon: AlertCircle },
  bridging: { label: "Bridging", color: "text-indigo-500", icon: Clock },
  shielding: { label: "Shielding", color: "text-indigo-500", icon: Clock },
  shielded: { label: "Shielded", color: "text-green-500", icon: CheckCircle2 },
  completed: { label: "Completed", color: "text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", icon: XCircle },
  refunding: { label: "Refunding", color: "text-yellow-500", icon: RefreshCw },
  refunded: { label: "Refunded", color: "text-yellow-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-500", icon: XCircle },
  withdrawal_pending: { label: "Withdrawal Pending", color: "text-yellow-500", icon: Clock },
  unshielding: { label: "Unshielding", color: "text-indigo-500", icon: Shield },
  bridging_out: { label: "Bridging Out", color: "text-indigo-500", icon: Clock },
  withdrawal_completed: { label: "Withdrawal Complete", color: "text-green-500", icon: CheckCircle2 },
};

export function TransactionHistory() {
  const [history, setHistory] = useState<TxHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    setIsLoading(true);
    setError("");

    try {
      const inventory = await relayerApi.getInventory();
      const tokens = inventory.inventories.map((inv) => inv.token);

      const promises = tokens.map((token) =>
        relayerApi.getTokenInventory(token).catch(() => null)
      );
      const results = await Promise.all(promises);

      const items: TxHistoryItem[] = results
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r) => ({
          id: r.token + "-inventory",
          status: "completed",
          amount: r.totalBalance,
          sourceChain: "starknet",
          sourceToken: r.token,
          destinationChain: "starknet",
          destinationToken: r.token,
          destinationAddress: "relayer",
          privacyLevel: "standard",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          depositAddress: r.token,
        }));

      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, []);

  return (
    <div className="panel space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          Transaction History
        </h3>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors disabled:text-zinc-700 mono uppercase tracking-wider"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 mono">
          {error}
        </div>
      )}

      {history.length === 0 && !isLoading && !error && (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No transactions yet. Submit an intent to get started.
        </div>
      )}

      <div className="space-y-2.5">
        {history.map((item) => {
          const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          const StatusIcon = config.icon;
          const date = new Date(item.createdAt).toLocaleString();

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-[#0f0f0f] border border-[#262626] rounded"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-[#0f0f0f] border border-[#262626]`}>
                  <StatusIcon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">
                    {item.sourceToken} {item.amount}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.sourceChain} → {item.destinationChain}
                  </p>
                  <p className="text-[11px] text-zinc-600 mono mt-1">{date}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium mono ${config.color}`}>
                  {config.label}
                </span>
                {item.shieldTxHash && (
                  <a
                    href={`https://starkscan.co/tx/${item.shieldTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
