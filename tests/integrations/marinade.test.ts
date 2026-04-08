import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  stateModelForTest,
} from "../glam_protocol/setup";
import { GlamClient, nameToChars } from "../../src";
import { PublicKey } from "@solana/web3.js";

describe("marinade", () => {
  const glamClient = new GlamClient();

  it("Create fund with 100 SOL in vault", async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.extMarinadeProgram.programId,
        protocolsBitmask: 0b0000001,
        protocolPolicies: [],
      },
      {
        integrationProgram: glamClient.protocolProgram.programId,
        protocolsBitmask: 0b0000011, // system program + stake program
        protocolPolicies: [],
      },
    ];

    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...stateModelForTest,
      name: nameToChars("Marinade Tests"),
      integrationAcls,
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls).toEqual(integrationAcls);

    await airdrop(glamClient.provider.connection, vaultPda, 100_000_000_000);
  }, 30_000);

  it("Marinade desposit: stake 20 SOL", async () => {
    try {
      const tx = await glamClient.marinade.deposit(20_000_000_000);
      console.log("Deposit 20 SOL to marinade:", tx);
    } catch (error) {
      console.log("Error", error);
      throw error;
    }
  }, 15_000);

  it("Stake 10 SOL to a validator", async () => {
    try {
      const txSig = await glamClient.staking.initializeAndDelegateStake(
        new PublicKey("GJQjnyhSG9jN1AdMHTSyTxUR44hJHEGCmNzkidw9z3y8"),
        new BN(10_000_000_000),
      );
      console.log("nativeStakeDeposit tx:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toBe(1);
  });

  it("Desposit stake account", async () => {
    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(1);

    try {
      await glamClient.marinade.depositStakeAccount(stakeAccounts[0].address);
    } catch (error) {
      console.log("Error", error);
      throw error;
    }

    expect(await glamClient.staking.getStakeAccountsWithStates()).toEqual([]);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toBe(0);
  });

  it("Withdraw stake account: 1 mSOL", async () => {
    try {
      const tx = await glamClient.marinade.withdrawStakeAccount(new BN(1e9));
      console.log("Withdraw stake account:", tx);
    } catch (error) {
      console.log("Error", error);
      throw error;
    }

    const stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(1);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toBe(1);
  }, 15_000);

  it("Marinade native deposit", async () => {
    let stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(1);

    try {
      const txId = await glamClient.marinade.depositNative(
        new BN(1_000_000_000),
      );
      console.log("authorizeStakeAccount tx:", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }

    stakeAccounts = await glamClient.staking.getStakeAccountsWithStates();
    expect(stakeAccounts.length).toEqual(2);
  });
});
