'use client';

import { ConnectButton } from "@/components/wallet/ConnectButton";
import { IntentForm } from "@/components/intent/IntentForm";
import { RouteSelector } from "@/components/intent/RouteSelector";
import { TxTracker } from "@/components/transaction/TxTracker";
import { TransactionHistory } from "@/components/transaction/TransactionHistory";
import { PrivateBalance } from "@/components/balance/PrivateBalance";
import { PrivacyHealthScore } from "@/components/balance/PrivacyHealthScore";
import { PoolActivityMetrics } from "@/components/balance/PoolActivityMetrics";
import { ViewingKeyFlow } from "@/components/viewing-key/ViewingKeyFlow";
import { SelectiveDisclosure } from "@/components/viewing-key/SelectiveDisclosure";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, Shield, Zap } from "lucide-react";

export default function Home() {
  useAppStore((s) => s.intent);

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Nexora</h1>
              <p className="text-xs text-zinc-400">Privacy-First Cross-Chain</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Intent-Based Cross-Chain Transfers
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Submit your transfer intent and let Nexora find the optimal route
            with built-in privacy protection via STRK20.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Shield className="w-4 h-4 text-indigo-400" />
              Shielded Transfers
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Zap className="w-4 h-4 text-indigo-400" />
              Optimal Routing
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Privacy Scores
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Submit Intent
              </h3>
              <IntentForm />
            </div>

            <RouteSelector />

            <TxTracker />

            <TransactionHistory />
          </div>

          <div className="space-y-6">
            <PrivateBalance />
            <PrivacyHealthScore />
            <PoolActivityMetrics />
            <ViewingKeyFlow />
            <SelectiveDisclosure />
          </div>
        </div>
      </main>
    </div>
  );
}
