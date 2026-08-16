export type NetworkEnvironment = 'MAINNET' | 'SEPOLIA';

export type ChainId = 'arbitrum' | 'starknet' | 'base' | 'ethereum' | 'optimism';

export type IntentStatus =
  | 'pending'
  | 'inventory_reserved'
  | 'bridge_reserved'
  | 'awaiting_deposit'
  | 'detected'
  | 'bridging'
  | 'shielding'
  | 'shielded'
  | 'completed'
  | 'failed'
  | 'refunding'
  | 'refunded'
  | 'cancelled'
  | 'withdrawal_pending'
  | 'unshielding'
  | 'bridging_out'
  | 'withdrawal_completed';

export type DepositStatus =
  | 'pending'
  | 'detected'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type BridgeProvider = 'layerswap' | 'starkgate' | 'orbiter';

export interface TokenInfo {
  symbol: string;
  name: string;
  contractAddress: string | null;
  decimals: number;
  logo?: string;
}

export interface ChainConfig {
  id: ChainId;
  name: string;
  type: 'evm' | 'starknet';
  chainId: string | number;
  rpcUrl: string;
  tokens: TokenInfo[];
  bridgeProviders: BridgeProvider[];
}

export interface DepositIntent {
  id: string;
  userId: string;
  sourceChain: ChainId;
  destinationChain: ChainId;
  sourceToken: string;
  destinationToken: string;
  amount: string;
  amountInBaseUnits: string;
  sourceAddress?: string;
  destinationAddress: string;
  privacyLevel: 'none' | 'standard' | 'maximum';
  viewingKey?: {
    publicKey: string;
    privateKey: string;
  };
  refundAddress?: string;
  referenceId?: string;
  createdAt: string;
  status: IntentStatus;
  failReason?: string;
}

export interface DepositReceipt {
  intentId: string;
  depositAddress: string;
  depositActions: DepositAction[];
  estimatedArrival?: string;
  fee: number;
  status: { state: IntentStatus };
  swapId?: string;
  bridgeTxHash?: string;
}

export interface DepositAction {
  type: 'transfer' | 'manual_transfer';
  toAddress?: string;
  amount: number;
  amountInBaseUnits: string;
  order: number;
  network: string;
  token: string;
  feeToken?: string;
  callData: string | null;
  gasLimit?: string;
}

export interface ShieldRecord {
  id: string;
  intentId: string;
  swapId: string;
  token: string;
  amount: string;
  txHash: string;
  noteHash: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface DepositRecord {
  id: string;
  intentId: string;
  swapId: string;
  sourceTxHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  token: string;
  blockNumber: number;
  blockHash: string;
  detectedAt: string;
  status: 'pending' | 'confirmed' | 'processed';
  shieldTxHash?: string;
}

export interface InventoryRecord {
  id: string;
  chain: ChainId;
  token: string;
  tokenAddress: string;
  totalBalance: string;
  reservedBalance: string;
  lastRefreshed: string;
}

export interface RelayerAccount {
  id: string;
  chain: ChainId;
  address: string;
  encryptedPrivateKey: string;
  isActive: boolean;
  createdAt: string;
}

export interface TransactionReceipt {
  transactionHash: string;
  status: 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  blockHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  timestamp?: number;
}
