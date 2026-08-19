import { ShieldParams, ShieldResult, ShieldEvent } from '../types';
import { PrivacyHubClient } from '../core/client';
import { ViewingKeyError, ShieldError, InvalidArgumentError } from '../utils/errors';

export class ShieldBuilder {
  constructor(
    private readonly client: PrivacyHubClient
  ) {}

  async shield(params: ShieldParams): Promise<ShieldResult> {
    const { account, token, amount, viewingKey, proof } = params;

    if (!account) {
      throw new InvalidArgumentError('account is required for shield operation');
    }
    if (!token || token === '0x0') {
      throw new ShieldError('token address is required and must not be zero');
    }
    if (!amount || amount <= 0n) {
      throw new ShieldError('amount must be greater than zero');
    }
    if (!viewingKey) {
      throw new ViewingKeyError('viewingKey is required for shield operation');
    }
    if (!viewingKey.publicKey || viewingKey.publicKey === 0n) {
      throw new ViewingKeyError('viewingKey.publicKey must be a non-zero bigint');
    }

    try {
      const tx = await this.client.shield(account, token, amount, proof ?? []);

      const receipt = await tx.wait();

      const shieldEvent = this.extractShieldEvent(tx.transactionHash, account.address, token, amount);

      return {
        transactionHash: tx.transactionHash,
        noteHash: shieldEvent.noteHash,
        amount,
        token,
        account: account.address,
        status: receipt.status,
        wait: tx.wait,
      } as ShieldResult;
    } catch (error) {
      if (error instanceof ShieldError || error instanceof ViewingKeyError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new ShieldError('Shield flow failed: ' + (error as Error).message, error);
    }
  }

  private extractShieldEvent(
    txHash: string,
    user: string,
    token: string,
    amount: bigint
  ): ShieldEvent {
    const noteHash = this.deriveNoteHash(txHash, user, token, amount);
    return {
      user,
      token,
      amount,
      noteHash,
      timestamp: Date.now(),
    };
  }

  deriveNoteHash(txHash: string, user: string, token: string, amount: bigint): string {
    const combined = `${txHash}:${user}:${token}:${amount.toString()}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31 + combined.charCodeAt(i)) | 0;
    }
    return `0x${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
}
