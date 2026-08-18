"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, ArrowDownRight, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { CountUp } from "@/components/animations/CountUp";
import { relayerApi } from "@/lib/relayer-api";

const DEMO_METRICS = {
  totalDeposits: 3847,
  totalVolume: "12,450.00",
  activeUsers: 892,
  avgDepositSize: "3.24",
  lastUpdated: 0,
};

export function PoolActivityMetrics() {
  const { poolMetrics, setPoolMetrics } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const loadRealMetrics = async (showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const real = await relayerApi.getPoolMetrics();
      setPoolMetrics({
        totalDeposits: real.totalDeposits,
        totalVolume: Number(real.totalVolume).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        activeUsers: real.activeUsers,
        avgDepositSize: Number(real.avgDepositSize).toFixed(2),
        lastUpdated: Date.now(),
      });
      setIsLive(true);
    } catch {
      setIsLive(false);
      if (!poolMetrics) {
        setPoolMetrics({ ...DEMO_METRICS, lastUpdated: Date.now() });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (!poolMetrics) {
      loadRealMetrics(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolMetrics]);

  const metrics = poolMetrics ?? DEMO_METRICS;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadRealMetrics(false);
    } catch {
      const updated = {
        ...metrics,
        totalDeposits: metrics.totalDeposits + Math.floor(Math.random() * 5),
        totalVolume: (Number(metrics.totalVolume.replace(/,/g, "")) + Math.random() * 10).toFixed(2),
        activeUsers: metrics.activeUsers + Math.floor(Math.random() * 3) - 1,
        lastUpdated: Date.now(),
      };
      setPoolMetrics(updated);
      setIsLive(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatVolume = (vol: string) => {
    const num = Number(vol);
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return vol;
  };

  const displayLastUpdated = mounted && metrics.lastUpdated
    ? new Date(metrics.lastUpdated).toLocaleString()
    : "Loading...";

  const items = [
    {
      label: "Deposits",
      value: <CountUp end={metrics.totalDeposits} />,
      sub: "All time",
      icon: ArrowDownRight,
    },
    {
      label: "Volume",
      value: formatVolume(metrics.totalVolume),
      sub: "ETH shielded",
      icon: TrendingUp,
    },
    {
      label: "Active Users",
      value: <CountUp end={metrics.activeUsers} />,
      sub: "Last 24h",
      icon: Users,
    },
    {
      label: "Avg Deposit",
      value: metrics.avgDepositSize,
      sub: "ETH per tx",
      icon: BarChart3,
    },
  ];

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          Pool Activity
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-zinc-500 hover:text-white transition-colors disabled:text-zinc-700"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="p-5 bg-[#0f0f0f] border border-[#262626] rounded space-y-1.5 hover:border-blue-500/20 transition-colors"
          >
            <div className="flex items-center gap-2 text-zinc-500">
              <item.icon className="w-3.5 h-3.5" />
              <span className="text-[11px] mono uppercase tracking-wider">{item.label}</span>
            </div>
            <p className="text-2xl font-bold text-white mono">{item.value}</p>
            <p className="text-[11px] text-zinc-600 mono">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-600 mono mt-4">
        <span>Last updated: {displayLastUpdated}</span>
        <span className={`flex items-center gap-1.5 ${isLive ? "text-blue-500" : "text-zinc-600"}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-blue-500" : "bg-zinc-700"}`}
            style={isLive ? { boxShadow: "0 0 6px rgba(59,130,246,0.5)" } : undefined}
          />
          {isLive ? "Live" : "Demo"}
        </span>
      </div>
    </div>
  );
}
