import { UnshieldParams, UnshieldResult, UnshieldProof } from '../types';
import { PrivacyHubClient } from '../core/client';
import { ProvingService } from './prover';
import { UnshieldError, InvalidArgumentError, ViewingKeyError } from '../utils/errors';

export class UnshieldBuilder {
  constructor(
    private readonly client: PrivacyHubClient,
    private readonly prover: ProvingService
  ) {}

  async unshield(params: UnshieldParams): Promise<UnshieldResult> {
    const { account, token, amount, recipient, note, viewingKey, poolAddress, chainId } = params;

    if (!account) {
      throw new InvalidArgumentError('account is required for unshield operation');
    }
    if (!token || token === '0x0') {
      throw new UnshieldError('token address is required and must not be zero');
    }
    if (!amount || amount <= 0n) {
      throw new UnshieldError('amount must be greater than zero');
    }
    if (!recipient || recipient === '0x0') {
      throw new UnshieldError('recipient address is required and must not be zero');
    }
    if (!note) {
      throw new UnshieldError('note is required for unshield operation');
    }
    if (!viewingKey || !viewingKey.publicKey || viewingKey.publicKey === 0n) {
      throw new ViewingKeyError('A valid viewingKey is required for unshield operation');
    }

    let proof: UnshieldProof;

    try {
      proof = await this.prover.generateUnshieldProof({
        note,
        viewingKey: {
          publicKey: viewingKey.publicKey,
          privateKey: viewingKey.privateKey,
        },
        poolAddress,
        chainId,
      });

      this.validateProof(proof, note);

      const tx = await this.client.unshield(account, token, amount, recipient, proof.proof ? proof.proof.split(',') : []);

      const receipt = await tx.wait();

      return {
        transactionHash: tx.transactionHash,
        nullifier: proof.nullifier,
        amount,
        token,
        recipient,
        account: account.address,
        status: receipt.status,
        wait: tx.wait,
      } as UnshieldResult;
    } catch (error) {
      if (error instanceof UnshieldError || error instanceof ViewingKeyError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new UnshieldError('Unshield flow failed: ' + (error as Error).message, error);
    }
  }

  private validateProof(proof: UnshieldProof, note: { nullifier?: string; noteHash: string }): void {
    if (!proof || !proof.proof) {
      throw new UnshieldError('Proof generation returned empty proof');
    }

    if (proof.nullifier && note.nullifier && proof.nullifier !== note.nullifier) {
      throw new UnshieldError('Proof nullifier does not match note nullifier');
    }
  }
}
