"use client";

import { useState } from "react";
import { KeyRound, Shield, Eye, AlertCircle, Wallet } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAccount } from "@starknet-react/core";
import {
  deriveViewingKeyFromWallet,
  registerViewingKey,
  isPoolConfigured,
} from "@/lib/privacy-client";

export function ViewingKeyFlow() {
  const { viewingKeys, addViewingKey, removeViewingKey } = useAppStore();
  const { account, isConnected } = useAccount();
  const [isRegistering, setIsRegistering] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const activeKeys = viewingKeys.filter((k) => k.isActive);

  const handleRegister = async () => {
    if (!label.trim()) {
      setError("Please enter a label for your viewing key");
      return;
    }

    setIsRegistering(true);
    setError("");

    try {
      let publicKey = "";
      let viewingKey = "";

      if (isConnected && account) {
        const derived = await deriveViewingKeyFromWallet(account as never);
        if (derived) {
          publicKey = derived.publicKey;
          viewingKey = derived.viewingKey;

          if (isPoolConfigured()) {
            try {
              await registerViewingKey(
                account as never,
                publicKey
              );
            } catch (e) {
              setError(
                e instanceof Error
                  ? `Key derived but on-chain registration failed: ${e.message}`
                  : "Key derived but on-chain registration failed"
              );
              return;
            }
          }
        } else {
          setError("Could not derive a viewing key from your wallet. Is the pool configured?");
          return;
        }
      } else {
        publicKey =
          "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
        viewingKey = publicKey;
      }

      const newKey = {
        id: crypto.randomUUID(),
        label: label.trim(),
        publicKey,
        viewingKey,
        createdAt: new Date(),
        isActive: true,
      };

      addViewingKey(newKey);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register viewing key");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeactivate = (id: string) => {
    removeViewingKey(id);
  };

  return (
    <div className="panel space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-blue-500" />
        Viewing Keys
      </h3>

      {activeKeys.length > 0 ? (
        <div className="space-y-3">
          {viewingKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-start justify-between p-4 bg-[#0f0f0f] border border-[#262626] rounded"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{key.label}</p>
                  <p className="text-xs text-zinc-500 mono mt-1">
                    VK: {key.viewingKey.slice(0, 20)}...
                  </p>
                  <p className="text-xs text-zinc-600 mono mt-1">
                    Registered {key.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeactivate(key.id)}
                className="text-[11px] mono uppercase tracking-wider text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/20 rounded hover:bg-red-500/5 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded">
            <Shield className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-zinc-300">
                Viewing keys allow you to decrypt and view your shielded transaction
                history without revealing your identity.
              </p>
            </div>
          </div>

          {isConnected && account ? (
            <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded text-xs text-blue-400 mono">
              <Wallet className="w-4 h-4 shrink-0" />
              Key will be derived from your connected wallet signature
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded text-xs text-yellow-500 mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Connect a Starknet wallet to derive a real viewing key (demo key otherwise)
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm text-zinc-300">Key Label</label>
            <input
              type="text"
              placeholder="e.g., Main Wallet Viewer"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
            />
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5 mono">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleRegister}
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-medium transition-colors"
          >
            {isRegistering ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Register Viewing Key
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
