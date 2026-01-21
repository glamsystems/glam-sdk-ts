import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  Transaction,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "../base";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { KAMINO_FARM_PROGRAM } from "../../constants";
import { getProgramAccounts } from "../../utils/rpc";
import { PkMap } from "../../utils";
import { KaminoLendingClient } from "./lending";
import { ParsedFarmState, ParsedFarmUser } from "./types";

class TxBuilder extends BaseTxBuilder<KaminoFarmClient> {
  public async stakeTx(
    amount: BN,
    farmState: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const farms = await this.client.fetchAndParseFarmStates([farmState]);
    const parsedFarmState = farms.get(farmState);
    if (!parsedFarmState) {
      throw new Error("Farm state not found");
    }
    const { farmTokenMint, farmTokenProgram, farmVault } = parsedFarmState;
    if (farmTokenMint.equals(PublicKey.default)) {
      throw new Error("Delegated farm is not supported");
    }

    const farmUserState = this.client.kaminoLending.getFarmUserState(
      this.client.base.vaultPda,
      farmState,
    );
    const farmUserStateAccountInfo =
      await this.client.base.connection.getAccountInfo(farmUserState);
    const preInstructions = txOptions.preInstructions || [];
    if (!farmUserStateAccountInfo) {
      const initUserIx = await this.client.base.extKaminoProgram.methods
        .farmsInitializeUser()
        .accounts({
          glamState: this.client.base.statePda,
          glamSigner,
          userState: farmUserState,
          farmState,
        })
        .instruction();
      preInstructions.push(initUserIx);
    }

    const tx = await this.client.base.extKaminoProgram.methods
      .farmsStake(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        userState: farmUserState,
        farmState,
        farmVault,
        userAta: this.client.base.getVaultAta(farmTokenMint, farmTokenProgram),
        tokenMint: farmTokenMint,
        scopePrices: null,
        tokenProgram: farmTokenProgram,
      })
      .preInstructions(preInstructions)
      .transaction();
    const vTx = await this.client.base.intoVersionedTransaction(tx, txOptions);
    return vTx;
  }

  public async unstakeTx(
    amount: BN,
    farmState: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const farms = await this.client.fetchAndParseFarmStates([farmState]);
    const parsedFarmState = farms.get(farmState);
    if (!parsedFarmState) {
      throw new Error("Farm state not found");
    }
    const { farmTokenMint, farmTokenProgram, farmVault } = parsedFarmState;
    if (farmTokenMint.equals(PublicKey.default)) {
      throw new Error("Delegated farm is not supported");
    }

    const farmUserState = this.client.kaminoLending.getFarmUserState(
      this.client.base.vaultPda,
      farmState,
    );
    const userAta = this.client.base.getVaultAta(
      farmTokenMint,
      farmTokenProgram,
    );
    const withdrawIx = await this.client.base.extKaminoProgram.methods
      .farmsWithdrawUnstakedDeposits()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        userState: farmUserState,
        farmState,
        userAta,
        farmVault,
        farmVaultsAuthority: this.client.farmVaultsAuthority(farmState),
        tokenProgram: farmTokenProgram,
      })
      .instruction();

    const tx = await this.client.base.extKaminoProgram.methods
      .farmsUnstake(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        userState: farmUserState,
        farmState,
        scopePrices: null,
      })
      .postInstructions([withdrawIx])
      .transaction();
    const vTx = await this.client.base.intoVersionedTransaction(tx, txOptions);
    return vTx;
  }

  public async harvestTx(
    farmUserStates: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const parsedFarmUserStates = (
      await this.client.findAndParseFarmUserStates(this.client.base.vaultPda)
    ).filter((farmUser) =>
      farmUserStates.find((v) => v.equals(farmUser.pubkey)),
    );

    const parsedFarmStates = await this.client.fetchAndParseFarmStates(
      parsedFarmUserStates.map((f) => f.farmState),
    );

    const tx = new Transaction();
    for (const {
      pubkey: userState,
      farmState,
      unclaimedRewards,
    } of parsedFarmUserStates) {
      const parsedFarmState = parsedFarmStates.get(farmState);
      if (!parsedFarmState) {
        throw new Error("Farm state not found");
      }
      const { globalConfig, rewards } = parsedFarmState;

      for (const { index, mint, tokenProgram, rewardsVault } of rewards) {
        if (unclaimedRewards[index].eq(new BN(0))) {
          continue;
        }

        const vaultAta = this.client.base.getVaultAta(mint, tokenProgram);
        const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
          glamSigner,
          vaultAta,
          this.client.base.vaultPda,
          mint,
          tokenProgram,
        );

        const harvestIx = await this.client.base.extKaminoProgram.methods
          .farmsHarvestReward(new BN(index))
          .accounts({
            glamState: this.client.base.statePda,
            glamSigner,
            userState,
            farmState,
            globalConfig,
            rewardMint: mint,
            userRewardAta: vaultAta,
            rewardsVault,
            rewardsTreasuryVault: this.client.rewardsTreasuryVault(
              globalConfig,
              mint,
            ),
            farmVaultsAuthority: this.client.farmVaultsAuthority(farmState),
            scopePrices: null,
            tokenProgram,
          })
          .instruction();
        tx.add(createAtaIx, harvestIx);
      }
    }

    if (tx.instructions.length === 0) {
      throw new Error("No rewards to harvest");
    }

    const vTx = await this.client.base.intoVersionedTransaction(tx, txOptions);
    return vTx;
  }
}

export class KaminoFarmClient {
  txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly kaminoLending: KaminoLendingClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Finds and parses farm states for the given owner
   */
  async findAndParseFarmUserStates(
    owner: PublicKey,
  ): Promise<ParsedFarmUser[]> {
    const accounts = await getProgramAccounts(
      this.base.connection,
      KAMINO_FARM_PROGRAM,
      {
        filters: [
          { dataSize: 920 },
          { memcmp: { offset: 48, bytes: owner.toBase58() } },
        ],
      },
    );
    return accounts.map(({ pubkey, account }) => {
      const farmState = new PublicKey(account.data.subarray(16, 48));

      const rewardsOffset = 248;
      const numRewards = 10;
      const rewardSize = 8;

      const rewardsData = account.data.subarray(
        rewardsOffset,
        rewardsOffset + numRewards * rewardSize,
      );
      const unclaimedRewards: BN[] = Array.from(
        { length: numRewards },
        (_, i) => {
          const rewardData = rewardsData.subarray(
            i * rewardSize,
            (i + 1) * rewardSize,
          );
          return new BN(rewardData, "le");
        },
      );

      return {
        pubkey,
        farmState,
        unclaimedRewards,
      };
    });
  }

  async parseFarmState(data: Buffer): Promise<ParsedFarmState> {
    const globalConfig = new PublicKey(data.subarray(40, 72));
    const farmTokenMint = new PublicKey(data.subarray(72, 104));
    const farmTokenDecimals = new BN(data.subarray(104, 112), "le");
    const farmTokenProgram = new PublicKey(data.subarray(112, 144));
    const rewardsOffset = 192;
    const numRewards = 10;
    const rewardSize = 704;

    const rewardsData = data.subarray(
      rewardsOffset,
      rewardsOffset + numRewards * rewardSize,
    );
    const rewards = Array.from({ length: numRewards }, (_, i) => {
      const rewardData = rewardsData.subarray(
        i * rewardSize,
        (i + 1) * rewardSize,
      );
      const mint = new PublicKey(rewardData.subarray(0, 32));
      const tokenProgram = new PublicKey(rewardData.subarray(40, 72));
      const rewardsVault = new PublicKey(rewardData.subarray(120, 152));
      const minClaimDurationSeconds = new BN(
        rewardData.subarray(480, 488),
        "le",
      );

      return {
        index: i,
        mint,
        minClaimDurationSeconds,
        tokenProgram,
        rewardsVault,
      };
    }).filter((r) => {
      if (r.mint.equals(PublicKey.default)) {
        return false;
      }
      // Filter out rewards with minClaimDurationSeconds > 1 year
      if (
        r.minClaimDurationSeconds.div(new BN(365 * 24 * 60 * 60)).gt(new BN(1))
      ) {
        return false;
      }
      return true;
    });

    const farmVaultOffset = rewardsOffset + numRewards * rewardSize + 24;
    const farmVault = new PublicKey(
      data.subarray(farmVaultOffset, farmVaultOffset + 32),
    );

    return {
      globalConfig,
      farmTokenMint,
      farmTokenDecimals,
      farmTokenProgram,
      farmVault,
      rewards,
    };
  }

  async fetchAndParseFarmStates(farms: PublicKey[]) {
    const farmAccounts =
      await this.base.connection.getMultipleAccountsInfo(farms);

    const map = new PkMap<ParsedFarmState>();

    for (let i = 0; i < farmAccounts.length; i++) {
      const account = farmAccounts[i];
      if (!account) {
        continue;
      }

      const data = account.data;
      const parsedFarm = await this.parseFarmState(data);
      map.set(farms[i], parsedFarm);
    }

    return map;
  }

  farmVaultTokenAccount = (farm: PublicKey, mint: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), farm.toBuffer(), mint.toBuffer()],
      KAMINO_FARM_PROGRAM,
    )[0];

  farmVaultsAuthority = (farm: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), farm.toBuffer()],
      KAMINO_FARM_PROGRAM,
    )[0];

  rewardsTreasuryVault = (globalConfig: PublicKey, mint: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("tvault"), globalConfig.toBuffer(), mint.toBuffer()],
      KAMINO_FARM_PROGRAM,
    )[0];

  /**
   * Harvest rewards from Kamino farms
   */
  public async harvest(
    vaultFarmStates: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.harvestTx(vaultFarmStates, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Stake tokens to a farm
   */
  public async stake(
    amount: BN,
    farmState: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.stakeTx(amount, farmState, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Unstake tokens from a farm
   */
  public async unstake(
    amount: BN,
    farmState: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.unstakeTx(amount, farmState, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
