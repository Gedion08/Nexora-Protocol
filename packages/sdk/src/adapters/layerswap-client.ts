import type {
  AdapterConfig,
  BridgeQuote,
  BridgeReservation,
  DepositAction,
  BridgeNetwork,
  BridgeToken,
} from './types';

const DEFAULT_BASE_URL = 'https://api.layerswap.io';
const DEFAULT_TIMEOUT_MS = 30_000;

export class LayerSwapApiError extends Error {
  readonly statusCode: number;
  readonly errorCode?: string;

  constructor(statusCode: number, errorCode: string | undefined, message: string) {
    super(message);
    this.name = 'LayerSwapApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function networkName(network: string, environment: string): string {
  const env = environment === 'SEPOLIA' ? '_SEPOLIA' : '_MAINNET';
  if (network === 'ARBITRUM') return `ARBITRUM${env}`;
  if (network === 'STARKNET') return `STARKNET${env}`;
  if (network === 'BASE') return `BASE${env}`;
  if (network === 'ETHEREUM') return `ETHEREUM${env}`;
  if (network === 'OPTIMISM') return `OPTIMISM${env}`;
  return `${network}${env}`;
}

export class LayerSwapClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly environment: string;
  readonly timeoutMs: number;

  constructor(config: AdapterConfig) {
    if (!config.apiKey) {
      throw new Error('LayerSwap API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.environment = config.environment ?? 'MAINNET';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private headers(): Record<string, string> {
    return {
      'X-LS-APIKEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    const qs = params?.toString();
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.unwrap<T>(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.unwrap<T>(response);
  }

  private async unwrap<T>(response: Response): Promise<T> {
    const json = (await response.json()) as {
      error: { code: string; message: string } | null;
      data: T | null;
    };

    if (!response.ok || json.error) {
      throw new LayerSwapApiError(
        response.status,
        json.error?.code,
        json.error?.message ?? `LayerSwap API error (HTTP ${response.status})`
      );
    }

    if (json.data === null || json.data === undefined) {
      throw new LayerSwapApiError(response.status, undefined, 'LayerSwap API returned empty data');
    }

    return json.data;
  }

  async getNetworks(): Promise<BridgeNetwork[]> {
    const params = new URLSearchParams();
    if (this.environment === 'SEPOLIA') {
      params.set('version', 'sandbox');
    }
    const networks = await this.get<LsNetwork[]>('/api/v2/networks', params);
    return networks.map((n) => this.mapNetwork(n));
  }

  async getSources(destinationNetwork: string, destinationToken: string): Promise<BridgeNetwork[]> {
    const params = new URLSearchParams();
    params.set('destination_network', networkName(destinationNetwork, this.environment));
    params.set('destination_token', destinationToken);
    const routes = await this.get<LsRoute[]>('/api/v2/sources', params);
    return routes.map((r) => this.mapNetwork(r));
  }

  async getDestinations(sourceNetwork: string, sourceToken: string): Promise<BridgeNetwork[]> {
    const params = new URLSearchParams();
    params.set('source_network', networkName(sourceNetwork, this.environment));
    params.set('source_token', sourceToken);
    const routes = await this.get<LsRoute[]>('/api/v2/destinations', params);
    return routes.map((r) => this.mapNetwork(r));
  }

  async getQuote(sourceNetwork: string, sourceToken: string, destinationNetwork: string, destinationToken: string, amount: number): Promise<BridgeQuote> {
    const params = new URLSearchParams();
    params.set('source_network', networkName(sourceNetwork, this.environment));
    params.set('source_token', sourceToken);
    params.set('destination_network', networkName(destinationNetwork, this.environment));
    params.set('destination_token', destinationToken);
    params.set('amount', String(amount));
    const response = await this.get<{ quote: LsQuote }>('/api/v2/quote', params);
    return this.mapQuote(response.quote);
  }

  async getLimits(sourceNetwork: string, sourceToken: string, destinationNetwork: string, destinationToken: string, amount: number): Promise<{ minAmount: number; maxAmount: number }> {
    const params = new URLSearchParams();
    params.set('source_network', networkName(sourceNetwork, this.environment));
    params.set('source_token', sourceToken);
    params.set('destination_network', networkName(destinationNetwork, this.environment));
    params.set('destination_token', destinationToken);
    params.set('amount', String(amount));
    const limits = await this.get<LsLimits>('/api/v2/limits', params);
    return { minAmount: limits.min_amount, maxAmount: limits.max_amount };
  }

  async createSwap(sourceNetwork: string, sourceToken: string, destinationNetwork: string, destinationToken: string, amount: number, destinationAddress: string, sourceAddress?: string, refuel = false, refundAddress?: string, referenceId?: string): Promise<BridgeReservation> {
    const body: Record<string, unknown> = {
      source_network: networkName(sourceNetwork, this.environment),
      source_token: sourceToken,
      destination_network: networkName(destinationNetwork, this.environment),
      destination_token: destinationToken,
      amount,
      destination_address: destinationAddress,
      refuel,
      use_deposit_address: true,
    };
    if (sourceAddress) {
      body.source_address = sourceAddress;
    }
    if (refundAddress) {
      body.refund_address = refundAddress;
    }
    if (referenceId) {
      body.metadata = { reference_id: referenceId };
    }
    const response = await this.post<LsSwapResponse>('/api/v2/swaps', body);
    return this.mapSwapResponse(response);
  }

  async getSwap(swapId: string): Promise<BridgeReservation> {
    const response = await this.get<LsSwapResponse>(`/api/v2/swaps/${encodeURIComponent(swapId)}`);
    return this.mapSwapResponse(response);
  }

  async getSwapByTransactionHash(transactionHash: string): Promise<BridgeReservation> {
    const response = await this.get<LsSwapResponse>(`/api/v2/swaps/by_transaction_hash/${encodeURIComponent(transactionHash)}`);
    return this.mapSwapResponse(response);
  }

  async getDepositActions(swapId: string, sourceAddress?: string): Promise<DepositAction[]> {
    const params = new URLSearchParams();
    if (sourceAddress) params.set('source_address', sourceAddress);
    const actions = await this.get<LsDepositAction[]>(`/api/v2/swaps/${encodeURIComponent(swapId)}/deposit_actions`, params);
    return actions.map((a) => ({
      type: a.type,
      toAddress: a.to_address,
      amount: a.amount,
      amountInBaseUnits: a.amount_in_base_units,
      order: a.order,
      network: a.network.name,
      token: a.token.symbol,
      feeToken: a.fee_token?.symbol,
      callData: a.call_data,
      gasLimit: a.gas_limit,
    }));
  }

  async speedUpDeposit(swapId: string, transactionHash: string): Promise<void> {
    await this.post<void>(`/api/v2/swaps/${encodeURIComponent(swapId)}/deposit_speedup`, {
      transaction_id: transactionHash,
    });
  }

  async health(): Promise<void> {
    const url = `${this.baseUrl}/api/v2/health`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new LayerSwapApiError(response.status, undefined, `LayerSwap health check failed (HTTP ${response.status})`);
    }
  }

  private mapQuote(quote: LsQuote): BridgeQuote {
    return {
      sourceNetwork: quote.source_network.name,
      sourceToken: quote.source_token.symbol,
      destinationNetwork: quote.destination_network.name,
      destinationToken: quote.destination_token.symbol,
      amount: quote.receive_amount,
      receiveAmount: quote.receive_amount,
      totalFee: quote.total_fee,
      blockchainFee: quote.blockchain_fee,
      serviceFee: quote.service_fee,
      avgCompletionTime: quote.avg_completion_time,
      minAmount: quote.min_receive_amount,
      maxAmount: 0,
    };
  }

  private mapSwapResponse(response: LsSwapResponse): BridgeReservation {
    const inputTx = response.swap.transactions.find((t) => t.type === 'input');
    const outputTx = response.swap.transactions.find((t) => t.type === 'output');

    return {
      swapId: response.swap.id,
      sourceNetwork: response.swap.source_network.name,
      sourceToken: response.swap.source_token.symbol,
      destinationNetwork: response.swap.destination_network.name,
      destinationToken: response.swap.destination_token.symbol,
      amount: response.swap.requested_amount,
      destinationAddress: response.swap.destination_address,
      depositAddress: response.swap.metadata?.deposit_address ?? '',
      refundAddress: response.swap.metadata?.refund_address ?? undefined,
      referenceId: response.swap.metadata?.reference_id ?? undefined,
      status: response.swap.status,
      depositActions: response.deposit_actions.map((a) => ({
        type: a.type,
        toAddress: a.to_address,
        amount: a.amount,
        amountInBaseUnits: a.amount_in_base_units,
        order: a.order,
        network: a.network.name,
        token: a.token.symbol,
        feeToken: a.fee_token?.symbol,
        callData: a.call_data,
        gasLimit: a.gas_limit,
      })),
      fee: response.quote.total_fee,
      createdAt: response.swap.created_date,
      inputTransactionHash: inputTx?.transaction_hash ?? null,
      outputTransactionHash: outputTx?.transaction_hash ?? null,
    };
  }

  private mapNetwork(network: LsNetwork): BridgeNetwork {
    return {
      name: network.name,
      displayName: network.display_name,
      logo: network.logo,
      chainId: network.chain_id,
      type: network.type,
      tokens: (network.tokens ?? []).map((t) => this.mapToken(t)),
    };
  }

  private mapToken(token: LsToken): BridgeToken {
    return {
      symbol: token.symbol,
      displayName: token.display_asset ?? token.symbol,
      contract: token.contract,
      decimals: token.decimals,
      logo: token.logo,
    };
  }
}

interface LsNetwork {
  name: string;
  display_name: string;
  logo: string;
  chain_id: string | null;
  type: string;
  tokens?: LsToken[];
  token?: LsToken;
}

interface LsToken {
  symbol: string;
  display_asset?: string;
  logo: string;
  contract: string | null;
  decimals: number;
  precision: number;
  price_in_usd: number;
  listing_date: string;
  group?: string;
}

interface LsRoute extends LsNetwork {
  tokens: LsToken[];
}

interface LsLimits {
  min_amount: number;
  max_amount: number;
  min_amount_in_usd?: number;
  max_amount_in_usd?: number;
}

interface LsQuote {
  source_network: LsNetwork;
  source_token: LsToken;
  destination_network: LsNetwork;
  destination_token: LsToken;
  receive_amount: number;
  min_receive_amount: number;
  total_fee: number;
  total_fee_in_usd: number;
  blockchain_fee: number;
  service_fee: number;
  avg_completion_time: string;
  slippage?: number;
  refuel_in_source?: number | null;
  rate?: number;
  fee_discount?: number;
}

interface LsDepositAction {
  type: 'transfer' | 'manual_transfer';
  to_address?: string;
  amount: number;
  amount_in_base_units: string;
  order: number;
  network: LsNetwork;
  token: LsToken;
  fee_token?: LsToken;
  call_data: string | null;
  gas_limit?: string;
}

interface LsExchange {
  name: string;
  display_name?: string;
  logo?: string;
  metadata?: {
    o_auth?: Record<string, unknown>;
  };
}

interface LsSwap {
  id: string;
  created_date: string;
  status: string;
  source_network: LsNetwork;
  source_token: LsToken;
  destination_network: LsNetwork;
  destination_token: LsToken;
  destination_address: string;
  requested_amount: number;
  fail_reason: string | null;
  use_deposit_address: boolean;
  source_exchange?: LsExchange | null;
  destination_exchange?: LsExchange | null;
  metadata: {
    reference_id?: string | null;
    app?: string | null;
    exchange_account?: string | null;
    sequence_number: number;
    deposit_address?: string;
    refund_address?: string;
  };
  transactions: LsTransaction[];
}

interface LsTransaction {
  type: 'input' | 'output' | 'refuel' | 'refund';
  from: string | null;
  to: string | null;
  created_date: string;
  amount: number;
  transaction_hash: string | null;
  confirmations: number;
  max_confirmations: number;
  usd_value: number;
  usd_price: number;
  status: 'completed' | 'failed' | 'initiated' | 'pending';
  network?: LsNetwork;
  token?: LsToken;
  fee_token?: LsToken;
  fee_amount?: number | null;
}

interface LsSwapResponse {
  swap: LsSwap;
  deposit_actions: LsDepositAction[];
  quote: LsQuote;
  refuel: { token?: LsToken; amount?: number; amount_in_usd?: number; network?: LsNetwork } | null;
  reward: { token?: LsToken; amount?: number; amount_in_usd?: number; network?: LsNetwork } | null;
}
