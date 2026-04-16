import {
  struct,
  u8,
  u16,
  u32,
  u64,
  u128,
  i64,
  publicKey,
  array,
} from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  bfToDecimal,
  BigFractionBytes,
  charsToString,
  Fraction,
} from "../utils";
import { Decodable } from "./base";
import Decimal from "decimal.js";
import { KAMINO_LENDING_PROGRAM } from "../constants";

const MAX_RESERVES = 25;

export interface KVaultAllocation {
  reserve: PublicKey;
  ctokenVault: PublicKey;
  targetAllocationWeight: BN;
  tokenAllocationCap: BN;
  ctokenVaultBump: BN;
  configPadding: BN[];
  ctokenAllocation: BN;
  lastInvestSlot: BN;
  tokenTargetAllocationSf: BN;
  statePadding: BN[];
}

export class KVaultState extends Decodable {
  discriminator!: number[];
  vaultAdminAuthority!: PublicKey;
  baseVaultAuthority!: PublicKey;
  baseVaultAuthorityBump!: BN;
  tokenMint!: PublicKey;
  tokenMintDecimals!: BN;
  tokenVault!: PublicKey;
  tokenProgram!: PublicKey;
  sharesMint!: PublicKey;
  sharesMintDecimals!: BN;
  tokenAvailable!: BN;
  sharesIssued!: BN;
  availableCrankFunds!: BN;
  padding0!: BN;
  performanceFeeBps!: BN;
  managementFeeBps!: BN;
  lastFeeChargeTimestamp!: BN;
  prevAumSf!: BN;
  pendingFeesSf!: BN;
  vaultAllocationStrategy!: KVaultAllocation[];
  padding1!: BN[];
  minDepositAmount!: BN;
  minWithdrawAmount!: BN;
  minInvestAmount!: BN;
  minInvestDelaySlots!: BN;
  crankFundFeePerReserve!: BN;
  pendingAdmin!: PublicKey;
  cumulativeEarnedInterestSf!: BN;
  cumulativeMgmtFeesSf!: BN;
  cumulativePerfFeesSf!: BN;
  name!: number[];
  vaultLookupTable!: PublicKey;
  vaultFarm!: PublicKey;
  creationTimestamp!: BN;
  padding2!: BN;
  allocationAdmin!: PublicKey;
  padding3!: BN[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("vaultAdminAuthority"),
    publicKey("baseVaultAuthority"),
    u64("baseVaultAuthorityBump"),
    publicKey("tokenMint"),
    u64("tokenMintDecimals"),
    publicKey("tokenVault"),
    publicKey("tokenProgram"),
    publicKey("sharesMint"),
    u64("sharesMintDecimals"),
    u64("tokenAvailable"),
    u64("sharesIssued"),
    u64("availableCrankFunds"),
    u64("padding0"),
    u64("performanceFeeBps"),
    u64("managementFeeBps"),
    u64("lastFeeChargeTimestamp"),
    u128("prevAumSf"),
    u128("pendingFeesSf"),
    array(
      struct([
        publicKey("reserve"),
        publicKey("ctokenVault"),
        u64("targetAllocationWeight"),
        u64("tokenAllocationCap"),
        u64("ctokenVaultBump"),
        array(u64(), 127, "configPadding"),
        u64("ctokenAllocation"),
        u64("lastInvestSlot"),
        u128("tokenTargetAllocationSf"),
        array(u64(), 128, "statePadding"),
      ]),
      MAX_RESERVES,
      "vaultAllocationStrategy",
    ),
    array(u128(), 256, "padding1"),
    u64("minDepositAmount"),
    u64("minWithdrawAmount"),
    u64("minInvestAmount"),
    u64("minInvestDelaySlots"),
    u64("crankFundFeePerReserve"),
    publicKey("pendingAdmin"),
    u128("cumulativeEarnedInterestSf"),
    u128("cumulativeMgmtFeesSf"),
    u128("cumulativePerfFeesSf"),
    array(u8(), 40, "name"),
    publicKey("vaultLookupTable"),
    publicKey("vaultFarm"),
    u64("creationTimestamp"),
    u64("padding2"),
    publicKey("allocationAdmin"),
    array(u128(), 242, "padding3"),
  ]);

  get nameStr(): string {
    return charsToString(this.name);
  }

  get validAllocations(): KVaultAllocation[] {
    return this.vaultAllocationStrategy.filter(
      ({ reserve }) => !reserve.equals(PublicKey.default),
    );
  }
}

//
// Kamino Lending Reserve
//

interface LastUpdate {
  slot: BN;
  stale: number;
  priceStatus: number;
  placeholder: number[];
}

interface PriceHeuristic {
  lower: BN;
  upper: BN;
  exp: BN;
}

interface ScopeConfiguration {
  priceFeed: PublicKey;
  priceChain: number[];
  twapChain: number[];
}

interface SwitchboardConfiguration {
  priceAggregator: PublicKey;
  twapAggregator: PublicKey;
}

interface PythConfiguration {
  price: PublicKey;
}

interface TokenInfo {
  name: number[];
  heuristic: PriceHeuristic;
  maxTwapDivergenceBps: BN;
  maxAgePriceSeconds: BN;
  maxAgeTwapSeconds: BN;
  scopeConfiguration: ScopeConfiguration;
  switchboardConfiguration: SwitchboardConfiguration;
  pythConfiguration: PythConfiguration;
  blockPriceUsage: number;
  reserved: number[];
  padding: BN[];
}

interface ReserveFees {
  borrowFeeSf: BN;
  flashLoanFeeSf: BN;
  padding: number[];
}

interface CurvePoint {
  utilizationRateBps: number;
  borrowRateBps: number;
}

interface BorrowRateCurve {
  points: CurvePoint[];
}

interface WithdrawalCaps {
  configCapacity: BN;
  currentTotal: BN;
  lastIntervalStartTimestamp: BN;
  configIntervalLengthSeconds: BN;
}

interface ReserveLiquidity {
  mintPubkey: PublicKey;
  supplyVault: PublicKey;
  feeVault: PublicKey;
  availableAmount: BN;
  borrowedAmountSf: BN;
  marketPriceSf: BN;
  marketPriceLastUpdatedTs: BN;
  mintDecimals: BN;
  depositLimitCrossedTimestamp: BN;
  borrowLimitCrossedTimestamp: BN;
  cumulativeBorrowRateBsf: BigFractionBytes;
  accumulatedProtocolFeesSf: BN;
  accumulatedReferrerFeesSf: BN;
  pendingReferrerFeesSf: BN;
  absoluteReferralRateSf: BN;
  tokenProgram: PublicKey;
  padding2: BN[];
  padding3: BN[];
}

interface ReserveCollateral {
  mintPubkey: PublicKey;
  mintTotalSupply: BN;
  supplyVault: PublicKey;
  padding1: BN[];
  padding2: BN[];
}

interface ReserveConfig {
  status: number;
  assetTier: number;
  hostFixedInterestRateBps: number;
  reserved2: number[];
  protocolOrderExecutionFeePct: number;
  protocolTakeRatePct: number;
  protocolLiquidationFeePct: number;
  loanToValuePct: number;
  liquidationThresholdPct: number;
  minLiquidationBonusBps: number;
  maxLiquidationBonusBps: number;
  badDebtLiquidationBonusBps: number;
  deleveragingMarginCallPeriodSecs: BN;
  deleveragingThresholdDecreaseBpsPerDay: BN;
  fees: ReserveFees;
  borrowRateCurve: BorrowRateCurve;
  borrowFactorPct: BN;
  depositLimit: BN;
  borrowLimit: BN;
  tokenInfo: TokenInfo;
  depositWithdrawalCap: WithdrawalCaps;
  debtWithdrawalCap: WithdrawalCaps;
  elevationGroups: number[];
  disableUsageAsCollOutsideEmode: number;
  utilizationLimitBlockBorrowingAbovePct: number;
  autodeleverageEnabled: number;
  reserved1: number[];
  borrowLimitOutsideElevationGroup: BN;
  borrowLimitAgainstThisCollateralInElevationGroup: BN[];
}

export class Reserve extends Decodable {
  discriminator!: number[];
  version!: BN;
  lastUpdate!: LastUpdate;
  lendingMarket!: PublicKey;
  farmCollateral!: PublicKey;
  farmDebt!: PublicKey;
  liquidity!: ReserveLiquidity;
  reserveLiquidityPadding!: BN[];
  collateral!: ReserveCollateral;
  reserveCollateralPadding!: BN[];
  config!: ReserveConfig;
  configPadding!: BN[];
  borrowedAmountOutsideElevationGroup!: BN;
  borrowedAmountsAgainstThisReserveInElevationGroups!: BN[];
  padding!: BN[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    u64("version"),
    struct(
      [
        u64("slot"),
        u8("stale"),
        u8("priceStatus"),
        array(u8(), 6, "placeholder"),
      ],
      "lastUpdate",
    ),
    publicKey("lendingMarket"),
    publicKey("farmCollateral"),
    publicKey("farmDebt"),
    struct(
      [
        publicKey("mintPubkey"),
        publicKey("supplyVault"),
        publicKey("feeVault"),
        u64("availableAmount"),
        u128("borrowedAmountSf"),
        u128("marketPriceSf"),
        u64("marketPriceLastUpdatedTs"),
        u64("mintDecimals"),
        u64("depositLimitCrossedTimestamp"),
        u64("borrowLimitCrossedTimestamp"),
        struct(
          [array(u64(), 4, "value"), array(u64(), 2, "padding")],
          "cumulativeBorrowRateBsf",
        ),
        u128("accumulatedProtocolFeesSf"),
        u128("accumulatedReferrerFeesSf"),
        u128("pendingReferrerFeesSf"),
        u128("absoluteReferralRateSf"),
        publicKey("tokenProgram"),
        array(u64(), 51, "padding2"),
        array(u128(), 32, "padding3"),
      ],
      "liquidity",
    ),
    array(u64(), 150, "reserveLiquidityPadding"),
    struct(
      [
        publicKey("mintPubkey"),
        u64("mintTotalSupply"),
        publicKey("supplyVault"),
        array(u128(), 32, "padding1"),
        array(u128(), 32, "padding2"),
      ],
      "collateral",
    ),
    array(u64(), 150, "reserveCollateralPadding"),
    struct(
      [
        u8("status"),
        u8("assetTier"),
        u16("hostFixedInterestRateBps"),
        array(u8(), 9, "reserved2"),
        u8("protocolOrderExecutionFeePct"),
        u8("protocolTakeRatePct"),
        u8("protocolLiquidationFeePct"),
        u8("loanToValuePct"),
        u8("liquidationThresholdPct"),
        u16("minLiquidationBonusBps"),
        u16("maxLiquidationBonusBps"),
        u16("badDebtLiquidationBonusBps"),
        u64("deleveragingMarginCallPeriodSecs"),
        u64("deleveragingThresholdDecreaseBpsPerDay"),
        struct(
          [
            u64("borrowFeeSf"),
            u64("flashLoanFeeSf"),
            array(u8(), 8, "padding"),
          ],
          "fees",
        ),
        struct(
          [
            array(
              struct([u32("utilizationRateBps"), u32("borrowRateBps")]),
              11,
              "points",
            ),
          ],
          "borrowRateCurve",
        ),
        u64("borrowFactorPct"),
        u64("depositLimit"),
        u64("borrowLimit"),
        struct(
          [
            array(u8(), 32, "name"),
            struct([u64("lower"), u64("upper"), u64("exp")], "heuristic"),
            u64("maxTwapDivergenceBps"),
            u64("maxAgePriceSeconds"),
            u64("maxAgeTwapSeconds"),
            struct(
              [
                publicKey("priceFeed"),
                array(u16(), 4, "priceChain"),
                array(u16(), 4, "twapChain"),
              ],
              "scopeConfiguration",
            ),
            struct(
              [publicKey("priceAggregator"), publicKey("twapAggregator")],
              "switchboardConfiguration",
            ),
            struct([publicKey("price")], "pythConfiguration"),
            u8("blockPriceUsage"),
            array(u8(), 7, "reserved"),
            array(u64(), 19, "padding"),
          ],
          "tokenInfo",
        ),
        struct(
          [
            i64("configCapacity"),
            i64("currentTotal"),
            u64("lastIntervalStartTimestamp"),
            u64("configIntervalLengthSeconds"),
          ],
          "depositWithdrawalCap",
        ),
        struct(
          [
            i64("configCapacity"),
            i64("currentTotal"),
            u64("lastIntervalStartTimestamp"),
            u64("configIntervalLengthSeconds"),
          ],
          "debtWithdrawalCap",
        ),
        array(u8(), 20, "elevationGroups"),
        u8("disableUsageAsCollOutsideEmode"),
        u8("utilizationLimitBlockBorrowingAbovePct"),
        u8("autodeleverageEnabled"),
        array(u8(), 1, "reserved1"),
        u64("borrowLimitOutsideElevationGroup"),
        array(u64(), 32, "borrowLimitAgainstThisCollateralInElevationGroup"),
      ],
      "config",
    ),
    array(u64(), 116, "configPadding"),
    u64("borrowedAmountOutsideElevationGroup"),
    array(u64(), 32, "borrowedAmountsAgainstThisReserveInElevationGroups"),
    array(u64(), 207, "padding"),
  ]);

  get cumulativeBorrowRate(): Decimal {
    return bfToDecimal(this.liquidity.cumulativeBorrowRateBsf);
  }

  /**
   * @returns the stale exchange rate between the collateral tokens and the liquidity - this is a decimal number scaled by 1e18
   */
  get collateralExchangeRate(): Decimal {
    const totalSupply = this.totalSupply;
    const mintTotalSupply = this.collateral.mintTotalSupply;

    if (totalSupply.isZero() || mintTotalSupply.isZero()) {
      return new Decimal(1); // initial exchange rate
    }

    return new Decimal(mintTotalSupply.toString()).div(totalSupply.toString());
  }

  get totalSupply(): Decimal {
    return new Decimal(this.liquidity.availableAmount.toString())
      .add(this.borrowedAmount)
      .sub(this.accumulatedProtocolFees)
      .sub(this.accumulatedReferrerFees)
      .sub(this.pendingReferrerFees);
  }

  get borrowedAmount(): Decimal {
    return new Fraction(this.liquidity.borrowedAmountSf).toDecimal();
  }

  get accumulatedProtocolFees(): Decimal {
    return new Fraction(this.liquidity.accumulatedProtocolFeesSf).toDecimal();
  }

  get accumulatedReferrerFees(): Decimal {
    return new Fraction(this.liquidity.accumulatedReferrerFeesSf).toDecimal();
  }

  get pendingReferrerFees(): Decimal {
    return new Fraction(this.liquidity.pendingReferrerFeesSf).toDecimal();
  }

  get scopePriceFeed(): PublicKey {
    return this.config.tokenInfo.scopeConfiguration.priceFeed;
  }

  get liquidityFeeReceiver(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fee_receiver"), this._address.toBuffer()],
      KAMINO_LENDING_PROGRAM,
    )[0];
  }

  get farmDebtNullable(): PublicKey | null {
    return this.farmDebt.equals(PublicKey.default) ? null : this.farmDebt;
  }

  get farmCollateralNullable(): PublicKey | null {
    return this.farmCollateral.equals(PublicKey.default)
      ? null
      : this.farmCollateral;
  }
}

//
// Kamino Lending Obligation
//

interface ObligationCollateral {
  depositReserve: PublicKey;
  depositedAmount: BN;
  marketValueSf: BN;
  borrowedAmountAgainstThisCollateralInElevationGroup: BN;
  padding: BN[];
}

interface ObligationLiquidity {
  borrowReserve: PublicKey;
  cumulativeBorrowRateBsf: BigFractionBytes;
  padding: BN;
  borrowedAmountSf: BN;
  marketValueSf: BN;
  borrowFactorAdjustedMarketValueSf: BN;
  borrowedAmountOutsideElevationGroups: BN;
  padding2: BN[];
}

interface ObligationOrder {
  conditionThresholdSf: BN;
  opportunityParameterSf: BN;
  minExecutionBonusBps: number;
  maxExecutionBonusBps: number;
  conditionType: number;
  opportunityType: number;
  padding1: number[];
  padding2: BN[];
}

export class Obligation extends Decodable {
  discriminator!: number[];
  tag!: BN;
  lastUpdate!: LastUpdate;
  lendingMarket!: PublicKey;
  owner!: PublicKey;
  deposits!: ObligationCollateral[];
  lowestReserveDepositLiquidationLtv!: BN;
  depositedValueSf!: BN;
  borrows!: ObligationLiquidity[];
  borrowFactorAdjustedDebtValueSf!: BN;
  borrowedAssetsMarketValueSf!: BN;
  allowedBorrowValueSf!: BN;
  unhealthyBorrowValueSf!: BN;
  depositsAssetTiers!: number[];
  borrowsAssetTiers!: number[];
  elevationGroup!: number;
  numOfObsoleteDepositReserves!: number;
  hasDebt!: number;
  referrer!: PublicKey;
  borrowingDisabled!: number;
  autodeleverageTargetLtvPct!: number;
  lowestReserveDepositMaxLtvPct!: number;
  numOfObsoleteBorrowReserves!: number;
  reserved!: number[];
  highestBorrowFactorPct!: BN;
  autodeleverageMarginCallStartedTimestamp!: BN;
  orders!: ObligationOrder[];
  padding3!: BN[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    u64("tag"),
    struct(
      [
        u64("slot"),
        u8("stale"),
        u8("priceStatus"),
        array(u8(), 6, "placeholder"),
      ],
      "lastUpdate",
    ),
    publicKey("lendingMarket"),
    publicKey("owner"),
    array(
      struct([
        publicKey("depositReserve"),
        u64("depositedAmount"),
        u128("marketValueSf"),
        u64("borrowedAmountAgainstThisCollateralInElevationGroup"),
        array(u64(), 9, "padding"),
      ]),
      8,
      "deposits",
    ),
    u64("lowestReserveDepositLiquidationLtv"),
    u128("depositedValueSf"),
    array(
      struct([
        publicKey("borrowReserve"),
        struct(
          [array(u64(), 4, "value"), array(u64(), 2, "padding")],
          "cumulativeBorrowRateBsf",
        ),
        u64("padding"),
        u128("borrowedAmountSf"),
        u128("marketValueSf"),
        u128("borrowFactorAdjustedMarketValueSf"),
        u64("borrowedAmountOutsideElevationGroups"),
        array(u64(), 7, "padding2"),
      ]),
      5,
      "borrows",
    ),
    u128("borrowFactorAdjustedDebtValueSf"),
    u128("borrowedAssetsMarketValueSf"),
    u128("allowedBorrowValueSf"),
    u128("unhealthyBorrowValueSf"),
    array(u8(), 8, "depositsAssetTiers"),
    array(u8(), 5, "borrowsAssetTiers"),
    u8("elevationGroup"),
    u8("numOfObsoleteDepositReserves"),
    u8("hasDebt"),
    publicKey("referrer"),
    u8("borrowingDisabled"),
    u8("autodeleverageTargetLtvPct"),
    u8("lowestReserveDepositMaxLtvPct"),
    u8("numOfObsoleteBorrowReserves"),
    array(u8(), 4, "reserved"),
    u64("highestBorrowFactorPct"),
    u64("autodeleverageMarginCallStartedTimestamp"),
    array(
      struct([
        u128("conditionThresholdSf"),
        u128("opportunityParameterSf"),
        u16("minExecutionBonusBps"),
        u16("maxExecutionBonusBps"),
        u8("conditionType"),
        u8("opportunityType"),
        array(u8(), 2, "padding1"),
        array(u64(), 8, "padding2"),
      ]),
      2,
      "orders",
    ),
    array(u64(), 93, "padding3"),
  ]);

  get activeDeposits() {
    return this.deposits.filter(
      ({ depositReserve }) => !depositReserve.equals(PublicKey.default),
    );
  }

  get activeBorrows() {
    return this.borrows.filter(
      ({ borrowReserve }) => !borrowReserve.equals(PublicKey.default),
    );
  }
}
