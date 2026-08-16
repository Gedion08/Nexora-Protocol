"use client";

import { useState } from "react";
import { Share2, KeyRound, Eye, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function SelectiveDisclosure() {
  const { viewingKeys } = useAppStore();
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [disclosedTo, setDisclosedTo] = useState("");
  const [isDisclosing, setIsDisclosing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedKey = viewingKeys.find((k) => k.id === selectedKeyId);

  const handleDisclose = async () => {
    if (!selectedKey || !disclosedTo.trim()) return;

    setIsDisclosing(true);
    setMessage(null);

    await new Promise((r) => setTimeout(r, 1200));

    setMessage({
      type: "success",
      text: `Viewing key disclosed to ${disclosedTo}. They can now view your shielded transactions.`,
    });
    setDisclosedTo("");
    setIsDisclosing(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "Copied to clipboard" });
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Share2 className="w-5 h-5 text-indigo-400" />
        Selective Disclosure
      </h3>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
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

      {viewingKeys.length === 0 ? (
        <div className="flex items-start gap-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <KeyRound className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-zinc-300">
              You need a viewing key to use selective disclosure.
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Register a viewing key in the panel above to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select Viewing Key
            </label>
            <select
              value={selectedKeyId || ""}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Select a key --</option>
              {viewingKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.label}
                </option>
              ))}
            </select>
          </div>

          {selectedKey && (
            <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Viewing Key Details</p>
                <button
                  onClick={() => handleCopy(selectedKey.viewingKey)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-zinc-500" />
                <code className="text-xs text-zinc-400 font-mono break-all">
                  {selectedKey.viewingKey}
                </code>
              </div>
              <p className="text-xs text-zinc-500">
                Public Key: {selectedKey.publicKey.slice(0, 20)}...
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Disclose To (Address or Email)
            </label>
            <input
              type="text"
              placeholder="0x... or email@example.com"
              value={disclosedTo}
              onChange={(e) => setDisclosedTo(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleDisclose}
            disabled={isDisclosing || !selectedKeyId || !disclosedTo.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
          >
            {isDisclosing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Disclosing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Disclose Viewing Key
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
