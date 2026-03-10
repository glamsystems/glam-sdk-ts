import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  StakeProgram,
  STAKE_CONFIG_ID,
  ParsedAccountData,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { STAKE_ACCOUNT_SIZE } from "../constants";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";

class TxBuilder extends BaseTxBuilder<StakeClient> {
  public async initializeAndDelegateStakeIxs(
    vote: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey]> {
    const [stakeAccount, createStakeAccountIx] =
      await this.client.createStakeAccount(glamSigner);
    const glamState = this.client.base.statePda;

    const initStakeIx = await (this.client.base.protocolProgram.methods as any)
      .stakeInitialize()
      .accounts({
        glamState,
        glamSigner,
        stake: stakeAccount,
      })
      .instruction();

    const fundStakeIx = await this.client.base.protocolProgram.methods
      .systemTransfer(amount)
      .accounts({
        glamState,
        glamSigner,
        to: stakeAccount,
      })
      .instruction();

    const ix = await (this.client.base.protocolProgram.methods as any)
      .stakeDelegateStake()
      .accounts({
        glamState,
        glamSigner,
        stake: stakeAccount,
        vote,
        stakeConfig: STAKE_CONFIG_ID,
      })
      .instruction();

    return [[createStakeAccountIx, initStakeIx, fundStakeIx, ix], stakeAccount];
  }

  public async initializeAndDelegateStakeTx(
    vote: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<[VersionedTransaction, PublicKey]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, stakeAccount] = await this.initializeAndDelegateStakeIxs(
      vote,
      amount,
      glamSigner,
    );
    const tx = await this.buildVersionedTx(ixs, txOptions);
    return [tx, stakeAccount];
  }

  public async deactivateStakesIx(
    stakeAccounts: PublicKey[],
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    if (stakeAccounts.length < 1) {
      throw new Error("At least one stake account is required");
    }

    return await (this.client.base.protocolProgram.methods as any)
      .stakeDeactivate()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        stake: stakeAccounts[0],
      })
      .remainingAccounts(
        stakeAccounts.slice(1).map((a) => ({
          pubkey: a,
          isSigner: false,
          isWritable: true,
        })),
      )
      .instruction();
  }

  public async deactivateStakesTx(
    stakeAccounts: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    if (stakeAccounts.length < 1) {
      throw new Error("At least one stake account is required");
    }
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.deactivateStakesIx(stakeAccounts, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  public async withdrawStakesIx(
    stakeAccounts: PublicKey[],
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    if (stakeAccounts.length < 1) {
      throw new Error("At least one stake account is required");
    }

    let lamports = new BN(0);
    if (stakeAccounts.length === 1) {
      const accontInfo = await this.client.base.connection.getAccountInfo(
        stakeAccounts[0],
      );
      lamports = accontInfo ? new BN(accontInfo.lamports) : new BN(0);
    }

    return await (this.client.base.protocolProgram.methods as any)
      .stakeWithdraw(lamports)
      .accounts({
        glamSigner,
        glamState: this.client.base.statePda,
        stake: stakeAccounts[0],
      })
      .remainingAccounts(
        stakeAccounts.slice(1).map((a) => ({
          pubkey: a,
          isSigner: false,
          isWritable: true,
        })),
      )
      .instruction();
  }

  public async withdrawStakesTx(
    stakeAccounts: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    if (stakeAccounts.length < 1) {
      throw new Error("At least one stake account is required");
    }

    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.withdrawStakesIx(stakeAccounts, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  public async mergeStakeIx(
    destinationStake: PublicKey,
    sourceStake: PublicKey,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await (this.client.base.protocolProgram.methods as any)
      .stakeMerge()
      .accounts({
        glamSigner,
        glamState: this.client.base.statePda,
        destinationStake,
        sourceStake,
      })
      .instruction();
  }

  public async mergeStakeTx(
    destinationStake: PublicKey,
    sourceStake: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.mergeStakeIx(
      destinationStake,
      sourceStake,
      glamSigner,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  public async splitStakeIxs(
    existingStake: PublicKey,
    lamports: BN,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey]> {
    const [newStake, createStakeAccountIx] =
      await this.client.createStakeAccount(glamSigner);

    const ix = await (this.client.base.protocolProgram.methods as any)
      .stakeSplit(lamports)
      .accounts({
        glamSigner,
        glamState: this.client.base.statePda,
        stake: existingStake,
        splitStake: newStake,
      })
      .instruction();
    return [[createStakeAccountIx, ix], newStake];
  }

  public async splitStakeTx(
    existingStake: PublicKey,
    lamports: BN,
    txOptions: TxOptions = {},
  ): Promise<[VersionedTransaction, PublicKey]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, newStake] = await this.splitStakeIxs(
      existingStake,
      lamports,
      glamSigner,
    );
    const tx = await this.buildVersionedTx(ixs, txOptions);
    return [tx, newStake];
  }

  public async moveStakeIx(
    sourceStake: PublicKey,
    destinationStake: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ) {
    return await (this.client.base.protocolProgram.methods as any)
      .stakeMove(true, amount)
      .accounts({
        glamSigner,
        glamState: this.client.base.statePda,
        sourceStake,
        destinationStake,
      })
      .instruction();
  }

  public async moveStakeTx(
    sourceStake: PublicKey,
    destinationStake: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.moveStakeIx(
      sourceStake,
      destinationStake,
      amount,
      glamSigner,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class StakeClient {
  readonly txBuilder: TxBuilder;
  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  public async initializeAndDelegateStake(
    vote: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const [tx, stakeAccount] =
      await this.txBuilder.initializeAndDelegateStakeTx(
        vote,
        amount,
        txOptions,
      );
    return await this.base.sendAndConfirm(tx);
  }

  public async deactivate(
    stakeAccounts: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.deactivateStakesTx(
      stakeAccounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  public async withdraw(
    stakeAccounts: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawStakesTx(stakeAccounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async merge(
    destinationStake: PublicKey,
    sourceStake: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.mergeStakeTx(
      destinationStake,
      sourceStake,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  public async split(
    existingStake: PublicKey,
    lamports: BN,
    txOptions: TxOptions = {},
  ): Promise<{ newStake: PublicKey; txSig: TransactionSignature }> {
    const [tx, newStake] = await this.txBuilder.splitStakeTx(
      existingStake,
      lamports,
      txOptions,
    );
    const txSig = await this.base.sendAndConfirm(tx);
    return { newStake, txSig };
  }

  public async move(
    sourceStake: PublicKey,
    destinationStake: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.moveStakeTx(
      sourceStake,
      destinationStake,
      amount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async getStakeAccountVoter(
    stakeAccount: PublicKey,
  ): Promise<PublicKey | null> {
    const connection = this.base.connection;
    const accountInfo = await connection.getParsedAccountInfo(stakeAccount);
    if (!accountInfo || !accountInfo.value) {
      console.warn("No account info found:", stakeAccount.toBase58());
      return null;
    }

    const delegation = (accountInfo.value.data as ParsedAccountData).parsed.info
      .stake?.delegation;
    if (!delegation) {
      console.warn("No delegation found:", stakeAccount.toBase58());
      return null;
    }

    const { voter } = delegation;
    return new PublicKey(voter);
  }

  async createStakeAccount(
    signer: PublicKey,
  ): Promise<[PublicKey, TransactionInstruction]> {
    const seed = Date.now().toString();
    const stakeAccount = await PublicKey.createWithSeed(
      signer,
      seed,
      StakeProgram.programId,
    );
    const lamports =
      await this.base.connection.getMinimumBalanceForRentExemption(
        STAKE_ACCOUNT_SIZE,
      );
    const createStakeAccountIx = SystemProgram.createAccountWithSeed({
      fromPubkey: signer,
      newAccountPubkey: stakeAccount,
      basePubkey: signer,
      seed,
      lamports,
      space: STAKE_ACCOUNT_SIZE,
      programId: StakeProgram.programId,
    });

    return [stakeAccount, createStakeAccountIx];
  }
}
