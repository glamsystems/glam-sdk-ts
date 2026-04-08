import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  stateModelForTest,
} from "../glam_protocol/setup";
import { GlamClient, nameToChars } from "../../src";

describe("kamino_lending", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...stateModelForTest,
      name: nameToChars("Kamino Lending Tests"),
      integrationAcls: [
        {
          integrationProgram: glamClient.extKaminoProgram.programId,
          protocolsBitmask: 0b111, // lending, vaults, farms
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: 0b01, // system program
          protocolPolicies: [],
        },
      ],
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    await airdrop(
      glamClient.provider.connection,
      glamClient.vaultPda,
      10_000_000_000,
    );

    await glamClient.vault.wrap(new BN(1_000_000_000));
  }, 30_000);

  it("Init kamino user metadata", async () => {
    try {
      const txSig = await glamClient.kaminoLending.initUserMetadata();
      console.log("init Kamino txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });
});
