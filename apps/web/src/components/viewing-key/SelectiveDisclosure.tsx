"use client";

import { useState } from "react";
import {
  Share2,
  KeyRound,
  Eye,
  Copy,
  CheckCircle2,
  AlertCircle,
  Shield,
  Trash2,
  Fingerprint,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

type DisclosureType = "full" | "partial" | "amount" | "source" | "auditor" | "none";

const DISCLOSURE_TYPES: { value: DisclosureType; label: string; description: string }[] = [
  { value: "full", label: "Full Disclosure", description: "Reveal all shielded transaction details" },
  { value: "partial", label: "Partial Disclosure", description: "Reveal only selected fields" },
  { value: "amount", label: "Amount Proof", description: "Prove amount above/below a threshold" },
  { value: "source", label: "Source Proof", description: "Prove funds originated from a specific address" },
  { value: "auditor", label: "Auditor Access", description: "Grant an auditor viewing access" },
  { value: "none", label: "No Disclosure", description: "Generate a null disclosure proof" },
];

const PARTIAL_FIELDS = [
  "amount",
  "timestamp",
  "token",
  "nullifier",
  "noteHash",
];

export function SelectiveDisclosure() {
  const { viewingKeys, addDisclosureProof, removeDisclosureProof, disclosureProofs } = useAppStore();
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [disclosureType, setDisclosureType] = useState<DisclosureType>("none");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [threshold, setThreshold] = useState("");
  const [operator, setOperator] = useState<string>(">=");
  const [sourceAddress, setSourceAddress] = useState("");
  const [auditorPublicKey, setAuditorPublicKey] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("365");
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedKey = viewingKeys.find((k) => k.id === selectedKeyId);
  const hasActiveKey = viewingKeys.some((k) => k.isActive);

  const handleGenerate = async () => {
    if (!selectedKey) return;

    setIsGenerating(true);
    setMessage(null);

    await new Promise((r) => setTimeout(r, 1500));

    const proofId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt =
      disclosureType === "auditor" && expiresInDays
        ? now + Number(expiresInDays) * 24 * 60 * 60 * 1000
        : undefined;

    const statement = buildStatement(disclosureType, {
      fields: selectedFields,
      threshold,
      operator,
      sourceAddress,
      auditorPublicKey,
      expiresAt,
    });

    addDisclosureProof({
      id: proofId,
      type: disclosureType,
      statement,
      proof: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
      publicInputs: ["0x" + Array(32).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")],
      verifiedAt: now,
      expiresAt,
    });

    setMessage({
      type: "success",
      text: `${DISCLOSURE_TYPES.find((t) => t.value === disclosureType)?.label ?? "Disclosure"} proof generated successfully.`,
    });

    setIsGenerating(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "Copied to clipboard" });
    setTimeout(() => setMessage(null), 2000);
  };

  const operatorOptions = [">=", "<=", ">", "<", "==", "!="] as const;

  return (
    <div className="panel space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Share2 className="w-5 h-5 text-blue-500" />
        Selective Disclosure
      </h3>

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

      {!hasActiveKey ? (
        <div className="flex items-start gap-3 p-4 bg-[#0f0f0f] border border-[#262626] rounded">
          <KeyRound className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-zinc-300">
              You need an active viewing key to generate disclosure proofs.
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Register a viewing key in the panel above to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Select Viewing Key</label>
            <select
              value={selectedKeyId || ""}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors mono text-sm"
            >
              <option value="">-- Select a key --</option>
              {viewingKeys
                .filter((k) => k.isActive)
                .map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.label}
                  </option>
                ))}
            </select>
          </div>

          {selectedKey && (
            <div className="p-4 bg-[#0f0f0f] border border-[#262626] rounded space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Viewing Key Details</p>
                <button
                  onClick={() => handleCopy(selectedKey.viewingKey)}
                  className="flex items-center gap-1 text-[11px] mono uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-zinc-600" />
                <code className="text-xs text-zinc-500 mono break-all">
                  {selectedKey.viewingKey}
                </code>
              </div>
              <p className="text-xs text-zinc-600 mono">
                Public Key: {selectedKey.publicKey.slice(0, 20)}...
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-300 mb-2">Disclosure Type</label>
            <div className="grid grid-cols-2 gap-2">
              {DISCLOSURE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setDisclosureType(type.value)}
                  className={`p-3 rounded border text-left transition-all ${
                    disclosureType === type.value
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-[#262626] bg-[#0f0f0f] text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <p className="text-sm font-medium">{type.label}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {disclosureType === "partial" && (
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Fields to Disclose</label>
              <div className="flex flex-wrap gap-2">
                {PARTIAL_FIELDS.map((field) => (
                  <button
                    key={field}
                    onClick={() =>
                      setSelectedFields((prev) =>
                        prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
                      )
                    }
                    className={`px-3 py-1.5 rounded border text-xs mono transition-all ${
                      selectedFields.includes(field)
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : "border-[#262626] bg-[#0f0f0f] text-zinc-500 hover:border-zinc-700"
                    }`}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>
          )}

          {disclosureType === "amount" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Threshold Amount (base units)</label>
                <input
                  type="text"
                  placeholder="e.g. 1000000000000000000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Operator</label>
                <div className="flex flex-wrap gap-2">
                  {operatorOptions.map((op) => (
                    <button
                      key={op}
                      onClick={() => setOperator(op)}
                      className={`px-3 py-2 rounded border text-sm mono transition-all ${
                        operator === op
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-[#262626] bg-[#0f0f0f] text-zinc-500 hover:border-zinc-700"
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {disclosureType === "source" && (
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Source Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={sourceAddress}
                onChange={(e) => setSourceAddress(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
              />
            </div>
          )}

          {disclosureType === "auditor" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Auditor Public Key / Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={auditorPublicKey}
                  onChange={(e) => setAuditorPublicKey(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Expires In (days)</label>
                <input
                  type="text"
                  placeholder="365"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f0f0f] border border-[#262626] rounded text-white placeholder-zinc-600 mono text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedKeyId}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Proof...
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                Generate Disclosure Proof
              </>
            )}
          </button>
        </div>
      )}

      {disclosureProofs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-300 mono uppercase tracking-wider">Generated Proofs</p>
          {disclosureProofs.map((proof) => (
            <div
              key={proof.id}
              className="p-4 bg-[#0f0f0f] border border-[#262626] rounded space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-white capitalize">
                    {proof.type} Disclosure
                  </span>
                </div>
                <button
                  onClick={() => removeDisclosureProof(proof.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-500">{proof.statement}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-zinc-600 mono break-all flex-1">
                  {proof.proof.slice(0, 32)}...
                </code>
                <button
                  onClick={() => handleCopy(proof.proof)}
                  className="text-xs text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-600 mono">
                <span>Generated {new Date(proof.verifiedAt).toLocaleString()}</span>
                {proof.expiresAt && (
                  <span>Expires {new Date(proof.expiresAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildStatement(
  type: DisclosureType,
  opts: {
    fields?: string[];
    threshold?: string;
    operator?: string;
    sourceAddress?: string;
    auditorPublicKey?: string;
    expiresAt?: number;
  }
): string {
  switch (type) {
    case "full":
      return "Prover owns a shielded note in the specified pool";
    case "partial":
      return `Prover discloses fields: ${opts.fields?.join(", ") ?? "selected"}`;
    case "amount":
      return `Prover proves amount ${opts.operator ?? ">="} ${opts.threshold ?? "0"}`;
    case "source":
      return `Prover proves funds originated from ${opts.sourceAddress}`;
    case "auditor":
      return `Prover grants auditor access until ${opts.expiresAt ? new Date(opts.expiresAt).toISOString() : "permanent"}`;
    case "none":
      return "No disclosure";
    default:
      return "Custom disclosure proof";
  }
}
