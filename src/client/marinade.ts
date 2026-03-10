import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  ParsedAccountData,
  TransactionSignature,
  StakeProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Marinade,
  MarinadeConfig,
  MarinadeState,
} from "@marinade.finance/marinade-ts-sdk";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { MARINADE_NATIVE_STAKE_AUTHORITY, MSOL } from "../constants";
import {
  getStakeAccountsWithStates,
  StakeAccountInfo,
} from "../utils/accounts";
import { ClusterNetwork } from "../clientConfig";
import { StakeClient } from "./stake";

export type Ticket = {
  address: PublicKey; // offset 8 after anchor discriminator
  lamports: number;
  createdEpoch: number;
  isDue: boolean;
  isClaimable: boolean; // >30min since the start of the current epoch
};

class TxBuilder extends BaseTxBuilder<MarinadeClient> {
  public async depositIxs(
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const marinadeState = await this.client.fetchMarinadeState();
    const { mSolMintAddress, marinadeStateAddress } = marinadeState;
    const vaultMsolAta = this.client.base.getVaultAta(mSolMintAddress);

    const vault = this.client.base.vaultPda;
    const createMsolAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      vaultMsolAta,
      vault,
      mSolMintAddress,
    );

    const [
      liqPoolSolLegPda,
      liqPoolMsolLegAuthority,
      reservePda,
      msolMintAuthority,
    ] = await Promise.all([
      marinadeState.solLeg(),
      marinadeState.mSolLegAuthority(),
      marinadeState.reserveAddress(),
      marinadeState.mSolMintAuthority(),
    ]);
    const ix = await this.client.base.extMarinadeProgram.methods
      .deposit(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        state: marinadeStateAddress,
        msolMint: mSolMintAddress,
        liqPoolSolLegPda,
        liqPoolMsolLeg: marinadeState.mSolLeg,
        liqPoolMsolLegAuthority,
        reservePda,
        mintTo: vaultMsolAta,
        msolMintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    return [createMsolAtaIx, ix];
  }

  public async depositTx(
    amount: BN,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositIxs(amount, glamSigner);
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async depositNativeIxs(
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    // Create and fund the stake account
    const [stakeAccount, createStakeAccountIx] =
      await this.client.stake.createStakeAccount(glamSigner);
    const initStakeIx = await (this.client.base.protocolProgram.methods as any)
      .stakeInitialize()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        stake: stakeAccount,
      })
      .instruction();
    const fundStakeIx = await this.client.base.protocolProgram.methods
      .systemTransfer(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        to: stakeAccount,
      })
      .instruction();

    // Then set stake authority to the marinade key
    const ix = await (this.client.base.protocolProgram.methods as any)
      .stakeAuthorize(MARINADE_NATIVE_STAKE_AUTHORITY, 0)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        stake: stakeAccount,
      })
      .instruction();
    return [createStakeAccountIx, initStakeIx, fundStakeIx, ix];
  }

  public async depositNativeTx(amount: BN, txOptions: TxOptions): Promise<any> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositNativeIxs(amount, glamSigner);
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async depositStakeAccountIx(
    stakeAccount: PublicKey,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    const stakeAccountInfo =
      await this.client.getParsedStakeAccountInfo(stakeAccount);

    const marinadeState = await this.client.fetchMarinadeState();
    const { validatorRecords } = await marinadeState.getValidatorRecords();
    const validatorLookupIndex = validatorRecords.findIndex(
      ({ validatorAccount }) => validatorAccount.equals(stakeAccountInfo.voter),
    );
    const validatorIndex =
      validatorLookupIndex === -1
        ? marinadeState.state.validatorSystem.validatorList.count
        : validatorLookupIndex;

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(
      stakeAccountInfo.voter,
    );

    return await this.client.base.extMarinadeProgram.methods
      .depositStakeAccount(validatorIndex)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        state: marinadeState.marinadeStateAddress,
        validatorList:
          marinadeState.state.validatorSystem.validatorList.account,
        stakeList: marinadeState.state.stakeSystem.stakeList.account,
        stakeAccount,
        duplicationFlag,
        msolMint: MSOL,
        msolMintAuthority: await marinadeState.mSolMintAuthority(),
        mintTo: this.client.base.getVaultAta(MSOL),
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeProgram: StakeProgram.programId,
      })
      .instruction();
  }

  public async depositStakeAccountTx(
    stakeAccount: PublicKey,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.depositStakeAccountIx(stakeAccount, glamSigner);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async withdrawStakeAccountIxs(
    amount: BN,
    deactivate: boolean = false,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], Keypair]> {
    const marinadeState = await this.client.fetchMarinadeState();

    // Get mariande stake withdraw authority
    const stakeWithdrawAuthority = await marinadeState.stakeWithdrawAuthority();
    const stakeDepositAuthority = await marinadeState.stakeDepositAuthority();
    const stakeList = marinadeState.state.stakeSystem.stakeList;
    const validatorList = marinadeState.state.validatorSystem.validatorList;

    // Fetch stake accounts by withdraw authority
    // Filter by state "active" does not work in localnet tests
    const stakeAccounts = await getStakeAccountsWithStates(
      this.client.base.connection,
      stakeWithdrawAuthority,
    );

    const idx =
      this.client.base.cluster === ClusterNetwork.Mainnet
        ? stakeAccounts.findIndex((s) => s.state === "active")
        : 0;

    const { stakeIndex, validatorIndex } = await this.client.getIndexes(
      stakeAccounts[idx],
      stakeList,
      validatorList,
    );

    const burnMsolFrom = this.client.base.getVaultAta(MSOL);
    const newStake = Keypair.generate();

    const postInstructions = deactivate
      ? [
          await (this.client.base.protocolProgram.methods as any)
            .stakeDeactivate()
            .accounts({
              glamSigner,
              glamState: this.client.base.statePda,
              stake: newStake.publicKey,
            })
            .instruction(),
        ]
      : [];

    const ix = await this.client.base.extMarinadeProgram.methods
      .withdrawStakeAccount(
        stakeIndex,
        validatorIndex,
        amount,
        this.client.base.vaultPda,
      )
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        state: marinadeState.marinadeStateAddress,
        validatorList: validatorList.account,
        stakeList: stakeList.account,
        stakeAccount: stakeAccounts[idx].address,
        stakeWithdrawAuthority,
        stakeDepositAuthority,
        treasuryMsolAccount: marinadeState.treasuryMsolAccount,
        msolMint: MSOL,
        burnMsolFrom,
        splitStakeAccount: newStake.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeProgram: StakeProgram.programId,
      })
      .instruction();

    return [[ix, ...postInstructions], newStake];
  }

  public async withdrawStakeAccountTx(
    amount: BN,
    deactivate: boolean = false,
    txOptions: TxOptions,
  ): Promise<[VersionedTransaction, Keypair]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, newStake] = await this.withdrawStakeAccountIxs(
      amount,
      deactivate,
      glamSigner,
    );
    const tx = await this.buildVersionedTx(ixs, txOptions);
    return [tx, newStake];
  }
}

export class MarinadeClient {
  private marinadeState: MarinadeState | null = null;
  txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly stake: StakeClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  public async deposit(
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositTx(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async depositNative(
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositNativeTx(amount, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async depositStakeAccount(
    stakeAccount: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositStakeAccountTx(
      stakeAccount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  public async withdrawStakeAccount(
    amount: BN,
    deactivate: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const [tx, extraSigner] = await this.txBuilder.withdrawStakeAccountTx(
      amount,
      deactivate,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx, [extraSigner]);
  }

  async fetchMarinadeState(): Promise<MarinadeState> {
    if (!this.marinadeState) {
      const marinade = new Marinade(
        new MarinadeConfig({
          connection: this.base.connection,
        }),
      );
      this.marinadeState = await marinade.getMarinadeState();
    }
    return this.marinadeState;
  }

  async getParsedStakeAccountInfo(stakeAccount: PublicKey): Promise<any> {
    const { value: stakeAccountInfo } =
      await this.base.connection.getParsedAccountInfo(stakeAccount);
    if (!stakeAccountInfo) {
      throw new Error(
        `Failed to find the stake account ${stakeAccount.toBase58()}`,
      );
    }

    if (!stakeAccountInfo.owner.equals(StakeProgram.programId)) {
      throw new Error(
        `${stakeAccount.toBase58()} is not a stake account because owner is ${
          stakeAccountInfo.owner
        }`,
      );
    }

    const parsedData = stakeAccountInfo?.data as ParsedAccountData;
    const balanceLamports = stakeAccountInfo.lamports;
    const stakedLamports =
      parsedData?.parsed?.info?.stake?.delegation?.stake ?? null;

    if (parsedData.space != 200) {
      throw new Error(
        `${stakeAccount} is not a stake account. Account size ${
          parsedData.space
        } != 200`,
      );
    }

    return {
      voter: new PublicKey(parsedData.parsed.info?.stake?.delegation?.voter),
      balanceLamports,
      stakedLamports,
    };
  }

  parseAccountList(data: Buffer, itemSize: number) {
    const accounts = [];
    for (let i = 8; i < data.length; i += itemSize) {
      accounts.push(new PublicKey(data.subarray(i, i + 32)));
    }
    return accounts;
  }

  async getIndexes(
    stakeAccount: StakeAccountInfo,
    stakeList: any,
    validatorList: any,
  ) {
    if (!stakeAccount.voter) {
      throw new Error("Stake account is not delegated");
    }

    const accountsInfo =
      await this.base.connection.getMultipleAccountsInfo([
        stakeList.account,
        validatorList.account,
      ]);

    if (!accountsInfo[0] || !accountsInfo[1]) {
      throw new Error(
        "Failed to get accounts info of stakeList and validatorList",
      );
    }

    const stakeIndex = this.parseAccountList(
      accountsInfo[0].data,
      stakeList.itemSize,
    ).findIndex((a) => a.equals(stakeAccount.address));

    const validatorIndex = this.parseAccountList(
      accountsInfo[1].data,
      validatorList.itemSize,
    ).findIndex((a) => a.equals(stakeAccount.voter!));

    return {
      stakeIndex,
      validatorIndex,
    };
  }
}
