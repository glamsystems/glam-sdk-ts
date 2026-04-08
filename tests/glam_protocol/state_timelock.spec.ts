import { createGlamStateForTest, sleep, defaultInitStateParams } from "./setup";
import { charsToName, GlamClient, nameToChars } from "../../src";
import { PublicKey } from "@solana/web3.js";

const txOptions = {
  simulate: true,
};

describe("state_timelock", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      timelockDuration: 10,
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.timelockDuration).toEqual(10);
  }, 25_000);

  it("Update owner - changes staged due to timelock", async () => {
    try {
      const txSig = await glamClient.state.update(
        { owner: PublicKey.default },
        txOptions,
      );
      console.log("Update owner", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Changes have not take effect yet due to timelock
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.owner).toEqual(glamClient.signer);
    expect(stateModel.timelockExpiresAt).toBeGreaterThan(0);
  }, 15_000);

  it("Cancel timelock", async () => {
    try {
      const txSig = await glamClient.timelock.cancel();
      console.log("Cancel timelock", txSig);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.timelockExpiresAt).toEqual(0);
    expect(stateModel.pendingStateUpdates).toEqual({});
    expect(stateModel.pendingMintUpdates).toEqual({});
  }, 15_000);

  it("Update name - changes staged due to timelock", async () => {
    try {
      const txSig = await glamClient.state.update(
        { name: nameToChars("New name") },
        txOptions,
      );
      console.log("Update name", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Name change has not take effect yet due to timelock
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual(
      charsToName(defaultInitStateParams.name!),
    );
  }, 15_000);

  it("Update integration ACL - changes staged due to timelock", async () => {
    try {
      const txSig = await glamClient.access.enableProtocols(
        glamClient.protocolProgram.programId,
        0b0000111,
        txOptions,
      );
      console.log("Update integration ACL", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls?.length).toEqual(0); // not changed due to timelock
  }, 15_000);

  it("Apply timelock - fail due to timelock still active", async () => {
    try {
      const txSig = await glamClient.timelock.apply();
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Timelock still active.");
    }
  }, 15_000);

  it("Apply timelock - success after timelock expires", async () => {
    await sleep(10000);
    try {
      const txSig = await glamClient.timelock.apply();
      console.log("Apply timelock txSig", txSig);
    } catch (e) {
      expect(e).toBeUndefined();
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual("New name");
    expect(stateModel.integrationAcls?.length).toEqual(1);
  }, 30_000);

  it("Emergency update - delete integration ACL", async () => {
    try {
      const txSig = await glamClient.access.emergencyAccessUpdate({
        disabledIntegrations: [glamClient.protocolProgram.programId],
      });
      console.log("Emergency delete integration ACL", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls?.length).toEqual(0);
  });

  it("Emergency update - disable state", async () => {
    try {
      const txSig = await glamClient.access.emergencyAccessUpdate({
        stateEnabled: false,
      });
      console.log("Emergency update disable state", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.enabled).toEqual(false);
  });
});
