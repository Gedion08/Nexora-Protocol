"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, ArrowDownRight, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const DEMO_METRICS = {
  totalDeposits: 3847,
  totalVolume: "12,450.00",
  activeUsers: 892,
  avgDepositSize: "3.24",
  lastUpdated: Date.now(),
};

export function PoolActivityMetrics() {
  const { poolMetrics, setPoolMetrics } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const metrics = poolMetrics ?? DEMO_METRICS;

  useEffect(() => {
    if (!poolMetrics) {
      setPoolMetrics(DEMO_METRICS);
    }
  }, [poolMetrics, setPoolMetrics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    const updated = {
      ...metrics,
      totalDeposits: metrics.totalDeposits + Math.floor(Math.random() * 5),
      totalVolume: (Number(metrics.totalVolume.replace(/,/g, "")) + Math.random() * 10).toFixed(2),
      activeUsers: metrics.activeUsers + Math.floor(Math.random() * 3) - 1,
      lastUpdated: Date.now(),
    };
    setPoolMetrics(updated);
    setIsRefreshing(false);
  };

  const formatVolume = (vol: string) => {
    const num = Number(vol);
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return vol;
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          Pool Activity
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <ArrowDownRight className="w-4 h-4" />
            <span className="text-xs font-medium">Deposits</span>
          </div>
          <p className="text-xl font-bold text-white">{metrics.totalDeposits.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">All time</p>
        </div>

        <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Volume</span>
          </div>
          <p className="text-xl font-bold text-white">{formatVolume(metrics.totalVolume)}</p>
          <p className="text-xs text-zinc-500">ETH shielded</p>
        </div>

        <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Active Users</span>
          </div>
          <p className="text-xl font-bold text-white">{metrics.activeUsers.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Last 24h</p>
        </div>

        <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-medium">Avg Deposit</span>
          </div>
          <p className="text-xl font-bold text-white">{metrics.avgDepositSize}</p>
          <p className="text-xs text-zinc-500">ETH per tx</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Last updated: {new Date(metrics.lastUpdated).toLocaleString()}</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Live
        </span>
      </div>
    </div>
  );
}
