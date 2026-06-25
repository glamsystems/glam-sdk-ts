import {
  airdrop,
  createGlamStateForTest,
  sleep,
  str2seed,
  defaultInitStateParams,
} from "./setup";
import {
  charsToName,
  GlamClient,
  JUPITER_SWAP_PROTOCOL,
  nameToChars,
  STAKE_PROTOCOL,
  stringToChars,
  SYSTEM_PROTOCOL,
} from "../../src";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN, Wallet } from "@coral-xyz/anchor";

const txOptions = {
  simulate: true,
};

describe("state_timelock", () => {
  const glamClient = new GlamClient();
  const delegate = Keypair.fromSeed(str2seed("timelock_delegate"));
  const glamClientDelegate = new GlamClient({
    wallet: new Wallet(delegate),
  });

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      timelockDuration: 10,
    });

    glamClientDelegate.statePda = statePda;

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
        SYSTEM_PROTOCOL | STAKE_PROTOCOL | JUPITER_SWAP_PROTOCOL,
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
      expect(e.message).toEqual("Timelock still active");
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

  // Re-enable state for delegate tests
  it("Emergency update - re-enable state", async () => {
    const txSig = await glamClient.access.emergencyAccessUpdate({
      stateEnabled: true,
    });
    console.log("Emergency update re-enable state", txSig);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.enabled).toEqual(true);
  });

  it("Grant delegate CancelTimelock permission", async () => {
    await airdrop(
      glamClient.provider.connection,
      delegate.publicKey,
      1_000_000_000,
    );

    // Grant CancelTimelock (bit 3) under System protocol (bit 0) for glam_protocol program
    const txSig = await glamClient.access.grantDelegatePermissions(
      delegate.publicKey,
      glamClient.protocolProgram.programId,
      0b0001, // System protocol bitflag
      new BN(1 << 3), // CancelTimelock permission
      txOptions,
    );
    console.log("Grant CancelTimelock permission to delegate", txSig);

    let stateModel = await glamClient.fetchStateModel();
    expect(stateModel.delegateAcls?.length).toEqual(0);
    expect(stateModel.pendingStateUpdates.delegateAcls?.length).toEqual(1);

    await sleep(11000);
    const applyTxSig = await glamClient.timelock.apply();
    console.log("Apply delegate permission timelock", applyTxSig);

    stateModel = await glamClient.fetchStateModel();
    expect(stateModel.delegateAcls?.length).toEqual(1);
    expect(stateModel.delegateAcls?.[0].pubkey).toEqual(delegate.publicKey);
  }, 30_000);

  it("Stage a change and delegate cancels timelock", async () => {
    // Stage a name change
    const txSig = await glamClient.state.update(
      { name: stringToChars("Vetoed name") },
      txOptions,
    );
    console.log("Stage name change", txSig);

    let stateModel = await glamClient.fetchStateModel();
    expect(stateModel.timelockExpiresAt).toBeGreaterThan(0);

    // Delegate cancels the timelock using its own client
    const cancelTxSig = await glamClientDelegate.timelock.cancel(txOptions);
    console.log("Delegate cancel timelock", cancelTxSig);

    stateModel = await glamClient.fetchStateModel();
    expect(stateModel.timelockExpiresAt).toEqual(0);
    expect(stateModel.pendingStateUpdates).toEqual({});
  }, 15_000);

  it("Unauthorized delegate cannot cancel timelock", async () => {
    const unauthorized = Keypair.fromSeed(str2seed("unauthorized_delegate"));
    await airdrop(
      glamClient.provider.connection,
      unauthorized.publicKey,
      1_000_000_000,
    );
    const glamClientUnauthorized = new GlamClient({
      wallet: new Wallet(unauthorized),
    });
    glamClientUnauthorized.statePda = glamClient.statePda;

    // Stage a change first
    await glamClient.state.update(
      { name: stringToChars("Another change") },
      txOptions,
    );

    // Unauthorized delegate should fail
    try {
      await glamClientUnauthorized.timelock.cancel(txOptions);
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.message).toContain("Signer is not authorized");
    }

    // Clean up: owner cancels
    await glamClient.timelock.cancel(txOptions);
  }, 15_000);

  it("Emergency update cannot remove delegate with CancelTimelock", async () => {
    try {
      await glamClient.access.emergencyAccessUpdate({
        disabledDelegates: [delegate.publicKey],
      });
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.message).toContain(
        "Cannot remove delegate with CancelTimelock permission",
      );
    }

    // Verify delegate still exists
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.delegateAcls?.length).toEqual(1);
  }, 15_000);
});
