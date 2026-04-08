import { BN } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import { GlamClient, nameToChars } from "../../src";
import { PublicKey } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

const txOptions = {
  simulate: true,
};

describe("kamino_farms", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Kamino Farms Tests"),
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

  it("Init kamino farm user", async () => {
    const kmnoMint = new PublicKey(
      "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",
    );
    const kmnoAta = glamClient.getVaultAta(kmnoMint);
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClient.signer,
      kmnoAta,
      glamClient.vaultPda,
      kmnoMint,
    );

    try {
      const txSig = await glamClient.kaminoFarm.stake(
        new BN(1_000_000),
        new PublicKey("2sFZDpBn4sA42uNbAD6QzQ98rPSmqnPyksYe6SJKVvay"), // KMNO farm state
        {
          ...txOptions,
          preInstructions: [createAtaIx],
        },
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Insufficient funds");
    }
  });
});
