import { create } from "zustand";
import type { IntentStatus } from "@/lib/relayer-api";

export interface Intent {
  id: string;
  fromChain: string;
  toChain: string;
  asset: string;
  amount: string;
  recipient: string;
  privacyLevel: "public" | "private" | "shielded";
  status: "draft" | "submitted" | "routing" | "building" | "signing" | "submitted_onchain" | "confirmed" | "failed";
  selectedRoute?: RouteOption;
  routes: RouteOption[];
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteOption {
  id: string;
  name: string;
  bridge: string;
  estimatedFee: string;
  estimatedTime: string;
  privacyScore: number;
  hops: number;
}

export interface ViewingKey {
  id: string;
  label: string;
  publicKey: string;
  viewingKey: string;
  createdAt: Date;
  isActive: boolean;
}

export interface DisclosureProof {
  id: string;
  type: string;
  statement: string;
  proof: string;
  publicInputs: string[];
  verifiedAt: number;
  expiresAt?: number;
}

export interface PoolActivityMetrics {
  totalDeposits: number;
  totalVolume: string;
  activeUsers: number;
  avgDepositSize: string;
  lastUpdated: number;
}

export interface PrivateBalance {
  asset: string;
  symbol: string;
  shieldedBalance: string;
  viewingKeyBalance: string;
  totalBalance: string;
}

interface AppState {
  intent: Intent | null;
  setIntent: (intent: Intent) => void;
  updateIntent: (updates: Partial<Intent>) => void;
  resetIntent: () => void;

  routes: RouteOption[];
  setRoutes: (routes: RouteOption[]) => void;
  selectRoute: (route: RouteOption) => void;

  viewingKeys: ViewingKey[];
  addViewingKey: (key: ViewingKey) => void;
  removeViewingKey: (id: string) => void;
  toggleViewingKey: (id: string) => void;

  balances: PrivateBalance[];
  setBalances: (balances: PrivateBalance[]) => void;

  transactionHistory: IntentStatus[];
  setTransactionHistory: (history: IntentStatus[]) => void;
  addTransaction: (tx: IntentStatus) => void;

  disclosureProofs: DisclosureProof[];
  addDisclosureProof: (proof: DisclosureProof) => void;
  removeDisclosureProof: (id: string) => void;
  clearDisclosureProofs: () => void;

  poolMetrics: PoolActivityMetrics | null;
  setPoolMetrics: (metrics: PoolActivityMetrics | null) => void;
}

const initialIntent: Intent = {
  id: crypto.randomUUID(),
  fromChain: "ethereum",
  toChain: "starknet",
  asset: "ETH",
  amount: "",
  recipient: "",
  privacyLevel: "private",
  status: "draft",
  routes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const useAppStore = create<AppState>((set) => ({
  intent: initialIntent,

  setIntent: (intent) => set({ intent }),

  updateIntent: (updates) =>
    set((state) => ({
      intent: state.intent ? { ...state.intent, ...updates, updatedAt: new Date() } : null,
    })),

  resetIntent: () => set({ intent: { ...initialIntent, id: crypto.randomUUID() } }),

  routes: [],
  setRoutes: (routes) => set({ routes }),
  selectRoute: (route) =>
    set((state) => ({
      intent: state.intent ? { ...state.intent, selectedRoute: route, updatedAt: new Date() } : null,
    })),

  viewingKeys: [],
  addViewingKey: (key) =>
    set((state) => ({ viewingKeys: [...state.viewingKeys, key] })),
  removeViewingKey: (id) =>
    set((state) => ({ viewingKeys: state.viewingKeys.filter((k) => k.id !== id) })),
  toggleViewingKey: (id) =>
    set((state) => ({
      viewingKeys: state.viewingKeys.map((k) =>
        k.id === id ? { ...k, isActive: !k.isActive } : k
      ),
    })),

  balances: [],
  setBalances: (balances) => set({ balances }),

  transactionHistory: [],
  setTransactionHistory: (history) => set({ transactionHistory: history }),
  addTransaction: (tx) =>
    set((state) => ({
      transactionHistory: [tx, ...state.transactionHistory].slice(0, 50),
    })),

  disclosureProofs: [],
  addDisclosureProof: (proof) =>
    set((state) => ({ disclosureProofs: [proof, ...state.disclosureProofs].slice(0, 50) })),
  removeDisclosureProof: (id) =>
    set((state) => ({ disclosureProofs: state.disclosureProofs.filter((p) => p.id !== id) })),
  clearDisclosureProofs: () => set({ disclosureProofs: [] }),

  poolMetrics: null,
  setPoolMetrics: (metrics) => set({ poolMetrics: metrics }),
}));
