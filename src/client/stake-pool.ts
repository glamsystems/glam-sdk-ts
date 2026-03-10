import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  ParsedAccountData,
  TransactionInstruction,
} from "@solana/web3.js";
import { MSOL } from "../constants";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { MarinadeClient } from "./marinade";
import { getStakePoolAccount } from "@solana/spl-stake-pool";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { getStakeAccountsWithStates } from "../utils/accounts";
import { STAKE_POOLS } from "../assets";
import { StakeClient } from "./stake";

interface StakePoolAccountData {
  programId: PublicKey;
  depositAuthority: PublicKey;
  withdrawAuthority: PublicKey;
  poolMint: PublicKey;
  feeAccount: PublicKey;
  reserveStake: PublicKey;
  tokenProgramId: PublicKey;
  validatorList: PublicKey;
}

class TxBuilder extends BaseTxBuilder<StakePoolClient> {
  public async depositSolIxs(
    stakePool: PublicKey,
    lamports: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const {
      programId: stakePoolProgram,
      poolMint,
      withdrawAuthority,
      feeAccount,
      tokenProgramId: tokenProgram,
      reserveStake,
    } = await this.client.getStakePoolAccountData(stakePool);

    const glamVault = this.client.base.vaultPda;
    const glamState = this.client.base.statePda;
    const poolTokensTo = this.client.base.getVaultAta(poolMint, tokenProgram);

    console.log(`stakePool ${stakePool}, programId: ${stakePoolProgram}`);

    const preIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      poolTokensTo,
      glamVault,
      poolMint,
      tokenProgram,
    );
    const ix = await this.client.base.extStakePoolProgram.methods
      .depositSol(lamports, null)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stakePool,
        stakePoolWithdrawAuthority: withdrawAuthority,
        reserveStake,
        feeAccount,
        poolTokensTo,
        poolMint,
        tokenProgram,
      })
      .instruction();
    return [preIx, ix];
  }

  public async depositSolTx(
    stakePool: PublicKey,
    lamports: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositSolIxs(stakePool, lamports, glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async depositStakeIxs(
    stakePool: PublicKey,
    stakeAccount: PublicKey,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const {
      programId: stakePoolProgram,
      poolMint,
      depositAuthority,
      withdrawAuthority,
      feeAccount,
      validatorList,
      tokenProgramId: tokenProgram,
      reserveStake,
    } = await this.client.getStakePoolAccountData(stakePool);

    const glamVault = this.client.base.vaultPda;
    const glamState = this.client.base.statePda;
    const poolTokensTo = this.client.base.getVaultAta(poolMint, tokenProgram);

    // All stake accounts owned by the stake pool withdraw authority
    const validatorStakeCandidates = await getStakeAccountsWithStates(
      this.client.base.connection,
      withdrawAuthority,
    );

    // Find a validator stake account to use from the list of candidates.
    // The vault stake account must have the same vote address as the chosen validator stake account.
    const vote = await this.client.getStakeAccountVoter(stakeAccount);
    if (!vote) {
      throw new Error(
        "Stake account is undelegated. Cannot be deposited to the pool.",
      );
    }

    const validatorStakeAccount = validatorStakeCandidates.find(
      (s) => s.voter && s.voter.equals(vote),
    )?.address;
    if (!validatorStakeAccount) {
      throw new Error("Stake account cannot be deposited to the pool");
    }

    const preix = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      poolTokensTo,
      glamVault,
      poolMint,
      tokenProgram,
    );
    const ix = await this.client.base.extStakePoolProgram.methods
      .depositStake(null)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stakePool,
        stakePoolDepositAuthority: depositAuthority,
        stakePoolWithdrawAuthority: withdrawAuthority,
        validatorList,
        validatorStakeAccount,
        reserveStakeAccount: reserveStake,
        depositStake: stakeAccount,
        poolTokensTo,
        poolMint,
        feeAccount,
        tokenProgram,
      })
      .instruction();
    return [preix, ix];
  }

  public async depositStakeTx(
    stakePool: PublicKey,
    stakeAccount: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositStakeIxs(stakePool, stakeAccount, glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async withdrawStakeIxs(
    stakePool: PublicKey,
    amount: BN,
    deactivate: boolean = false,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey]> {
    const {
      programId: stakePoolProgram,
      poolMint,
      withdrawAuthority,
      feeAccount,
      tokenProgramId: tokenProgram,
      validatorList,
      reserveStake,
    } = await this.client.getStakePoolAccountData(stakePool);

    const poolTokensFrom = this.client.base.getVaultAta(poolMint, tokenProgram);
    const glamState = this.client.base.statePda;

    // The reserve stake account should NOT be used for withdrawals unless we have no other options.
    // And only active validator stake accounts should be used.
    const validatorStakeCandidates = (
      await getStakeAccountsWithStates(
        this.client.base.connection,
        withdrawAuthority,
      )
    ).filter((s) => !s.address.equals(reserveStake) && s.state === "active");

    const validatorStakeAccount =
      validatorStakeCandidates.length === 0
        ? reserveStake
        : validatorStakeCandidates[0].address;

    const [stakeAccount, createStakeAccountIx] =
      await this.client.stake.createStakeAccount(glamSigner);

    const postInstructions = deactivate
      ? [
          await (this.client.base.protocolProgram.methods as any)
            .stakeDeactivate()
            .accounts({
              glamSigner,
              glamState,
              stake: stakeAccount,
            })
            .instruction(),
        ]
      : [];

    const ix = await this.client.base.extStakePoolProgram.methods
      .withdrawStake(amount, null)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stake: stakeAccount,
        stakePool,
        poolMint,
        poolTokensFrom,
        validatorList,
        validatorStakeAccount,
        stakePoolWithdrawAuthority: withdrawAuthority,
        feeAccount,
        tokenProgram,
      })
      .instruction();
    return [[createStakeAccountIx, ix, ...postInstructions], stakeAccount];
  }

  public async withdrawStakeTx(
    stakePool: PublicKey,
    amount: BN,
    deactivate: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<[VersionedTransaction, PublicKey]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, stakeAccount] = await this.withdrawStakeIxs(
      stakePool,
      amount,
      deactivate,
      glamSigner,
    );
    return [await this.buildVersionedTx(ixs, txOptions), stakeAccount];
  }
}

export class StakePoolClient {
  readonly txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly stake: StakeClient,
    readonly marinade: MarinadeClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  public async unstake(
    asset: PublicKey,
    amount: number | BN,
    deactivate: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    // mSOL
    if (asset.equals(MSOL)) {
      return await this.marinade.withdrawStakeAccount(
        new BN(amount),
        deactivate,
        txOptions,
      );
    }

    // Other LSTs
    const stakePool = STAKE_POOLS.find((p) => p.mint === asset.toBase58());
    if (!stakePool) {
      throw new Error(`LST not supported: ${asset}`);
    }
    return await this.withdrawStake(
      stakePool.poolState,
      new BN(amount),
      deactivate,
      txOptions,
    );
  }

  public async depositSol(
    stakePool: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositSolTx(stakePool, amount, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async depositStake(
    stakePool: PublicKey,
    stakeAccount: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositStakeTx(
      stakePool,
      stakeAccount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  public async withdrawStake(
    stakePool: PublicKey,
    amount: BN,
    deactivate: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const [tx, _] = await this.txBuilder.withdrawStakeTx(
      stakePool,
      amount,
      deactivate,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  getStakePoolWithdrawAuthority(programId: PublicKey, stakePool: PublicKey) {
    const [publicKey] = PublicKey.findProgramAddressSync(
      [stakePool.toBuffer(), Buffer.from("withdraw")],
      programId,
    );
    return publicKey;
  }

  getStakePoolDepositAuthority(
    programId: PublicKey,
    stakePool: PublicKey,
  ): PublicKey {
    const [publicKey] = PublicKey.findProgramAddressSync(
      [stakePool.toBuffer(), Buffer.from("deposit")],
      programId,
    );
    return publicKey;
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

  async getStakePoolAccountData(
    stakePool: PublicKey,
  ): Promise<StakePoolAccountData> {
    // Get stake pool account data
    const stakePoolAccount = await getStakePoolAccount(
      this.base.connection,
      stakePool,
    );
    const stakePoolAccountData = stakePoolAccount.account.data;
    const stakePoolProgramId = stakePoolAccount.account.owner;
    const stakePoolWithdrawAuthority = this.getStakePoolWithdrawAuthority(
      stakePoolProgramId,
      stakePool,
    );
    const stakePoolDepositAuthority = this.getStakePoolDepositAuthority(
      stakePoolProgramId,
      stakePool,
    );

    return {
      programId: stakePoolProgramId,
      depositAuthority: stakePoolDepositAuthority,
      withdrawAuthority: stakePoolWithdrawAuthority,
      poolMint: stakePoolAccountData.poolMint,
      feeAccount: stakePoolAccountData.managerFeeAccount,
      reserveStake: stakePoolAccountData.reserveStake,
      tokenProgramId: stakePoolAccountData.tokenProgramId,
      validatorList: stakePoolAccountData.validatorList,
    };
  }
}
