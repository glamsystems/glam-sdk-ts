import { IdlTypes, IdlAccounts } from "@coral-xyz/anchor";
import { GlamProtocol, getGlamMintProgramId } from "../glamExports";
import { PublicKey } from "@solana/web3.js";
import {
  ExtensionType,
  getExtensionData,
  getTransferHook,
  Mint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TokenMetadata, unpack } from "@solana/spl-token-metadata";
import { BN } from "@coral-xyz/anchor";
import { charsToName, nameToChars } from "../utils/common";
import { MintPolicy } from "../deser/integrationPolicies";
import { MintModel } from "./mint";
import type { RequestQueue } from "./types";
import type { IntegrationAcl, DelegateAcl } from "./acl";
import { PkSet } from "../utils";

export type StateAccount = IdlAccounts<GlamProtocol>["stateAccount"];

export type StateModelType = IdlTypes<GlamProtocol>["stateModel"];

/**
 * State model class as defined in the IDL.
 */
export class StateIdlModel implements StateModelType {
  accountType: StateAccountType | null;
  name: number[] | null;
  uri: string | null;
  enabled: boolean | null;

  assets: PublicKey[] | null;
  created: CreatedModel | null;
  owner: PublicKey | null;
  portfolioManagerName: number[] | null;

  borrowable: PublicKey[] | null;
  timelockDuration: number | null;
  integrationAcls: IntegrationAcl[] | null;
  delegateAcls: DelegateAcl[] | null;

  constructor(data: Partial<StateModelType>) {
    this.accountType = data.accountType ?? null;
    this.name = data.name ?? null;
    this.uri = data.uri ?? null;
    this.enabled = data.enabled ?? null;

    this.assets = data.assets ?? null;
    this.created = data.created ?? null;
    this.owner = data.owner ?? null;
    this.portfolioManagerName = data.portfolioManagerName ?? null;

    this.borrowable = data.borrowable ?? null;
    this.timelockDuration = data.timelockDuration ?? null;
    this.delegateAcls = data.delegateAcls ?? null;
    this.integrationAcls = data.integrationAcls ?? null;
  }
}

/**
 * Enriched state model built from multiple onchain accounts
 */
export class StateModel extends StateIdlModel {
  // Override nullable fields from StateIdlModel with non-nullable
  accountType!: StateAccountType;
  name!: number[];
  enabled!: boolean;
  assets!: PublicKey[];
  created!: CreatedModel;
  owner!: PublicKey;
  portfolioManagerName!: number[];
  timelockDuration!: number;
  integrationAcls!: IntegrationAcl[];
  delegateAcls!: DelegateAcl[];

  // Fields not available on StateIdlModel but can be derived from state account
  id!: PublicKey;
  vault!: PublicKey;
  mint: PublicKey | null;
  mintModel: MintModel | null;
  baseAssetMint!: PublicKey;
  baseAssetTokenProgram!: number;
  baseAssetDecimals!: number;
  pendingStateUpdates: any | null;
  pendingMintUpdates: any | null;
  timelockExpiresAt: number | null;
  externalPositions!: PublicKey[];
  pricedProtocols!: any[];

  constructor(data: Partial<StateModel>) {
    super(data);

    // Will be set from state params
    this.id = data.id!;
    this.vault = data.vault!;
    this.mint =
      data.mint && !data.mint.equals(PublicKey.default) ? data.mint : null;
    this.mintModel = data.mintModel ?? null;

    this.baseAssetMint = data.baseAssetMint!;
    this.baseAssetDecimals = data.baseAssetDecimals!;
    this.baseAssetTokenProgram = data.baseAssetTokenProgram!;

    this.pendingStateUpdates = data.pendingStateUpdates ?? null;
    this.pendingMintUpdates = data.pendingMintUpdates ?? null;
    this.timelockExpiresAt = data.timelockExpiresAt
      ? Number(data.timelockExpiresAt.toString())
      : null;
    this.externalPositions = data.externalPositions ?? [];
    this.pricedProtocols = data.pricedProtocols ?? [];
    this.borrowable = data.borrowable ?? null;
  }

  get idStr() {
    return this.id?.toBase58() || "";
  }

  get nameStr() {
    return this.name ? charsToName(this.name) : "";
  }

  get productType(): string {
    // @ts-ignore
    const val = Object.keys(this.accountType)[0];
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  }

  get launchDate() {
    const createdAt = this.created?.createdAt.toNumber() ?? 0;
    return new Date(createdAt * 1000).toISOString().split("T")[0] || "Unknown";
  }

  get sparkleKey() {
    const pubkey =
      (this.mint?.equals(PublicKey.default) ? this.id : this.mint) ||
      PublicKey.default;
    return pubkey.toBase58();
  }

  get baseAssetTokenProgramId() {
    switch (this.baseAssetTokenProgram) {
      case 0:
        return TOKEN_PROGRAM_ID;
      case 1:
        return TOKEN_2022_PROGRAM_ID;
      default:
        throw new Error("Invalid base asset token program");
    }
  }

  // A union set of assets and borrowable assets
  get assetsForPricing(): PublicKey[] {
    const assets = new PkSet([...this.assets, ...(this.borrowable || [])]);
    return Array.from(assets);
  }

  /**
   * Build a StateModel from onchain data
   *
   * @param stateAccount provides core fund data
   * @param openfundsMetadataAccount includes fund rawOpenfunds data and share class rawOpenfunds data
   * @param glamMint
   */
  static fromOnchainAccounts(
    statePda: PublicKey,
    stateAccount: StateAccount,
    glamMint?: Mint,
    requestQueue?: RequestQueue,
  ) {
    const stateModel: Partial<StateModel> = { id: statePda };
    Object.entries(stateAccount).forEach(([key, value]) => {
      (stateModel as any)[key] = value;
    });

    // All fields in state_params[0] should be available on the StateModel
    stateAccount.params[0].forEach((param) => {
      const name = Object.keys(param.name)[0];
      // @ts-ignore
      const value = Object.values(param.value)[0].val;
      if (new StateModel({}).hasOwnProperty(name)) {
        // @ts-ignore
        stateModel[name] = value;
      } else if (process.env.NODE_ENV === "development") {
        console.warn(`State param ${name} not found in StateModel`);
      }
    });

    // If timelock is enabled, parse pending state & mint updates from params[2] & params[3]
    stateModel.pendingStateUpdates = {};
    stateModel.pendingMintUpdates = {};
    if (stateAccount.params[2]) {
      stateAccount.params[2].forEach((param) => {
        const name = Object.keys(param.name)[0];
        // @ts-ignore
        const value = Object.values(param.value)[0].val;
        stateModel.pendingStateUpdates[name] = value;
      });
    }
    if (stateAccount.params[3]) {
      stateAccount.params[3].forEach((param) => {
        const name = Object.keys(param.name)[0];
        // @ts-ignore
        const value = Object.values(param.value)[0].val;
        stateModel.pendingMintUpdates[name] = value;
      });
    }

    // Build mint model
    if (glamMint) {
      const mintModel = {
        statePda,
        baseAssetMint: stateAccount.baseAssetMint,
      } as Partial<MintModel>;

      // Parse mint params
      stateAccount.params[1].forEach((param) => {
        const name = Object.keys(param.name)[0];
        // @ts-ignore
        const value = Object.values(param.value)[0].val;
        // @ts-ignore
        mintModel[name] = value;
      });

      // Parse token extensions
      const extMetadata = getExtensionData(
        ExtensionType.TokenMetadata,
        glamMint.tlvData,
      );
      const tokenMetadata = extMetadata
        ? unpack(extMetadata)
        : ({} as TokenMetadata);
      mintModel["symbol"] = tokenMetadata?.symbol;
      mintModel["name"] = nameToChars(tokenMetadata?.name);
      mintModel["uri"] = tokenMetadata?.uri;
      if (tokenMetadata?.additionalMetadata) {
        tokenMetadata.additionalMetadata.forEach(([k, v]) => {
          if (k === "LockupPeriodSeconds") {
            mintModel["lockupPeriod"] = parseInt(v);
          }
        });
      }

      mintModel["transferHookProgram"] =
        getTransferHook(glamMint)?.programId ?? null;

      const extPermDelegate = getExtensionData(
        ExtensionType.PermanentDelegate,
        glamMint.tlvData,
      );
      if (extPermDelegate) {
        const permanentDelegate = new PublicKey(
          extPermDelegate.subarray(0, 32),
        );
        mintModel["permanentDelegate"] = permanentDelegate;
      }
      const extDefaultState = getExtensionData(
        ExtensionType.DefaultAccountState,
        glamMint.tlvData,
      );
      if (extDefaultState) {
        mintModel["defaultAccountStateFrozen"] =
          extDefaultState.readUInt8() === 2;
      }

      // Parse mint policy
      const mintIntegrationPolicy = stateAccount.integrationAcls?.find((acl) =>
        acl.integrationProgram.equals(getGlamMintProgramId()),
      );
      const mintPolicyData = mintIntegrationPolicy?.protocolPolicies?.find(
        (policy: any) => policy.protocolBitflag === 1,
      )?.data;
      const mintPolicy = MintPolicy.decode(mintPolicyData);
      Object.entries(mintPolicy).forEach(([key, value]) => {
        (mintModel as any)[key] = value;
      });

      // Parse request queue
      if (requestQueue) {
        mintModel.subscriptionPaused = requestQueue.subscriptionPaused;
        mintModel.redemptionPaused = requestQueue.redemptionPaused;
        mintModel.pendingRequests = requestQueue.data;
      }

      // Assign mint model
      stateModel.mintModel = new MintModel(mintModel);
    }

    return new StateModel(stateModel);
  }
}

export type CreatedModelType = IdlTypes<GlamProtocol>["createdModel"];
export class CreatedModel implements CreatedModelType {
  key: number[]; // Uint8Array;
  createdBy: PublicKey;
  createdAt: BN;

  constructor(obj: Partial<CreatedModelType>) {
    this.key = obj.key!;
    this.createdBy = obj.createdBy ?? new PublicKey(0);
    this.createdAt = obj.createdAt ?? new BN(0);
  }
}

export class StateAccountType {
  static readonly VAULT = { vault: {} };
  static readonly TOKENIZED_VAULT = { tokenizedVault: {} };
  static readonly MINT = { mint: {} };

  static equals(a: StateAccountType, b: StateAccountType) {
    return Object.keys(a)[0] === Object.keys(b)[0];
  }

  static from(s: string) {
    if (s === "vault") {
      return StateAccountType.VAULT;
    }

    if (s === "tokenizedVault") {
      return StateAccountType.TOKENIZED_VAULT;
    }

    if (s === "mint") {
      return StateAccountType.MINT;
    }

    throw new Error(`Invalid state account type: ${s}`);
  }
}
