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
import { Navbar } from "@/components/layout/Navbar";
import { Reveal } from "@/components/animations/Reveal";
import { HeroCanvas } from "@/components/animations/HeroCanvas";
import { Shield, Zap, Eye, ArrowDownRight, ExternalLink } from "lucide-react";

export default function Home() {
  useAppStore((s) => s.intent);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <HeroCanvas />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a]" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <div className="section-label justify-center mb-6">
              <span className="text-blue-500">STRK20</span> Privacy Layer
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter leading-[0.9]">
              <span className="block">Privacy-first</span>
              <span className="block mt-2">cross-chain</span>
              <span className="block mt-2 text-blue-500">infrastructure</span>
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              Shield any token. Move it privately. Use it anywhere in DeFi.
              Compliant by design on Starknet.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <ConnectButton />
              <a href="#features" className="btn">
                Explore Features
                <ArrowDownRight className="w-4 h-4" />
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-20 flex items-center justify-center gap-8 text-zinc-600">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-xs mono uppercase tracking-wider">Shielded</span>
              </div>
              <div className="w-px h-4 bg-zinc-800" />
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs mono uppercase tracking-wider">Private</span>
              </div>
              <div className="w-px h-4 bg-zinc-800" />
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="text-xs mono uppercase tracking-wider">Compliant</span>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ArrowDownRight className="w-5 h-5 text-zinc-600" />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="section">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <div className="section-label">Core Primitives</div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tighter">
              Built for privacy.
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mb-16 leading-relaxed">
              Every primitive is designed to keep your activity private while
              remaining compliant when you need it.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Shielded Balances",
                desc: "Deposit tokens into a privacy pool. Your balance is hidden on-chain while you retain full control.",
              },
              {
                icon: Zap,
                title: "Private Transfers",
                desc: "Move funds between addresses with zero on-chain link. No sender, no receiver, just a valid transfer.",
              },
              {
                icon: Eye,
                title: "Viewing Keys",
                desc: "Share decryption access with auditors or yourself across devices. Selective, revocable, private.",
              },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.1}>
                <div className="panel group h-full hover:border-blue-500/30 transition-colors duration-300">
                  <feature.icon className="w-5 h-5 text-blue-500 mb-6 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy Stats ── */}
      <section id="privacy" className="section bg-[#0f0f0f]">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <div className="section-label">Privacy Health</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PrivateBalance />
              <PrivacyHealthScore />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pool Metrics ── */}
      <section id="metrics" className="section">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <div className="section-label">Network Metrics</div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tighter">
              Pool activity.
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mb-12">
              Real-time metrics from the STRK20 privacy pool on Starknet.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <PoolActivityMetrics />
          </Reveal>
        </div>
      </section>

      {/* ── Disclosure ── */}
      <section id="disclosure" className="section bg-[#0f0f0f]">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <div className="section-label">Selective Disclosure</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ViewingKeyFlow />
              <SelectiveDisclosure />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Intent Builder ── */}
      <section className="section">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <div className="section-label">Cross-Chain</div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tighter">
              Intent-based transfers.
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mb-12">
              Submit your transfer intent and let Nexora find the optimal route
              with built-in privacy protection.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <IntentForm />
                <RouteSelector />
                <TxTracker />
                <TransactionHistory />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#262626] py-16">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="text-lg font-bold tracking-tight">Nexora</span>
              </div>
              <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
                Privacy-first cross-chain infrastructure built on Starknet.
                Shield, transfer, and interact with compliant privacy.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Protocol</h4>
              <ul className="space-y-3">
                {["Shield", "Unshield", "Transfer", "Disclosure"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-zinc-500 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-3">
                {["Documentation", "GitHub", "Starknet", "Starkscan"].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      {item}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-600">
              Nexora Protocol. Privacy, not secrecy.
            </p>
            <p className="text-xs text-zinc-700 mono">
              Built on Starknet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
