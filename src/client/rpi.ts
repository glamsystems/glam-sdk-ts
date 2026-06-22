import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  AccountMeta,
  Keypair,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SEED_INTEGRATION_AUTHORITY,
  SEED_OBSERVATION_STATE,
  SEED_WORMHOLE_HYPERLIQUID_OBSERVATION_CONFIG,
  SEED_WORMHOLE_OBSERVATION_CONFIG,
  WORMHOLE_CORE_BRIDGE_PROGRAM,
  WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
} from "../constants";
import { getGlobalConfigPda } from "../utils/glamPDAs";
import { PkSet } from "../utils";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";

type BufferLike = Uint8Array | number[] | Buffer;
type BufferLike32 = BufferLike;
type BufferLike20 = BufferLike;

export type RpiDenominationKindInput =
  | { usd: Record<string, never> }
  | { mint: Record<string, never> };

export type RpiDenominationSpecInput = {
  denom: RpiDenominationKindInput;
  mint: PublicKey;
};

export type RpiRegisteredPositionTypeInput =
  | { valued: Record<string, never> }
  | { tokenized: Record<string, never> };

export type RpiRegisteredSourceTypeInput =
  | { trusted: Record<string, never> }
  | { native: Record<string, never> }
  | { wormhole: Record<string, never> };

export type RpiNativeCustodyKindInput =
  | { splToken: Record<string, never> }
  | { nativeSol: Record<string, never> };

export type UpsertRegisteredPositionParams = {
  positionId: BufferLike32;
  positionType: RpiRegisteredPositionTypeInput;
  sourceType: RpiRegisteredSourceTypeInput;
  denomination: RpiDenominationSpecInput;
  nativeCustodyAccount?: PublicKey;
  nativeCustodyKind?: RpiNativeCustodyKindInput;
  enabled?: boolean;
  freshnessOverrideSecs?: number;
  submitAllowlist?: PublicKey[];
  validateAllowlist?: PublicKey[];
  configureAllowlist?: PublicKey[];
};

export type SubmitObservationParams = {
  positionId: BufferLike32;
  amount: BN;
  denomination: RpiDenominationSpecInput;
  observationTimestamp: BN;
  externalShares?: BN;
  reserved?: Uint8Array | number[] | Buffer;
};

export type ValidateObservationOracleAccounts = {
  glamConfig?: PublicKey | null;
  solUsdOracle?: PublicKey | null;
  baseAssetOracle?: PublicKey | null;
  observedMintOracle?: PublicKey | null;
};

export type ValidateObservationParams = {
  positionId: BufferLike32;
} & ValidateObservationOracleAccounts;

type ResolvedValidateObservationAccounts = Required<
  Omit<ValidateObservationOracleAccounts, "observedMintOracle">
> & {
  remainingAccounts: AccountMeta[];
  kaminoReservesToRefresh: PublicKey[];
};

export type WormholeObservationConfigInput = {
  positionId: BufferLike32;
  emitterChain: number;
  emitterAddress: BufferLike32;
  payloadVersion: number;
  payloadType: number;
  maxAgeSeconds: number;
};

export type WormholeHyperliquidObservationConfigInput = {
  positionId: BufferLike32;
  hyperliquidAccount: BufferLike20;
  accountMarginSummaryPrecompile: BufferLike20;
  spotBalancePrecompile: BufferLike20;
  perpDexIndex: number;
  usdcSpotToken: BN;
};

export type SubmitObservationWormholeParams = {
  positionId: BufferLike32;
  signedVaa: BufferLike;
  payloadConfigAccounts?: AccountMeta[];
  guardianSignatures?: Keypair;
  guardianSet?: PublicKey;
  wormholeCoreBridgeProgram?: PublicKey;
  wormholeVerifyVaaShimProgram?: PublicKey;
  maxSignaturesPerPost?: number;
};

export type SubmitObservationWormholeResult = {
  postSignatureTxs: TransactionSignature[];
  submitTx: TransactionSignature;
  guardianSignatures: PublicKey;
};

export type ParsedWormholeSignedVaa = {
  version: number;
  guardianSetIndex: number;
  signatures: Buffer[];
  vaaBody: Buffer;
};

const WORMHOLE_SIGNATURE_LEN = 66;
const WORMHOLE_POST_SIGNATURES_DISCRIMINATOR = Buffer.from([
  138, 2, 53, 166, 45, 77, 137, 51,
]);
const WORMHOLE_CLOSE_SIGNATURES_DISCRIMINATOR = Buffer.from([
  192, 65, 63, 117, 213, 138, 179, 190,
]);

function toFixedArray(
  value: BufferLike,
  length: number,
  label: string,
): number[] {
  const bytes = Array.from(Buffer.from(value));
  if (bytes.length !== length) {
    throw new Error(`${label} must be exactly ${length} bytes`);
  }
  return bytes;
}

function toFixedArray32(value: BufferLike32, label: string): number[] {
  return toFixedArray(value, 32, label);
}

function toFixedArray20(value: BufferLike20, label: string): number[] {
  return toFixedArray(value, 20, label);
}

function toReservedBytes(value?: Uint8Array | number[] | Buffer): number[] {
  const bytes = Array.from(Buffer.from(value || Buffer.alloc(128)));
  if (bytes.length !== 128) {
    throw new Error("reserved must be exactly 128 bytes");
  }
  return bytes;
}

function validateParams(
  value: BufferLike32 | ValidateObservationParams,
): ValidateObservationParams {
  if (
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    !(value instanceof Uint8Array) &&
    "positionId" in value
  ) {
    return value;
  }

  return { positionId: value };
}

function isUsdDenomination(denomination: any): boolean {
  return !!denomination?.denom?.usd;
}

function isMintDenomination(denomination: any): boolean {
  return !!denomination?.denom?.mint;
}

function positionIdToPubkey(positionId: number[]): PublicKey {
  return new PublicKey(Uint8Array.from(positionId));
}

export function evmAddressToBytes20(address: string): number[] {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error("EVM address must be 20 bytes");
  }
  return Array.from(Buffer.from(hex, "hex"));
}

export function evmAddressToWormholeEmitterAddress(address: string): number[] {
  return [...new Array(12).fill(0), ...evmAddressToBytes20(address)];
}

export function parseWormholeSignedVaa(
  signedVaa: BufferLike,
): ParsedWormholeSignedVaa {
  const bytes = Buffer.from(signedVaa);
  if (bytes.length < 6) {
    throw new Error("signedVaa is too short");
  }

  const version = bytes.readUInt8(0);
  if (version !== 1) {
    throw new Error(`unsupported VAA version ${version}`);
  }
  const guardianSetIndex = bytes.readUInt32BE(1);
  const signatureCount = bytes.readUInt8(5);
  if (signatureCount === 0) {
    throw new Error("signedVaa contains no guardian signatures");
  }
  const bodyOffset = 6 + signatureCount * WORMHOLE_SIGNATURE_LEN;
  if (bytes.length <= bodyOffset) {
    throw new Error("signedVaa is missing VAA body");
  }

  const signatures: Buffer[] = [];
  for (let i = 0; i < signatureCount; i++) {
    const offset = 6 + i * WORMHOLE_SIGNATURE_LEN;
    signatures.push(bytes.subarray(offset, offset + WORMHOLE_SIGNATURE_LEN));
  }

  return {
    version,
    guardianSetIndex,
    signatures,
    vaaBody: bytes.subarray(bodyOffset),
  };
}

export function getWormholeGuardianSetPda(
  guardianSetIndex: number,
  wormholeCoreBridgeProgram: PublicKey = WORMHOLE_CORE_BRIDGE_PROGRAM,
): [PublicKey, number] {
  const indexBe = Buffer.alloc(4);
  indexBe.writeUInt32BE(guardianSetIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("GuardianSet"), indexBe],
    wormholeCoreBridgeProgram,
  );
}

function encodeWormholePostSignaturesData(
  guardianSetIndex: number,
  totalSignatures: number,
  signatures: Buffer[],
): Buffer {
  if (signatures.length === 0) {
    throw new Error("at least one guardian signature is required");
  }
  if (totalSignatures > 255) {
    throw new Error("totalSignatures must fit in u8");
  }

  const data = Buffer.alloc(
    WORMHOLE_POST_SIGNATURES_DISCRIMINATOR.length +
      4 +
      1 +
      4 +
      signatures.length * WORMHOLE_SIGNATURE_LEN,
  );
  let offset = 0;
  WORMHOLE_POST_SIGNATURES_DISCRIMINATOR.copy(data, offset);
  offset += WORMHOLE_POST_SIGNATURES_DISCRIMINATOR.length;
  data.writeUInt32LE(guardianSetIndex, offset);
  offset += 4;
  data.writeUInt8(totalSignatures, offset);
  offset += 1;
  data.writeUInt32LE(signatures.length, offset);
  offset += 4;
  for (const signature of signatures) {
    if (signature.length !== WORMHOLE_SIGNATURE_LEN) {
      throw new Error("guardian signature must be exactly 66 bytes");
    }
    signature.copy(data, offset);
    offset += WORMHOLE_SIGNATURE_LEN;
  }
  return data;
}

class TxBuilder extends BaseTxBuilder<RpiClient> {
  async upsertRegisteredPositionIx(
    params: UpsertRegisteredPositionParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extRpiProgram.methods
      .upsertRegisteredPosition({
        positionId: toFixedArray32(params.positionId, "positionId"),
        positionType: params.positionType,
        sourceType: params.sourceType,
        denomination: params.denomination,
        nativeCustodyAccount: params.nativeCustodyAccount || PublicKey.default,
        nativeCustodyKind: params.nativeCustodyKind || { splToken: {} },
        enabled: params.enabled ?? true,
        freshnessOverrideSecs: params.freshnessOverrideSecs ?? 0,
        submitAllowlist: params.submitAllowlist || [],
        validateAllowlist: params.validateAllowlist || [],
        configureAllowlist: params.configureAllowlist || [],
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamVault: this.client.base.vaultPda,
        observationState: this.client.getObservationStatePda(),
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async upsertRegisteredPositionWormholeConfigIx(
    params: WormholeObservationConfigInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extRpiProgram.methods
      .upsertRegisteredPositionWormholeConfig({
        positionId: toFixedArray32(params.positionId, "positionId"),
        emitterChain: params.emitterChain,
        emitterAddress: toFixedArray32(params.emitterAddress, "emitterAddress"),
        payloadVersion: params.payloadVersion,
        payloadType: params.payloadType,
        maxAgeSeconds: params.maxAgeSeconds,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        wormholeConfig: this.client.getWormholeObservationConfigPda(
          params.positionId,
        ),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async upsertRegisteredPositionWormholeHyperliquidConfigIx(
    params: WormholeHyperliquidObservationConfigInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extRpiProgram.methods
      .upsertRegisteredPositionWormholeHyperliquidConfig({
        positionId: toFixedArray32(params.positionId, "positionId"),
        hyperliquidAccount: toFixedArray20(
          params.hyperliquidAccount,
          "hyperliquidAccount",
        ),
        accountMarginSummaryPrecompile: toFixedArray20(
          params.accountMarginSummaryPrecompile,
          "accountMarginSummaryPrecompile",
        ),
        spotBalancePrecompile: toFixedArray20(
          params.spotBalancePrecompile,
          "spotBalancePrecompile",
        ),
        perpDexIndex: params.perpDexIndex,
        usdcSpotToken: params.usdcSpotToken,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        wormholeConfig: this.client.getWormholeObservationConfigPda(
          params.positionId,
        ),
        hyperliquidConfig:
          this.client.getWormholeHyperliquidObservationConfigPda(
            params.positionId,
          ),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async submitObservationIx(
    params: SubmitObservationParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extRpiProgram.methods
      .submitObservation({
        positionId: toFixedArray32(params.positionId, "positionId"),
        amount: params.amount,
        denomination: params.denomination,
        observationTimestamp: params.observationTimestamp,
        externalShares: params.externalShares || new BN(0),
        reserved: toReservedBytes(params.reserved),
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        observationState: this.client.getObservationStatePda(),
      })
      .instruction();
  }

  wormholePostSignaturesIx(
    parsedVaa: ParsedWormholeSignedVaa,
    guardianSignatures: PublicKey,
    payer?: PublicKey,
    signatures: Buffer[] = parsedVaa.signatures,
    wormholeVerifyVaaShimProgram: PublicKey = WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
  ): TransactionInstruction {
    return new TransactionInstruction({
      programId: wormholeVerifyVaaShimProgram,
      keys: [
        {
          pubkey: payer || this.client.base.signer,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: guardianSignatures,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: encodeWormholePostSignaturesData(
        parsedVaa.guardianSetIndex,
        parsedVaa.signatures.length,
        signatures,
      ),
    });
  }

  wormholeCloseSignaturesIx(
    guardianSignatures: PublicKey,
    refundRecipient?: PublicKey,
    wormholeVerifyVaaShimProgram: PublicKey = WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
  ): TransactionInstruction {
    return new TransactionInstruction({
      programId: wormholeVerifyVaaShimProgram,
      keys: [
        {
          pubkey: guardianSignatures,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: refundRecipient || this.client.base.signer,
          isSigner: true,
          isWritable: true,
        },
      ],
      data: WORMHOLE_CLOSE_SIGNATURES_DISCRIMINATOR,
    });
  }

  async submitObservationWormholeIx(
    params: SubmitObservationWormholeParams,
    guardianSignatures: PublicKey,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const parsedVaa = parseWormholeSignedVaa(params.signedVaa);
    const [derivedGuardianSet, guardianSetBump] = getWormholeGuardianSetPda(
      parsedVaa.guardianSetIndex,
      params.wormholeCoreBridgeProgram,
    );

    const payloadConfigAccounts = params.payloadConfigAccounts || [
      {
        pubkey: this.client.getWormholeHyperliquidObservationConfigPda(
          params.positionId,
        ),
        isSigner: false,
        isWritable: false,
      },
    ];

    return await this.client.base.extRpiProgram.methods
      .submitObservationWormhole(
        toFixedArray32(params.positionId, "positionId"),
        guardianSetBump,
        parsedVaa.vaaBody,
      )
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        observationState: this.client.getObservationStatePda(),
        wormholeConfig: this.client.getWormholeObservationConfigPda(
          params.positionId,
        ),
        guardianSet: params.guardianSet || derivedGuardianSet,
        guardianSignatures,
        wormholeVerifyVaaShim:
          params.wormholeVerifyVaaShimProgram ||
          WORMHOLE_VERIFY_VAA_SHIM_PROGRAM,
      })
      .remainingAccounts(payloadConfigAccounts)
      .instruction();
  }

  async validateObservationIx(
    paramsOrPositionId: BufferLike32 | ValidateObservationParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const params = validateParams(paramsOrPositionId);
    const accounts =
      await this.client.resolveValidateObservationAccounts(params);
    return await this.validateObservationIxWithAccounts(
      params,
      accounts,
      signer,
    );
  }

  private async validateObservationIxWithAccounts(
    params: ValidateObservationParams,
    accounts: ResolvedValidateObservationAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extRpiProgram.methods
      .validateObservation(toFixedArray32(params.positionId, "positionId"))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        observationState: this.client.getObservationStatePda(),
        glamConfig: accounts.glamConfig,
        solUsdOracle: accounts.solUsdOracle,
        baseAssetOracle: accounts.baseAssetOracle,
      })
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  private async refreshKaminoReserveOracleIxs(
    reserveKeys: PublicKey[],
  ): Promise<TransactionInstruction[]> {
    if (reserveKeys.length === 0) {
      return [];
    }

    const kaminoLending = (this.client.base as any).kaminoLending;
    if (!kaminoLending) {
      throw new Error(
        "RPI validation requires Kamino reserve refresh support for KaminoReserve oracle accounts",
      );
    }

    const reserves = await kaminoLending.fetchAndParseReserves(reserveKeys);
    return [kaminoLending.txBuilder.refreshReservesBatchIx(reserves, false)];
  }

  async submitObservationTx(
    params: SubmitObservationParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.submitObservationIx(params, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async upsertRegisteredPositionTx(
    params: UpsertRegisteredPositionParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.upsertRegisteredPositionIx(params, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async removeRegisteredPositionTx(
    positionId: BufferLike32,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.client.base.extRpiProgram.methods
      .removeRegisteredPosition(toFixedArray32(positionId, "positionId"))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: txOptions.signer || this.client.base.signer,
        glamVault: this.client.base.vaultPda,
        observationState: this.client.getObservationStatePda(),
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return await this.buildVersionedTx([ix], txOptions);
  }

  async upsertRegisteredPositionWormholeConfigTx(
    params: WormholeObservationConfigInput,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.upsertRegisteredPositionWormholeConfigIx(
      params,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async upsertRegisteredPositionWormholeHyperliquidConfigTx(
    params: WormholeHyperliquidObservationConfigInput,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.upsertRegisteredPositionWormholeHyperliquidConfigIx(
      params,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async submitObservationWormholeTx(
    params: SubmitObservationWormholeParams,
    guardianSignatures: PublicKey,
    txOptions: TxOptions = {},
    closeSignatures = true,
  ): Promise<VersionedTransaction> {
    const ix = await this.submitObservationWormholeIx(
      params,
      guardianSignatures,
      txOptions.signer,
    );
    const ixs = [ix];
    if (closeSignatures) {
      ixs.push(
        this.wormholeCloseSignaturesIx(
          guardianSignatures,
          txOptions.signer,
          params.wormholeVerifyVaaShimProgram,
        ),
      );
    }
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async validateObservationTx(
    paramsOrPositionId: BufferLike32 | ValidateObservationParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const params = validateParams(paramsOrPositionId);
    const accounts =
      await this.client.resolveValidateObservationAccounts(params);
    const refreshIxs = await this.refreshKaminoReserveOracleIxs(
      accounts.kaminoReservesToRefresh,
    );
    const ix = await this.validateObservationIxWithAccounts(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], {
      ...txOptions,
      preInstructions: [...(txOptions.preInstructions || []), ...refreshIxs],
    });
  }
}

export class RpiClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getObservationStatePda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_OBSERVATION_STATE), this.base.statePda.toBuffer()],
      this.base.extRpiProgram.programId,
    )[0];
  }

  getWormholeObservationConfigPda(positionId: BufferLike32): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(SEED_WORMHOLE_OBSERVATION_CONFIG),
        this.base.statePda.toBuffer(),
        Buffer.from(toFixedArray32(positionId, "positionId")),
      ],
      this.base.extRpiProgram.programId,
    )[0];
  }

  getWormholeHyperliquidObservationConfigPda(
    positionId: BufferLike32,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(SEED_WORMHOLE_HYPERLIQUID_OBSERVATION_CONFIG),
        this.base.statePda.toBuffer(),
        Buffer.from(toFixedArray32(positionId, "positionId")),
      ],
      this.base.extRpiProgram.programId,
    )[0];
  }

  getIntegrationAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_INTEGRATION_AUTHORITY)],
      this.base.extRpiProgram.programId,
    )[0];
  }

  async fetchObservationState() {
    return await this.base.extRpiProgram.account.observationState.fetchNullable(
      this.getObservationStatePda(),
    );
  }

  async fetchWormholeObservationConfig(positionId: BufferLike32) {
    return await this.base.extRpiProgram.account.wormholeObservationConfig.fetchNullable(
      this.getWormholeObservationConfigPda(positionId),
    );
  }

  async fetchWormholeHyperliquidObservationConfig(positionId: BufferLike32) {
    return await this.base.extRpiProgram.account.wormholeHyperliquidObservationConfig.fetchNullable(
      this.getWormholeHyperliquidObservationConfigPda(positionId),
    );
  }

  async submitObservation(
    params: SubmitObservationParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.submitObservationTx(params, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async upsertRegisteredPosition(
    params: UpsertRegisteredPositionParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.upsertRegisteredPositionTx(
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async removeRegisteredPosition(
    positionId: BufferLike32,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.removeRegisteredPositionTx(
      positionId,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async upsertRegisteredPositionWormholeConfig(
    params: WormholeObservationConfigInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.upsertRegisteredPositionWormholeConfigTx(
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async upsertRegisteredPositionWormholeHyperliquidConfig(
    params: WormholeHyperliquidObservationConfigInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx =
      await this.txBuilder.upsertRegisteredPositionWormholeHyperliquidConfigTx(
        params,
        txOptions,
      );
    return await this.base.sendAndConfirm(tx);
  }

  async submitObservationWormhole(
    params: SubmitObservationWormholeParams,
    txOptions: TxOptions = {},
  ): Promise<SubmitObservationWormholeResult> {
    const parsedVaa = parseWormholeSignedVaa(params.signedVaa);
    const guardianSignatures = params.guardianSignatures || Keypair.generate();
    const maxSignaturesPerPost = params.maxSignaturesPerPost || 13;
    if (maxSignaturesPerPost <= 0) {
      throw new Error("maxSignaturesPerPost must be positive");
    }
    const postSignatureTxs: TransactionSignature[] = [];

    for (
      let offset = 0;
      offset < parsedVaa.signatures.length;
      offset += maxSignaturesPerPost
    ) {
      const chunk = parsedVaa.signatures.slice(
        offset,
        offset + maxSignaturesPerPost,
      );
      const ix = this.txBuilder.wormholePostSignaturesIx(
        parsedVaa,
        guardianSignatures.publicKey,
        txOptions.signer,
        chunk,
        params.wormholeVerifyVaaShimProgram,
      );
      const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
      postSignatureTxs.push(
        await this.base.sendAndConfirm(tx, [guardianSignatures]),
      );
    }

    const submitTx = await this.txBuilder.submitObservationWormholeTx(
      params,
      guardianSignatures.publicKey,
      txOptions,
      true,
    );
    const submitTxSig = await this.base.sendAndConfirm(submitTx);

    return {
      postSignatureTxs,
      submitTx: submitTxSig,
      guardianSignatures: guardianSignatures.publicKey,
    };
  }

  async validateObservation(
    paramsOrPositionId: BufferLike32 | ValidateObservationParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.validateObservationTx(
      paramsOrPositionId,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async resolveValidateObservationAccounts(
    params: ValidateObservationParams,
  ): Promise<ResolvedValidateObservationAccounts> {
    const overrides: ValidateObservationOracleAccounts = params;
    const nullAccounts = {
      glamConfig: overrides.glamConfig ?? null,
      solUsdOracle: overrides.solUsdOracle ?? null,
      baseAssetOracle: overrides.baseAssetOracle ?? null,
      remainingAccounts: [] as AccountMeta[],
      kaminoReservesToRefresh: [] as PublicKey[],
    };
    const kaminoReservesToRefresh = new PkSet();
    const addKaminoReserveToRefresh = (assetMeta?: {
      oracle?: PublicKey;
      oracleSource?: string;
    }) => {
      if (assetMeta?.oracleSource === "KaminoReserve" && assetMeta.oracle) {
        kaminoReservesToRefresh.add(assetMeta.oracle);
      }
    };

    const observationState = await this.fetchObservationState();
    const positionId = toFixedArray32(params.positionId, "positionId");
    const positionObservation = observationState?.positions
      .slice(0, observationState.positionsLen)
      .find((candidate: any) =>
        positionIdToPubkey(candidate.positionId).equals(
          positionIdToPubkey(positionId),
        ),
      );

    const pendingObservation = positionObservation?.hasPending
      ? positionObservation.pendingObservation
      : null;

    if (!pendingObservation) {
      return nullAccounts;
    }

    const stateAccount = await this.base.fetchStateAccount();
    const observedMint = pendingObservation.denomination.mint as PublicKey;
    const isBaseMintObservation =
      isMintDenomination(pendingObservation.denomination) &&
      observedMint.equals(stateAccount.baseAssetMint);

    if (isBaseMintObservation) {
      return nullAccounts;
    }

    const [solUsdOracle, baseAssetMeta] = await Promise.all([
      overrides.solUsdOracle
        ? Promise.resolve(overrides.solUsdOracle)
        : this.base.getSolOracle(),
      overrides.baseAssetOracle
        ? Promise.resolve({ oracle: overrides.baseAssetOracle })
        : this.base.getAssetMeta(stateAccount.baseAssetMint),
    ]);
    addKaminoReserveToRefresh(baseAssetMeta);

    const remainingAccounts: AccountMeta[] = [];
    if (isMintDenomination(pendingObservation.denomination)) {
      let observedMintOracle = overrides.observedMintOracle;
      if (!observedMintOracle) {
        const observedMintMeta = await this.base.getAssetMeta(observedMint);
        addKaminoReserveToRefresh(observedMintMeta);
        observedMintOracle = observedMintMeta.oracle;
      }
      remainingAccounts.push({
        pubkey: observedMintOracle,
        isSigner: false,
        isWritable: false,
      });
    } else if (!isUsdDenomination(pendingObservation.denomination)) {
      return nullAccounts;
    }

    return {
      glamConfig: overrides.glamConfig ?? getGlobalConfigPda(),
      solUsdOracle,
      baseAssetOracle: baseAssetMeta.oracle,
      remainingAccounts,
      kaminoReservesToRefresh: Array.from(kaminoReservesToRefresh),
    };
  }
}
