import { BN } from "@coral-xyz/anchor";

export function readUnsignedBigInt64LE(buffer: Buffer, offset: number): BN {
  return new BN(buffer.subarray(offset, offset + 8), 10, "le");
}

export function readSignedBigInt64LE(buffer: Buffer, offset: number): BN {
  const unsignedValue = new BN(buffer.subarray(offset, offset + 8), 10, "le");
  if (unsignedValue.testn(63)) {
    const inverted = unsignedValue.notn(64).addn(1);
    return inverted.neg();
  } else {
    return unsignedValue;
  }
}

export function readI128LE(buffer: Buffer, offset: number): BN {
  const lo = buffer.readBigUInt64LE(offset);
  const hi = buffer.readBigUInt64LE(offset + 8);
  let v = (hi << 64n) + lo;
  if ((hi & (1n << 63n)) !== 0n) {
    v -= 1n << 128n;
  }
  return new BN(v.toString());
}

export const ZERO = new BN(0);

export enum ExchangeStatus {
  ACTIVE = 0,
  DEPOSIT_PAUSED = 1,
  WITHDRAW_PAUSED = 2,
  AMM_PAUSED = 4,
  FILL_PAUSED = 8,
  LIQ_PAUSED = 16,
  FUNDING_PAUSED = 32,
  SETTLE_PNL_PAUSED = 64,
  AMM_IMMEDIATE_FILL_PAUSED = 128,
  PAUSED = 255,
}

export class MarketStatus {
  static readonly INITIALIZED = { initialized: {} };
  static readonly ACTIVE = { active: {} };
  static readonly FUNDING_PAUSED = { fundingPaused: {} };
  static readonly AMM_PAUSED = { ammPaused: {} };
  static readonly FILL_PAUSED = { fillPaused: {} };
  static readonly WITHDRAW_PAUSED = { withdrawPaused: {} };
  static readonly REDUCE_ONLY = { reduceOnly: {} };
  static readonly SETTLEMENT = { settlement: {} };
  static readonly DELISTED = { delisted: {} };
}

export enum PerpOperation {
  UPDATE_FUNDING = 1,
  AMM_FILL = 2,
  FILL = 4,
  SETTLE_PNL = 8,
  SETTLE_PNL_WITH_POSITION = 16,
  LIQUIDATION = 32,
}

export enum SpotOperation {
  UPDATE_CUMULATIVE_INTEREST = 1,
  FILL = 2,
  DEPOSIT = 4,
  WITHDRAW = 8,
  LIQUIDATION = 16,
}

export enum InsuranceFundOperation {
  INIT = 1,
  ADD = 2,
  REQUEST_REMOVE = 4,
  REMOVE = 8,
}

export enum UserStatus {
  BEING_LIQUIDATED = 1,
  BANKRUPT = 2,
  REDUCE_ONLY = 4,
  ADVANCED_LP = 8,
  PROTECTED_MAKER = 16,
}

export class MarginMode {
  static readonly DEFAULT = { default: {} };
  static readonly HIGH_LEVERAGE = { highLeverage: {} };
}

export class ContractType {
  static readonly PERPETUAL = { perpetual: {} };
  static readonly FUTURE = { future: {} };
  static readonly PREDICTION = { prediction: {} };
}

export class ContractTier {
  static readonly A = { a: {} };
  static readonly B = { b: {} };
  static readonly C = { c: {} };
  static readonly SPECULATIVE = { speculative: {} };
  static readonly HIGHLY_SPECULATIVE = { highlySpeculative: {} };
  static readonly ISOLATED = { isolated: {} };
}

export class AssetTier {
  static readonly COLLATERAL = { collateral: {} };
  static readonly PROTECTED = { protected: {} };
  static readonly CROSS = { cross: {} };
  static readonly ISOLATED = { isolated: {} };
  static readonly UNLISTED = { unlisted: {} };
}

export class SwapDirection {
  static readonly ADD = { add: {} };
  static readonly REMOVE = { remove: {} };
}

export class SpotBalanceType {
  static readonly DEPOSIT = { deposit: {} };
  static readonly BORROW = { borrow: {} };
}

export class PositionDirection {
  static readonly LONG = { long: {} };
  static readonly SHORT = { short: {} };
}

export class DepositDirection {
  static readonly DEPOSIT = { deposit: {} };
  static readonly WITHDRAW = { withdraw: {} };
}

export class OracleSource {
  static readonly PYTH = { pyth: {} };
  static readonly PYTH_1K = { pyth1K: {} };
  static readonly PYTH_1M = { pyth1M: {} };
  static readonly PYTH_PULL = { pythPull: {} };
  static readonly PYTH_1K_PULL = { pyth1KPull: {} };
  static readonly PYTH_1M_PULL = { pyth1MPull: {} };
  static readonly SWITCHBOARD = { switchboard: {} };
  static readonly QUOTE_ASSET = { quoteAsset: {} };
  static readonly PYTH_STABLE_COIN = { pythStableCoin: {} };
  static readonly PYTH_STABLE_COIN_PULL = { pythStableCoinPull: {} };
  static readonly Prelaunch = { prelaunch: {} };
  static readonly SWITCHBOARD_ON_DEMAND = { switchboardOnDemand: {} };
  static readonly PYTH_LAZER = { pythLazer: {} };
  static readonly PYTH_LAZER_1K = { pythLazer1K: {} };
  static readonly PYTH_LAZER_1M = { pythLazer1M: {} };
  static readonly PYTH_LAZER_STABLE_COIN = { pythLazerStableCoin: {} };

  static fromString(name: string) {
    const k = name.slice(0, 1).toLowerCase() + name.slice(1);
    return { [k]: {} } as OracleSource;
  }

  static get(n: Number) {
    const name = Object.entries(OracleSourceNum).find(([, v]) => v === n)?.[0];

    const source = Object.entries(OracleSource).find(
      ([key, _]) => key.toLocaleLowerCase() === name?.toLocaleLowerCase(),
    )?.[1];

    if (!source) {
      throw new Error(`Invalid oracle source enum value: ${n}`);
    }

    return source;
  }
}

export class OracleSourceNum {
  static readonly PYTH = 0;
  static readonly PYTH_1K = 1;
  static readonly PYTH_1M = 2;
  static readonly PYTH_PULL = 3;
  static readonly PYTH_1K_PULL = 4;
  static readonly PYTH_1M_PULL = 5;
  static readonly SWITCHBOARD = 6;
  static readonly QUOTE_ASSET = 7;
  static readonly PYTH_STABLE_COIN = 8;
  static readonly PYTH_STABLE_COIN_PULL = 9;
  static readonly PRELAUNCH = 10;
  static readonly SWITCHBOARD_ON_DEMAND = 11;
  static readonly PYTH_LAZER = 12;
  static readonly PYTH_LAZER_1K = 13;
  static readonly PYTH_LAZER_1M = 14;
  static readonly PYTH_LAZER_STABLE_COIN = 15;
}

export class OrderType {
  static readonly LIMIT = { limit: {} };
  static readonly TRIGGER_MARKET = { triggerMarket: {} };
  static readonly TRIGGER_LIMIT = { triggerLimit: {} };
  static readonly MARKET = { market: {} };
  static readonly ORACLE = { oracle: {} };
}

export declare type MarketTypeStr = "perp" | "spot";
export class MarketType {
  static readonly SPOT = { spot: {} };
  static readonly PERP = { perp: {} };
}

export class OrderStatus {
  static readonly INIT = { init: {} };
  static readonly OPEN = { open: {} };
  static readonly FILLED = { filled: {} };
  static readonly CANCELED = { canceled: {} };
}

export class OrderAction {
  static readonly PLACE = { place: {} };
  static readonly CANCEL = { cancel: {} };
  static readonly EXPIRE = { expire: {} };
  static readonly FILL = { fill: {} };
  static readonly TRIGGER = { trigger: {} };
}

export class OrderActionExplanation {
  static readonly NONE = { none: {} };
  static readonly INSUFFICIENT_FREE_COLLATERAL = {
    insufficientFreeCollateral: {},
  };
  static readonly ORACLE_PRICE_BREACHED_LIMIT_PRICE = {
    oraclePriceBreachedLimitPrice: {},
  };
  static readonly MARKET_ORDER_FILLED_TO_LIMIT_PRICE = {
    marketOrderFilledToLimitPrice: {},
  };
  static readonly ORDER_EXPIRED = {
    orderExpired: {},
  };
  static readonly LIQUIDATION = {
    liquidation: {},
  };
  static readonly ORDER_FILLED_WITH_AMM = {
    orderFilledWithAmm: {},
  };
  static readonly ORDER_FILLED_WITH_AMM_JIT = {
    orderFilledWithAmmJit: {},
  };
  static readonly ORDER_FILLED_WITH_AMM_JIT_LP_SPLIT = {
    orderFilledWithAmmJitLpSplit: {},
  };
  static readonly ORDER_FILLED_WITH_LP_JIT = {
    orderFilledWithLpJit: {},
  };
  static readonly ORDER_FILLED_WITH_MATCH = {
    orderFilledWithMatch: {},
  };
  static readonly ORDER_FILLED_WITH_MATCH_JIT = {
    orderFilledWithMatchJit: {},
  };
  static readonly MARKET_EXPIRED = {
    marketExpired: {},
  };
  static readonly RISK_INCREASING_ORDER = {
    riskingIncreasingOrder: {},
  };
  static readonly ORDER_FILLED_WITH_SERUM = {
    orderFillWithSerum: {},
  };
  static readonly ORDER_FILLED_WITH_OPENBOOK_V2 = {
    orderFilledWithOpenbookV2: {},
  };
  static readonly ORDER_FILLED_WITH_PHOENIX = {
    orderFillWithPhoenix: {},
  };
  static readonly REDUCE_ONLY_ORDER_INCREASED_POSITION = {
    reduceOnlyOrderIncreasedPosition: {},
  };
  static readonly DERISK_LP = {
    deriskLp: {},
  };
  static readonly TRANSFER_PERP_POSITION = {
    transferPerpPosition: {},
  };
}

export class OrderTriggerCondition {
  static readonly ABOVE = { above: {} };
  static readonly BELOW = { below: {} };
  static readonly TRIGGERED_ABOVE = { triggeredAbove: {} }; // above condition has been triggered
  static readonly TRIGGERED_BELOW = { triggeredBelow: {} }; // below condition has been triggered
}

export class SpotFulfillmentType {
  static readonly EXTERNAL = { external: {} };
  static readonly MATCH = { match: {} };
}

export class SpotFulfillmentStatus {
  static readonly ENABLED = { enabled: {} };
  static readonly DISABLED = { disabled: {} };
}

export class DepositExplanation {
  static readonly NONE = { none: {} };
  static readonly TRANSFER = { transfer: {} };
  static readonly BORROW = { borrow: {} };
  static readonly REPAY_BORROW = { repayBorrow: {} };
}

export class SettlePnlExplanation {
  static readonly NONE = { none: {} };
  static readonly EXPIRED_POSITION = { expiredPosition: {} };
}

export class SpotFulfillmentConfigStatus {
  static readonly ENABLED = { enabled: {} };
  static readonly DISABLED = { disabled: {} };
}

export class StakeAction {
  static readonly STAKE = { stake: {} };
  static readonly UNSTAKE_REQUEST = { unstakeRequest: {} };
  static readonly UNSTAKE_CANCEL_REQUEST = { unstakeCancelRequest: {} };
  static readonly UNSTAKE = { unstake: {} };
  static readonly UNSTAKE_TRANSFER = { unstakeTransfer: {} };
  static readonly STAKE_TRANSFER = { stakeTransfer: {} };
}

export type Order = {
  status: OrderStatus;
  orderType: OrderType;
  marketType: MarketType;
  slot: BN;
  orderId: number;
  userOrderId: number;
  marketIndex: number;
  price: BN;
  baseAssetAmount: BN;
  quoteAssetAmount: BN;
  baseAssetAmountFilled: BN;
  quoteAssetAmountFilled: BN;
  direction: PositionDirection;
  reduceOnly: boolean;
  triggerPrice: BN;
  triggerCondition: OrderTriggerCondition;
  existingPositionDirection: PositionDirection;
  postOnly: boolean;
  immediateOrCancel: boolean;
  oraclePriceOffset: number;
  auctionDuration: number;
  auctionStartPrice: BN;
  auctionEndPrice: BN;
  maxTs: BN;
  bitFlags: number;
  postedSlotTail: number;
};

export type OrderParams = {
  orderType: OrderType;
  marketType: MarketType;
  userOrderId: number;
  direction: PositionDirection;
  baseAssetAmount: BN;
  price: BN;
  marketIndex: number;
  reduceOnly: boolean;
  postOnly: PostOnlyParams;
  immediateOrCancel: boolean;
  triggerPrice: BN | null;
  triggerCondition: OrderTriggerCondition;
  oraclePriceOffset: number | null;
  auctionDuration: number | null;
  maxTs: BN | null;
  auctionStartPrice: BN | null;
  auctionEndPrice: BN | null;
};

export class PostOnlyParams {
  static readonly NONE = { none: {} };
  static readonly MUST_POST_ONLY = { mustPostOnly: {} }; // Tx fails if order can't be post only
  static readonly TRY_POST_ONLY = { tryPostOnly: {} }; // Tx succeeds and order not placed if can't be post only
  static readonly SLIDE = { slide: {} }; // Modify price to be post only if can't be post only
}

export type NecessaryOrderParams = {
  orderType: OrderType;
  marketIndex: number;
  baseAssetAmount: BN;
  direction: PositionDirection;
};

export type OptionalOrderParams = {
  [Property in keyof OrderParams]?: OrderParams[Property];
} & NecessaryOrderParams;

export type ModifyOrderParams = {
  direction: PositionDirection | null;
  baseAssetAmount: BN | null;
  price: BN | null;
  reduceOnly: boolean | null;
  postOnly: PostOnlyParams | null;
  bitFlags: number | null;
  maxTs: BN | null;
  triggerPrice: BN | null;
  triggerCondition: OrderTriggerCondition | null;
  oraclePriceOffset: number | null;
  auctionDuration: number | null;
  auctionStartPrice: BN | null;
  auctionEndPrice: BN | null;
  policy: number | null;
};

export enum ModifyOrderPolicy {
  MustModify = 1,
  ExcludePreviousFill = 2,
}

export const DefaultOrderParams: OrderParams = {
  orderType: OrderType.MARKET,
  marketType: MarketType.PERP,
  userOrderId: 0,
  direction: PositionDirection.LONG,
  baseAssetAmount: ZERO,
  price: ZERO,
  marketIndex: 0,
  reduceOnly: false,
  postOnly: PostOnlyParams.NONE,
  immediateOrCancel: false,
  triggerPrice: null,
  triggerCondition: OrderTriggerCondition.ABOVE,
  oraclePriceOffset: null,
  auctionDuration: null,
  maxTs: null,
  auctionStartPrice: null,
  auctionEndPrice: null,
};
