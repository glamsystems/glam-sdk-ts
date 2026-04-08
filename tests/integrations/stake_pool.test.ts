import { BN } from "@coral-xyz/anchor";

import {
  getStakeAccountsWithStates,
  GlamClient,
  nameToChars,
  STAKE_ACCOUNT_SIZE,
} from "../../src";
import { PublicKey } from "@solana/web3.js";
import {
  airdrop,
  BONK_STAKE_POOL,
  createGlamStateForTest,
  defaultInitStateParams,
  JITO_STAKE_POOL,
  PHASE_LABS_STAKE_POOL,
  sleep,
} from "../glam_protocol/setup";

describe("stake_pool", () => {
  const glamClient = new GlamClient();
  const connection = glamClient.provider.connection;

  let defaultVote: PublicKey; // the test validator's default vote account
  let statePda: PublicKey;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    const voteAccountStatus = await connection.getVoteAccounts();
    const vote = voteAccountStatus.current.sort(
      (a, b) => b.activatedStake - a.activatedStake,
    )[0].votePubkey;
    defaultVote = new PublicKey(vote);
    const integrationAcls = [
      {
        integrationProgram: glamClient.protocolProgram.programId,
        protocolsBitmask: 0b0000011, // system program + stake program
        protocolPolicies: [],
      },
      {
        integrationProgram: glamClient.extStakePoolProgram.programId,
        protocolsBitmask: 0b0000111, // spl-stake-pool + sanctum + sanctum-multi
        protocolPolicies: [],
      },
    ];

    const created = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Stake Pool Tests"),
      integrationAcls,
    });
    statePda = created.statePda;
    vaultPda = created.vaultPda;

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    await airdrop(connection, vaultPda, 100_000_000_000);
  }, 30_000);

  it("Initialize stake with 10 SOL and delegate to a validator", async () => {
    try {
      const txSig = await glamClient.stake.initializeAndDelegateStake(
        defaultVote,
        new BN(10_000_000_000),
      );
      console.log("initializeAndDelegateStake tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stakeAccounts = await getStakeAccountsWithStates(
      glamClient.connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(1);
  }, 15_000);

  /* FIXME: this test is flaky
  it("Redelegate stake", async () => {
    // wait for the stake account to become active
    await sleep(75_000);

    let stakeAccounts = await glamClient.staking.getStakeAccountsWithStates(
      glamClient.getVaultPda(statePda),
    );
    expect(stakeAccounts.length).toEqual(1);

    // redelegate the stake account
    try {
      const { txSig } = await glamClient.staking.redelegateStake(
        statePda,
        stakeAccounts[0].address,
        new PublicKey("GJQjnyhSG9jN1AdMHTSyTxUR44hJHEGCmNzkidw9z3y8"),
      );
      console.log("redelegateStake tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // 2 stake accounts after re-delegation
    // the existing stake account is not closed by default
    stakeAccounts = await glamClient.staking.getStakeAccountsWithStates(
      glamClient.getVaultPda(statePda),
    );
    expect(stakeAccounts.length).toEqual(2);
  }, 90_000);

  it("[spl-stake-pool] Deposit stake account to jito stake pool", async () => {
    try {
      let stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
      const txSig = await glamClient.staking.stakePoolDepositStake(
        JITO_STAKE_POOL,
        stakeAccounts[0].address,
      );
      console.log("stakePoolDepositStake tx:", txSig);

      stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
      expect(stakeAccounts.length).toEqual(1);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  */

  it("[spl-stake-pool] Deposit 10 SOL to jito stake pool", async () => {
    try {
      const txSig = await glamClient.stakePool.depositSol(
        JITO_STAKE_POOL,
        new BN(10_000_000_000),
      );
      console.log("stakePoolDepositSol tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  /*
  it("[spl-stake-pool] Withdraw 1 jitoSOL to stake account", async () => {
    try {
      const txSig = await glamClient.staking.stakePoolWithdrawStake(
        statePda,
        JITO_STAKE_POOL,
        false,
        new BN(1_000_000_000),
      );
      console.log("stakePoolWithdrawStake tx:", txSig);

      const stakeAccounts = await glamClient.staking.getStakeAccounts(
        glamClient.getVaultPda(statePda),
      );
      expect(stakeAccounts.length).toEqual(1);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
  */

  it("[sanctum-single-valiator] Deposit 10 SOL to bonk stake pool", async () => {
    try {
      const txSig = await glamClient.stakePool.depositSol(
        BONK_STAKE_POOL,
        new BN(10_000_000_000),
      );
      console.log("stakePoolDepositSol tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("[sanctum-single-valiator] Withdraw 1 bonkSOL to stake account", async () => {
    try {
      const txSig = await glamClient.stakePool.withdrawStake(
        BONK_STAKE_POOL,
        new BN(1_000_000_000),
      );
      console.log("stakePoolWithdrawStake tx:", txSig);

      // Now we should have 2 stake accounts: 1 from jito and 1 from bonk
      const stakeAccounts = await getStakeAccountsWithStates(
        glamClient.connection,
        glamClient.vaultPda,
      );
      expect(stakeAccounts.length).toEqual(2);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("[sanctum-multi-valiator] Deposit 10 SOL to phase labs stake pool", async () => {
    try {
      const txSig = await glamClient.stakePool.depositSol(
        PHASE_LABS_STAKE_POOL,
        new BN(10_000_000_000),
      );
      console.log("stakePoolDepositSol tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  // FIXME: this test is flaky:
  // 'Program log: Error withdrawing from reserve: validator stake accounts have lamports available, please use those first.',
  // 'Program log: Error: The lamports in the validator stake account is not equal to the minimum',
  // We might need to clone the validator stake account to withdraw from it.
  it("[sanctum-multi-valiator] Withdraw 1 phaseSOL to stake account", async () => {
    try {
      const txSig = await glamClient.stakePool.withdrawStake(
        PHASE_LABS_STAKE_POOL,
        new BN(1_000_000_000),
      );
      console.log("stakePoolWithdrawStake tx:", txSig);

      const stakeAccounts = await getStakeAccountsWithStates(
        glamClient.connection,
        glamClient.vaultPda,
      );
      expect(stakeAccounts.length).toEqual(3);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Deactivate stake accounts", async () => {
    const stakeAccounts = await getStakeAccountsWithStates(
      glamClient.connection,
      glamClient.vaultPda,
    );
    try {
      const txSig = await glamClient.stake.deactivate(
        stakeAccounts.map((account) => account.address),
      );
      console.log("deactivateStakeAccounts tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Withdraw from stake accounts", async () => {
    await sleep(30_000); // Wait till the next epoch to withdraw

    const stakeAccountsInfo = await getStakeAccountsWithStates(
      glamClient.connection,
      glamClient.vaultPda,
    );
    const lamportsInStakeAccounts = stakeAccountsInfo.reduce(
      (acc, account) => acc + (account?.lamports ?? 0),
      0,
    );

    const vaultLamportsBefore = await glamClient.getVaultLamports();

    try {
      const txSig = await glamClient.stake.withdraw(
        stakeAccountsInfo.map((s) => s.address),
      );
      console.log("withdrawFromStakeAccounts tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const rentPerStake =
      await glamClient.provider.connection.getMinimumBalanceForRentExemption(
        STAKE_ACCOUNT_SIZE,
      );
    const totalRent = rentPerStake * stakeAccountsInfo.length;
    const vaultLamportsAfter = await glamClient.getVaultLamports();
    expect(vaultLamportsAfter).toEqual(
      vaultLamportsBefore + lamportsInStakeAccounts - totalRent,
    );

    const stakeAccountsAfter = await getStakeAccountsWithStates(
      glamClient.connection,
      glamClient.vaultPda,
    );
    expect(stakeAccountsAfter.length).toEqual(0);

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toEqual(0);
  }, 45_000);
});
