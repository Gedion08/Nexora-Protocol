"use client";

import { Eye, EyeOff, Lock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#27272a"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

function HealthFactor({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  const Icon = score >= 80 ? CheckCircle2 : score >= 60 ? AlertTriangle : XCircle;
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-400">{description}</p>
      </div>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
  );
}

export function PrivacyHealthScore() {
  const { viewingKeys, balances, intent } = useAppStore();

  const hasActiveViewingKey = viewingKeys.some((k) => k.isActive);
  const viewingKeyScore = hasActiveViewingKey ? 90 : 20;
  const balanceScore = balances.length > 0 ? 70 : 40;
  const intentScore = intent && intent.status !== "draft" ? 75 : 50;
  const overall = Math.round((viewingKeyScore + balanceScore + intentScore) / 3);

  const factors = [
    {
      label: "Viewing Keys",
      score: viewingKeyScore,
      description: hasActiveViewingKey
        ? "Active viewing key registered"
        : "No active viewing key",
    },
    {
      label: "Shielded Balances",
      score: balanceScore,
      description: balances.length > 0
        ? `${balances.length} shielded assets`
        : "No shielded balances",
    },
    {
      label: "Transaction Privacy",
      score: intentScore,
      description: intent && intent.status !== "draft"
        ? `Active ${intent.privacyLevel} intent`
        : "No recent intents",
    },
  ];

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        Privacy Health Score
      </h3>

      <div className="flex flex-col items-center gap-4">
        <ScoreRing score={overall} />
        <p className="text-sm text-zinc-400 text-center">
          {overall >= 80
            ? "Excellent privacy posture"
            : overall >= 60
            ? "Good privacy posture"
            : "Needs improvement"}
        </p>
      </div>

      <div className="space-y-3">
        {factors.map((factor) => (
          <HealthFactor key={factor.label} {...factor} />
        ))}
      </div>

      {!hasActiveViewingKey && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Lock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-300 font-medium">
              Improve your score
            </p>
            <p className="text-xs text-yellow-400/80 mt-1">
              Register a viewing key to unlock your full privacy health score.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
