export { PoolClient, PrivacyHubClient, PaymasterClient } from './core/client';
export type { ContractResponse, PaymasterConfig, PaymasterSponsorshipResponse } from './core/client';

export { ViewingKey, ViewingKeyManager } from './privacy/viewing-key';
export { ShieldBuilder } from './privacy/shield';
export { UnshieldBuilder } from './privacy/unshield';
export { PrivateTransferBuilder } from './privacy/private-transfer';
export { NoteDiscovery, IndexerDiscoveryProvider } from './privacy/discovery';
export { ProvingService } from './privacy/prover';

export { LayerSwapClient, LayerSwapApiError, ArbitrumAdapter, BaseAdapter, StarknetAccountGenerator, CrossChainFlow } from './adapters';
export type {
  AdapterConfig,
  ArbitrumAdapterConfig,
  BaseAdapterConfig,
  BridgeQuote,
  BridgeReservation,
  DepositAction,
  DepositStatus,
  DepositStatusResult,
  BridgeToken,
  BridgeNetwork,
  NetworkEnvironment,
  FreshAddressResult,
  WithdrawalParams,
  WithdrawalReceipt,
  DeterministicAccountParams,
  CrossChainFlowConfig,
  CrossChainReceipt,
  CrossChainStatus,
  StarknetAccount,
} from './adapters';

export type {
  ShieldedNote,
  PrivateBalance,
  ViewingKeyData,
  ShieldParams,
  UnshieldParams,
  TransferParams,
  UnshieldProof,
  UnshieldProofParams,
  TransferProofParams,
  TransactionResult,
  TransactionReceipt,
  DiscoverNotesOptions,
  PoolClientConfig,
  PrivacyHubClientConfig,
  ProvingServiceConfig,
  IndexerConfig,
  ShieldEvent,
  UnshieldEvent,
  ViewingKeyRegisteredEvent,
  ShieldResult,
  UnshieldResult,
  TransferResult,
  SupportedError,
  DisclosureType,
  DisclosureProof,
  DisclosureProofParams,
  PrivacyHealth,
  PrivacyHealthFactor,
  PoolActivityMetrics,
} from './types';

export {
  CHAIN_IDS,
  DEFAULT_RPC_URLS,
  POOL_ADDRESSES,
  DOMAIN_NAME,
  DEFAULT_BLOCK_IDENTIFIER,
  DEFAULT_PROVER_TIMEOUT_MS,
  DEFAULT_INDEXER_TIMEOUT_MS,
  DEFAULT_TX_WAIT_TIMEOUT_MS,
} from './constants';
export type { BlockIdentifier } from './constants';

export {
  ErrorCode,
  NexoraError,
  ViewingKeyError,
  ShieldError,
  UnshieldError,
  TransferError,
  DiscoveryError,
  ProverError,
  InvalidArgumentError,
  PaymasterError,
  isErrorCode,
} from './utils/errors';
export type { ErrorCodeValue } from './utils/errors';

export {
  deriveViewingKey,
  deriveDeterministicAccountKey,
  deriveStarknetPrivateKeyFromSignature,
  computeStarknetPublicKey,
  computeStarknetAddress,
  starknetKeccak,
  computePoseidonHashOnElements,
  reduceToField,
  hexToBigInt,
  bigIntToHex,
  feltToString,
  STARK_CURVE_ORDER,
} from './utils/poseidon';
export type { SignatureComponents, ViewingKeyComponents } from './utils/poseidon';

export { SDK_VERSION } from './_version';
