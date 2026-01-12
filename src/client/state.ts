import * as anchor from "@coral-xyz/anchor";
import {
  VersionedTransaction,
  TransactionSignature,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { CreatedModel, StateIdlModel, StateAccountType } from "../models";
import { getStatePda } from "../utils/glamPDAs";
import { charsToString } from "../utils/common";

export type InitStateParams = {
  accountType: StateAccountType;
  name: number[];
  baseAssetMint: PublicKey;
} & Partial<StateIdlModel>;

/**
 * A subset of StateIdlModel fields that are updatable using updateState instruction
 */
export type UpdateStateParams = {
  name?: number[];
  owner?: PublicKey;
  portfolioManagerName?: number[];
  timelockDuration?: number;
  assets?: PublicKey[];
  borrowable?: PublicKey[];
  reduceOnly?: boolean;
  anyLst?: boolean;
};

class TxBuilder extends BaseTxBuilder<StateClient> {
  async initializeIx(
    params: InitStateParams,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction, PublicKey]> {
    // stateInitKey = hash state name and get first 8 bytes
    // useful for re-computing state account PDA in the future
    const stateInitKey = [
      ...Buffer.from(
        anchor.utils.sha256.hash(charsToString(params.name)),
      ).subarray(0, 8),
    ];
    const created = new CreatedModel({ key: stateInitKey });
    const owner = params.owner || glamSigner;
    const statePda = getStatePda(
      stateInitKey,
      owner,
      this.client.base.protocolProgram.programId,
    );
    const uri = params.uri || `https://gui.glam.systems/products/${statePda}`;

    // create a StateIdlModel object, baseAssetMint is dropped
    const stateIdlModel = new StateIdlModel({
      ...params,
      created,
      owner,
      uri,
    });
    const ix = await this.client.base.protocolProgram.methods
      .initializeState(stateIdlModel)
      .accountsPartial({
        glamState: statePda,
        glamSigner,
        baseAssetMint: params.baseAssetMint,
      })
      .instruction();
    return [ix, statePda];
  }

  async initializeTx(
    params: InitStateParams,
    txOptions: TxOptions = {},
  ): Promise<[VersionedTransaction, PublicKey]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ix, statePda] = await this.initializeIx(params, glamSigner);
    const tx = await this.buildVersionedTx([ix], txOptions);
    return [tx, statePda];
  }

  async updateIx(
    params: UpdateStateParams,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .updateState(new StateIdlModel(params))
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
  }

  async updateTx(
    params: UpdateStateParams,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.updateIx(params, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async extendIx(
    newBytes: number,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .extendState(newBytes)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
  }

  async extendTx(
    newBytes: number,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.extendIx(newBytes, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async closeIx(glamSigner: PublicKey): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .closeState()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
  }

  async closeTx(txOptions: TxOptions = {}): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.closeIx(glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class StateClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Creates a new GLAM state
   */
  public async initialize(
    params: InitStateParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const [vTx, statePda] = await this.txBuilder.initializeTx(
      params,
      txOptions,
    );
    this.base.statePda = statePda;
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Updates the GLAM state account.
   *
   * If no timelock , the updates will be applied immediately.
   * If timelock is enabled, the updates will be staged and can be applied after the timelock period.
   *
   * Only the fields provided in `params` will be updated; omitted fields remain unchanged.
   */
  public async update(
    params: UpdateStateParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.updateTx(params, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Extends GLAM state account size
   */
  public async extend(
    newBytes: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.extendTx(newBytes, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Closes GLAM state account
   */
  public async close(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.closeTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }
}
