import {
  array,
  bool,
  f64,
  publicKey,
  struct,
  u8,
  u16,
  u32,
  u64,
  vec,
} from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decodable } from "./base";

type OffsetableLayout = ReturnType<typeof struct> & {
  offsetOf(property: string): number | undefined;
};

function offsetOf(layout: ReturnType<typeof struct>, property: string): number {
  const offset = (layout as OffsetableLayout).offsetOf(property);
  if (offset === undefined || offset < 0) {
    throw new Error(`Unable to derive layout offset for ${property}`);
  }
  return offset;
}

function hasDiscriminator(data: Buffer, discriminator: Buffer): boolean {
  return data.subarray(0, discriminator.length).equals(discriminator);
}

const exponentNumber = (property?: string) =>
  struct([array(u64(), 4, "words")], property);

const marketFinancials = struct(
  [
    u64("expirationTs"),
    u64("ptBalance"),
    u64("syBalance"),
    f64("lnFeeRateRoot"),
    f64("lastLnImpliedRate"),
    f64("rateScalarRoot"),
  ],
  "financials",
);

const marketEmission = struct([
  publicKey("tokenEscrow"),
  exponentNumber("lpShareIndex"),
  u64("lastSeenStaged"),
]);

const farmEmission = struct([
  publicKey("mint"),
  u64("tokenRate"),
  u32("expiryTimestamp"),
  exponentNumber("index"),
]);

const marketEmissions = struct([vec(marketEmission, "trackers")], "emissions");

const lpFarm = struct(
  [u32("lastSeenTimestamp"), vec(farmEmission, "farmEmissions")],
  "lpFarm",
);

const cpiInterfaceContext = struct([
  u8("altIndex"),
  bool("isSigner"),
  bool("isWritable"),
]);

const cpiAccounts = struct(
  [
    vec(cpiInterfaceContext, "getSyState"),
    vec(cpiInterfaceContext, "depositSy"),
    vec(cpiInterfaceContext, "withdrawSy"),
    vec(vec(cpiInterfaceContext), "claimEmission"),
    vec(cpiInterfaceContext, "getPositionState"),
  ],
  "cpiAccounts",
);

const liquidityNetBalanceLimits = struct(
  [
    u32("windowStartTimestamp"),
    u64("windowStartNetBalance"),
    u16("maxNetBalanceChangeNegativePercentage"),
    u32("maxNetBalanceChangePositivePercentage"),
    u32("windowDurationSeconds"),
  ],
  "liquidityNetBalanceLimits",
);

const emissionInfo = struct([
  publicKey("tokenAccount"),
  exponentNumber("initialIndex"),
  exponentNumber("lastSeenIndex"),
  exponentNumber("finalIndex"),
  publicKey("treasuryTokenAccount"),
  u16("feeBps"),
  u64("treasuryEmission"),
]);

const claimLimits = struct(
  [
    u32("claimWindowStartTimestamp"),
    u64("totalClaimAmountInWindow"),
    u64("maxClaimAmountPerWindow"),
    u32("claimWindowDurationSeconds"),
  ],
  "claimLimits",
);

const EXPONENT_MARKET_TWO_LAYOUT = struct(
  [
    array(u8(), 8, "discriminator"),
    publicKey("addressLookupTable"),
    publicKey("mintPt"),
    publicKey("mintSy"),
    publicKey("vault"),
    publicKey("mintLp"),
    publicKey("tokenLpEscrow"),
    publicKey("tokenPtEscrow"),
    publicKey("tokenSyEscrow"),
    publicKey("tokenFeeTreasurySy"),
    u16("feeTreasurySyBps"),
    publicKey("selfAddress"),
    u8("signerBump"),
    u8("statusFlags"),
    publicKey("syProgram"),
    marketFinancials,
    marketEmissions,
    lpFarm,
    u64("maxLpSupply"),
    u64("lpEscrowAmount"),
    cpiAccounts,
    bool("isCurrentFlashSwap"),
    liquidityNetBalanceLimits,
    u8("seedId"),
  ],
  undefined,
  true,
);

const EXPONENT_VAULT_LAYOUT = struct(
  [
    array(u8(), 8, "discriminator"),
    publicKey("syProgram"),
    publicKey("mintSy"),
    publicKey("mintYt"),
    publicKey("mintPt"),
    publicKey("escrowYt"),
    publicKey("escrowSy"),
    publicKey("yieldPosition"),
    publicKey("addressLookupTable"),
    u32("startTs"),
    u32("duration"),
    publicKey("signerSeed"),
    publicKey("authority"),
    u8("signerBump"),
    exponentNumber("lastSeenSyExchangeRate"),
    exponentNumber("allTimeHighSyExchangeRate"),
    exponentNumber("finalSyExchangeRate"),
    u64("totalSyInEscrow"),
    u64("syForPt"),
    u64("ptSupply"),
    u64("treasurySy"),
    u64("uncollectedSy"),
    publicKey("treasurySyTokenAccount"),
    u16("interestBpsFee"),
    u64("minOpSizeStrip"),
    u64("minOpSizeMerge"),
    u8("status"),
    vec(emissionInfo, "emissions"),
    cpiAccounts,
    claimLimits,
    u64("maxPySupply"),
  ],
  undefined,
  true,
);

const EXPONENT_GENERIC_SY_STATE_LAYOUT = struct(
  [
    array(u8(), 129, "prefixPadding"),
    publicKey("yieldBearingMint"),
    array(u8(), 179, "middlePadding"),
    publicKey("oracle"),
  ],
  undefined,
  true,
);

export const EXPONENT_MARKET_TWO_DISCRIMINATOR = Buffer.from([
  212, 4, 132, 126, 169, 121, 121, 20,
]);
export const EXPONENT_VAULT_DISCRIMINATOR = Buffer.from([
  211, 8, 232, 43, 2, 152, 117, 119,
]);

export interface ExponentNumber {
  words: BN[];
}

export interface ExponentMarketFinancials {
  expirationTs: BN;
  ptBalance: BN;
  syBalance: BN;
  lnFeeRateRoot: number;
  lastLnImpliedRate: number;
  rateScalarRoot: number;
}

export interface ExponentMarketEmission {
  tokenEscrow: PublicKey;
  lpShareIndex: ExponentNumber;
  lastSeenStaged: BN;
}

export interface ExponentFarmEmission {
  mint: PublicKey;
  tokenRate: BN;
  expiryTimestamp: number;
  index: ExponentNumber;
}

export interface ExponentMarketEmissions {
  trackers: ExponentMarketEmission[];
}

export interface ExponentLpFarm {
  lastSeenTimestamp: number;
  farmEmissions: ExponentFarmEmission[];
}

export interface ExponentCpiInterfaceContext {
  altIndex: number;
  isSigner: boolean;
  isWritable: boolean;
}

export interface ExponentCpiAccounts {
  getSyState: ExponentCpiInterfaceContext[];
  depositSy: ExponentCpiInterfaceContext[];
  withdrawSy: ExponentCpiInterfaceContext[];
  claimEmission: ExponentCpiInterfaceContext[][];
  getPositionState: ExponentCpiInterfaceContext[];
}

export interface ExponentLiquidityNetBalanceLimits {
  windowStartTimestamp: number;
  windowStartNetBalance: BN;
  maxNetBalanceChangeNegativePercentage: number;
  maxNetBalanceChangePositivePercentage: number;
  windowDurationSeconds: number;
}

export interface ExponentEmissionInfo {
  tokenAccount: PublicKey;
  initialIndex: ExponentNumber;
  lastSeenIndex: ExponentNumber;
  finalIndex: ExponentNumber;
  treasuryTokenAccount: PublicKey;
  feeBps: number;
  treasuryEmission: BN;
}

export interface ExponentClaimLimits {
  claimWindowStartTimestamp: number;
  totalClaimAmountInWindow: BN;
  maxClaimAmountPerWindow: BN;
  claimWindowDurationSeconds: number;
}

export class ExponentMarketTwo extends Decodable {
  discriminator!: number[];
  addressLookupTable!: PublicKey;
  mintPt!: PublicKey;
  mintSy!: PublicKey;
  vault!: PublicKey;
  mintLp!: PublicKey;
  tokenLpEscrow!: PublicKey;
  tokenPtEscrow!: PublicKey;
  tokenSyEscrow!: PublicKey;
  tokenFeeTreasurySy!: PublicKey;
  feeTreasurySyBps!: number;
  selfAddress!: PublicKey;
  signerBump!: number;
  statusFlags!: number;
  syProgram!: PublicKey;
  financials!: ExponentMarketFinancials;
  emissions!: ExponentMarketEmissions;
  lpFarm!: ExponentLpFarm;
  maxLpSupply!: BN;
  lpEscrowAmount!: BN;
  cpiAccounts!: ExponentCpiAccounts;
  isCurrentFlashSwap!: boolean;
  liquidityNetBalanceLimits!: ExponentLiquidityNetBalanceLimits;
  seedId!: number;

  static _layout = EXPONENT_MARKET_TWO_LAYOUT;
  static discriminator = EXPONENT_MARKET_TWO_DISCRIMINATOR;
  static fixedDataLength = offsetOf(EXPONENT_MARKET_TWO_LAYOUT, "emissions");

  static offsetOf(property: string): number {
    return offsetOf(EXPONENT_MARKET_TWO_LAYOUT, property);
  }

  static hasDiscriminator(data: Buffer): boolean {
    return hasDiscriminator(data, EXPONENT_MARKET_TWO_DISCRIMINATOR);
  }

  get pubkey(): PublicKey {
    return this.getAddress();
  }

  get expirationTs(): string {
    return this.financials.expirationTs.toString();
  }

  get ptBalance(): string {
    return this.financials.ptBalance.toString();
  }

  get syBalance(): string {
    return this.financials.syBalance.toString();
  }

  get lnFeeRateRoot(): number {
    return this.financials.lnFeeRateRoot;
  }

  get lastLnImpliedRate(): number {
    return this.financials.lastLnImpliedRate;
  }

  get rateScalarRoot(): number {
    return this.financials.rateScalarRoot;
  }
}

export class ExponentVault extends Decodable {
  discriminator!: number[];
  syProgram!: PublicKey;
  mintSy!: PublicKey;
  mintYt!: PublicKey;
  mintPt!: PublicKey;
  escrowYt!: PublicKey;
  escrowSy!: PublicKey;
  yieldPosition!: PublicKey;
  addressLookupTable!: PublicKey;
  startTs!: number;
  duration!: number;
  signerSeed!: PublicKey;
  authority!: PublicKey;
  signerBump!: number;
  lastSeenSyExchangeRate!: ExponentNumber;
  allTimeHighSyExchangeRate!: ExponentNumber;
  finalSyExchangeRate!: ExponentNumber;
  totalSyInEscrow!: BN;
  syForPt!: BN;
  ptSupply!: BN;
  treasurySy!: BN;
  uncollectedSy!: BN;
  treasurySyTokenAccount!: PublicKey;
  interestBpsFee!: number;
  minOpSizeStrip!: BN;
  minOpSizeMerge!: BN;
  status!: number;
  emissions!: ExponentEmissionInfo[];
  cpiAccounts!: ExponentCpiAccounts;
  claimLimits!: ExponentClaimLimits;
  maxPySupply!: BN;

  static _layout = EXPONENT_VAULT_LAYOUT;
  static discriminator = EXPONENT_VAULT_DISCRIMINATOR;
  static fixedDataLength = offsetOf(EXPONENT_VAULT_LAYOUT, "emissions");

  static offsetOf(property: string): number {
    return offsetOf(EXPONENT_VAULT_LAYOUT, property);
  }

  static hasDiscriminator(data: Buffer): boolean {
    return hasDiscriminator(data, EXPONENT_VAULT_DISCRIMINATOR);
  }

  get pubkey(): PublicKey {
    return this.getAddress();
  }
}

export class ExponentGenericSyState extends Decodable {
  prefixPadding!: number[];
  yieldBearingMint!: PublicKey;
  middlePadding!: number[];
  oracle!: PublicKey;

  static _layout = EXPONENT_GENERIC_SY_STATE_LAYOUT;
  static fixedDataLength = EXPONENT_GENERIC_SY_STATE_LAYOUT.span;

  static offsetOf(property: string): number {
    return offsetOf(EXPONENT_GENERIC_SY_STATE_LAYOUT, property);
  }
}
