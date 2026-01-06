import {
  struct,
  u8,
  u16,
  u32,
  u64,
  u128,
  i64,
  bool,
  publicKey,
  array,
} from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { charsToString } from "../utils/common";
import { Decodable } from "./base";
import { PkMap, readSignedBigInt64LE, readUnsignedBigInt64LE } from "../utils";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  MarginMode,
  MarketType,
  OracleSource,
  Order,
  OrderStatus,
  OrderTriggerCondition,
  OrderType,
  PositionDirection,
  readI128LE,
  SpotBalanceType,
  ZERO,
} from "../utils/drift/types";
import { DRIFT_PROGRAM_ID } from "../constants";

export class SpotPosition {
  marketIndex!: number;
  balanceType!: SpotBalanceType;
  scaledBalance!: BN;
  openOrders!: number;
  openBids!: BN;
  openAsks!: BN;
  cumulativeDeposits!: BN;

  constructor(data: any) {
    this.marketIndex = data?.marketIndex;
    this.balanceType = data?.balanceType;
    this.scaledBalance = data?.scaledBalance;
    this.openOrders = data?.openOrders;
    this.openBids = data?.openBids;
    this.openAsks = data?.openAsks;
    this.cumulativeDeposits = data?.cumulativeDeposits;
  }

  get marketPda() {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("spot_market"),
        new BN(this.marketIndex).toArrayLike(Buffer, "le", 2),
      ],
      DRIFT_PROGRAM_ID,
    )[0];
  }

  calcBalance(
    decimals: number,
    cumulativeDepositInterest: BN,
    cumulativeBorrowInterest: BN,
  ): { amount: number; uiAmount: number } {
    const precisionAdjustment = new BN(10 ** (19 - decimals));
    const balance = this.scaledBalance
      .mul(this._interest(cumulativeDepositInterest, cumulativeBorrowInterest))
      .div(precisionAdjustment);
    const amount =
      this.balanceType === SpotBalanceType.BORROW
        ? balance.neg().toNumber()
        : balance.toNumber();
    const uiAmount = amount / 10 ** decimals;
    return { amount, uiAmount };
  }

  calcBalanceBn(
    decimals: number,
    cumulativeDepositInterest: BN,
    cumulativeBorrowInterest: BN,
  ): BN {
    const precisionAdjustment = new BN(10 ** (19 - decimals));
    const sign =
      this.balanceType === SpotBalanceType.BORROW ? new BN(-1) : new BN(1);
    return this.scaledBalance
      .mul(this._interest(cumulativeDepositInterest, cumulativeBorrowInterest))
      .div(precisionAdjustment)
      .mul(sign);
  }

  _interest(cumulativeDepositInterest: BN, cumulativeBorrowInterest: BN): BN {
    return this.balanceType === SpotBalanceType.BORROW
      ? cumulativeBorrowInterest
      : cumulativeDepositInterest;
  }

  get direction() {
    return this.balanceType === SpotBalanceType.BORROW ? "borrow" : "deposit";
  }
}

export class PerpPosition {
  baseAssetAmount!: BN;
  lastCumulativeFundingRate!: BN;
  marketIndex!: number;
  quoteAssetAmount!: BN;
  quoteEntryAmount!: BN;
  quoteBreakEvenAmount!: BN;
  openOrders!: number;
  openBids!: BN;
  openAsks!: BN;
  settledPnl!: BN;
  lpShares!: BN;
  remainderBaseAssetAmount!: number;
  lastBaseAssetAmountPerLp!: BN;
  lastQuoteAssetAmountPerLp!: BN;
  perLpBase!: number;

  constructor(data: any) {
    this.baseAssetAmount = data?.baseAssetAmount;
    this.lastCumulativeFundingRate = data?.lastCumulativeFundingRate;
    this.marketIndex = data?.marketIndex;
    this.quoteAssetAmount = data?.quoteAssetAmount;
    this.quoteEntryAmount = data?.quoteEntryAmount;
    this.quoteBreakEvenAmount = data?.quoteBreakEvenAmount;
    this.openOrders = data?.openOrders;
    this.openBids = data?.openBids;
    this.openAsks = data?.openAsks;
    this.settledPnl = data?.settledPnl;
    this.lpShares = data?.lpShares;
    this.remainderBaseAssetAmount = data?.remainderBaseAssetAmount;
    this.lastBaseAssetAmountPerLp = data?.lastBaseAssetAmountPerLp;
    this.lastQuoteAssetAmountPerLp = data?.lastQuoteAssetAmountPerLp;
    this.perLpBase = data?.perLpBase;
  }

  get marketPda() {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("perp_market"),
        new BN(this.marketIndex).toArrayLike(Buffer, "le", 2),
      ],
      DRIFT_PROGRAM_ID,
    )[0];
  }

  baseAssetValue(oraclePrice: BN): BN {
    return this.baseAssetAmount.mul(oraclePrice).div(new BN(1_000_000_000));
  }

  unrealizedPnl(oraclePrice: BN): BN {
    return this.baseAssetValue(oraclePrice).add(this.quoteAssetAmount);
  }

  getUsdValueScaled(
    oraclePrice: BN,
    cumulativeFundingRateLong: BN,
    cumulativeFundingRateShort: BN,
  ): BN {
    const unrealizedPnl = this.unrealizedPnl(oraclePrice);
    const fundingPayment = this.calcFundingPayment(
      cumulativeFundingRateLong,
      cumulativeFundingRateShort,
    );
    return unrealizedPnl.add(fundingPayment);
  }

  calcFundingPayment(
    cumulativeFundingRateLong: BN,
    cumulativeFundingRateShort: BN,
  ): BN {
    const fundingRate = this.baseAssetAmount.isNeg()
      ? cumulativeFundingRateShort
      : cumulativeFundingRateLong;
    const fundingRateDelta = fundingRate.sub(this.lastCumulativeFundingRate);
    if (fundingRateDelta.eq(new BN(0))) {
      return new BN(0);
    }

    const fundingRateDeltaSign = fundingRateDelta.isNeg() ? -1 : 1;

    const usdPricePrecision = new BN(1_000_000);
    const fundingRatePaymentMagnitude = fundingRateDelta
      .abs()
      .mul(this.baseAssetAmount.abs())
      .div(usdPricePrecision)
      .div(new BN(1000));

    const fundingRatePaymentSign = this.baseAssetAmount.isNeg() ? 1 : -1;
    const sign = fundingRatePaymentSign * fundingRateDeltaSign;

    return sign < 0
      ? fundingRatePaymentMagnitude.neg()
      : fundingRatePaymentMagnitude;
  }
}

export class DriftVaultDepositor extends Decodable {
  discriminator!: number[];
  vault!: PublicKey;
  pubkey!: PublicKey;
  authority!: PublicKey;
  vaultShares!: BN;
  lastWithdrawRequest!: {
    shares: BN;
    value: BN;
    ts: BN;
  };
  lastValidTs!: BN;
  netDeposits!: BN;
  totalDeposits!: BN;
  totalWithdraws!: BN;
  cumulativeProfitShareAmount!: BN;
  profitShareFeePaid!: BN;
  vaultSharesBase!: number;
  lastFuelUpdateTs!: number;
  cumulativeFuelPerShareAmount!: BN;
  fuelAmount!: BN;
  padding!: BN[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("vault"),
    publicKey("pubkey"),
    publicKey("authority"),
    u128("vaultShares"),
    struct([u128("shares"), u64("value"), i64("ts")], "lastWithdrawRequest"),
    i64("lastValidTs"),
    i64("netDeposits"),
    u64("totalDeposits"),
    u64("totalWithdraws"),
    i64("cumulativeProfitShareAmount"),
    u64("profitShareFeePaid"),
    u32("vaultSharesBase"),
    u32("lastFuelUpdateTs"),
    u128("cumulativeFuelPerShareAmount"),
    u128("fuelAmount"),
    array(u64(), 4, "padding"),
  ]);

  get netShares(): BN {
    return this.vaultShares.sub(this.lastWithdrawRequest.shares);
  }
}

export class DriftVault extends Decodable {
  discriminator!: number[];
  nameBytes!: number[];
  pubkey!: PublicKey;
  manager!: PublicKey;
  tokenAccount!: PublicKey;
  userStats!: PublicKey;
  user!: PublicKey;
  delegate!: PublicKey;
  liquidationDelegate!: PublicKey;
  userShares!: BN;
  totalShares!: BN;
  lastFeeUpdateTs!: BN;
  liquidationStartTs!: BN;
  redeemPeriod!: BN;
  totalWithdrawRequested!: BN;
  maxTokens!: BN;
  managementFee!: BN;
  initTs!: BN;
  netDeposits!: BN;
  managerNetDeposits!: BN;
  totalDeposits!: BN;
  totalWithdraws!: BN;
  managerTotalDeposits!: BN;
  managerTotalWithdraws!: BN;
  managerTotalFee!: BN;
  managerTotalProfitShare!: BN;
  minDepositAmount!: BN;
  lastManagerWithdrawRequest!: {
    shares: BN;
    amount: BN;
    ts: BN;
  };
  sharesBase!: number;
  profitShare!: number;
  hurdleRate!: number;
  spotMarketIndex!: number;
  bump!: number;
  permissioned!: boolean;
  vaultProtocol!: boolean;
  fuelDistributionMode!: number;
  feeUpdateStatus!: number;
  padding1!: number;
  lastCumulativeFuelPerShareTs!: number;
  cumulativeFuelPerShare!: BN;
  cumulativeFuel!: BN;
  managerBorrowedValue!: BN;
  padding!: BN[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    // Basic vault info
    array(u8(), 32, "nameBytes"), // [u8; 32]
    publicKey("pubkey"),
    publicKey("manager"),
    publicKey("tokenAccount"),
    publicKey("userStats"),
    publicKey("user"),
    publicKey("delegate"),
    publicKey("liquidationDelegate"),

    // Share accounting
    u128("userShares"),
    u128("totalShares"),

    // Timestamps
    i64("lastFeeUpdateTs"),
    i64("liquidationStartTs"),
    i64("redeemPeriod"),

    // Withdrawal tracking
    u64("totalWithdrawRequested"),

    // Capacity and fees
    u64("maxTokens"),
    i64("managementFee"),
    i64("initTs"),

    // Deposit/withdrawal accounting
    i64("netDeposits"),
    i64("managerNetDeposits"),
    u64("totalDeposits"),
    u64("totalWithdraws"),
    u64("managerTotalDeposits"),
    u64("managerTotalWithdraws"),
    i64("managerTotalFee"),
    i64("managerTotalProfitShare"),
    u64("minDepositAmount"),

    // Manager withdraw request
    struct(
      [u128("shares"), u64("amount"), i64("ts")],
      "lastManagerWithdrawRequest",
    ),

    // Configuration
    u32("sharesBase"),
    u32("profitShare"),
    u32("hurdleRate"),
    u16("spotMarketIndex"),
    u8("bump"),
    bool("permissioned"),
    bool("vaultProtocol"),
    u8("fuelDistributionMode"),
    u8("feeUpdateStatus"),
    u8("padding1"),
    u32("lastCumulativeFuelPerShareTs"),
    u128("cumulativeFuelPerShare"),
    u128("cumulativeFuel"),
    u64("managerBorrowedValue"),

    // Final padding
    array(u64(), 2, "padding"), // [u64; 2]
  ]);

  get name(): string {
    return charsToString(this.nameBytes);
  }

  marketPda(marketType: MarketType, marketIndex: number) {
    const marketTypeStr = marketType === MarketType.SPOT ? "spot" : "perp";
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(`${marketTypeStr}_market`),
        new BN(marketIndex).toArrayLike(Buffer, "le", 2),
      ],
      DRIFT_PROGRAM_ID,
    )[0];
  }

  aum(
    spotPositions: SpotPosition[],
    perpPositions: PerpPosition[],
    spotMarketsMap: PkMap<DriftSpotMarket>,
    perpMarketsMap: PkMap<DriftPerpMarket>,
  ): BN {
    const positionBalances = [];
    for (const spotPosition of spotPositions) {
      const {
        decimals,
        lastOraclePrice,
        cumulativeDepositInterest,
        cumulativeBorrowInterest,
      } = spotMarketsMap.get(spotPosition.marketPda)!;

      const amount = spotPosition.calcBalanceBn(
        decimals,
        cumulativeDepositInterest,
        cumulativeBorrowInterest,
      );
      const balance = amount.mul(lastOraclePrice).div(new BN(10 ** decimals));
      positionBalances.push(balance);
    }

    for (const perpPosition of perpPositions) {
      const {
        lastOraclePrice,
        cumulativeFundingRateLong,
        cumulativeFundingRateShort,
      } = perpMarketsMap.get(perpPosition.marketPda)!;

      positionBalances.push(
        perpPosition.getUsdValueScaled(
          lastOraclePrice,
          cumulativeFundingRateLong,
          cumulativeFundingRateShort,
        ),
      );
    }

    return positionBalances.reduce((a, b) => a.add(b), new BN(0));
  }

  getBaseAsset(spotMarketsMap: PkMap<DriftSpotMarket>) {
    const market = spotMarketsMap.get(
      this.marketPda(MarketType.SPOT, this.spotMarketIndex),
    )!;
    return { mint: market.mint, decimals: market.decimals };
  }

  aumInBaseAsset(
    spotPositions: SpotPosition[],
    perpPositions: PerpPosition[],
    spotMarketsMap: PkMap<DriftSpotMarket>,
    perpMarketsMap: PkMap<DriftPerpMarket>,
  ): BN {
    const aumScaledUsd = this.aum(
      spotPositions,
      perpPositions,
      spotMarketsMap,
      perpMarketsMap,
    );
    const spotMarket = spotMarketsMap.get(
      this.marketPda(MarketType.SPOT, this.spotMarketIndex),
    )!;
    const baseAssetAmount = aumScaledUsd
      .mul(new BN(10 ** spotMarket.decimals))
      .div(spotMarket.lastOraclePrice);
    return baseAssetAmount.sub(this.managerBorrowedValue);
  }
}

export class DriftUser {
  _address!: PublicKey;
  authority!: PublicKey;
  delegate!: PublicKey;
  nameBytes!: number[];
  subAccountId!: number;
  spotPositions!: SpotPosition[];
  perpPositions!: PerpPosition[];
  orders!: Order[];
  status!: number;
  nextLiquidationId!: number;
  nextOrderId!: number;
  maxMarginRatio!: number;
  lastAddPerpLpSharesTs!: BN;
  settledPerpPnl!: BN;
  totalDeposits: BN;
  totalWithdraws: BN;
  totalSocialLoss: BN;
  cumulativePerpFunding: BN;
  cumulativeSpotFees: BN;
  liquidationMarginFreed: BN;
  lastActiveSlot: BN;
  isMarginTradingEnabled!: boolean;
  idle!: boolean;
  openOrders!: number;
  hasOpenOrder!: boolean;
  openAuctions!: number;
  hasOpenAuction!: boolean;
  lastFuelBonusUpdateTs!: number;
  marginMode!: MarginMode;
  poolId!: number;

  // Manually decode drift user account so that signed BN can be parsed correctly
  static decode(address: PublicKey, buffer: Buffer): DriftUser {
    let offset = 8;
    const authority = new PublicKey(buffer.subarray(offset, offset + 32));
    offset += 32;
    const delegate = new PublicKey(buffer.subarray(offset, offset + 32));
    offset += 32;
    const nameBytes = [];
    for (let i = 0; i < 32; i++) {
      nameBytes.push(buffer.readUint8(offset + i));
    }
    offset += 32;

    const spotPositions: SpotPosition[] = [];
    for (let i = 0; i < 8; i++) {
      const scaledBalance = readUnsignedBigInt64LE(buffer, offset);
      const openOrders = buffer.readUInt8(offset + 35);
      if (scaledBalance.eq(ZERO) && openOrders === 0) {
        offset += 40;
        continue;
      }

      offset += 8;
      const openBids = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const openAsks = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const cumulativeDeposits = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const marketIndex = buffer.readUInt16LE(offset);
      offset += 2;
      const balanceTypeNum = buffer.readUInt8(offset);
      let balanceType: SpotBalanceType;
      if (balanceTypeNum === 0) {
        balanceType = SpotBalanceType.DEPOSIT;
      } else {
        balanceType = SpotBalanceType.BORROW;
      }
      offset += 6;

      spotPositions.push(
        new SpotPosition({
          marketIndex,
          balanceType,
          scaledBalance,
          openOrders,
          openBids,
          openAsks,
          cumulativeDeposits,
        }),
      );
    }

    const perpPositions: PerpPosition[] = [];
    for (let i = 0; i < 8; i++) {
      const baseAssetAmount = readSignedBigInt64LE(buffer, offset + 8);
      const quoteAssetAmount = readSignedBigInt64LE(buffer, offset + 16);
      const lpShares = readUnsignedBigInt64LE(buffer, offset + 64);
      const openOrders = buffer.readUInt8(offset + 94);

      if (
        baseAssetAmount.eq(ZERO) &&
        openOrders === 0 &&
        quoteAssetAmount.eq(ZERO) &&
        lpShares.eq(ZERO)
      ) {
        offset += 96;
        continue;
      }

      const lastCumulativeFundingRate = readSignedBigInt64LE(buffer, offset);
      offset += 24;
      const quoteBreakEvenAmount = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const quoteEntryAmount = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const openBids = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const openAsks = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const settledPnl = readSignedBigInt64LE(buffer, offset);
      offset += 16;
      const lastBaseAssetAmountPerLp = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const lastQuoteAssetAmountPerLp = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const remainderBaseAssetAmount = buffer.readInt32LE(offset);
      offset += 4;
      const marketIndex = buffer.readUInt16LE(offset);
      offset += 3;
      const perLpBase = buffer.readUInt8(offset);
      offset += 1;

      perpPositions.push(
        new PerpPosition({
          baseAssetAmount,
          lastCumulativeFundingRate,
          marketIndex,
          quoteAssetAmount,
          quoteEntryAmount,
          quoteBreakEvenAmount,
          openOrders,
          openBids,
          openAsks,
          settledPnl,
          lpShares,
          remainderBaseAssetAmount,
          lastBaseAssetAmountPerLp,
          lastQuoteAssetAmountPerLp,
          perLpBase,
        }),
      );
    }

    const orders: Order[] = [];
    for (let i = 0; i < 32; i++) {
      // skip order if it's not open
      if (buffer.readUint8(offset + 82) !== 1) {
        offset += 96;
        continue;
      }

      const slot = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const price = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const baseAssetAmount = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const baseAssetAmountFilled = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const quoteAssetAmountFilled = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const triggerPrice = readUnsignedBigInt64LE(buffer, offset);
      offset += 8;
      const auctionStartPrice = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const auctionEndPrice = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const maxTs = readSignedBigInt64LE(buffer, offset);
      offset += 8;
      const oraclePriceOffset = buffer.readInt32LE(offset);
      offset += 4;
      const orderId = buffer.readUInt32LE(offset);
      offset += 4;
      const marketIndex = buffer.readUInt16LE(offset);
      offset += 2;
      const orderStatusNum = buffer.readUInt8(offset);

      let status: OrderStatus = OrderStatus.INIT;
      if (orderStatusNum === 0) {
        status = OrderStatus.INIT;
      } else if (orderStatusNum === 1) {
        status = OrderStatus.OPEN;
      } else if (orderStatusNum === 2) {
        status = OrderStatus.FILLED;
      } else if (orderStatusNum === 3) {
        status = OrderStatus.CANCELED;
      }
      offset += 1;
      const orderTypeNum = buffer.readUInt8(offset);
      let orderType: OrderType = OrderType.MARKET;
      if (orderTypeNum === 0) {
        orderType = OrderType.MARKET;
      } else if (orderTypeNum === 1) {
        orderType = OrderType.LIMIT;
      } else if (orderTypeNum === 2) {
        orderType = OrderType.TRIGGER_MARKET;
      } else if (orderTypeNum === 3) {
        orderType = OrderType.TRIGGER_LIMIT;
      } else if (orderTypeNum === 4) {
        orderType = OrderType.ORACLE;
      }
      offset += 1;
      const marketTypeNum = buffer.readUInt8(offset);
      let marketType: MarketType;
      if (marketTypeNum === 0) {
        marketType = MarketType.SPOT;
      } else {
        marketType = MarketType.PERP;
      }
      offset += 1;
      const userOrderId = buffer.readUint8(offset);
      offset += 1;
      const existingPositionDirectionNum = buffer.readUInt8(offset);
      let existingPositionDirection: PositionDirection;
      if (existingPositionDirectionNum === 0) {
        existingPositionDirection = PositionDirection.LONG;
      } else {
        existingPositionDirection = PositionDirection.SHORT;
      }
      offset += 1;
      const positionDirectionNum = buffer.readUInt8(offset);
      let direction: PositionDirection;
      if (positionDirectionNum === 0) {
        direction = PositionDirection.LONG;
      } else {
        direction = PositionDirection.SHORT;
      }
      offset += 1;
      const reduceOnly = buffer.readUInt8(offset) === 1;
      offset += 1;
      const postOnly = buffer.readUInt8(offset) === 1;
      offset += 1;
      const immediateOrCancel = buffer.readUInt8(offset) === 1;
      offset += 1;
      const triggerConditionNum = buffer.readUInt8(offset);
      let triggerCondition: OrderTriggerCondition = OrderTriggerCondition.ABOVE;
      if (triggerConditionNum === 0) {
        triggerCondition = OrderTriggerCondition.ABOVE;
      } else if (triggerConditionNum === 1) {
        triggerCondition = OrderTriggerCondition.BELOW;
      } else if (triggerConditionNum === 2) {
        triggerCondition = OrderTriggerCondition.TRIGGERED_ABOVE;
      } else if (triggerConditionNum === 3) {
        triggerCondition = OrderTriggerCondition.TRIGGERED_BELOW;
      }
      offset += 1;
      const auctionDuration = buffer.readUInt8(offset);
      offset += 1;
      const postedSlotTail = buffer.readUint8(offset);
      offset += 1;
      const bitFlags = buffer.readUint8(offset);
      offset += 1;
      offset += 1; // padding
      orders.push({
        slot,
        price,
        baseAssetAmount,
        quoteAssetAmount: undefined,
        baseAssetAmountFilled,
        quoteAssetAmountFilled,
        triggerPrice,
        auctionStartPrice,
        auctionEndPrice,
        maxTs,
        oraclePriceOffset,
        orderId,
        marketIndex,
        status,
        orderType,
        marketType,
        userOrderId,
        existingPositionDirection,
        direction,
        reduceOnly,
        postOnly,
        immediateOrCancel,
        triggerCondition,
        auctionDuration,
        bitFlags,
        postedSlotTail,
      });
    }

    const lastAddPerpLpSharesTs = readSignedBigInt64LE(buffer, offset);
    offset += 8;

    const totalDeposits = readUnsignedBigInt64LE(buffer, offset);
    offset += 8;

    const totalWithdraws = readUnsignedBigInt64LE(buffer, offset);
    offset += 8;

    const totalSocialLoss = readUnsignedBigInt64LE(buffer, offset);
    offset += 8;

    const settledPerpPnl = readSignedBigInt64LE(buffer, offset);
    offset += 8;

    const cumulativeSpotFees = readSignedBigInt64LE(buffer, offset);
    offset += 8;

    const cumulativePerpFunding = readSignedBigInt64LE(buffer, offset);
    offset += 8;

    const liquidationMarginFreed = readUnsignedBigInt64LE(buffer, offset);
    offset += 8;

    const lastActiveSlot = readUnsignedBigInt64LE(buffer, offset);
    offset += 8;

    const nextOrderId = buffer.readUInt32LE(offset);
    offset += 4;

    const maxMarginRatio = buffer.readUInt32LE(offset);
    offset += 4;

    const nextLiquidationId = buffer.readUInt16LE(offset);
    offset += 2;

    const subAccountId = buffer.readUInt16LE(offset);
    offset += 2;

    const status = buffer.readUInt8(offset);
    offset += 1;

    const isMarginTradingEnabled = buffer.readUInt8(offset) === 1;
    offset += 1;

    const idle = buffer.readUInt8(offset) === 1;
    offset += 1;

    const openOrders = buffer.readUInt8(offset);
    offset += 1;

    const hasOpenOrder = buffer.readUInt8(offset) === 1;
    offset += 1;

    const openAuctions = buffer.readUInt8(offset);
    offset += 1;

    const hasOpenAuction = buffer.readUInt8(offset) === 1;
    offset += 1;

    let marginMode: MarginMode;
    const marginModeNum = buffer.readUInt8(offset);
    if (marginModeNum === 0) {
      marginMode = MarginMode.DEFAULT;
    } else {
      marginMode = MarginMode.HIGH_LEVERAGE;
    }
    offset += 1;

    const poolId = buffer.readUint8(offset);
    offset += 1;
    offset += 3; // padding

    const lastFuelBonusUpdateTs = buffer.readUint32LE(offset);
    offset += 4;

    const data = {
      authority,
      delegate,
      nameBytes,
      spotPositions,
      perpPositions,
      orders,
      lastAddPerpLpSharesTs,
      totalDeposits,
      totalWithdraws,
      totalSocialLoss,
      settledPerpPnl,
      cumulativeSpotFees,
      cumulativePerpFunding,
      liquidationMarginFreed,
      lastActiveSlot,
      nextOrderId,
      maxMarginRatio,
      nextLiquidationId,
      subAccountId,
      status,
      isMarginTradingEnabled,
      idle,
      openOrders,
      hasOpenOrder,
      openAuctions,
      hasOpenAuction,
      marginMode,
      poolId,
      lastFuelBonusUpdateTs,
    };

    const instance = new this();
    Object.assign(instance, { _address: address, ...data });
    return instance;
  }

  get name(): string {
    return charsToString(this.nameBytes);
  }

  getAddress() {
    return this._address;
  }
}

export class DriftSpotMarket extends Decodable {
  discriminator!: number[];
  marketPda!: PublicKey;
  oracle!: PublicKey;
  lastOraclePrice!: BN;
  mint!: PublicKey;
  vault!: PublicKey;
  nameBytes!: number[];
  padding1!: number[];
  cumulativeDepositInterest!: BN;
  cumulativeBorrowInterest!: BN;
  padding2!: number[];
  decimals!: number;
  marketIndex!: number;
  padding3!: number;
  oracleSourceOrd!: number;
  padding4!: number[];
  tokenProgram!: number;
  poolId!: number;
  padding5!: number[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("marketPda"),
    publicKey("oracle"),
    publicKey("mint"),
    publicKey("vault"),

    array(u8(), 32, "nameBytes"),
    u64("lastOraclePrice"),

    // Padding for bytes between name and cumulativeDepositInterest
    array(u8(), 464 - 176, "padding1"),

    u128("cumulativeDepositInterest"),
    u128("cumulativeBorrowInterest"),

    // Padding for bytes between cumulativeBorrowInterest and decimals
    array(u8(), 680 - 496, "padding2"),

    u32("decimals"), // [680, 684)
    u16("marketIndex"), // [684, 686)
    u8("padding3"), // [686, 687)
    u8("oracleSourceOrd"), // [687, 688)
    array(u8(), 46, "padding4"), // [688, 734)
    u8("tokenProgram"), // [734, 735)
    u8("poolId"), // [735, 736)
    array(u8(), 40, "padding5"), // [736, 776)
  ]);

  get name(): string {
    return charsToString(this.nameBytes);
  }

  get oracleSource(): OracleSource {
    return OracleSource.get(this.oracleSourceOrd);
  }

  get tokenProgramId(): PublicKey {
    return this.tokenProgram === 0 ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
  }
}

export class DriftPerpMarket extends Decodable {
  discriminator!: number[];
  marketPda!: PublicKey;
  oracle!: PublicKey;
  lastOraclePrice!: BN;
  cumulativeFundingRateLong!: BN;
  cumulativeFundingRateShort!: BN;
  padding1!: number[];
  oracleSourceOrd!: number;
  padding2!: number[];
  nameBytes!: number[];
  padding3!: number[];
  marketIndex!: number;
  padding4!: number[];
  quoteSpotMarketIndex!: number;

  static decode<T extends Decodable>(
    this: { new (): T; _layout: ReturnType<typeof struct> },
    address: PublicKey,
    buffer: Buffer,
  ): T {
    const instance = Decodable.decode.call(this, address, buffer) as T;
    if (instance instanceof DriftPerpMarket) {
      (instance as DriftPerpMarket).cumulativeFundingRateLong = readI128LE(
        buffer,
        608,
      );
      (instance as DriftPerpMarket).cumulativeFundingRateShort = readI128LE(
        buffer,
        624,
      );
    }
    return instance;
  }

  static _layout = struct([
    array(u8(), 8, "discriminator"), // [0, 8)
    publicKey("marketPda"), // [8, 40)
    publicKey("oracle"), // [40, 72)
    u64("lastOraclePrice"), // [72, 80)
    array(u8(), 846, "padding1"), // [80, 926)
    u8("oracleSourceOrd"), // [926, 927)
    array(u8(), 73, "padding2"), // [927, 1000)
    array(u8(), 32, "nameBytes"), // [1000, 1032)
    array(u8(), 128, "padding3"), // [1032, 1160)
    u16("marketIndex"), // [1160, 1162)
    array(u8(), 4, "padding4"), // [1162, 1166)
    u16("quoteSpotMarketIndex"), // [1166, 1168)
  ]);

  get name(): string {
    return charsToString(this.nameBytes);
  }

  get oracleSource(): OracleSource {
    return OracleSource.get(this.oracleSourceOrd);
  }
}
