import { PublicKey } from "@solana/web3.js";

export const DEFAULT_PHOENIX_API_URL = "https://perp-api.phoenix.trade";

export type PhoenixSnapshot = {
  slot?: number;
  exchange: {
    programId: string;
    globalConfig: string;
    currentAuthorities?: {
      rootAuthority?: string;
      riskAuthority?: string;
      marketAuthority?: string;
      oracleAuthority?: string;
      adlAuthority?: string;
      cancelAuthority?: string;
      backstopAuthority?: string;
    };
    canonicalMint: string;
    usdcMint: string;
    globalVault: string;
    perpAssetMap: string;
    globalTraderIndex: string[];
    activeTraderBuffer: string[];
    withdrawQueue: string;
    active?: boolean;
    gated?: boolean;
  };
  markets: PhoenixMarket[];
};

export type PhoenixMarket = {
  symbol: string;
  marketPubkey: string;
  splinePubkey?: string;
  tickSize: number | string;
  baseLotsDecimals: number;
  marketStatus?: string;
  isolatedOnly?: boolean;
  takerFee?: number;
  makerFee?: number;
};

export type TraderCapabilityAccess = {
  immediate?: boolean;
  viaColdActivation?: boolean;
};

export type DisplayAmount =
  | string
  | number
  | {
      ui?: string;
      value?: string | number;
      decimals?: number;
    };

export type LimitOrder = {
  price?: DisplayAmount;
  side?: string;
  orderSequenceNumber?: string | number;
  initialTradeSize?: DisplayAmount;
  tradeSizeRemaining?: DisplayAmount;
  marginRequirement?: DisplayAmount;
  marginFactor?: DisplayAmount;
  isReduceOnly?: boolean;
  isConditionalOrder?: boolean;
  isStopLoss?: boolean;
  isStopLossDirection?: boolean;
  nodePointer?: string | number;
  node_pointer?: string | number;
  priceInTicks?: string | number;
  priceTicks?: string | number;
  price_in_ticks?: string | number;
  orderId?: {
    priceInTicks?: string | number;
    price_in_ticks?: string | number;
    orderSequenceNumber?: string | number;
    order_sequence_number?: string | number;
  };
};

export type TraderPositionView = {
  symbol?: string;
  positionSize?: DisplayAmount;
  virtualQuotePosition?: DisplayAmount;
  entryPrice?: DisplayAmount;
  unrealizedPnl?: DisplayAmount;
  discountedUnrealizedPnl?: DisplayAmount;
  positionInitialMargin?: DisplayAmount;
  initialMargin?: DisplayAmount;
  maintenanceMargin?: DisplayAmount;
  backstopMargin?: DisplayAmount;
  limitOrderMargin?: DisplayAmount;
  positionValue?: DisplayAmount;
  unsettledFunding?: DisplayAmount;
  accumulatedFunding?: DisplayAmount;
  liquidationPrice?: DisplayAmount | null;
  takeProfitPrice?: DisplayAmount | null;
  stopLossPrice?: DisplayAmount | null;
};

export type TraderView = {
  flags?: number;
  state?: string;
  slot?: number;
  slotIndex?: number;
  traderKey?: string;
  traderPdaIndex?: number;
  traderSubaccountIndex?: number;
  authority?: string;
  capabilities?: {
    placeLimitOrder?: TraderCapabilityAccess;
    placeMarketOrder?: TraderCapabilityAccess;
    riskIncreasingTrade?: TraderCapabilityAccess;
    riskReducingTrade?: TraderCapabilityAccess;
    depositCollateral?: TraderCapabilityAccess;
    withdrawCollateral?: TraderCapabilityAccess;
  };
  collateralBalance?: DisplayAmount;
  effectiveCollateral?: DisplayAmount;
  effectiveCollateralForWithdrawals?: DisplayAmount;
  unrealizedPnl?: DisplayAmount;
  discountedUnrealizedPnl?: DisplayAmount;
  unsettledFundingOwed?: DisplayAmount;
  accumulatedFunding?: DisplayAmount;
  portfolioValue?: DisplayAmount;
  maintenanceMargin?: DisplayAmount;
  cancelMargin?: DisplayAmount;
  initialMargin?: DisplayAmount;
  initialMarginForWithdrawals?: DisplayAmount;
  riskState?: string;
  riskTier?: string;
  positions?: TraderPositionView[];
  limitOrders?: Record<string, LimitOrder[]>;
  makerFeeOverrideMultiplier?: number;
  takerFeeOverrideMultiplier?: number;
  maxPositions?: number;
  lastDepositSlot?: number;
  isInActiveTraders?: boolean;
};

export type TraderStateResponse = {
  slot?: number;
  slotIndex?: number;
  authority?: string;
  pdaIndex?: number;
  traders?: TraderView[];
};

export function normalizePhoenixApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

function publicKeyString(value: PublicKey | string): string {
  return value instanceof PublicKey ? value.toBase58() : value;
}

export class PhoenixApiClient {
  apiUrl: string;

  constructor() {
    this.apiUrl =
      process.env.NEXT_PUBLIC_PHOENIX_API_URL ||
      process.env.PHOENIX_API_URL ||
      DEFAULT_PHOENIX_API_URL;
  }

  private url(path: string): string {
    return `${normalizePhoenixApiUrl(this.apiUrl)}${path}`;
  }

  async fetchPhoenixSnapshot(): Promise<PhoenixSnapshot> {
    const url = this.url("/v1/exchange/snapshot");
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch Phoenix exchange snapshot: ${response.status} ${
          errorText || response.statusText
        }`,
      );
    }

    const snapshot = (await response.json()) as PhoenixSnapshot;
    if (!snapshot.exchange || !Array.isArray(snapshot.markets)) {
      throw new Error(`Unexpected Phoenix snapshot response from ${url}`);
    }
    return snapshot;
  }

  async fetchTraderView(
    trader: PublicKey | string,
  ): Promise<TraderView | null> {
    const url = this.url(`/v1/view/trader/${publicKeyString(trader)}`);
    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch Phoenix trader view: ${response.status} ${
          errorText || response.statusText
        }`,
      );
    }
    return (await response.json()) as TraderView;
  }

  async fetchTraderState(
    authority: PublicKey | string,
    pdaIndex: number,
  ): Promise<TraderStateResponse | null> {
    const queryParams = new URLSearchParams({ pdaIndex: `${pdaIndex}` });
    const url = `${this.url(
      `/trader/${publicKeyString(authority)}/state`,
    )}?${queryParams}`;

    const response = await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch Phoenix trader state: ${response.status} ${
          errorText || response.statusText
        }`,
      );
    }

    const state = (await response.json()) as TraderStateResponse;
    if (!Array.isArray(state.traders)) {
      throw new Error(`Unexpected Phoenix trader state response from ${url}`);
    }
    return state;
  }
}
