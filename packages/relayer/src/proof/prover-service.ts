import type { RelayerConfig } from '@nexora-protocol/shared';
import { ProvingService, type UnshieldProofParams, type DisclosureProofParams } from '@nexora-protocol/sdk';
import { withRetry, MAX_RETRIES, RETRY_BACKOFF_MS } from '@nexora-protocol/shared';

export interface UnshieldProofResult {
  nullifier: string;
  proof: string;
  publicInputs: string[];
}

export interface TransferProofResult {
  nullifier: string;
  proof: string;
  publicInputs: string[];
}

export interface DisclosureProofResult {
  type: string;
  statement: string;
  proof: string;
  publicInputs: string[];
  verifiedAt: number;
  expiresAt?: number;
}

export class ProverServiceUnavailableError extends Error {
  readonly url: string;

  constructor(url: string, message?: string) {
    super(message ?? `Prover service unavailable at ${url}`);
    this.name = 'ProverServiceUnavailableError';
    this.url = url;
  }
}

export class RelayerProverService {
  private config: RelayerConfig;
  private prover: ProvingService | null = null;
  private initialized = false;

  constructor(config: RelayerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.proverUrl) {
      console.warn('Prover URL not configured; proof generation will be disabled');
      this.initialized = false;
      return;
    }

    try {
      this.prover = new ProvingService({
        url: this.config.proverUrl,
        timeoutMs: this.config.txWaitTimeoutMs,
      });

      const healthy = await withRetry(
        () => this.prover!.healthCheck(),
        {
          maxRetries: MAX_RETRIES,
          baseDelayMs: RETRY_BACKOFF_MS,
          timeoutMs: this.config.txWaitTimeoutMs,
        }
      );

      if (!healthy) {
        throw new ProverServiceUnavailableError(this.config.proverUrl, 'Prover health check failed');
      }

      this.initialized = true;
      console.log(`Prover service initialized: ${this.config.proverUrl}`);
    } catch (error) {
      console.error('Failed to initialize prover service:', error);
      this.initialized = false;
      this.prover = null;
    }
  }

  async generateUnshieldProof(params: {
    noteHash: string;
    token: string;
    amount: string;
    nullifier: string;
    viewingKey: { publicKey: string; privateKey: string };
  }): Promise<UnshieldProofResult> {
    if (!this.prover || !this.initialized) {
      throw new ProverServiceUnavailableError(this.config.proverUrl ?? 'not configured');
    }

    const proofParams: UnshieldProofParams = {
      note: {
        noteHash: params.noteHash,
        token: params.token,
        amount: BigInt(params.amount),
        nullifier: params.nullifier,
        spent: false,
        createdAt: Date.now(),
      },
      viewingKey: {
        publicKey: BigInt(params.viewingKey.publicKey),
        privateKey: BigInt(params.viewingKey.privateKey),
      },
      poolAddress: this.config.poolAddress,
      chainId: this.config.environment === 'SEPOLIA' ? '0x534e5f5345504f4c4941' : '0x534e5f4d41494e',
    };

    const result = await withRetry(
      () => this.prover!.generateUnshieldProof(proofParams),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );

    return {
      nullifier: result.nullifier,
      proof: result.proof,
      publicInputs: result.publicInputs,
    };
  }

  async generateTransferProof(params: {
    token: string;
    amount: string;
    recipient: string;
    viewingKey: { publicKey: string; privateKey: string };
  }): Promise<TransferProofResult> {
    if (!this.prover || !this.initialized) {
      throw new ProverServiceUnavailableError(this.config.proverUrl ?? 'not configured');
    }

    const result = await withRetry(
      () =>
        this.prover!.generateTransferProof({
          token: params.token,
          amount: params.amount,
          recipient: params.recipient,
          viewing_key: {
            public_key: params.viewingKey.publicKey,
            private_key: params.viewingKey.privateKey,
          },
          pool_address: this.config.poolAddress,
          chain_id: this.config.environment === 'SEPOLIA' ? '0x534e5f5345504f4c4941' : '0x534e5f4d41494e',
        }),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );

    return {
      nullifier: result.nullifier,
      proof: result.proof,
      publicInputs: result.publicInputs,
    };
  }

  async generateDisclosureProof(params: {
    type: string;
    viewingKey: { publicKey: string; privateKey: string };
    fields?: string[];
    threshold?: string;
    operator?: string;
    sourceAddress?: string;
    auditorPublicKey?: string;
    expiresAt?: number;
    noteHash?: string;
  }): Promise<DisclosureProofResult> {
    if (!this.prover || !this.initialized) {
      throw new ProverServiceUnavailableError(this.config.proverUrl ?? 'not configured');
    }

    const proofParams: DisclosureProofParams = {
      type: params.type as any,
      viewingKey: {
        publicKey: BigInt(params.viewingKey.publicKey),
        privateKey: BigInt(params.viewingKey.privateKey),
      },
      poolAddress: this.config.poolAddress,
      chainId: this.config.environment === 'SEPOLIA' ? '0x534e5f5345504f4c4941' : '0x534e5f4d41494e',
      fields: params.fields,
      threshold: params.threshold ? BigInt(params.threshold) : undefined,
      operator: params.operator as any,
      sourceAddress: params.sourceAddress,
      auditorPublicKey: params.auditorPublicKey,
      expiresAt: params.expiresAt,
      noteHash: params.noteHash,
    };

    const result = await withRetry(
      () => this.prover!.generateDisclosureProof(proofParams),
      {
        maxRetries: MAX_RETRIES,
        baseDelayMs: RETRY_BACKOFF_MS,
        timeoutMs: this.config.txWaitTimeoutMs,
      }
    );

    return {
      type: result.type,
      statement: result.statement,
      proof: result.proof,
      publicInputs: result.publicInputs,
      verifiedAt: result.verifiedAt,
      expiresAt: result.expiresAt,
    };
  }

  isAvailable(): boolean {
    return this.initialized && this.prover !== null;
  }

  getUrl(): string | undefined {
    return this.config.proverUrl;
  }
}
