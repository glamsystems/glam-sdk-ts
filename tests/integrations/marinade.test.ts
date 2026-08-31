import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import {
  GlamClient,
  MARINADE_PROTOCOL,
  nameToChars,
  STAKE_PROTOCOL,
  SYSTEM_PROTOCOL,
} from "../../src";
import { getStakeAccountsWithStates } from "../../src/utils/accounts";
import { PublicKey } from "@solana/web3.js";

describe("marinade", () => {
  const glamClient = new GlamClient();

  it("Create fund with 100 SOL in vault", async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.extMarinadeProgram.programId,
        protocolsBitmask: MARINADE_PROTOCOL,
        protocolPolicies: [],
      },
      {
        integrationProgram: glamClient.protocolProgram.programId,
        protocolsBitmask: SYSTEM_PROTOCOL | STAKE_PROTOCOL,
        protocolPolicies: [],
      },
    ];

    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
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
      const txSig = await glamClient.stake.initializeAndDelegateStake(
        // A member of the refreshed marinade validator list (fixtures capture slot
        // 443178787); GJQjny... was delisted upstream and now serves only the
        // native-staking and stake-pool suites.
        new PublicKey("HHLMTHR9YoyDNsWKVJBT5AKrX86iQjkiKRFRrnaFubgq"),
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
    const stakeAccounts = await getStakeAccountsWithStates(
      glamClient.provider.connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(1);

    try {
      await glamClient.marinade.depositStakeAccount(stakeAccounts[0].address);
    } catch (error) {
      console.log("Error", error);
      throw error;
    }

    expect(
      await getStakeAccountsWithStates(
        glamClient.provider.connection,
        glamClient.vaultPda,
      ),
    ).toEqual([]);
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

    const stakeAccounts = await getStakeAccountsWithStates(
      glamClient.provider.connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(1);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toBe(1);
  }, 15_000);

  it("Marinade native deposit", async () => {
    let stakeAccounts = await getStakeAccountsWithStates(
      glamClient.provider.connection,
      glamClient.vaultPda,
    );
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

    stakeAccounts = await getStakeAccountsWithStates(
      glamClient.provider.connection,
      glamClient.vaultPda,
    );
    expect(stakeAccounts.length).toEqual(2);
  });
});
