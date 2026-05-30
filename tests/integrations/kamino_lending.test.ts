import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import {
  GlamClient,
  KAMINO_FARMS_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  KAMINO_VAULTS_PROTOCOL,
  nameToChars,
  SYSTEM_PROTOCOL,
} from "../../src";

describe("kamino_lending", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Kamino Lending Tests"),
      integrationAcls: [
        {
          integrationProgram: glamClient.extKaminoProgram.programId,
          protocolsBitmask:
            KAMINO_LENDING_PROTOCOL |
            KAMINO_VAULTS_PROTOCOL |
            KAMINO_FARMS_PROTOCOL,
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: SYSTEM_PROTOCOL,
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
