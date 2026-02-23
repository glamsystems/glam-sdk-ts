import { Transaction } from "@solana/web3.js";
import { GlamClient, stringToChars, StateAccountType, WSOL } from "../../src";
import { airdrop, sleep } from "../test-utils";
import { BN } from "@coral-xyz/anchor";

const txOptions = {
  simulate: true,
};

describe("fees", () => {
  const glamClient = new GlamClient();

  it("Initialize mint", async () => {
    const name = "GLAM Mint Test Fees";
    const params = {
      accountType: StateAccountType.TOKENIZED_VAULT,
      name: stringToChars(name),
      symbol: "GMT",
      uri: "https://glam.systems",
      baseAssetMint: WSOL,
      defaultAccountStateFrozen: false,
      feeStructure: {
        vault: {
          subscriptionFeeBps: 10,
          redemptionFeeBps: 20,
        },
        manager: {
          subscriptionFeeBps: 10,
          redemptionFeeBps: 20,
        },
        management: {
          feeBps: 10,
        },
        performance: {
          feeBps: 2000,
          hurdleRateBps: 500,
          hurdleType: { hard: {} },
        },
        protocol: {
          baseFeeBps: 0, // will be overwritten by program
          flowFeeBps: 0, // will be overwritten by program
        },
      },
    };

    try {
      const txSig = await glamClient.mint.initialize(params, txOptions);
      console.log("Initialize mint txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual(name);
    expect(stateModel.baseAssetMint).toEqual(WSOL);
    expect(stateModel.baseAssetTokenProgram).toEqual(0);
    expect(stateModel.mintModel?.feeStructure.protocol.baseFeeBps).toEqual(20);
    expect(stateModel.mintModel?.feeStructure.protocol.flowFeeBps).toEqual(0);
  }, 25_000);

  it("Set protocol fees: fail before fees crystallized", async () => {
    try {
      const setIx = await glamClient.fees.txBuilder.setProtocolFeesIx(2, 4000);
      const vTx = await glamClient.intoVersionedTransaction(
        new Transaction().add(setIx),
        txOptions,
      );
      const txSig = await glamClient.sendAndConfirm(vTx);
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain(
        "Protocol fees should be crystallized before updating",
      );
    }
  });

  it("First-time crystallize fees and set protocol fees", async () => {
    try {
      const txSig = await glamClient.fees.setProtocolFees(2, 4000, txOptions);
      console.log("Crystallize fees and set protocol fees:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Protocol fees should be updated
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.mintModel?.feeStructure.protocol.baseFeeBps).toEqual(2);
    expect(stateModel.mintModel?.feeStructure.protocol.flowFeeBps).toEqual(
      4000,
    );

    // After first-time crystallization, all fees should be 0
    const { claimableFees, claimedFees, feeParams } = stateModel.mintModel!;
    Object.values(claimableFees).forEach((fee) => {
      expect(new BN(fee).eq(new BN(0))).toBeTruthy();
    });
    Object.values(claimedFees).forEach((fee) => {
      expect(new BN(fee).eq(new BN(0))).toBeTruthy();
    });
    expect(feeParams.lastPerformanceFeeCrystallized.toString()).toEqual(
      feeParams.lastManagementFeeCrystallized.toString(),
    );
    expect(feeParams.lastPerformanceFeeCrystallized.toString()).toEqual(
      feeParams.lastProtocolFeeCrystallized.toString(),
    );
  });

  it("Crystallize fees", async () => {
    // Airdrop 1000 SOL to vault and wrap it (vault pays fees in wSOL)
    await airdrop(
      glamClient.provider.connection,
      glamClient.vaultPda,
      1_000_000_000_000,
    );
    const txWrapSolSig = await glamClient.vault.wrap(new BN(1_000_000_000_000));
    console.log("Wrap vault SOL -> wSOL:", txWrapSolSig);

    await sleep(10_000); // more time elapsed, more fees generated

    try {
      const txSig = await glamClient.fees.crystallizeFees(txOptions);
      console.log("Crystallize fees txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // AUM-based fees should be >0, but perf fee should still be 0
    const stateModel = await glamClient.fetchStateModel();
    const { claimableFees, claimedFees } = stateModel.mintModel!;
    Object.values(claimedFees).forEach((fee) => {
      expect(new BN(fee).eq(new BN(0))).toBeTruthy();
    });
    expect(new BN(claimableFees.managementFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.performanceFee).eq(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.protocolBaseFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.protocolFlowFee).gt(new BN(0))).toBeTruthy();
  }, 15_000);

  it("Claim fees", async () => {
    // In this test there's no shares minted for subscriptions.
    // All shares are issued as fees.
    try {
      const txSig = await glamClient.fees.claimFees(txOptions);
      console.log("Claim fees", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    const { claimableFees, claimedFees } = stateModel.mintModel!;
    Object.values(claimableFees).forEach((fee) => {
      expect(new BN(fee).eq(new BN(0))).toBeTruthy();
    });

    expect(new BN(claimedFees.managementFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimedFees.performanceFee).eq(new BN(0))).toBeTruthy();
    expect(new BN(claimedFees.protocolBaseFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimedFees.protocolFlowFee).gt(new BN(0))).toBeTruthy();
  });

  it("Update fee structure", async () => {
    // Get current fee structure
    const stateModelBefore = await glamClient.fetchStateModel();
    const feeStructureBefore = stateModelBefore.mintModel?.feeStructure;

    expect(feeStructureBefore?.vault.subscriptionFeeBps).toEqual(10);
    expect(feeStructureBefore?.vault.redemptionFeeBps).toEqual(20);
    expect(feeStructureBefore?.manager.subscriptionFeeBps).toEqual(10);
    expect(feeStructureBefore?.manager.redemptionFeeBps).toEqual(20);
    expect(feeStructureBefore?.management.feeBps).toEqual(10);
    expect(feeStructureBefore?.performance.feeBps).toEqual(2000);
    expect(feeStructureBefore?.performance.hurdleRateBps).toEqual(500);

    // Update fee structure with new values
    const newFeeStructure = {
      vault: {
        subscriptionFeeBps: 15,
        redemptionFeeBps: 25,
      },
      manager: {
        subscriptionFeeBps: 15,
        redemptionFeeBps: 25,
      },
      management: {
        feeBps: 20,
      },
      performance: {
        feeBps: 2500,
        hurdleRateBps: 600,
        hurdleType: { hard: {} },
      },
      protocol: {
        baseFeeBps: 10000, // won't be changed
        flowFeeBps: 10000, // won't be changed
      },
    };

    try {
      const txSig = await glamClient.mint.update(
        { feeStructure: newFeeStructure },
        txOptions,
      );
      console.log("Update fee structure txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Verify fee structure was updated
    const stateModelAfter = await glamClient.fetchStateModel();
    const feeStructureAfter = stateModelAfter.mintModel?.feeStructure;

    expect(feeStructureAfter?.vault.subscriptionFeeBps).toEqual(15);
    expect(feeStructureAfter?.vault.redemptionFeeBps).toEqual(25);
    expect(feeStructureAfter?.manager.subscriptionFeeBps).toEqual(15);
    expect(feeStructureAfter?.manager.redemptionFeeBps).toEqual(25);
    expect(feeStructureAfter?.management.feeBps).toEqual(20);
    expect(feeStructureAfter?.performance.feeBps).toEqual(2500);
    expect(feeStructureAfter?.performance.hurdleRateBps).toEqual(600);

    // Protocol fees should remain unchanged
    expect(feeStructureAfter?.protocol.baseFeeBps).toEqual(
      feeStructureBefore?.protocol.baseFeeBps,
    );
    expect(feeStructureAfter?.protocol.flowFeeBps).toEqual(
      feeStructureBefore?.protocol.flowFeeBps,
    );
  });
});
