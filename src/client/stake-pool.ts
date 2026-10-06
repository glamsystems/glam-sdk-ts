import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  StakeProgram,
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

// The program refuses a zero minimum (MinimumOutputRequired); one base unit is the loosest
// bound it takes, which is what the retired Option<u64> handlers' `None` meant.
const NO_SLIPPAGE_BOUND = new BN(1);

interface StakePoolAccountData {
  programId: PublicKey;
  depositAuthority: PublicKey;
  withdrawAuthority: PublicKey;
  poolMint: PublicKey;
  feeAccount: PublicKey;
  reserveStake: PublicKey;
  tokenProgramId: PublicKey;
  validatorList: PublicKey;
  preferredWithdrawValidatorVoteAddress: PublicKey | null;
  totalLamports: BN;
  poolTokenSupply: BN;
}

// The stake pool program's MINIMUM_ACTIVE_STAKE: the least delegation it keeps in a validator
// stake account, whatever the stake program's minimum.
const STAKE_POOL_MINIMUM_ACTIVE_STAKE = new BN(1_000_000);

// One entry of the pool's validator list, as the program lays it out (ValidatorStakeInfo):
// active and transient stake, the last update epoch, the transient seed suffix, four unused
// bytes, the validator seed suffix, the status and the vote address, 73 bytes.
const VALIDATOR_LIST_ENTRIES_OFFSET = 9;
const VALIDATOR_LIST_ENTRY_SIZE = 73;

interface ValidatorListEntry {
  voteAccountAddress: PublicKey;
  activeStakeLamports: BN;
  validatorSeedSuffix: number;
}

export function decodeValidatorListEntries(data: Buffer): ValidatorListEntry[] {
  const count = data.readUInt32LE(VALIDATOR_LIST_ENTRIES_OFFSET - 4);
  const entries: ValidatorListEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = VALIDATOR_LIST_ENTRIES_OFFSET + i * VALIDATOR_LIST_ENTRY_SIZE;
    const entry = data.subarray(at, at + VALIDATOR_LIST_ENTRY_SIZE);
    entries.push({
      activeStakeLamports: new BN(entry.subarray(0, 8), "le"),
      validatorSeedSuffix: entry.readUInt32LE(36),
      voteAccountAddress: new PublicKey(entry.subarray(41, 73)),
    });
  }
  return entries;
}

// The validator stake account of a validator in the pool: the vote address and the pool, and
// the validator seed suffix as four little-endian bytes when it is not zero.
export function validatorStakeAccountAddress(
  programId: PublicKey,
  stakePool: PublicKey,
  entry: Pick<ValidatorListEntry, "voteAccountAddress" | "validatorSeedSuffix">,
): PublicKey {
  const seeds = [entry.voteAccountAddress.toBuffer(), stakePool.toBuffer()];
  if (entry.validatorSeedSuffix !== 0) {
    const suffix = Buffer.alloc(4);
    suffix.writeUInt32LE(entry.validatorSeedSuffix);
    seeds.push(suffix);
  }
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
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
      .depositSolWithSlippage(lamports, NO_SLIPPAGE_BOUND)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stakePool,
        stakePoolWithdrawAuthority: withdrawAuthority,
        reserveStake,
        destinationPoolAccount: poolTokensTo,
        managerFeeAccount: feeAccount,
        referralPoolAccount: poolTokensTo,
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
      .depositStakeWithSlippage(NO_SLIPPAGE_BOUND)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stakePool,
        validatorList,
        depositAuthority,
        stakePoolWithdrawAuthority: withdrawAuthority,
        depositStakeAccount: stakeAccount,
        validatorStakeAccount,
        reserveStake,
        destinationPoolAccount: poolTokensTo,
        managerFeeAccount: feeAccount,
        referralPoolAccount: poolTokensTo,
        poolMint,
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
    const stakePoolData = await this.client.getStakePoolAccountData(stakePool);
    const {
      programId: stakePoolProgram,
      poolMint,
      withdrawAuthority,
      feeAccount,
      tokenProgramId: tokenProgram,
      validatorList,
      reserveStake,
    } = stakePoolData;

    const poolTokensFrom = this.client.base.getVaultAta(poolMint, tokenProgram);
    const glamState = this.client.base.statePda;

    // The pool's preferred withdraw validator comes first: while it has active stake the pool
    // refuses every other source. Otherwise any active validator stake account, and the reserve
    // only when there is none.
    const preferred = await this.client.getPreferredWithdrawStakeAccount(
      stakePool,
      stakePoolData,
    );
    const validatorStakeCandidates = preferred
      ? []
      : (
          await getStakeAccountsWithStates(
            this.client.base.connection,
            withdrawAuthority,
          )
        ).filter(
          (s) => !s.address.equals(reserveStake) && s.state === "active",
        );

    const validatorStakeAccount =
      preferred ??
      (validatorStakeCandidates.length === 0
        ? reserveStake
        : validatorStakeCandidates[0].address);

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
      .withdrawStakeWithSlippage(amount, NO_SLIPPAGE_BOUND)
      .accounts({
        glamSigner,
        glamState,
        cpiProgram: stakePoolProgram,
        stakePool,
        validatorList,
        stakePoolWithdrawAuthority: withdrawAuthority,
        splitStakeSource: validatorStakeAccount,
        destinationStakeAccount: stakeAccount,
        destinationStakeAuthority: this.client.base.vaultPda,
        sourcePoolAccount: poolTokensFrom,
        managerFeeAccount: feeAccount,
        poolMint,
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
      preferredWithdrawValidatorVoteAddress:
        stakePoolAccountData.preferredWithdrawValidatorVoteAddress ?? null,
      totalLamports: new BN(stakePoolAccountData.totalLamports.toString()),
      poolTokenSupply: new BN(stakePoolAccountData.poolTokenSupply.toString()),
    };
  }

  /**
   * The validator stake account a withdrawal draws from while the pool's preferred withdraw
   * validator holds more than the rent, the minimum delegation and one pool token's worth of
   * lamports. Above that bound the SPL stake pool program before 2.2.0 and the Sanctum pool
   * programs refuse any other source. SPL 2.2.0 and later force the preferred validator one
   * minimum delegation higher; below that they still accept it while some validator holds
   * active stake above their own bound, and require a transient stake account otherwise. No
   * deployed pool runs them today. Null when the pool names no preferred validator, its list
   * does not hold it, or it holds no more than the bound.
   */
  async getPreferredWithdrawStakeAccount(
    stakePool: PublicKey,
    data: StakePoolAccountData,
  ): Promise<PublicKey | null> {
    const vote = data.preferredWithdrawValidatorVoteAddress;
    if (!vote || data.poolTokenSupply.isZero()) {
      return null;
    }
    const connection = this.base.connection;
    const list = await connection.getAccountInfo(data.validatorList);
    if (!list) {
      return null;
    }
    const entry = decodeValidatorListEntries(list.data).find((e) =>
      e.voteAccountAddress.equals(vote),
    );
    if (!entry) {
      return null;
    }
    const rent = new BN(
      await connection.getMinimumBalanceForRentExemption(StakeProgram.space),
    );
    const stakeMinimumDelegation = new BN(
      (await connection.getStakeMinimumDelegation()).value,
    );
    const lamportsPerPoolToken = data.totalLamports
      .add(data.poolTokenSupply)
      .subn(1)
      .div(data.poolTokenSupply);
    const bound = rent
      .add(BN.max(stakeMinimumDelegation, STAKE_POOL_MINIMUM_ACTIVE_STAKE))
      .add(lamportsPerPoolToken);
    if (entry.activeStakeLamports.lte(bound)) {
      return null;
    }
    return validatorStakeAccountAddress(data.programId, stakePool, entry);
  }
}
