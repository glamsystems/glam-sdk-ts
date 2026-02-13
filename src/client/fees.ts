import {
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { PriceClient } from "./price";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { getGlobalConfigPda } from "../utils/glamPDAs";

class TxBuilder extends BaseTxBuilder<FeesClient> {
  async crystallizeFeesIxs(
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const glamState = this.client.base.statePda;
    const glamMint = this.client.base.mintPda;
    const escrowPda = this.client.base.escrowPda;
    const escrowMintAta = this.client.base.getMintAta(escrowPda);

    const priceVaultIxs = await this.client.price.priceVaultIxs();
    const createEscrowShareAtaIx =
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        escrowMintAta,
        escrowPda,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      );

    const ix = await this.client.base.mintProgram.methods
      .crystallizeFees()
      .accounts({
        glamState,
        glamMint,
      })
      .instruction();
    return [...priceVaultIxs, createEscrowShareAtaIx, ix];
  }

  async crystallizeFeesTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.crystallizeFeesIxs(glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async claimFeesIxs(glamSigner: PublicKey): Promise<TransactionInstruction[]> {
    const stateModel = await this.client.base.fetchStateModel();
    const { baseAssetMint: baseAsset } = stateModel;

    // TODO: parse from glam config account
    const protocolFeeAuthority = new PublicKey(
      "9oWi2MjrAujYNTUXXNBLk1ugioaF1mJHc7EoamX4eQLZ",
    );
    const managerFeeAuthority = stateModel.owner;
    if (!managerFeeAuthority) {
      throw new Error("Manager fee authority not found");
    }

    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      baseAsset,
    );

    const protocolFeeAuthorityAta = this.client.base.getAta(
      baseAsset,
      protocolFeeAuthority,
      tokenProgram,
    );
    const managerFeeAuthorityAta = this.client.base.getAta(
      baseAsset,
      managerFeeAuthority,
      tokenProgram,
    );

    const priceVaultIxs = await this.client.price.priceVaultIxs();
    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        protocolFeeAuthorityAta,
        protocolFeeAuthority,
        baseAsset,
        tokenProgram,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        managerFeeAuthorityAta,
        managerFeeAuthority,
        baseAsset,
        tokenProgram,
      ),
      ...priceVaultIxs,
    ];
    const ix = await this.client.base.mintProgram.methods
      .claimFees()
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        protocolFeeAuthority,
        managerFeeAuthority,
        depositAsset: baseAsset,
        depositTokenProgram: tokenProgram,
      })
      .instruction();

    return [...preInstructions, ix];
  }

  async claimFeesTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.claimFeesIxs(glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async chargeProtocolFeeIxs(
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const stateModel = await this.client.base.fetchStateModel();
    const { baseAssetMint: baseAsset } = stateModel;

    // TODO: parse from glam config account
    const protocolFeeAuthority = new PublicKey(
      "9oWi2MjrAujYNTUXXNBLk1ugioaF1mJHc7EoamX4eQLZ",
    );

    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      baseAsset,
    );

    const protocolFeeAuthorityAta = this.client.base.getAta(
      baseAsset,
      protocolFeeAuthority,
      tokenProgram,
    );

    const priceVaultIxs = await this.client.price.priceVaultIxs();
    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        protocolFeeAuthorityAta,
        protocolFeeAuthority,
        baseAsset,
        tokenProgram,
      ),
      ...priceVaultIxs,
    ];

    const ix = await this.client.base.protocolProgram.methods
      .chargeProtocolFee()
      .accounts({
        glamState: this.client.base.statePda,
        protocolFeeAuthority,
        depositAsset: baseAsset,
        depositTokenProgram: tokenProgram,
      })
      .instruction();

    return [...preInstructions, ix];
  }

  async chargeProtocolFeeTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.chargeProtocolFeeIxs(glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async setProtocolFeesIx(
    baseFeeBps: number,
    flowFeeBps: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const _signer = signer || this.client.base.signer;
    return await this.client.base.mintProgram.methods
      .setProtocolFees(baseFeeBps, flowFeeBps)
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        signer: _signer,
      })
      .instruction();
  }

  async setProtocolFeesTx(
    baseFeeBps: number,
    flowFeeBps: number,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const preIxs = await this.crystallizeFeesIxs(glamSigner);
    const ix = await this.setProtocolFeesIx(baseFeeBps, flowFeeBps, glamSigner);
    return await this.buildVersionedTx([...preIxs, ix], txOptions);
  }
}

export class FeesClient {
  readonly txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly price: PriceClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Returns claimable fees object
   */
  public async getClaimableFees(): Promise<any> {
    const stateAccount = await this.base.fetchStateAccount();
    const mintParams = stateAccount.params[1];
    for (let i = 0; i < mintParams.length; i++) {
      let param = mintParams[i];
      const name = Object.keys(param.name)[0];
      // @ts-ignore
      const value = Object.values(param.value)[0].val;

      if (name === "claimableFees") {
        return value;
      }
    }

    throw new Error("Claimable fees not found");
  }

  /**
   * Returns claimed fees object
   */
  public async getClaimedFees(): Promise<any> {
    const stateAccount = await this.base.fetchStateAccount();
    const mintParams = stateAccount.params[1];
    for (let i = 0; i < mintParams.length; i++) {
      let param = mintParams[i];
      const name = Object.keys(param.name)[0];
      // @ts-ignore
      const value = Object.values(param.value)[0].val;

      if (name === "claimedFees") {
        return value;
      }
    }

    throw new Error("Claimed fees not found");
  }

  public async crystallizeFees(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.crystallizeFeesTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async claimFees(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.claimFeesTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async chargeProtocolFee(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.chargeProtocolFeeTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async setProtocolFees(
    baseFeeBps: number,
    flowFeeBps: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.setProtocolFeesTx(
      baseFeeBps,
      flowFeeBps,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }
}
