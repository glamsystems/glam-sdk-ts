import {
  struct,
  u8,
  u32,
  u64,
  u128,
  i64,
  publicKey,
  array,
  vec,
  bool,
  f32,
} from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decodable } from "./base";

export class NtBundleAccount extends Decodable {
  discriminator!: number[];
  name!: number[];
  manager!: PublicKey;
  keeper!: PublicKey;
  treasuryAccount!: PublicKey;
  allocatedReceivers!: PublicKey[];
  bundleUnderlyingBalance!: BN;
  maxDepositAmount!: BN;
  withdrawalDelay!: BN;
  performanceFee!: number;
  managementFeeBps!: number;
  depositFee!: number;
  withdrawalFee!: number;
  managerPfeeShares!: BN;
  currentAllocationBps!: number;
  oracleBuffer!: BN;
  totalShares!: BN;
  assetPrecision!: BN;
  assetAddress!: PublicKey;
  assetDecimals!: number;
  withdrawalTMin!: BN;
  withdrawalTMax!: BN;
  withdrawalCurve!: number;
  permissionned!: boolean;
  managerMfeeShares!: BN;
  minDepositAmount!: BN;
  oracleUpdateTimeLimit!: BN;
  oracleMaxAge!: BN;
  withdrawalRedemptionRequestCutoffTs!: BN;
  withdrawalRedemptionUnlockCurrentCycleTs!: BN;
  withdrawalRedemptionUnlockNextCycleTs!: BN;
  padding!: number[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    array(u8(), 32, "name"),
    publicKey("manager"),
    publicKey("keeper"),
    publicKey("treasuryAccount"),
    vec(publicKey(), "allocatedReceivers"),
    u64("bundleUnderlyingBalance"),
    u64("maxDepositAmount"),
    u64("withdrawalDelay"),
    u32("performanceFee"),
    u32("managementFeeBps"),
    u32("depositFee"),
    u32("withdrawalFee"),
    u128("managerPfeeShares"),
    u32("currentAllocationBps"),
    u64("oracleBuffer"),
    u128("totalShares"),
    u64("assetPrecision"),
    publicKey("assetAddress"),
    u8("assetDecimals"),
    i64("withdrawalTMin"),
    i64("withdrawalTMax"),
    f32("withdrawalCurve"),
    bool("permissionned"),
    u128("managerMfeeShares"),
    u64("minDepositAmount"),
    i64("oracleUpdateTimeLimit"),
    i64("oracleMaxAge"),
    i64("withdrawalRedemptionRequestCutoffTs"),
    i64("withdrawalRedemptionUnlockCurrentCycleTs"),
    i64("withdrawalRedemptionUnlockNextCycleTs"),
    array(u8(), 207, "padding"),
  ]);
}

export class NtBundleOracleDataAccount extends Decodable {
  discriminator!: number[];
  averageExternalEquity!: BN;
  lastUpdateTime!: BN;
  padding!: number[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    u64("averageExternalEquity"),
    i64("lastUpdateTime"),
    array(u8(), 64, "padding"),
  ]);
}

export class NtBundleUserAccount extends Decodable {
  discriminator!: number[];
  owner!: PublicKey;
  lastDepositTimestamp!: BN;
  shares!: BN;
  pendingDeposit!: BN;
  pendingShares!: BN;
  estimatedPendingWithdrawalValue!: BN;

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("owner"),
    i64("lastDepositTimestamp"),
    u128("shares"),
    u64("pendingDeposit"),
    u128("pendingShares"),
    u64("estimatedPendingWithdrawalValue"),
  ]);
}
