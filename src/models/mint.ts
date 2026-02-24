import { IdlTypes } from "@coral-xyz/anchor";
import { GlamProtocol, GlamMint } from "../glamExports";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { charsToString } from "../utils/common";

export type FeeStructure = IdlTypes<GlamProtocol>["feeStructure"];
export type FeeParams = IdlTypes<GlamProtocol>["feeParams"];
export type AccruedFees = IdlTypes<GlamProtocol>["accruedFees"];
export type NotifyAndSettle = IdlTypes<GlamProtocol>["notifyAndSettle"];

export type MintModelType = IdlTypes<GlamProtocol>["mintModel"];
export class MintIdlModel implements MintModelType {
  symbol: string | null;
  name: number[] | null;
  uri: string | null;

  yearInSeconds: number | null;
  permanentDelegate: PublicKey | null;
  defaultAccountStateFrozen: boolean | null;
  feeStructure: FeeStructure | null;
  notifyAndSettle: NotifyAndSettle | null;

  lockupPeriod: number | null;
  maxCap: BN | null;
  minSubscription: BN | null;
  minRedemption: BN | null;
  maxSubscription: BN | null;
  maxRedemption: BN | null;
  allowlist: PublicKey[] | null;
  blocklist: PublicKey[] | null;

  constructor(data: Partial<MintModelType>) {
    this.symbol = data.symbol ?? null;
    this.name = data.name ?? null;
    this.uri = data.uri ?? null;

    this.yearInSeconds = data.yearInSeconds ?? null;
    this.permanentDelegate = data.permanentDelegate ?? null;
    this.defaultAccountStateFrozen = data.defaultAccountStateFrozen ?? null;
    this.feeStructure = data.feeStructure ?? null;
    this.notifyAndSettle = data.notifyAndSettle ?? null;

    this.lockupPeriod = data.lockupPeriod ?? null;
    this.maxCap = data.maxCap ?? null;
    this.minSubscription = data.minSubscription ?? null;
    this.minRedemption = data.minRedemption ?? null;
    this.maxSubscription = data.maxSubscription ?? null;
    this.maxRedemption = data.maxRedemption ?? null;
    this.allowlist = data.allowlist ?? null;
    this.blocklist = data.blocklist ?? null;
  }
}

export class MintModel extends MintIdlModel {
  statePda: PublicKey | null;
  baseAssetMint: PublicKey | null;
  transferHookProgram: PublicKey | null;
  claimableFees: AccruedFees | null;
  claimedFees: AccruedFees | null;
  feeParams: FeeParams | null;
  subscriptionPaused: boolean | null;
  redemptionPaused: boolean | null;
  pendingRequests: any[] | null;

  constructor(data: Partial<MintModel>) {
    super(data);
    this.statePda = data.statePda ?? null;
    this.baseAssetMint = data.baseAssetMint ?? null;
    this.transferHookProgram = data.transferHookProgram ?? null;
    this.claimableFees = data.claimableFees ?? null;
    this.claimedFees = data.claimedFees ?? null;
    this.feeParams = data.feeParams ?? null;
    this.subscriptionPaused = data.subscriptionPaused ?? null;
    this.redemptionPaused = data.redemptionPaused ?? null;
    this.pendingRequests = data.pendingRequests ?? null;
  }

  get nameStr() {
    return this.name ? charsToString(this.name) : "";
  }
}

export type EmergencyUpdateMintArgsType =
  IdlTypes<GlamMint>["emergencyUpdateMintArgs"];
export class EmergencyUpdateMintArgs implements EmergencyUpdateMintArgsType {
  requestType!: RequestType;
  setPaused!: boolean;
}

export class RequestType {
  static readonly SUBSCRIPTION = { subscription: {} };
  static readonly REDEMPTION = { redemption: {} };

  static equals(a: RequestType, b: RequestType) {
    return Object.keys(a)[0] === Object.keys(b)[0];
  }

  static fromInt(int: number) {
    switch (int) {
      case 0:
        return RequestType.SUBSCRIPTION;
      case 1:
        return RequestType.REDEMPTION;
      default:
        throw new Error("Invalid request type");
    }
  }
}

export type OracleConfigsType = IdlTypes<GlamProtocol>["oracleConfigs"];
export class OracleConfigs implements OracleConfigsType {
  padding: number[]; // 12 bytes padding

  constructor(readonly maxAgesSeconds: number[][]) {
    this.padding = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
}
