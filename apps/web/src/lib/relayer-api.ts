const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || "";

interface SubmitIntentPayload {
  userId: string;
  sourceChain: string;
  sourceToken: string;
  destinationChain: string;
  destinationToken: string;
  amount: string;
  amountInBaseUnits?: string;
  sourceAddress?: string;
  destinationAddress: string;
  privacyLevel?: "none" | "standard" | "maximum";
  refundAddress?: string;
  viewingKey?: string;
}

interface SubmitWithdrawalPayload {
  userId: string;
  token: string;
  amount: string;
  amountInBaseUnits?: string;
  destinationChain: string;
  destinationToken: string;
  privacyLevel?: "none" | "standard" | "maximum";
  viewingKey?: string;
  recipient?: string;
  referenceId?: string;
}

export interface RouteOption {
  id: string;
  name: string;
  bridge: string;
  estimatedFee: string;
  estimatedTime: string;
  privacyScore: number;
  hops: number;
}

export interface QuoteResult {
  quote: {
    receiveAmount: number;
    totalFee: number;
    avgCompletionTime: number;
  };
  limits: {
    min: number;
    max: number;
  };
}

export interface IntentResult {
  intentId: string;
  status: string;
  depositAddress: string;
  depositActions: Array<{
    type: string;
    toAddress?: string;
    amount: number;
    amountInBaseUnits: string;
    order: number;
    network: string;
    token: string;
    feeToken?: string;
    callData: string | null;
  }>;
  fee: number;
  estimatedArrival?: string;
  referenceId?: string;
}

export interface WithdrawalResult {
  withdrawalId: string;
  status: string;
  swapId?: string;
  depositAddress?: string;
  destinationAddress?: string;
  depositActions: Array<{
    type: string;
    toAddress?: string;
    amount: number;
    amountInBaseUnits: string;
    order: number;
    network: string;
    token: string;
    feeToken?: string;
    callData: string | null;
  }>;
  fee: number;
  estimatedArrival?: string;
  freshAddress?: string;
  referenceId?: string;
}

export interface IntentStatus {
  id: string;
  status: string;
  amount: string;
  sourceChain: string;
  sourceToken: string;
  destinationChain: string;
  destinationToken: string;
  destinationAddress: string;
  privacyLevel: string;
  createdAt: string;
  updatedAt: string;
  depositAddress?: string;
  bridgeTxHash?: string;
  shieldTxHash?: string;
  failReason?: string;
}

export interface WithdrawalStatus {
  id: string;
  status: string;
  token: string;
  amount: string;
  destinationChain: string;
  destinationToken: string;
  destinationAddress: string;
  privacyLevel: string;
  createdAt: string;
  updatedAt: string;
  freshAddress?: string;
  swapId?: string;
  depositAddress?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  services?: {
    database?: string;
    account?: string;
  };
}

class RelayerApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.message || error.error || "Request failed");
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>("/health");
  }

  async getQuote(
    sourceToken: string,
    destinationToken: string,
    amount: number
  ): Promise<QuoteResult> {
    const params = new URLSearchParams({
      sourceToken,
      destinationToken,
      amount: String(amount),
    });
    return this.request<QuoteResult>(`/quotes?${params.toString()}`);
  }

  async getTokens(): Promise<{
    source: { chain: string; tokens: string[] };
    destination: { chain: string; tokens: string[] };
  }> {
    return this.request("/info/tokens");
  }

  async getInventory(): Promise<{
    inventories: Array<{
      chain: string;
      token: string;
      totalBalance: string;
      reservedBalance: string;
      availableBalance: string;
      tokenAddress: string;
      lastRefreshed: string;
    }>;
  }> {
    return this.request("/inventory");
  }

  async getTokenInventory(token: string): Promise<{
    chain: string;
    token: string;
    totalBalance: string;
    reservedBalance: string;
    availableBalance: string;
  }> {
    return this.request(`/inventory/${encodeURIComponent(token)}`);
  }

  async submitIntent(payload: SubmitIntentPayload): Promise<IntentResult> {
    return this.request<IntentResult>("/intents", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getIntent(id: string): Promise<IntentStatus> {
    return this.request<IntentStatus>(`/intents/${encodeURIComponent(id)}`);
  }

  async cancelIntent(id: string): Promise<{ intentId: string; status: string }> {
    return this.request(`/intents/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
  }

  async refundIntent(id: string): Promise<{
    intentId: string;
    status: string;
    refundTxHash?: string;
  }> {
    return this.request(`/intents/${encodeURIComponent(id)}/refund`, {
      method: "POST",
    });
  }

  async submitWithdrawal(payload: SubmitWithdrawalPayload): Promise<WithdrawalResult> {
    return this.request<WithdrawalResult>("/withdrawals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getWithdrawal(id: string): Promise<WithdrawalStatus> {
    return this.request<WithdrawalStatus>(`/withdrawals/${encodeURIComponent(id)}`);
  }
}

export const relayerApi = new RelayerApiClient(RELAYER_URL);
