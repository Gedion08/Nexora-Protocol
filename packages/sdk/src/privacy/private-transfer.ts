import { TransferParams, TransferResult } from '../types';
import { PrivacyHubClient } from '../core/client';
import { ProvingService } from './prover';
import { TransferError, InvalidArgumentError, ViewingKeyError } from '../utils/errors';

export class PrivateTransferBuilder {
  constructor(
    private readonly client: PrivacyHubClient,
    private readonly prover: ProvingService
  ) {}

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { account, token, amount, recipient, viewingKey, poolAddress, chainId } = params;

    if (!account) {
      throw new InvalidArgumentError('account is required for private transfer');
    }
    if (!token || token === '0x0') {
      throw new TransferError('token address is required and must not be zero');
    }
    if (!amount || amount <= 0n) {
      throw new TransferError('amount must be greater than zero');
    }
    if (!recipient || recipient === 0n) {
      throw new TransferError('recipient address is required and must not be zero');
    }
    if (!viewingKey || !viewingKey.publicKey || viewingKey.publicKey === 0n) {
      throw new ViewingKeyError('A valid viewingKey is required for private transfer');
    }

    let proof: { proof: string; nullifier: string };

    try {
      proof = await this.prover.generateTransferProof({
        token,
        amount: amount.toString(),
        recipient: typeof recipient === 'bigint' ? '0x' + recipient.toString(16) : recipient,
        viewing_key: {
          public_key: viewingKey.publicKey.toString(),
          private_key: viewingKey.privateKey.toString(),
        },
        pool_address: poolAddress,
        chain_id: chainId,
      });

      if (!proof || !proof.proof) {
        throw new TransferError('Proof generation returned empty proof');
      }

      const recipientStr = typeof recipient === 'bigint' ? '0x' + recipient.toString(16) : recipient;
      const tx = await this.client.privateTransfer(account, recipientStr, token, amount);

      const receipt = await tx.wait();

      return {
        transactionHash: tx.transactionHash,
        nullifier: proof.nullifier,
        amount,
        token,
        recipient: typeof recipient === 'bigint' ? '0x' + recipient.toString(16) : recipient,
        account: account.address,
        status: receipt.status,
        wait: tx.wait,
      } as TransferResult;
    } catch (error) {
      if (error instanceof TransferError || error instanceof ViewingKeyError || error instanceof InvalidArgumentError) {
        throw error;
      }
      throw new TransferError('Private transfer flow failed: ' + (error as Error).message, error);
    }
  }
}
