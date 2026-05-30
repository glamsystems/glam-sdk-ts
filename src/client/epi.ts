import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  AccountMeta,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SEED_INTEGRATION_AUTHORITY,
  SEED_OBSERVATION_STATE,
} from "../constants";
import { getGlobalConfigPda } from "../utils/glamPDAs";
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

export type ValidateExternalObservationOracleAccounts = {
  glamConfig?: PublicKey | null;
  solUsdOracle?: PublicKey | null;
  baseAssetOracle?: PublicKey | null;
  observedMintOracle?: PublicKey | null;
};

export type ValidateExternalObservationParams = {
  positionId: BufferLike32;
} & ValidateExternalObservationOracleAccounts;

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

function validateParams(
  value: BufferLike32 | ValidateExternalObservationParams,
): ValidateExternalObservationParams {
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
    paramsOrPositionId: BufferLike32 | ValidateExternalObservationParams,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const params = validateParams(paramsOrPositionId);
    const accounts =
      await this.client.resolveValidateExternalObservationAccounts(params);

    return await this.client.base.extEpiProgram.methods
      .validateExternalObservation(toFixedArray32(params.positionId, "positionId"))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamConfig: accounts.glamConfig,
        solUsdOracle: accounts.solUsdOracle,
        baseAssetOracle: accounts.baseAssetOracle,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .remainingAccounts(accounts.remainingAccounts)
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
    paramsOrPositionId: BufferLike32 | ValidateExternalObservationParams,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.validateExternalObservationIx(
      paramsOrPositionId,
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
    paramsOrPositionId: BufferLike32 | ValidateExternalObservationParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.validateExternalObservationTx(
      paramsOrPositionId,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async resolveValidateExternalObservationAccounts(
    params: ValidateExternalObservationParams,
  ): Promise<
    Required<Omit<ValidateExternalObservationOracleAccounts, "observedMintOracle">> & {
      remainingAccounts: AccountMeta[];
    }
  > {
    const overrides: ValidateExternalObservationOracleAccounts = params;
    const nullAccounts = {
      glamConfig: overrides.glamConfig ?? null,
      solUsdOracle: overrides.solUsdOracle ?? null,
      baseAssetOracle: overrides.baseAssetOracle ?? null,
      remainingAccounts: [] as AccountMeta[],
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

    const remainingAccounts: AccountMeta[] = [];
    if (isMintDenomination(pendingObservation.denomination)) {
      const observedMintOracle =
        overrides.observedMintOracle ||
        (await this.base.getAssetMeta(observedMint)).oracle;
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
    };
  }

  async refreshPricedProtocol(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.refreshPricedProtocolTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
