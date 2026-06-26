import { BN } from "@coral-xyz/anchor";
import {
  AccountMeta,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { resolveThawAccounts, buildThawPermissionlessIx } from "./mint";
import { TRANSFER_HOOK_PROGRAM, WSOL } from "../constants";
import { getAccountPolicyPda } from "../utils/glamPDAs";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { PendingRequest, RequestType } from "../models";

class TxBuilder extends BaseTxBuilder<InvestClient> {
  public async subscribeIxs(
    amount: BN,
    signer: PublicKey,
  ): Promise<TransactionInstruction[]> {
    return this.subscribeIxsForMethod(amount, signer);
  }

  public async subscribeWithRefNavIxs(
    amount: BN,
    signer: PublicKey,
    refNav: BN | null = null,
  ): Promise<TransactionInstruction[]> {
    return this.subscribeIxsForMethod(amount, signer, refNav);
  }

  private async subscribeIxsForMethod(
    amount: BN,
    signer: PublicKey,
    refNav?: BN | null,
  ): Promise<TransactionInstruction[]> {
    const { baseAssetMint: depositAsset } =
      await this.client.base.fetchStateModel();

    const mintTo = this.client.base.getMintAta(signer);
    const signerAta = this.client.base.getAta(depositAsset, signer);

    const preInstructions: TransactionInstruction[] = [];
    const postInstructions: TransactionInstruction[] = [];
    if (depositAsset.equals(WSOL)) {
      preInstructions.push(
        ...[
          createAssociatedTokenAccountIdempotentInstruction(
            signer,
            signerAta,
            signer,
            depositAsset,
          ),
          SystemProgram.transfer({
            fromPubkey: signer,
            toPubkey: signerAta,
            lamports: amount.toNumber(),
          }),
          createSyncNativeInstruction(signerAta),
        ],
      );
      postInstructions.push(
        createCloseAccountInstruction(signerAta, signer, signer),
      );
    }

    // If Token ACL is enabled, prepend create ATA + thaw for the signer
    const glamMint = this.client.base.mintPda;
    const thawPairs = await resolveThawAccounts(
      this.client.base.connection,
      glamMint,
      signer,
    );
    if (thawPairs.length > 0) {
      preInstructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          signer,
          mintTo,
          signer,
          glamMint,
          TOKEN_2022_PROGRAM_ID,
        ),
        buildThawPermissionlessIx(glamMint, signer, thawPairs, signer),
      );
    }

    // Check if lockup is enabled on the fund, if so, add signerPolicy
    let signerPolicy = null;
    if (await this.client.base.isLockupEnabled()) {
      signerPolicy = getAccountPolicyPda(mintTo);
      console.log(
        `signerPolicy: ${signerPolicy} for signer ${signer} (token account ${mintTo})`,
      );
    }

    const { tokenProgram: depositTokenProgram } =
      await fetchMintAndTokenProgram(this.client.base.connection, depositAsset);
    const method =
      refNav === undefined
        ? this.client.base.mintProgram.methods.subscribe(amount)
        : this.client.base.mintProgram.methods.subscribeWithRefNav(
            amount,
            refNav,
          );
    const ix = await method
      .accounts({
        glamState: this.client.base.statePda,
        glamMint,
        signer,
        depositAsset,
        signerPolicy,
        depositTokenProgram,
      })
      .instruction();

    return [...preInstructions, ix, ...postInstructions];
  }

  public async subscribeTx(
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.subscribeIxs(amount, signer);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async subscribeWithRefNavTx(
    amount: BN,
    txOptions: TxOptions = {},
    refNav: BN | null = null,
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.subscribeWithRefNavIxs(amount, signer, refNav);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async queuedSubscribeIxs(
    amount: BN,
    signer: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { baseAssetMint: depositAsset } =
      await this.client.base.fetchStateModel();
    const { tokenProgram: depositTokenProgram } =
      await fetchMintAndTokenProgram(this.client.base.connection, depositAsset);

    const signerDepositAta = this.client.base.getAta(
      depositAsset,
      signer,
      depositTokenProgram,
    );
    const escrowDepositAta = this.client.base.getAta(
      depositAsset,
      this.client.base.escrowPda,
      depositTokenProgram,
    );
    const preInstructions: TransactionInstruction[] = [];
    const postInstructions: TransactionInstruction[] = [];

    if (depositAsset.equals(WSOL)) {
      // Wrap SOL
      preInstructions.push(
        ...[
          createAssociatedTokenAccountIdempotentInstruction(
            signer,
            signerDepositAta,
            signer,
            depositAsset,
          ),
          SystemProgram.transfer({
            fromPubkey: signer,
            toPubkey: signerDepositAta,
            lamports: amount.toNumber(),
          }),
          createSyncNativeInstruction(signerDepositAta),
        ],
      );
      // Close WSOL ata
      postInstructions.push(
        createCloseAccountInstruction(signerDepositAta, signer, signer),
      );
    }

    const ix = await this.client.base.mintProgram.methods
      .queuedSubscribe(amount)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamEscrow: this.client.base.escrowPda,
        glamMint: this.client.base.mintPda,
        requestQueue: this.client.base.requestQueuePda,
        signer,
        depositAsset,
        signerDepositAta,
        escrowDepositAta,
        depositTokenProgram,
      })
      .instruction();

    return [...preInstructions, ix, ...postInstructions];
  }

  public async queuedSubscribeTx(
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.queuedSubscribeIxs(amount, signer);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async queuedRedeemIx(
    amount: BN,
    signer: PublicKey,
  ): Promise<TransactionInstruction> {
    const escrowPda = this.client.base.escrowPda;
    const signerMintAta = this.client.base.getMintAta(signer);
    const escrowMintAta = this.client.base.getMintAta(escrowPda);

    const remainingAccounts: PublicKey[] = [];
    if (await this.client.base.isLockupEnabled()) {
      const extraMetasAccount = this.client.base.extraMetasPda;
      const signerPolicy = getAccountPolicyPda(signerMintAta);
      const escrowPolicy = getAccountPolicyPda(escrowMintAta);
      remainingAccounts.push(
        ...[
          extraMetasAccount,
          signerPolicy,
          escrowPolicy,
          TRANSFER_HOOK_PROGRAM,
        ],
      );
    }

    return await this.client.base.mintProgram.methods
      .queuedRedeem(amount)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamEscrow: escrowPda,
        glamMint: this.client.base.mintPda,
        requestQueue: this.client.base.requestQueuePda,
        signer,
        signerMintAta,
        escrowMintAta,
        systemProgram: SystemProgram.programId,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(
        remainingAccounts.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();
  }

  public async queuedRedeemTx(
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ix = await this.queuedRedeemIx(amount, signer);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async cancelIx(
    pubkey: PublicKey | null,
    signer: PublicKey,
  ): Promise<TransactionInstruction> {
    const user = pubkey || signer;

    const pendingRequest = await this.client.fetchPendingRequest(user);
    if (!pendingRequest) {
      throw new Error("No pending request found to cancel.");
    }

    let requestType = pendingRequest.requestType as RequestType;
    let recoverTokenMint = this.client.base.mintPda;
    let recoverTokenProgram = TOKEN_2022_PROGRAM_ID;

    if (RequestType.equals(requestType, RequestType.SUBSCRIPTION)) {
      const { baseAssetMint, baseAssetTokenProgramId } =
        await this.client.base.fetchStateModel();
      recoverTokenMint = baseAssetMint;
      recoverTokenProgram = baseAssetTokenProgramId;
    }
    const userAta = this.client.base.getAta(
      recoverTokenMint,
      user,
      recoverTokenProgram,
    );
    const escrowAta = this.client.base.getAta(
      recoverTokenMint,
      this.client.base.escrowPda,
      recoverTokenProgram,
    );

    return await this.client.base.mintProgram.methods
      .cancel()
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamEscrow: this.client.base.escrowPda,
        glamMint: this.client.base.mintPda,
        requestQueue: this.client.base.requestQueuePda,
        signer,
        user,
        recoverTokenMint,
        userAta,
        escrowAta,
        systemProgram: SystemProgram.programId,
        recoverTokenProgram,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async cancelTx(
    pubkey: PublicKey | null,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ix = await this.cancelIx(pubkey, signer);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async fulfillIx(
    limit: number | null,
    signer: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.fulfillIxForMethod(limit, signer);
  }

  public async fulfillWithRefNavIx(
    limit: number | null,
    signer: PublicKey,
    refNav: BN | null = null,
  ): Promise<TransactionInstruction> {
    return this.fulfillIxForMethod(limit, signer, refNav);
  }

  private async fulfillIxForMethod(
    limit: number | null,
    signer: PublicKey,
    refNav?: BN | null,
  ): Promise<TransactionInstruction> {
    const { baseAssetMint } = await this.client.base.fetchStateModel();

    const { tokenProgram: depositTokenProgram } =
      await fetchMintAndTokenProgram(
        this.client.base.connection,
        baseAssetMint,
      );
    const method =
      refNav === undefined
        ? this.client.base.mintProgram.methods.fulfill(limit)
        : this.client.base.mintProgram.methods.fulfillWithRefNav(limit, refNav);
    return await method
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        signer,
        asset: baseAssetMint,
        depositTokenProgram,
      })
      .instruction();
  }

  public async fulfillTx(
    limit: number | null,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ix = await this.fulfillIx(limit, signer);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async fulfillWithRefNavTx(
    limit: number | null,
    txOptions: TxOptions = {},
    refNav: BN | null = null,
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ix = await this.fulfillWithRefNavIx(limit, signer, refNav);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async claimIxs(
    user: PublicKey | null,
    signer: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const claimUser = user || signer;

    const pendingRequest = await this.client.fetchPendingRequest(claimUser);
    if (!pendingRequest) {
      throw new Error("No eligible request found to claim.");
    }
    const requestType = pendingRequest.requestType as RequestType;

    let claimUserAta = null;
    let claimUserPolicy = null;
    let claimTokenMint = null;
    let claimTokenProgram = null;
    let escrowAta = null;
    const preInstructions: TransactionInstruction[] = [];
    const remainingAccounts: AccountMeta[] = [];
    const postInstructions: TransactionInstruction[] = [];

    // Claim redemption, user gets base asset back
    if (RequestType.equals(requestType, RequestType.REDEMPTION)) {
      const { baseAssetMint, baseAssetTokenProgramId } =
        await this.client.base.fetchStateModel();
      claimTokenProgram = baseAssetTokenProgramId;
      claimTokenMint = baseAssetMint;
      claimUserAta = this.client.base.getAta(
        baseAssetMint,
        claimUser,
        claimTokenProgram,
      );
      escrowAta = this.client.base.getAta(
        baseAssetMint,
        this.client.base.escrowPda,
        claimTokenProgram,
      );
      // Close wSOL ata so user gets SOL, only possible if signer is claiming for themselves
      baseAssetMint.equals(WSOL) &&
        claimUser.equals(signer) &&
        postInstructions.push(
          createCloseAccountInstruction(claimUserAta, claimUser, claimUser),
        );
    } else if (RequestType.equals(requestType, RequestType.SUBSCRIPTION)) {
      const glamMint = this.client.base.mintPda;
      claimTokenMint = glamMint;
      claimTokenProgram = TOKEN_2022_PROGRAM_ID;
      claimUserAta = this.client.base.getMintAta(claimUser);
      escrowAta = this.client.base.getMintAta(this.client.base.escrowPda);

      // If Token ACL is enabled, prepend create ATA + thaw for the claim user
      const thawPairs = await resolveThawAccounts(
        this.client.base.connection,
        glamMint,
        claimUser,
      );

      if (thawPairs.length > 0) {
        preInstructions.push(
          createAssociatedTokenAccountIdempotentInstruction(
            signer,
            claimUserAta,
            claimUser,
            glamMint,
            TOKEN_2022_PROGRAM_ID,
          ),
          buildThawPermissionlessIx(glamMint, claimUser, thawPairs, signer),
        );
      }

      if (await this.client.base.isLockupEnabled()) {
        const extraMetasAccount = this.client.base.extraMetasPda;
        const escrowPolicy = getAccountPolicyPda(escrowAta);
        claimUserPolicy = getAccountPolicyPda(claimUserAta);
        [
          extraMetasAccount,
          escrowPolicy,
          claimUserPolicy,
          TRANSFER_HOOK_PROGRAM,
        ].forEach((pubkey) =>
          remainingAccounts.push({
            pubkey,
            isSigner: false,
            isWritable: false,
          }),
        );
      }
    }

    if (!claimUserAta || !claimTokenMint || !claimTokenProgram || !escrowAta) {
      throw new Error("Missing required accounts.");
    }

    const ix = await this.client.base.mintProgram.methods
      .claim()
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamEscrow: this.client.base.escrowPda,
        glamMint: this.client.base.mintPda,
        signer,
        claimTokenMint,
        claimUser,
        claimUserAta,
        escrowAta,
        claimUserPolicy,
        claimTokenProgram,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return [...preInstructions, ix, ...postInstructions];
  }

  public async claimTx(
    user: PublicKey | null,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.claimIxs(user, signer);
    return await this.buildVersionedTx(ixs, txOptions);
  }
}

export class InvestClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  public async subscribe(
    amount: BN,
    queued: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await (queued
      ? this.txBuilder.queuedSubscribeTx(amount, txOptions)
      : this.txBuilder.subscribeTx(amount, txOptions));
    return await this.base.sendAndConfirm(tx);
  }

  public async subscribeWithRefNav(
    amount: BN,
    txOptions: TxOptions = {},
    refNav: BN | null = null,
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.subscribeWithRefNavTx(
      amount,
      txOptions,
      refNav,
    );
    return await this.base.sendAndConfirm(tx);
  }

  public async queuedRedeem(
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.queuedRedeemTx(amount, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async cancel(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelTx(null, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async cancelForUser(
    user: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelTx(user, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async fulfill(
    limit: number | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.fulfillTx(limit, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async fulfillWithRefNav(
    limit: number | null,
    txOptions: TxOptions = {},
    refNav: BN | null = null,
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.fulfillWithRefNavTx(
      limit,
      txOptions,
      refNav,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Claims the pending request for the signer.
   * @param txOptions
   * @returns
   */
  public async claim(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.claimTx(null, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async claimForUser(
    user: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.claimTx(user, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async fetchPendingRequest(
    user?: PublicKey,
  ): Promise<PendingRequest | null> {
    const queue = await this.base.fetchRequestQueue();
    if (!queue) {
      return null;
    }
    return (
      queue.data.find((r: PendingRequest) =>
        r.user.equals(user || this.base.signer),
      ) || null
    );
  }
}
