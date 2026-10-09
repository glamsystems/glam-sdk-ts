import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  sleep,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import {
  GlamClient,
  nameToChars,
  STAKE_ACCOUNT_SIZE,
  STAKE_PROTOCOL,
  SYSTEM_PROTOCOL,
} from "../../src";
import { getStakeAccountsWithStates } from "../../src/utils/accounts";
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
        protocolsBitmask: SYSTEM_PROTOCOL | STAKE_PROTOCOL,
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
      connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(1);
  }, 15_000);

  it("Spilt stake account", async () => {
    let stakeAccounts = await getStakeAccountsWithStates(
      connection,
      glamClient.vaultPda,
    );

    try {
      const { newStake, txSig } = await glamClient.stake.split(
        stakeAccounts[0].address,
        new BN(2_000_000_000),
      );
      console.log("splitStakeAccount tx:", txSig);

      stakeAccounts = await getStakeAccountsWithStates(
        connection,
        glamClient.vaultPda,
      );
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
    // The program refuses a merge into a destination still in its activation
    // epoch, where the Stake program would stake the source's reserve, so wait
    // until both accounts are active.
    let stakeAccounts = await getStakeAccountsWithStates(
      connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(2);
    for (let i = 0; i < 60; i++) {
      if (stakeAccounts.every((account) => account.state === "active")) break;
      await sleep(2_000);
      stakeAccounts = await getStakeAccountsWithStates(
        connection,
        glamClient.vaultPda,
      );
    }
    expect(stakeAccounts.every((account) => account.state === "active")).toBe(
      true,
    );
    // "active" here means delegated in an earlier epoch; the Stake program
    // merges only stake that has finished warming up, so wait as the move
    // test does for the stake to be fully activated.
    await sleep(75_000);
    const [destination, source] = [
      stakeAccounts[0].address,
      stakeAccounts[1].address,
    ];

    let txId: string;
    try {
      txId = await glamClient.stake.merge(destination, source);
      console.log("mergeStakeAccounts tx:", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }

    stakeAccounts = await getStakeAccountsWithStates(
      connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(1);
    // The merge returned the closed source's reserve to the signer, so the
    // survivor holds the two balances less one reserve. Rewards land at epoch
    // boundaries, so compare the transaction's own pre and post balances.
    const rentPerStake =
      await glamClient.provider.connection.getMinimumBalanceForRentExemption(
        STAKE_ACCOUNT_SIZE,
      );
    const tx = await connection.getTransaction(txId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const keys = tx!.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx!.meta?.loadedAddresses,
    });
    const indexOf = (key: PublicKey) => {
      for (let i = 0; i < keys.length; i++) {
        if (keys.get(i)!.equals(key)) return i;
      }
      throw new Error(`account ${key} not in the merge transaction`);
    };
    const pre = tx!.meta!.preBalances;
    const post = tx!.meta!.postBalances;
    expect(post[indexOf(destination)]).toEqual(
      pre[indexOf(destination)] + pre[indexOf(source)] - rentPerStake,
    );
    expect(post[indexOf(source)]).toEqual(0);
    expect(post[indexOf(glamClient.vaultPda)]).toEqual(
      pre[indexOf(glamClient.vaultPda)],
    );
  }, 150_000);

  it("Deactivate stake accounts", async () => {
    const stakeAccounts = await getStakeAccountsWithStates(
      connection,
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
      connection,
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
      connection,
      glamClient.vaultPda,
    );
    expect(stakeAccountsAfter.length).toEqual(0);

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toEqual(0);
  }, 45_000);

  it("Initialize 2 stake accounts and delegate them", async () => {
    try {
      const txSig0 = await glamClient.stake.initializeAndDelegateStake(
        defaultVote,
        new BN(10_000_000_000),
        txOptions,
      );
      console.log("initializeAndDelegateStake #0:", txSig0);

      const txSig1 = await glamClient.stake.initializeAndDelegateStake(
        defaultVote,
        new BN(1_000_000_000),
        txOptions,
      );
      console.log("initializeAndDelegateStake #1:", txSig1);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stakeAccounts = await getStakeAccountsWithStates(
      connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(2);
  }, 15_000);

  it("Move stake", async () => {
    // wait for the stake account to be fully activated
    await sleep(75_000);

    const stakeAccounts = await getStakeAccountsWithStates(
      connection,
      glamClient.vaultPda,
    );
    const sourceStake = stakeAccounts[0].address;
    const destinationStake = stakeAccounts[1].address;

    try {
      const txSig = await glamClient.stake.move(
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
