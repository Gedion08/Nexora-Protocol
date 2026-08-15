import { ProvingServiceConfig, UnshieldProof, UnshieldProofParams } from '../types';
import { ProverError, InvalidArgumentError } from '../utils/errors';

export interface ProverResponse {
  nullifier: string;
  proof: string;
  public_inputs: string[];
}

export class ProvingService {
  readonly url: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;

  constructor(config: ProvingServiceConfig) {
    if (!config.url) {
      throw new InvalidArgumentError('prover url is required');
    }
    this.url = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async generateUnshieldProof(params: UnshieldProofParams): Promise<UnshieldProof> {
    this.validateProofParams(params);

    const body = {
      note: {
        note_hash: params.note.noteHash,
        token: params.note.token,
        amount: params.note.amount.toString(),
        nullifier: params.note.nullifier,
      },
      viewing_key: {
        public_key: params.viewingKey.publicKey.toString(),
        private_key: params.viewingKey.privateKey.toString(),
      },
      pool_address: params.poolAddress,
      chain_id: params.chainId,
    };

    try {
      const response = await this.request('/prove/unshield', 'POST', body) as ProverResponse;

      if (!response || !response.proof) {
        throw new ProverError('Prover response missing proof field');
      }

      return {
        nullifier: response.nullifier ?? params.note.nullifier,
        proof: response.proof,
        publicInputs: response.public_inputs ?? [],
      };
    } catch (error) {
      if (error instanceof ProverError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new ProverError('Proof generation failed: ' + (error as Error).message, error);
    }
  }

  async generateTransferProof(params: Record<string, unknown>): Promise<UnshieldProof> {
    try {
      const response = await this.request('/prove/transfer', 'POST', params) as ProverResponse;
      return {
        nullifier: response.nullifier,
        proof: response.proof,
        publicInputs: response.public_inputs ?? [],
      };
    } catch (error) {
      if (error instanceof ProverError) throw error;
      throw new ProverError('Transfer proof generation failed: ' + (error as Error).message, error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health', 'GET') as { status?: string; healthy?: boolean };
      return Boolean(response?.status === 'ok' || response?.healthy);
    } catch {
      return false;
    }
  }

  private validateProofParams(params: UnshieldProofParams): void {
    if (!params.note) {
      throw new InvalidArgumentError('note is required for proof generation');
    }
    if (!params.note.noteHash && !params.note.nullifier) {
      throw new InvalidArgumentError('note must have noteHash or nullifier');
    }
    if (!params.viewingKey) {
      throw new InvalidArgumentError('viewingKey is required for proof generation');
    }
    if (!params.poolAddress) {
      throw new InvalidArgumentError('poolAddress is required for proof generation');
    }
  }

  private async request(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const url = this.url + path;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ProverError(
          'Prover request failed: ' + response.status + ' ' + response.statusText + (text ? ': ' + text : '')
        );
      }

      return (await response.json()) as unknown;
    } catch (error) {
      clearTimeout(timeout);

      const err = error as Error & { name?: string };
      if (err.name === 'AbortError') {
        throw new ProverError('Prover request timed out after ' + this.timeoutMs + 'ms');
      }

      throw error;
    }
  }
}
