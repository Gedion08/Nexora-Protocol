export type NetworkEnvironment = 'MAINNET' | 'SEPOLIA';

export interface AdapterConfig {
  apiKey: string;
  baseUrl?: string;
  environment?: NetworkEnvironment;
  timeoutMs?: number;
}

export interface ArbitrumAdapterConfig extends AdapterConfig {
  sourceNetwork?: 'ARBITRUM';
  destinationNetwork?: 'STARKNET';
  defaultToken?: string;
}

export interface BridgeQuote {
  sourceNetwork: string;
  sourceToken: string;
  destinationNetwork: string;
  destinationToken: string;
  amount: number;
  receiveAmount: number;
  totalFee: number;
  blockchainFee: number;
  serviceFee: number;
  avgCompletionTime: string;
  minAmount: number;
  maxAmount: number;
}

export interface BridgeReservation {
  swapId: string;
  sourceNetwork: string;
  sourceToken: string;
  destinationNetwork: string;
  destinationToken: string;
  amount: number;
  destinationAddress: string;
  depositAddress: string;
  status: string;
  depositActions: DepositAction[];
  fee: number;
  createdAt: string;
  inputTransactionHash: string | null;
  outputTransactionHash: string | null;
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

export type DepositStatus = 'pending' | 'detected' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled';

export interface DepositStatusResult {
  swapId: string;
  status: DepositStatus;
  inputTransactionHash?: string;
  outputTransactionHash?: string;
  confirmations: number;
  maxConfirmations: number;
  failReason?: string;
}

export interface BridgeToken {
  symbol: string;
  displayName: string;
  contract: string | null;
  decimals: number;
  logo: string;
}

export interface BridgeNetwork {
  name: string;
  displayName: string;
  logo: string;
  chainId: string | null;
  type: string;
  tokens: BridgeToken[];
}
