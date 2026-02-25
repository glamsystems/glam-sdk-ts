import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import { GlamClient, stringToChars } from "../../src";

describe("offchain_aum", () => {
  const glamClient = new GlamClient();

  let statePda: PublicKey;
  let vaultPda: PublicKey;

  beforeAll(async () => {
    const integrationAcls = [
      {
        integrationProgram: glamClient.extOffchainProgram.programId,
        protocolsBitmask: 0b0000001, // OffchainAum
        protocolPolicies: [],
      },
    ];

    const created = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: stringToChars("Offchain AUM Tests"),
      integrationAcls,
    });
    statePda = created.statePda;
    vaultPda = created.vaultPda;

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls).toEqual(integrationAcls);

    await airdrop(glamClient.connection, vaultPda, 10_000_000_000);
  }, 30_000);

  it("Update offchain AUM", async () => {
    const amount = new BN(1_000_000_000); // 1 SOL equivalent in lamports
    try {
      const txSig = await glamClient.extOffchainProgram.methods
        .updateOffchainAum(amount)
        .accounts({
          glamState: statePda,
          glamSigner: glamClient.signer,
        })
        .rpc();
      console.log("Update offchain AUM tx:", txSig);
    } catch (error) {
      console.error("Error", error);
      throw error;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.pricedProtocols.length).toBe(1);
    expect(stateModel.pricedProtocols[0].amount.toString()).toBe(
      amount.toString(),
    );
    expect(stateModel.pricedProtocols[0].integrationProgram.toBase58()).toBe(
      glamClient.extOffchainProgram.programId.toBase58(),
    );
  }, 15_000);

  it("Update offchain AUM with new value", async () => {
    const newAmount = new BN(5_000_000_000); // 5 SOL equivalent
    try {
      const txSig = await glamClient.extOffchainProgram.methods
        .updateOffchainAum(newAmount)
        .accounts({
          glamState: statePda,
          glamSigner: glamClient.signer,
        })
        .rpc();
      console.log("Update offchain AUM (new value) tx:", txSig);
    } catch (error) {
      console.error("Error", error);
      throw error;
    }

    const stateModel = await glamClient.fetchStateModel();
    // Should still be 1 priced protocol (updated, not added)
    expect(stateModel.pricedProtocols.length).toBe(1);
    expect(stateModel.pricedProtocols[0].amount.toString()).toBe(
      newAmount.toString(),
    );
  }, 15_000);

  it("Update offchain AUM to zero", async () => {
    const zeroAmount = new BN(0);
    try {
      const txSig = await glamClient.extOffchainProgram.methods
        .updateOffchainAum(zeroAmount)
        .accounts({
          glamState: statePda,
          glamSigner: glamClient.signer,
        })
        .rpc();
      console.log("Update offchain AUM (zero) tx:", txSig);
    } catch (error) {
      console.error("Error", error);
      throw error;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.pricedProtocols.length).toBe(1);
    expect(stateModel.pricedProtocols[0].amount.toString()).toBe("0");
  }, 15_000);
});
