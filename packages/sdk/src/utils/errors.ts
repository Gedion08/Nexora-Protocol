export const ErrorCode = {
  VIEWING_KEY_NOT_DERIVED: 'VIEWING_KEY_NOT_DERIVED',
  VIEWING_KEY_NOT_REGISTERED: 'VIEWING_KEY_NOT_REGISTERED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  SHIELD_FAILED: 'SHIELD_FAILED',
  UNSHIELD_FAILED: 'UNSHIELD_FAILED',
  TRANSFER_FAILED: 'TRANSFER_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  INDEXER_ERROR: 'INDEXER_ERROR',
  PROVER_ERROR: 'PROVER_ERROR',
  PROOF_GENERATION_TIMEOUT: 'PROOF_GENERATION_TIMEOUT',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  CONNECTIVITY_ERROR: 'CONNECTIVITY_ERROR',
  UNSUPPORTED_TOKEN: 'UNSUPPORTED_TOKEN',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class NexoraError extends Error {
  readonly code: ErrorCodeValue;
  readonly cause?: unknown;

  constructor(message: string, code: ErrorCodeValue, cause?: unknown) {
    super(message);
    this.name = 'NexoraError';
    this.code = code;
    this.cause = cause;

    if (process.env.NODE_ENV !== 'production' && cause instanceof Error && cause.stack) {
      this.stack = `${this.stack?.split('\n')[0]}\n${cause.stack.split('\n').slice(1).join('\n')}`;
    }
  }
}

export class ViewingKeyError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.VIEWING_KEY_NOT_DERIVED, cause);
    this.name = 'ViewingKeyError';
  }
}

export class ShieldError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.SHIELD_FAILED, cause);
    this.name = 'ShieldError';
  }
}

export class UnshieldError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.UNSHIELD_FAILED, cause);
    this.name = 'UnshieldError';
  }
}

export class TransferError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.TRANSFER_FAILED, cause);
    this.name = 'TransferError';
  }
}

export class DiscoveryError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.INDEXER_ERROR, cause);
    this.name = 'DiscoveryError';
  }
}

export class ProverError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.PROVER_ERROR, cause);
    this.name = 'ProverError';
  }
}

export class InvalidArgumentError extends NexoraError {
  constructor(message: string, cause?: unknown) {
    super(message, ErrorCode.INVALID_ARGUMENT, cause);
    this.name = 'InvalidArgumentError';
  }
}

export class PaymasterError extends NexoraError {
  constructor(message: string, code?: ErrorCodeValue, cause?: unknown) {
    super(message, code ?? ErrorCode.TRANSACTION_FAILED, cause);
    this.name = 'PaymasterError';
  }
}

export function isErrorCode(error: unknown, code: ErrorCodeValue): boolean {
  return error instanceof NexoraError && error.code === code;
}
