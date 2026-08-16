"use client";

import { useEffect, useState } from "react";
import { History, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield } from "lucide-react";
import { relayerApi, type IntentStatus } from "@/lib/relayer-api";

type TxHistoryItem = IntentStatus & { _fetchedAt?: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-yellow-400", icon: Clock },
  inventory_reserved: { label: "Inventory Reserved", color: "text-blue-400", icon: Clock },
  bridge_reserved: { label: "Bridge Reserved", color: "text-blue-400", icon: Clock },
  awaiting_deposit: { label: "Awaiting Deposit", color: "text-yellow-400", icon: Clock },
  detected: { label: "Deposit Detected", color: "text-indigo-400", icon: AlertCircle },
  bridging: { label: "Bridging", color: "text-indigo-400", icon: Clock },
  shielding: { label: "Shielding", color: "text-indigo-400", icon: Clock },
  shielded: { label: "Shielded", color: "text-green-400", icon: CheckCircle2 },
  completed: { label: "Completed", color: "text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", icon: XCircle },
  refunding: { label: "Refunding", color: "text-yellow-400", icon: RefreshCw },
  refunded: { label: "Refunded", color: "text-yellow-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-400", icon: XCircle },
  withdrawal_pending: { label: "Withdrawal Pending", color: "text-yellow-400", icon: Clock },
  unshielding: { label: "Unshielding", color: "text-indigo-400", icon: Shield },
  bridging_out: { label: "Bridging Out", color: "text-indigo-400", icon: Clock },
  withdrawal_completed: { label: "Withdrawal Complete", color: "text-green-400", icon: CheckCircle2 },
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
    } catch (err: any) {
      setError(err.message || "Failed to load transaction history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          Transaction History
        </h3>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {history.length === 0 && !isLoading && !error && (
        <div className="text-center py-8 text-zinc-400 text-sm">
          No transactions yet. Submit an intent to get started.
        </div>
      )}

      <div className="space-y-3">
        {history.map((item) => {
          const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          const StatusIcon = config.icon;
          const date = new Date(item.createdAt).toLocaleString();

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-zinc-700/50`}>
                  <StatusIcon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">
                    {item.sourceToken} {item.amount}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {item.sourceChain} → {item.destinationChain}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">{date}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
                {item.shieldTxHash && (
                  <a
                    href={`https://starkscan.co/tx/${item.shieldTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white"
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
