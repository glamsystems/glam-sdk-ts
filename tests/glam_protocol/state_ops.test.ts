import { Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";

import { airdrop, createGlamStateForTest, str2seed } from "./setup";
import {
  GlamClient,
  GlamError,
  MSOL,
  USDC,
  WSOL,
  stringToChars,
} from "../../src";

const key1 = Keypair.fromSeed(str2seed("acl_test_key1"));

describe("state_ops", () => {
  const glamClient = new GlamClient(); // statePda will be set once glam state is created

  beforeAll(async () => {
    await airdrop(
      glamClient.provider.connection,
      key1.publicKey,
      1_000_000_000,
    );
  });

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient);
    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.baseAssetMint).toEqual(WSOL);
    expect(stateModel.baseAssetDecimals).toEqual(9);
    expect(stateModel.baseAssetTokenProgram).toEqual(0);
  }, 25_000);

  it("Extend glam state account size", async () => {
    const accountInfoBefore = await glamClient.connection.getAccountInfo(
      glamClient.statePda,
    );
    const dataLenBefore = accountInfoBefore?.data.length!;
    const newBytes = 10000;

    try {
      const txSig = await glamClient.state.extend(newBytes);
      console.log("Extended glam state account size by 10000 bytes", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const accountInfoAfter =
      await glamClient.provider.connection.getAccountInfo(glamClient.statePda);
    const dataLenAfter = accountInfoAfter?.data.length;
    expect(dataLenAfter).toEqual(dataLenBefore + newBytes);
  });

  it("Update name in state", async () => {
    const newName = "Updated name";
    try {
      const txSig = await glamClient.state.update({
        name: stringToChars(newName),
      });
      console.log("Update name", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual(newName);
  });

  it("Update assets allowlist", async () => {
    // The test glam state has 2 assets, WSOL and MSOL. Update to USDC.
    try {
      const txSig = await glamClient.state.update({
        assets: [USDC],
      });
      console.log("Update assets to [USDC]", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    let stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([USDC]);

    // Update assets back to WSOL and MSOL
    try {
      const txSig = await glamClient.state.update({
        assets: [WSOL, MSOL],
      });
      console.log("Update assets to [WSOL, MSOL]", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([WSOL, MSOL]);
  });

  it("Update borrowable assets", async () => {
    try {
      const txSig = await glamClient.state.update({
        borrowable: [WSOL, MSOL],
      });
      console.log("Update borrowable assets to [WSOL, MSOL]", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    let stateModel = await glamClient.fetchStateModel();
    expect(stateModel.borrowable).toEqual([WSOL, MSOL]);
  });

  it("[ownership] Update state unauthorized", async () => {
    const glamClientCustomWallet = new GlamClient({
      wallet: new Wallet(key1),
      statePda: glamClient.statePda,
    });
    try {
      const txSig = await glamClientCustomWallet.state.update(
        {
          name: stringToChars("Updated state name"),
        },
        { simulate: true },
      );
      expect(txSig).toBeUndefined();
    } catch (e) {
      expect((e as GlamError).message).toEqual("Signer is not authorized");
    }
  }, 25_000);

  it("[ownership] Update owner", async () => {
    const glamClientCustomWallet = new GlamClient({
      wallet: new Wallet(key1),
      statePda: glamClient.statePda,
    });

    try {
      const txSig = await glamClient.state.update(
        {
          owner: key1.publicKey,
          portfolioManagerName: stringToChars("New Owner"),
        },
        { simulate: true },
      );
      console.log("Owner updated from default to new", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    let glamState = await glamClient.fetchStateAccount();
    expect(glamState.owner).toEqual(key1.publicKey);

    // previous owner CANNOT update
    try {
      const txSig = await glamClient.state.update({
        name: stringToChars("Updated state name"),
      });
      expect(txSig).toBeUndefined();
    } catch (e) {
      expect((e as GlamError).message).toEqual("Signer is not authorized.");
    }

    // new manager CAN update back
    try {
      const txId = await glamClientCustomWallet.state.update({
        owner: glamClient.signer,
        portfolioManagerName: stringToChars("Default Owner"),
      });
      console.log("Owner updated from new to default", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }
    glamState = await glamClient.fetchStateAccount();
    expect(glamState.owner).toEqual(glamClient.signer);
  }, 25_000);

  it("Close state account - should fail due to not disabled", async () => {
    try {
      const txSig = await glamClient.state.close();
      expect(txSig).toBeUndefined();
    } catch (e) {
      expect((e as GlamError).message).toEqual(
        "Glam state cannot be closed: mint must be closed and state must be disabled.",
      );
    }
  });

  it("Disable and close state account", async () => {
    try {
      const txSigDisable = await glamClient.access.emergencyAccessUpdate({
        stateEnabled: false,
      });
      console.log("State disabled", txSigDisable);

      const txSigClose = await glamClient.state.close();
      console.log("State closed", txSigClose);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // The following accounts should no longer exist
    const ret = await glamClient.provider.connection.getMultipleAccountsInfo([
      glamClient.statePda,
      glamClient.vaultPda,
    ]);
    expect(ret).toEqual([null, null]);
  }, 15_000);
});
