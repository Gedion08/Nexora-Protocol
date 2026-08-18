"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAccount } from "@starknet-react/core";
import {
  getWithdrawableNotes,
  withdrawPrivateFunds,
  isIndexerConfigured,
  isProverConfigured,
  isPoolConfigured,
} from "@/lib/privacy-client";

interface WithdrawableAsset {
  token: string;
  amount: bigint;
  noteCount: number;
  displayAmount: string;
  notes: Array<{ noteHash: string; amount: bigint; nullifier: string; spent: boolean }>;
}

export function WithdrawForm() {
  const { viewingKeys } = useAppStore();
  const { account, isConnected } = useAccount();
  const [assets, setAssets] = useState<WithdrawableAsset[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [useFreshAddress, setUseFreshAddress] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [txHash, setTxHash] = useState("");
  const [source, setSource] = useState<"demo" | "indexer">("demo");

  const activeKey = viewingKeys.find((k) => k.isActive);

  useEffect(() => {
    if (
      isConnected &&
      account &&
      activeKey &&
      isIndexerConfigured() &&
      isPoolConfigured()
    ) {
      let cancelled = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(true);

      getWithdrawableNotes(account as never, {
        publicKey: activeKey.publicKey,
        viewingKey: activeKey.viewingKey,
      })
        .then((notes) => {
          if (cancelled) return;
          const mapped = notes.map((n) => ({
            token: n.token,
            amount: n.amount,
            noteCount: n.noteCount,
            displayAmount: formatAmount(n.amount),
            notes: n.notes,
          }));
          setAssets(mapped);
          setSource("indexer");
          if (mapped.length > 0 && !selectedToken) {
            setSelectedToken(mapped[0].token);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account, activeKey, isIndexerConfigured(), isPoolConfigured()]);

  const selectedAsset = assets.find((a) => a.token === selectedToken);

  const handleWithdraw = async () => {
    if (!account || !activeKey || !selectedAsset || !amount) return;

    const amountBig = parseAmount(amount);
    if (amountBig <= BigInt(0)) {
      setMessage({ type: "error", text: "Amount must be greater than zero" });
      return;
    }
    if (amountBig > selectedAsset.amount) {
      setMessage({ type: "error", text: "Amount exceeds shielded balance" });
      return;
    }

    const to = useFreshAddress ? account.address : recipient;
    if (!to) {
      setMessage({ type: "error", text: "Recipient address is required" });
      return;
    }

    setIsWithdrawing(true);
    setMessage(null);
    setTxHash("");

    try {
      const note = selectedAsset.notes.find((n) => n.amount >= amountBig) ?? selectedAsset.notes[0];
      if (!note) {
        throw new Error("No unspent note large enough for this token");
      }

      const result = await withdrawPrivateFunds({
        account: account as never,
        viewingKey: {
          publicKey: activeKey.publicKey,
          viewingKey: activeKey.viewingKey,
        },
        token: selectedToken,
        amount: amountBig,
        recipient: to,
        note,
      });

      if (!result) {
        throw new Error("Withdrawal is not available until the indexer, prover and pool are configured");
      }

      setTxHash(result.transactionHash);
      setMessage({
        type: "success",
        text: `Unshield submitted with nullifier ${result.nullifier.slice(0, 20)}...`,
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.token === selectedToken
            ? { ...a, amount: a.amount - amountBig, displayAmount: formatAmount(a.amount - amountBig) }
            : a
        )
      );
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to unshield funds",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const maxAmount = selectedAsset ? formatAmount(selectedAsset.amount) : "--";

  return (
    <div className="panel space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ArrowDownLeft className="w-5 h-5 text-blue-500" />
          Unshield / Withdraw
        </h3>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
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

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded text-sm mono ${
            message.type === "success"
              ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {!isConnected || !account ? (
        <div className="flex items-start gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded">
          <Wallet className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-zinc-300">Connect your wallet to unshield funds.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Withdrawals are submitted from the same address that shielded.
            </p>
          </div>
        </div>
      ) : !activeKey ? (
        <div className="flex items-start gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded">
          <Lock className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-zinc-300">
              You need an active viewing key to unshield funds.
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Register a viewing key in the panel above to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!isProverConfigured() && (
            <div className="flex items-start gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded">
              <AlertCircle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-500">
                Withdrawal needs a prover, indexer and pool endpoint configured to run on-chain.
                Setting an amount below previews the flow.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-300 mb-2">Asset</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            >
              {assets.length === 0 && <option value="">-- No shielded balance --</option>}
              {assets.map((asset) => (
                <option key={asset.token} value={asset.token}>
                  {shortAddress(asset.token)} - {asset.displayAmount}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-600 mono mt-1">
              Available: {maxAmount}
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-2">Amount</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-3">Withdraw To</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded cursor-pointer">
                <input
                  type="radio"
                  checked={useFreshAddress}
                  onChange={() => setUseFreshAddress(true)}
                  className="accent-blue-500"
                />
                <div>
                  <p className="text-sm text-white">Current wallet</p>
                  <p className="text-[11px] text-zinc-500 mono break-all">{account.address}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded cursor-pointer">
                <input
                  type="radio"
                  checked={!useFreshAddress}
                  onChange={() => setUseFreshAddress(false)}
                  className="accent-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm text-white">Custom recipient</p>
                  {!useFreshAddress && (
                    <input
                      type="text"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-[#0a0a0a] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !amount || (useFreshAddress ? false : !recipient)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-medium transition-colors"
          >
            {isWithdrawing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Unshielding...
              </>
            ) : (
              <>
                <ArrowDownLeft className="w-4 h-4" />
                Unshield {amount || "0"} from Privacy Pool
              </>
            )}
          </button>

          {txHash && (
            <div className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded text-xs">
              <span className="mono text-green-400 break-all flex-1">
                tx: {txHash.slice(0, 24)}...
              </span>
              <a
                href={`https://voyager.online/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-400 hover:text-green-300 ml-3 shrink-0"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatAmount(value: bigint): string {
  const raw = Number(value) / 1e18;
  if (raw >= 1000) return raw.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return raw.toFixed(4);
}

function parseAmount(value: string): bigint {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed <= 0) return BigInt(0);
  return BigInt(Math.floor(parsed * 1e18));
}

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}
