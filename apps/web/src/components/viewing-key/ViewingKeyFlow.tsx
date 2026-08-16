"use client";

import { useState } from "react";
import { KeyRound, Shield, Eye, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function ViewingKeyFlow() {
  const { viewingKeys, addViewingKey, removeViewingKey } = useAppStore();
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

    await new Promise((r) => setTimeout(r, 1500));

    const newKey = {
      id: crypto.randomUUID(),
      label: label.trim(),
      publicKey: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
      viewingKey: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
      createdAt: new Date(),
      isActive: true,
    };

    addViewingKey(newKey);
    setLabel("");
    setIsRegistering(false);
  };

  const handleDeactivate = (id: string) => {
    removeViewingKey(id);
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-indigo-400" />
        Viewing Keys
      </h3>

      {activeKeys.length > 0 ? (
        <div className="space-y-3">
          {viewingKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-start justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{key.label}</p>
                  <p className="text-xs text-zinc-400 font-mono mt-1">
                    VK: {key.viewingKey.slice(0, 20)}...
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Registered {key.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeactivate(key.id)}
                className="text-xs text-red-400 hover:text-red-300 px-3 py-1 border border-red-400/30 rounded-md hover:bg-red-400/10 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
            <Shield className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-zinc-300">
                Viewing keys allow you to decrypt and view your shielded transaction
                history without revealing your identity.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300">
              Key Label
            </label>
            <input
              type="text"
              placeholder="e.g., Main Wallet Viewer"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleRegister}
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
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
