import { Account, Contract, RpcProvider, num } from 'starknet';
import { PaymasterError, InvalidArgumentError, NexoraError, ErrorCode } from '../utils/errors';
import { DEFAULT_TX_WAIT_TIMEOUT_MS } from '../constants';

export interface PaymasterConfig {
  rpcUrl: string;
  paymasterAddress?: string;
  timeoutMs?: number;
}

export interface PaymasterSponsorshipResponse {
  paymasterData: string[];
  tip?: number;
}

export class PaymasterClient {
  readonly rpcUrl: string;
  readonly paymasterAddress: string | undefined;
  readonly timeoutMs: number;

  constructor(config: PaymasterConfig) {
    if (!config.rpcUrl) {
      throw new InvalidArgumentError('rpcUrl is required for PaymasterClient');
    }
    this.rpcUrl = config.rpcUrl;
    this.paymasterAddress = config.paymasterAddress;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TX_WAIT_TIMEOUT_MS;
  }

  async sponsorTransaction(
    account: Account,
    contractAddress: string,
    entryPoint: string,
    calldata: string[],
    _maxFee?: number
  ): Promise<PaymasterSponsorshipResponse> {
    if (!account) {
      throw new InvalidArgumentError('account is required for paymaster sponsorship');
    }
    if (!contractAddress || contractAddress === '0x0') {
      throw new InvalidArgumentError('contractAddress must not be zero');
    }
    if (!entryPoint) {
      throw new InvalidArgumentError('entryPoint is required');
    }

    try {
      const provider = new RpcProvider({ nodeUrl: this.rpcUrl });
      const contract = new Contract(
        [
          {
            type: 'function',
            name: 'sponsor_transaction',
            inputs: [
              { name: 'account', type: 'core::starknet::contract_address::ContractAddress' },
              { name: 'contract_address', type: 'core::starknet::contract_address::ContractAddress' },
              { name: 'entry_point', type: 'core::felt252' },
              { name: 'calldata', type: 'core::array::ArrayCore<core::felt252>' },
            ],
            outputs: [
              { name: 'paymaster_data', type: 'core::array::ArrayCore<core::felt252>' },
              { name: 'tip', type: 'core::integer::u64' },
            ],
          },
        ] as any,
        this.paymasterAddress ?? '0x0',
        provider
      );

      const response = await (contract as any).sponsor_transaction(
        account.address,
        contractAddress,
        entryPoint,
        calldata,
        { blockIdentifier: 'pending' }
      );

      const paymasterData = (response.paymaster_data ?? []).map((v: string | bigint) =>
        typeof v === 'bigint' ? num.toHex(v) : v
      );

      return {
        paymasterData,
        tip: response.tip ? Number(response.tip) : undefined,
      };
    } catch (error) {
      if (error instanceof InvalidArgumentError || error instanceof NexoraError) {
        throw error;
      }
      throw new PaymasterError(
        'Paymaster sponsorship failed: ' + (error as Error).message,
        ErrorCode.TRANSACTION_FAILED,
        error
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'starknet_chainId',
          params: [],
        }),
      });

      if (!response.ok) return false;

      const result = (await response.json()) as { result?: string };
      return Boolean(result.result);
    } catch {
      return false;
    }
  }
}
