import type { Account } from 'starknet';
import { BlockIdentifier } from './constants';
import { ErrorCodeValue } from './utils/errors';

export interface ShieldedNote {
  noteHash: string;
  token: string;
  amount: bigint;
  nullifier: string;
  spent: boolean;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface PrivateBalance {
  token: string;
  amount: bigint;
  noteCount: number;
  notes: ShieldedNote[];
}

export interface ViewingKeyData {
  publicKey: bigint;
  privateKey: bigint;
}

export interface ShieldParams {
  account: Account;
  token: string;
  amount: bigint;
  viewingKey: ViewingKeyData;
  blockIdentifier?: BlockIdentifier;
}

export interface UnshieldParams {
  account: Account;
  token: string;
  amount: bigint;
  recipient: string;
  note: ShieldedNote;
  viewingKey: ViewingKeyData;
  poolAddress: string;
  chainId: string;
  blockIdentifier?: BlockIdentifier;
}

export interface TransferParams {
  account: Account;
  token: string;
  amount: bigint;
  recipient: bigint;
  viewingKey: ViewingKeyData;
  poolAddress: string;
  chainId: string;
  blockIdentifier?: BlockIdentifier;
}

export interface UnshieldProof {
  nullifier: string;
  proof: string;
  publicInputs: string[];
}

export interface UnshieldProofParams {
  note: ShieldedNote;
  viewingKey: ViewingKeyData;
  poolAddress: string;
  chainId: string;
}

export interface TransferProofParams {
  note: ShieldedNote;
  viewingKey: ViewingKeyData;
  poolAddress: string;
  chainId: string;
  recipientViewingKey: ViewingKeyData;
}

export interface TransactionResult {
  transactionHash: string;
  wait(timeoutMs?: number): Promise<TransactionReceipt>;
}

export interface TransactionReceipt {
  transactionHash: string;
  status: 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  blockHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  timestamp?: number;
}

export interface DiscoverNotesOptions {
  tokens?: string[];
  blockIdentifier?: BlockIdentifier;
  includeSpent?: boolean;
}

export interface PoolClientConfig {
  rpcUrl: string;
  poolAddress: string;
  chainId?: string;
  timeoutMs?: number;
  paymaster?: {
    rpcUrl: string;
    paymasterAddress?: string;
    timeoutMs?: number;
  };
}

export interface PrivacyHubClientConfig {
  rpcUrl: string;
  privacyHubAddress: string;
  poolAddress: string;
  chainId?: string;
  timeoutMs?: number;
  paymaster?: {
    rpcUrl: string;
    paymasterAddress?: string;
    timeoutMs?: number;
  };
}

export interface ProvingServiceConfig {
  url: string;
  timeoutMs?: number;
  apiKey?: string;
}

export interface IndexerConfig {
  url: string;
  poolAddress: string;
  timeoutMs?: number;
}

export interface ShieldEvent {
  user: string;
  token: string;
  amount: bigint;
  noteHash: string;
  timestamp: number;
}

export interface UnshieldEvent {
  user: string;
  token: string;
  amount: bigint;
  recipient: string;
  timestamp: number;
}

export interface ViewingKeyRegisteredEvent {
  user: string;
  publicKey: bigint;
  timestamp: number;
}

export interface TransferResult extends TransactionResult {
  nullifier: string;
  amount: bigint;
  token: string;
  recipient: string;
  account?: string;
  status?: string;
}

export interface ShieldResult extends TransactionResult {
  noteHash: string;
  amount: bigint;
  token: string;
  account?: string;
  status?: string;
}

export interface UnshieldResult extends TransactionResult {
  nullifier: string;
  amount: bigint;
  token: string;
  recipient: string;
  account?: string;
  status?: string;
}

export type SupportedError = Error & { code?: ErrorCodeValue };
