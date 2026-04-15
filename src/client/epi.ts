import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SEED_INTEGRATION_AUTHORITY,
  SEED_OBSERVATION_STATE,
} from "../constants";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";

type BufferLike32 = Uint8Array | number[] | Buffer;

export type EpiDenominationKindInput =
  | { usd: Record<string, never> }
  | { mint: Record<string, never> };

export type EpiDenominationSpecInput = {
  denom: EpiDenominationKindInput;
  mint: PublicKey;
};

export type EpiExternalPositionTypeInput =
  | { valued: Record<string, never> }
  | { tokenized: Record<string, never> };

export type EpiExternalSourceTypeInput =
  | { trusted: Record<string, never> }
  | { native: Record<string, never> };

export type EpiNativeCustodyKindInput =
  | { splToken: Record<string, never> }
  | { nativeSol: Record<string, never> };

export type UpsertExternalPositionParams = {
  positionId: BufferLike32;
  positionType: EpiExternalPositionTypeInput;
  sourceType: EpiExternalSourceTypeInput;
  denomination: EpiDenominationSpecInput;
  nativeCustodyAccount?: PublicKey;
  nativeCustodyKind?: EpiNativeCustodyKindInput;
  enabled?: boolean;
  freshnessOverrideSecs?: number;
  submitAllowlist?: PublicKey[];
  validateAllowlist?: PublicKey[];
  configureAllowlist?: PublicKey[];
};

export type SubmitExternalObservationParams = {
  positionId: BufferLike32;
  amount: BN;
  denomination: EpiDenominationSpecInput;
  observationTimestamp: BN;
  externalShares?: BN;
  reserved?: Uint8Array | number[] | Buffer;
};

function toFixedArray32(value: BufferLike32, label: string): number[] {
  const bytes = Array.from(Buffer.from(value));
  if (bytes.length !== 32) {
    throw new Error(`${label} must be exactly 32 bytes`);
  }
  return bytes;
}

function toReservedBytes(value?: Uint8Array | number[] | Buffer): number[] {
  const bytes = Array.from(Buffer.from(value || Buffer.alloc(128)));
  if (bytes.length !== 128) {
    throw new Error("reserved must be exactly 128 bytes");
  }
  return bytes;
}

class TxBuilder extends BaseTxBuilder<EpiClient> {
  async upsertExternalPositionIx(
    params: UpsertExternalPositionParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extEpiProgram.methods
      .upsertExternalPosition({
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
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async submitExternalObservationIx(
    params: SubmitExternalObservationParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extEpiProgram.methods
      .submitExternalObservation({
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
      })
      .instruction();
  }

  async validateExternalObservationIx(
    positionId: BufferLike32,
    normalizedBaseAssetAmount: BN | null,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extEpiProgram.methods
      .validateExternalObservation(
        toFixedArray32(positionId, "positionId"),
        normalizedBaseAssetAmount,
      )
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async refreshPricedProtocolIx(
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extEpiProgram.methods
      .refreshPricedProtocol()
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async submitExternalObservationTx(
    params: SubmitExternalObservationParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.submitExternalObservationIx(params, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async upsertExternalPositionTx(
    params: UpsertExternalPositionParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.upsertExternalPositionIx(params, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async validateExternalObservationTx(
    positionId: BufferLike32,
    normalizedBaseAssetAmount: BN | null,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.validateExternalObservationIx(
      positionId,
      normalizedBaseAssetAmount,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async refreshPricedProtocolTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.refreshPricedProtocolIx(txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class EpiClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getObservationStatePda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_OBSERVATION_STATE), this.base.statePda.toBuffer()],
      this.base.extEpiProgram.programId,
    )[0];
  }

  getIntegrationAuthorityPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_INTEGRATION_AUTHORITY)],
      this.base.extEpiProgram.programId,
    )[0];
  }

  async fetchObservationState() {
    return await this.base.extEpiProgram.account.observationState.fetchNullable(
      this.getObservationStatePda(),
    );
  }

  async submitExternalObservation(
    params: SubmitExternalObservationParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.submitExternalObservationTx(
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async upsertExternalPosition(
    params: UpsertExternalPositionParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.upsertExternalPositionTx(params, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async validateExternalObservation(
    positionId: BufferLike32,
    normalizedBaseAssetAmount: BN | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.validateExternalObservationTx(
      positionId,
      normalizedBaseAssetAmount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async refreshPricedProtocol(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.refreshPricedProtocolTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
