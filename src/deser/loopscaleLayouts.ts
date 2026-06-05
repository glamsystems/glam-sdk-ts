import {
  struct,
  u8,
  u16,
  u32,
  u64,
  u128,
  publicKey,
  array,
} from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decodable } from "./base";
import { U64_MAX_BN } from "../utils/common";

//
// Loopscale Strategy & MarketInformation
//
// Loopscale stores its numeric fields as little-endian Pod byte arrays
// (`PodU64 = [u8; 8]`, `PodU128 = [u8; 16]`, `PodDecimal = [u8; 24]`, etc.).
// Those are byte-compatible with the borsh fixed-width integer layouts, so we
// model each Pod wrapper with the matching `@coral-xyz/borsh` reader.
//

export const STRATEGY_DURATION_COUNT = 5;
const COLLATERAL_MAP_ASSET_COUNT = 200;
const MARKET_ASSET_DATA_COUNT = 200;

function hasLoopscaleDiscriminator(
  data: Buffer,
  discriminator: Buffer,
): boolean {
  return (
    data.length >= discriminator.length &&
    data.subarray(0, discriminator.length).equals(discriminator)
  );
}

interface ExternalYieldAccounts {
  externalYieldAccount: PublicKey;
  externalYieldVault: PublicKey;
}

interface CapMonitor {
  startTime1hr: BN;
  startTime24hr: BN;
  principal1hr: BN;
  principal24hr: BN;
}

const capMonitorLayout = (property: string) =>
  struct(
    [
      u64("startTime1hr"),
      u64("startTime24hr"),
      u64("principal1hr"),
      u64("principal24hr"),
    ],
    property,
  );

// Discriminator for the Loopscale `Strategy` account.
export const LOOPSCALE_STRATEGY_ACCOUNT_DISCRIMINATOR = Buffer.from([
  174, 110, 39, 119, 82, 106, 169, 102,
]);

export function hasLoopscaleStrategyDiscriminator(data: Buffer): boolean {
  return hasLoopscaleDiscriminator(
    data,
    LOOPSCALE_STRATEGY_ACCOUNT_DISCRIMINATOR,
  );
}

export class LoopscaleStrategy extends Decodable {
  discriminator!: number[];
  version!: number;
  nonce!: PublicKey;
  bump!: number;
  principalMint!: PublicKey;
  lender!: PublicKey;
  originationsEnabled!: number;
  externalYieldSource!: number;
  interestPerSecond!: number[];
  lastAccruedTimestamp!: BN;
  liquidityBuffer!: BN;
  tokenBalance!: BN;
  interestFee!: BN;
  principalFee!: BN;
  originationFee!: BN;
  originationCap!: BN;
  externalYieldAmount!: BN;
  currentDeployedAmount!: BN;
  outstandingInterestAmount!: BN;
  feeClaimable!: BN;
  cumulativePrincipalOriginated!: BN;
  cumulativeInterestAccrued!: BN;
  cumulativeLoanCount!: BN;
  activeLoanCount!: BN;
  marketInformation!: PublicKey;
  // collateralMap[assetIndex][durationIndex] holds the lending APY (in cBPS)
  // for that collateral/duration; u64::MAX means the slot is unset.
  collateralMap!: BN[][];
  externalYieldAccounts!: ExternalYieldAccounts;
  supplyMonitor!: CapMonitor;
  withdrawMonitor!: CapMonitor;
  borrowMonitor!: CapMonitor;

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    u8("version"),
    publicKey("nonce"),
    u8("bump"),
    publicKey("principalMint"),
    publicKey("lender"),
    u8("originationsEnabled"),
    u8("externalYieldSource"),
    array(u8(), 24, "interestPerSecond"),
    u64("lastAccruedTimestamp"),
    u64("liquidityBuffer"),
    u64("tokenBalance"),
    u64("interestFee"),
    u64("principalFee"),
    u64("originationFee"),
    u64("originationCap"),
    u64("externalYieldAmount"),
    u64("currentDeployedAmount"),
    u64("outstandingInterestAmount"),
    u64("feeClaimable"),
    u128("cumulativePrincipalOriginated"),
    u128("cumulativeInterestAccrued"),
    u64("cumulativeLoanCount"),
    u64("activeLoanCount"),
    publicKey("marketInformation"),
    array(
      array(u64(), STRATEGY_DURATION_COUNT),
      COLLATERAL_MAP_ASSET_COUNT,
      "collateralMap",
    ),
    struct(
      [publicKey("externalYieldAccount"), publicKey("externalYieldVault")],
      "externalYieldAccounts",
    ),
    capMonitorLayout("supplyMonitor"),
    capMonitorLayout("withdrawMonitor"),
    capMonitorLayout("borrowMonitor"),
  ]);

  /**
   * Returns the duration index whose collateral term for the given asset
   * matches `expectedApy`, or null if no populated slot matches.
   */
  durationIndexForApy(
    collateralAssetIndex: number,
    expectedApy: BN,
  ): number | null {
    const terms = this.collateralMap[collateralAssetIndex];
    if (!terms) {
      return null;
    }
    for (let i = 0; i < terms.length; i++) {
      if (!terms[i].eq(U64_MAX_BN) && terms[i].eq(expectedApy)) {
        return i;
      }
    }
    return null;
  }

  /** Duration indexes that have a populated collateral term for the asset. */
  populatedDurationIndexes(collateralAssetIndex: number): number[] {
    const terms = this.collateralMap[collateralAssetIndex] ?? [];
    return terms.reduce<number[]>((acc, term, i) => {
      if (!term.eq(U64_MAX_BN)) {
        acc.push(i);
      }
      return acc;
    }, []);
  }
}

//
// Loopscale Loan
//
// A loan tracks up to 5 borrow ledgers and up to 5 collateral entries, plus the
// weight/ltv/lqt matrices. As with Strategy/MarketInformation, the numeric
// fields are little-endian Pod byte arrays (`PodU64`, `PodU32`, `PodDecimal`,
// etc.) that map directly onto the matching borsh fixed-width readers.
//

export const LOOPSCALE_LOAN_LEDGER_COUNT = 5;
export const LOOPSCALE_LOAN_COLLATERAL_COUNT = 5;
const LOAN_MATRIX_DIM = 5;

// Discriminator for the Loopscale `Loan` account.
export const LOOPSCALE_LOAN_DISCRIMINATOR = Buffer.from([
  20, 195, 70, 117, 165, 227, 182, 1,
]);

export function hasLoopscaleLoanDiscriminator(data: Buffer): boolean {
  return hasLoopscaleDiscriminator(data, LOOPSCALE_LOAN_DISCRIMINATOR);
}

export interface LoopscaleLoanDuration {
  duration: number;
  durationType: number;
}

export interface LoopscaleLedger {
  status: number;
  strategy: PublicKey;
  principalMint: PublicKey;
  marketInformation: PublicKey;
  principalDue: BN;
  principalRepaid: BN;
  interestOutstanding: BN;
  lastInterestUpdatedTime: BN;
  duration: LoopscaleLoanDuration;
  interestPerSecond: number[];
  startTime: BN;
  endTime: BN;
  apy: BN;
}

export interface LoopscaleCollateral {
  assetMint: PublicKey;
  amount: BN;
  assetType: number;
  assetIdentifier: PublicKey;
}

const ledgerLayout = struct([
  u8("status"),
  publicKey("strategy"),
  publicKey("principalMint"),
  publicKey("marketInformation"),
  u64("principalDue"),
  u64("principalRepaid"),
  u64("interestOutstanding"),
  u64("lastInterestUpdatedTime"),
  struct([u32("duration"), u8("durationType")], "duration"),
  array(u8(), 24, "interestPerSecond"),
  u64("startTime"),
  u64("endTime"),
  u64("apy"),
]);

const collateralLayout = struct([
  publicKey("assetMint"),
  u64("amount"),
  u8("assetType"),
  publicKey("assetIdentifier"),
]);

export class LoopscaleLoan extends Decodable {
  discriminator!: number[];
  version!: number;
  bump!: number;
  status!: number;
  borrower!: PublicKey;
  nonce!: BN;
  startTime!: BN;
  ledgers!: LoopscaleLedger[];
  collateral!: LoopscaleCollateral[];
  weightMatrix!: number[][];
  ltvMatrix!: number[][];
  lqtMatrix!: number[][];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    u8("version"),
    u8("bump"),
    u8("status"),
    publicKey("borrower"),
    u64("nonce"),
    u64("startTime"),
    array(ledgerLayout, LOOPSCALE_LOAN_LEDGER_COUNT, "ledgers"),
    array(collateralLayout, LOOPSCALE_LOAN_COLLATERAL_COUNT, "collateral"),
    array(array(u32(), LOAN_MATRIX_DIM), LOAN_MATRIX_DIM, "weightMatrix"),
    array(array(u32(), LOAN_MATRIX_DIM), LOAN_MATRIX_DIM, "ltvMatrix"),
    array(array(u32(), LOAN_MATRIX_DIM), LOAN_MATRIX_DIM, "lqtMatrix"),
  ]);

  /** Ledgers that are not in the empty/unused (status 0) state. */
  get activeLedgers(): LoopscaleLedger[] {
    return this.ledgers.filter((ledger) => ledger.status !== 0);
  }

  /** Collateral entries that hold a non-zero amount or a set identifier. */
  get activeCollateral(): LoopscaleCollateral[] {
    return this.collateral.filter(
      (c) => !c.amount.isZero() || !c.assetIdentifier.equals(PublicKey.default),
    );
  }
}

interface CollateralCaps {
  maxAllocationPct: BN;
  currentAllocationAmount: BN;
}

export interface LoopscaleAssetData {
  assetIdentifier: PublicKey;
  quoteMint: PublicKey;
  oracleAccount: PublicKey;
  oracleType: number;
  maxUncertainty: BN;
  maxAge: BN;
  decimals: number;
  ltv: BN;
  liquidationThreshold: BN;
  collateralCaps: CollateralCaps;
}

interface PrincipalCaps {
  max1hr: BN;
  max24hr: BN;
  maxOutstanding: BN;
}

const principalCapsLayout = (property: string) =>
  struct([u64("max1hr"), u64("max24hr"), u64("maxOutstanding")], property);

export class LoopscaleMarketInformation extends Decodable {
  discriminator!: number[];
  authority!: PublicKey;
  delegate!: PublicKey;
  principalMint!: PublicKey;
  assetData!: LoopscaleAssetData[];
  borrowCaps!: PrincipalCaps;
  withdrawCaps!: PrincipalCaps;
  supplyCaps!: PrincipalCaps;
  version!: number;

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("authority"),
    publicKey("delegate"),
    publicKey("principalMint"),
    array(
      struct([
        publicKey("assetIdentifier"),
        publicKey("quoteMint"),
        publicKey("oracleAccount"),
        u8("oracleType"),
        u32("maxUncertainty"),
        u16("maxAge"),
        u8("decimals"),
        u32("ltv"),
        u32("liquidationThreshold"),
        struct(
          [u64("maxAllocationPct"), u64("currentAllocationAmount")],
          "collateralCaps",
        ),
      ]),
      MARKET_ASSET_DATA_COUNT,
      "assetData",
    ),
    principalCapsLayout("borrowCaps"),
    principalCapsLayout("withdrawCaps"),
    principalCapsLayout("supplyCaps"),
    u8("version"),
  ]);

  /** Index of `assetIdentifier` in the asset data table, or null if absent. */
  findAssetIndex(assetIdentifier: PublicKey): number | null {
    const index = this.assetData.findIndex(({ assetIdentifier: id }) =>
      id.equals(assetIdentifier),
    );
    return index === -1 ? null : index;
  }
}
