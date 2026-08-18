"use client";

import {
  ViewingKey,
  ViewingKeyManager,
  PoolClient,
  PrivacyHubClient,
  NoteDiscovery,
  ProvingService,
  UnshieldBuilder,
  CHAIN_IDS,
} from "@nexora-protocol/sdk";

export interface SignerLike {
  address: string;
  provider?: { getChainId?: () => Promise<string> };
  chainId?: string;
  signMessage: (data: unknown) => Promise<unknown>;
  getNonce?: () => Promise<unknown>;
  execute?: (...args: unknown[]) => Promise<{ transaction_hash?: string }>;
}

export interface ViewingKeyLike {
  publicKey: bigint | string;
  privateKey: bigint | string;
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS || "";
const HUB_ADDRESS = process.env.NEXT_PUBLIC_PRIVACY_HUB_ADDRESS || "";
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || "";
const PROVER_URL = process.env.NEXT_PUBLIC_PROVER_URL || "";
const CHAIN_ID =
  process.env.NEXT_PUBLIC_CHAIN_ID === "SN_SEPOLIA" ? CHAIN_IDS.SEPOLIA : CHAIN_IDS.MAINNET;

let poolClient: PoolClient | null = null;

export function isPoolConfigured(): boolean {
  return Boolean(RPC_URL && POOL_ADDRESS);
}

export function isIndexerConfigured(): boolean {
  return Boolean(INDEXER_URL);
}

export function isProverConfigured(): boolean {
  return Boolean(PROVER_URL);
}

export function getPoolClient(): PoolClient | null {
  if (!isPoolConfigured()) return null;
  if (!poolClient) {
    poolClient = new PoolClient({
      rpcUrl: RPC_URL,
      poolAddress: POOL_ADDRESS,
      chainId: CHAIN_ID,
      timeoutMs: 60_000,
    });
  }
  return poolClient;
}

export interface DerivedViewingKey {
  publicKey: string;
  viewingKey: string;
  chainId: string;
  poolAddress: string;
}

export async function deriveViewingKeyFromWallet(
  account: SignerLike
): Promise<DerivedViewingKey | null> {
  if (!account) return null;
  if (!POOL_ADDRESS) return null;

  try {
    const vk = await ViewingKey.deriveFromWallet(account as never, CHAIN_ID, POOL_ADDRESS);
    return {
      publicKey: "0x" + vk.publicKey.toString(16),
      viewingKey: "0x" + vk.privateKey.toString(16),
      chainId: CHAIN_ID,
      poolAddress: POOL_ADDRESS,
    };
  } catch {
    return null;
  }
}

export async function registerViewingKey(
  account: SignerLike,
  publicKey: string
): Promise<{ transactionHash: string }> {
  const client = getPoolClient();
  if (!client) {
    throw new Error("Privacy pool not configured");
  }

  const manager = new ViewingKeyManager(client);
  const vk = ViewingKey.fromPublicKey(publicKey, CHAIN_ID, POOL_ADDRESS);

  const result = await manager.register(account as never, vk);
  await result.wait();
  return { transactionHash: result.transactionHash };
}

export async function getPrivateBalances(
  account: SignerLike,
  viewingKey: { publicKey: string; viewingKey: string }
): Promise<
  Array<{
    token: string;
    amount: bigint;
    noteCount: number;
  }>
> {
  const client = getPoolClient();
  if (!client || !INDEXER_URL) return [];

  const discovery = new NoteDiscovery(client, INDEXER_URL);
  const vkData = {
    publicKey: BigInt(viewingKey.publicKey),
    privateKey: BigInt(viewingKey.viewingKey),
  };

  const notesMap = await discovery.discoverNotes(account.address, vkData, {
    includeSpent: false,
  });

  const balances: Array<{ token: string; amount: bigint; noteCount: number }> = [];

  for (const [token, notes] of notesMap.entries()) {
    const unspent = notes.filter((n) => !n.spent);
    const total = unspent.reduce((sum, n) => sum + n.amount, BigInt(0));
    balances.push({ token, amount: total, noteCount: unspent.length });
  }

  return balances;
}

export async function generateDisclosureProof(params: {
  type: "full" | "partial" | "amount" | "source" | "auditor" | "none";
  viewingKey: { publicKey: string; viewingKey: string };
  fields?: string[];
  threshold?: string;
  operator?: string;
  sourceAddress?: string;
  auditorPublicKey?: string;
  expiresAt?: number;
}): Promise<{ proof: string; publicInputs: string[]; statement: string; verifiedAt: number } | null> {
  if (!PROVER_URL) return null;

  const prover = new ProvingService({ url: PROVER_URL, timeoutMs: 120_000 });

  const result = await prover.generateDisclosureProof({
    type: params.type,
    viewingKey: {
      publicKey: BigInt(params.viewingKey.publicKey),
      privateKey: BigInt(params.viewingKey.viewingKey),
    },
    poolAddress: POOL_ADDRESS,
    chainId: CHAIN_ID,
    fields: params.fields,
    threshold: params.threshold ? BigInt(params.threshold) : undefined,
    operator: params.operator as ">=" | "<=" | "==" | "!=" | ">" | "<",
    sourceAddress: params.sourceAddress,
    auditorPublicKey: params.auditorPublicKey,
    expiresAt: params.expiresAt,
  });

  return {
    proof: result.proof,
    publicInputs: result.publicInputs,
    statement: result.statement,
    verifiedAt: result.verifiedAt,
  };
}

export async function getWithdrawableNotes(
  account: SignerLike,
  viewingKey: { publicKey: string; viewingKey: string }
): Promise<
  Array<{
    token: string;
    amount: bigint;
    noteCount: number;
    notes: Array<{ noteHash: string; amount: bigint; nullifier: string; spent: boolean }>;
  }>
> {
  const client = getPoolClient();
  if (!client || !INDEXER_URL) return [];

  const discovery = new NoteDiscovery(client, INDEXER_URL);
  const vkData = {
    publicKey: BigInt(viewingKey.publicKey),
    privateKey: BigInt(viewingKey.viewingKey),
  };

  const notesMap = await discovery.discoverNotes(account.address, vkData, {
    includeSpent: false,
  });

  const result: Array<{
    token: string;
    amount: bigint;
    noteCount: number;
    notes: Array<{ noteHash: string; amount: bigint; nullifier: string; spent: boolean }>;
  }> = [];

  for (const [token, notes] of notesMap.entries()) {
    const unspent = notes.filter((n) => !n.spent);
    if (unspent.length === 0) continue;
    const total = unspent.reduce((sum, n) => sum + n.amount, BigInt(0));
    result.push({
      token,
      amount: total,
      noteCount: unspent.length,
      notes: unspent.map((n) => ({
        noteHash: n.noteHash,
        amount: n.amount,
        nullifier: n.nullifier,
        spent: n.spent,
      })),
    });
  }

  return result;
}

export async function withdrawPrivateFunds(params: {
  account: SignerLike;
  viewingKey: { publicKey: string; viewingKey: string };
  token: string;
  amount: bigint;
  recipient: string;
  note: { noteHash: string; amount: bigint; nullifier: string; spent: boolean };
}): Promise<{ transactionHash: string; nullifier: string } | null> {
  const poolClient = getPoolClient();
  if (!poolClient || !HUB_ADDRESS || !PROVER_URL) return null;

  const hubClient = new PrivacyHubClient({
    rpcUrl: RPC_URL,
    privacyHubAddress: HUB_ADDRESS,
    poolAddress: POOL_ADDRESS,
    chainId: CHAIN_ID,
    timeoutMs: 60_000,
  });

  const prover = new ProvingService({ url: PROVER_URL, timeoutMs: 120_000 });
  const builder = new UnshieldBuilder(hubClient, prover);

  const result = await builder.unshield({
    account: params.account as never,
    token: params.token,
    amount: params.amount,
    recipient: params.recipient,
    note: params.note as never,
    viewingKey: {
      publicKey: BigInt(params.viewingKey.publicKey),
      privateKey: BigInt(params.viewingKey.viewingKey),
    },
    poolAddress: POOL_ADDRESS,
    chainId: CHAIN_ID,
  });

  return {
    transactionHash: result.transactionHash,
    nullifier: result.nullifier,
  };
}