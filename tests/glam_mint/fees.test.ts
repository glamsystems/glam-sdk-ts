import { Keypair, Transaction } from "@solana/web3.js";
import {
  AccruedFees,
  GlamClient,
  nameToChars,
  StateAccountType,
  WSOL,
  fetchMintAndTokenProgram,
} from "../../src";
import { airdrop, sleep, str2seed } from "../test-utils";
import { BN, Wallet } from "@coral-xyz/anchor";

const txOptions = {
  simulate: true,
};

const initTxOptions = {
  simulate: false,
};

describe("fees", () => {
  const glamClient = new GlamClient();
  const investor = Keypair.fromSeed(str2seed("fees-investor"));
  const glamClientInvestor = new GlamClient({ wallet: new Wallet(investor) });

  const precision = new BN(1_000_000_000);
  const delta = (after: AccruedFees, before: AccruedFees) =>
    Object.fromEntries(
      (Object.keys(after) as Array<keyof AccruedFees>).map((category) => [
        category,
        new BN(after[category]).sub(new BN(before[category])),
      ]),
    ) as Record<keyof AccruedFees, BN>;

  // After a claim each recipient holds less than one whole share: fractions
  // stay in the ledger until later accrual makes another share payable.
  const expectRecipientsSettled = (claimableFees: AccruedFees) => {
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
  };

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

  it("Investor subscribes with 1000 SOL", async () => {
    // AUM-based fees accrue on share supply, so an empty vault accrues none
    // (GLAM-867). The suite needs an investor before it can measure accrual.
    await airdrop(
      glamClient.provider.connection,
      investor.publicKey,
      1_001_000_000_000,
    );
    glamClientInvestor.statePda = glamClient.statePda;
    const preInstructions = await glamClientInvestor.price.priceVaultIxs();
    try {
      const txSig = await glamClientInvestor.invest.subscribe(
        new BN(1_000_000_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      console.log("Investor subscribes:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // The first deposit is priced at 1 share per SOL. The 0.1% vault
    // subscription fee is never minted; the 0.1% manager subscription fee
    // sits in escrow as one whole share.
    const { mint } = await fetchMintAndTokenProgram(
      glamClient.connection,
      glamClient.mintPda,
    );
    expect(mint.supply.toString()).toEqual("999000000000");
    const { claimableFees } = (await glamClient.fetchStateModel()).mintModel!;
    expect(new BN(claimableFees!.managerSubscriptionFee).toString()).toEqual(
      "1000000000000000000", // precision adjusted
    );
    expect(new BN(claimableFees!.managementFee).eq(new BN(0))).toBeTruthy();
    expect(new BN(claimableFees!.performanceFee).eq(new BN(0))).toBeTruthy();
  }, 15_000);

  it("Settle entry-time fees", async () => {
    // The vault subscription fee stayed in the vault, so NAV sits above the
    // 1.0 benchmark: the first crystallization charges a performance fee on
    // that uplift and raises the high-water mark. Claiming everything here
    // leaves the next two tests measuring time-based accrual alone.
    try {
      const txSig = await glamClient.fees.crystallizeFees(txOptions);
      console.log("Settle entry-time fees, crystallize:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const crystallized = (await glamClient.fetchStateModel()).mintModel!
      .claimableFees!;
    expect(new BN(crystallized.performanceFee).gt(new BN(0))).toBeTruthy();

    try {
      const txSig = await glamClient.fees.claimFees(txOptions);
      console.log("Settle entry-time fees, claim:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const { claimableFees } = (await glamClient.fetchStateModel()).mintModel!;
    expectRecipientsSettled(claimableFees!);
  }, 10_000);

  it("Crystallize fees", async () => {
    await sleep(10_000); // more time elapsed, more fees generated

    const before = (await glamClient.fetchStateModel()).mintModel!;
    const beforeClaimableFees = before.claimableFees!;
    const beforeClaimedFees = before.claimedFees!;

    try {
      const txSig = await glamClient.fees.crystallizeFees(txOptions);
      console.log("Crystallize fees txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // AUM-based fees accrue. NAV is below the high-water mark set when the
    // entry-time fees settled, so no performance fee accrues, and
    // crystallization never moves the claimed ledger.
    const mintModel = (await glamClient.fetchStateModel()).mintModel!;
    const accrued = delta(mintModel.claimableFees!, beforeClaimableFees);
    const claimed = delta(mintModel.claimedFees!, beforeClaimedFees);
    Object.values(claimed).forEach((fee) => {
      expect(fee.eq(new BN(0))).toBeTruthy();
    });
    expect(accrued.managementFee.gt(new BN(0))).toBeTruthy();
    expect(accrued.performanceFee.eq(new BN(0))).toBeTruthy();
    expect(accrued.protocolBaseFee.gt(new BN(0))).toBeTruthy();
    expect(accrued.protocolFlowFee.gt(new BN(0))).toBeTruthy();

    const flowRateBps = mintModel.feeStructure!.protocol.flowFeeBps;
    const flowNumerator = accrued.managementFee
      .add(accrued.performanceFee)
      .mul(new BN(flowRateBps));
    expect(flowRateBps).toEqual(2_000);
    expect(flowNumerator.gt(new BN(0))).toBeTruthy();
    // Validator time determines this live accrual's remainder. The deterministic
    // nondivisible floor-versus-ceiling regression remains in the native and LiteSVM suites.
    expect(
      accrued.protocolFlowFee.eq(flowNumerator.div(new BN(10_000))),
    ).toBeTruthy();
  }, 15_000);

  it("Claim fees", async () => {
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
    expectRecipientsSettled(claimableFees);
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

    // Claimed amounts are attributed in draw order: entry fees, exit fees,
    // management, then performance for the manager; flow, then base for the
    // protocol. The entry fees settled earlier, so this manager payout draws
    // from management. Whatever the performance category gives up is the
    // leftover of that settlement (the manager's fraction plus flow carve-out
    // the protocol had not drawn yet); no performance fee accrued, as the
    // crystallization step pinned.
    const claimed = delta(claimedFees, beforeClaimedFees);
    expect(claimed.managementFee.gt(new BN(0))).toBeTruthy();
    expect(claimed.protocolBaseFee.gt(new BN(0))).toBeTruthy();
    expect(claimed.protocolFlowFee.gt(new BN(0))).toBeTruthy();
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
