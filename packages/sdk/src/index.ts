export { PoolClient, PrivacyHubClient } from './core/client';
export type { ContractResponse } from './core/client';

export { ViewingKey, ViewingKeyManager } from './privacy/viewing-key';
export { ShieldBuilder } from './privacy/shield';
export { UnshieldBuilder } from './privacy/unshield';
export { NoteDiscovery, IndexerDiscoveryProvider } from './privacy/discovery';
export { ProvingService } from './privacy/prover';

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
  SupportedError,
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
  DiscoveryError,
  ProverError,
  InvalidArgumentError,
  isErrorCode,
} from './utils/errors';
export type { ErrorCodeValue } from './utils/errors';

export {
  deriveViewingKey,
  deriveDeterministicAccountKey,
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
