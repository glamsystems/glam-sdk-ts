import { Transaction } from "@solana/web3.js";
import { GlamClient, nameToChars, StateAccountType, WSOL } from "../../src";
import { airdrop, sleep } from "../test-utils";
import { BN } from "@coral-xyz/anchor";

const txOptions = {
  simulate: true,
};

const initTxOptions = {
  simulate: false,
};

describe("fees", () => {
  const glamClient = new GlamClient();

  it("Initialize mint", async () => {
    const name = "GLAM Mint Test Fees";
    const params = {
      accountType: StateAccountType.TOKENIZED_VAULT,
      name: nameToChars(name),
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
      const txSig = await glamClient.mint.initialize(params, initTxOptions);
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
      const setIx = await glamClient.fees.setProtocolFeesIx(2, 2000);
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
      const txSig = await glamClient.fees.setProtocolFees(2, 2000, txOptions);
      console.log("Crystallize fees and set protocol fees:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Protocol fees should be updated
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.mintModel?.feeStructure.protocol.baseFeeBps).toEqual(2);
    expect(stateModel.mintModel?.feeStructure.protocol.flowFeeBps).toEqual(
      2000,
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

    const before = (await glamClient.fetchStateModel()).mintModel!;
    const beforeClaimableFees = before.claimableFees!;

    try {
      const txSig = await glamClient.fees.crystallizeFees(txOptions);
      console.log("Crystallize fees txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // AUM-based fees should be >0, but perf fee should still be 0
    const stateModel = await glamClient.fetchStateModel();
    const mintModel = stateModel.mintModel!;
    const claimableFees = mintModel.claimableFees!;
    const claimedFees = mintModel.claimedFees!;
    Object.values(claimedFees).forEach((fee) => {
      expect(new BN(fee).eq(new BN(0))).toBeTruthy();
    });
    expect(new BN(claimableFees.managementFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.performanceFee).eq(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.protocolBaseFee).gt(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees.protocolFlowFee).gt(new BN(0))).toBeTruthy();

    const managementAccrual = new BN(claimableFees.managementFee).sub(
      new BN(beforeClaimableFees.managementFee),
    );
    const performanceAccrual = new BN(claimableFees.performanceFee).sub(
      new BN(beforeClaimableFees.performanceFee),
    );
    const flowAccrual = new BN(claimableFees.protocolFlowFee).sub(
      new BN(beforeClaimableFees.protocolFlowFee),
    );
    const flowRateBps = mintModel.feeStructure!.protocol.flowFeeBps;
    const flowNumerator = managementAccrual
      .add(performanceAccrual)
      .mul(new BN(flowRateBps));

    expect(flowRateBps).toEqual(2_000);
    expect(managementAccrual.gt(new BN(0))).toBeTruthy();
    expect(performanceAccrual.eq(new BN(0))).toBeTruthy();
    expect(flowNumerator.gt(new BN(0))).toBeTruthy();
    // Validator time determines this live accrual's remainder. The deterministic
    // nondivisible floor-versus-ceiling regression remains in the native and LiteSVM suites.
    expect(flowAccrual.eq(flowNumerator.div(new BN(10_000)))).toBeTruthy();
  }, 15_000);

  it("Claim fees", async () => {
    // In this test there's no shares minted for subscriptions.
    // All shares are issued as fees.
    const before = (await glamClient.fetchStateModel()).mintModel!;
    const beforeClaimableFees = before.claimableFees!;
    const beforeClaimedFees = before.claimedFees!;
    try {
      const txSig = await glamClient.fees.claimFees(txOptions);
      console.log("Claim fees", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const mintModel = (await glamClient.fetchStateModel()).mintModel!;
    const claimableFees = mintModel.claimableFees!;
    const claimedFees = mintModel.claimedFees!;
    const precision = new BN(1_000_000_000);
    const managerRemaining = [
      claimableFees.managerSubscriptionFee,
      claimableFees.managerRedemptionFee,
      claimableFees.managementFee,
      claimableFees.performanceFee,
    ]
      .reduce((total, fee) => total.add(new BN(fee)), new BN(0))
      .sub(new BN(claimableFees.protocolFlowFee));
    const protocolRemaining = new BN(claimableFees.protocolBaseFee).add(
      new BN(claimableFees.protocolFlowFee),
    );
    for (const remaining of [managerRemaining, protocolRemaining]) {
      expect(remaining.gte(new BN(0)) && remaining.lt(precision)).toBeTruthy();
    }
    for (const category of Object.keys(claimableFees) as Array<
      keyof typeof claimableFees
    >) {
      expect(
        new BN(claimedFees[category])
          .add(new BN(claimableFees[category]))
          .eq(
            new BN(beforeClaimedFees[category]).add(
              new BN(beforeClaimableFees[category]),
            ),
          ),
      ).toBeTruthy();
    }

    // Claimed amounts are attributed in draw order. This suite has no entry or
    // exit fees ahead of management, so the whole manager payout lands here.
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
