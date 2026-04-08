import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  sleep,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import { GlamClient, nameToChars, STAKE_ACCOUNT_SIZE } from "../../src";
import { PublicKey } from "@solana/web3.js";

const txOptions = {
  simulate: true,
};

describe("native_staking", () => {
  const glamClient = new GlamClient();
  const connection = glamClient.provider.connection;

  let defaultVote: PublicKey; // the test validator's default vote account

  beforeAll(async () => {
    const voteAccountStatus = await connection.getVoteAccounts();
    const vote = voteAccountStatus.current.sort(
      (a, b) => b.activatedStake - a.activatedStake,
    )[0].votePubkey;
    defaultVote = new PublicKey(vote);
  });

  it("Create vault with 100 SOL in vault", async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.protocolProgram.programId,
        protocolsBitmask: 0b0000011, // system program + stake program
        protocolPolicies: [],
      },
    ];

    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Stake Tests"),
      integrationAcls,
    });
    console.log("State PDA:", statePda);
    console.log("Vault PDA:", vaultPda);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls).toEqual(integrationAcls);

    await airdrop(connection, vaultPda, 100_000_000_000);
  }, 30_000);

  it("Initialize stake with 10 SOL and delegate to a validator", async () => {
    try {
      const txSig = await glamClient.staking.initializeAndDelegateStake(
        defaultVote,
        new BN(10_000_000_000),
      );
      console.log("initializeAndDelegateStake tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(1);
  }, 15_000);

  it("Spilt stake account", async () => {
    let stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();

    try {
      const { newStake, txSig } = await glamClient.staking.split(
        stakeAccounts[0].address,
        new BN(2_000_000_000),
      );
      console.log("splitStakeAccount tx:", txSig);

      stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
      expect(stakeAccounts.length).toEqual(2);
      expect(
        stakeAccounts.some((account) => account.address.equals(newStake)),
      ).toBeTruthy();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Merge stake accounts", async () => {
    let stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(2);

    try {
      const txId = await glamClient.staking.merge(
        stakeAccounts[0].address,
        stakeAccounts[1].address,
      );
      console.log("mergeStakeAccounts tx:", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }

    stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(1);
  });

  it("Deactivate stake accounts", async () => {
    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    try {
      const txSig = await glamClient.staking.deactivate(
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

    const stakeAccountsInfo =
      await glamClient.staking.getStakeAccountsWithStates();
    const lamportsInStakeAccounts = stakeAccountsInfo.reduce(
      (acc, account) => acc + (account?.lamports ?? 0),
      0,
    );

    const vaultLamportsBefore = await glamClient.getVaultLamports();

    try {
      const txSig = await glamClient.staking.withdraw(
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

    const stakeAccountsAfter =
      await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccountsAfter.length).toEqual(0);

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toEqual(0);
  }, 45_000);

  it("Initialize 2 stake accounts and delegate them", async () => {
    try {
      const txSig0 = await glamClient.staking.initializeAndDelegateStake(
        defaultVote,
        new BN(10_000_000_000),
        txOptions,
      );
      console.log("initializeAndDelegateStake #0:", txSig0);

      const txSig1 = await glamClient.staking.initializeAndDelegateStake(
        defaultVote,
        new BN(1_000_000_000),
        txOptions,
      );
      console.log("initializeAndDelegateStake #1:", txSig1);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(2);
  }, 15_000);

  it("Move stake", async () => {
    // wait for the stake account to be fully activated
    await sleep(75_000);

    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    const sourceStake = stakeAccounts[0].address;
    const destinationStake = stakeAccounts[1].address;

    try {
      const txSig = await glamClient.staking.move(
        sourceStake,
        destinationStake,
        new BN(1_000_000_000),
        txOptions,
      );
      console.log("move stake:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 90_000);
});
