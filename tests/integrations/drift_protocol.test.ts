import { BN } from "@coral-xyz/anchor";
import {
  GlamClient,
  getOrderParams,
  MarketType,
  ModifyOrderParams,
  OrderType,
  PositionDirection,
  OrderStatus,
  Order,
  WSOL,
  stringToChars,
} from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  mintUSDC,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import { DriftProtocolPolicy } from "../../src/deser/integrationPolicies";

const txOptions = { simulate: true };

describe("drift_protocol", () => {
  const glamClient = new GlamClient();

  const getOpenOrders = async (subAccountId: number = 0): Promise<Order[]> => {
    const driftUser =
      await glamClient.drift.fetchAndParseDriftUser(subAccountId);
    return (driftUser?.orders || []).filter(
      (o) => o.status === OrderStatus.OPEN,
    );
  };

  // spot market allowlist: [0, 1] (USDC, SOL)
  // perp market allowlist: [0] (SOL)
  // borrowable: [WSOL]
  const restoreDefaultPolicy = async () => {
    const policy = new DriftProtocolPolicy([0, 1], [0], [WSOL]);
    await setPolicy(policy);
  };

  // allows nothing
  const setEmptyPolicy = async () => {
    const policy = new DriftProtocolPolicy([], [], []);
    await setPolicy(policy);
  };

  const setPolicy = async (policy: DriftProtocolPolicy) => {
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.extDriftProgram.programId,
        0b01, // drift protocol
        policy.encode(),
        txOptions,
      );
      console.log("setProtocolPolicy", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  it("Create and initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: stringToChars("Drift Protocol Tests"),
      integrationAcls: [
        {
          integrationProgram: glamClient.extDriftProgram.programId,
          protocolsBitmask: new BN(0b01), // drift protocol
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: new BN(0b01), // system program
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.extSplProgram.programId,
          protocolsBitmask: new BN(0b01), // token program
          protocolPolicies: [],
        },
      ],
      borrowable: [WSOL],
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const state = await glamClient.fetchStateAccount();
    expect(state.integrationAcls.length).toEqual(3);

    // Airdrop 100 SOL to vault
    await airdrop(glamClient.provider.connection, vaultPda, 100_000_000_000);

    // Mint USDC to vault (used as collateral)
    await mintUSDC(glamClient.provider.connection, vaultPda, 1_000_000);
  }, 30_000);

  it("Initialize user stats and create user #0", async () => {
    try {
      const txSig = await glamClient.drift.initialize(0, txOptions);
      console.log("driftInitialize", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const { user } = glamClient.drift.getDriftUserPdas();
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions).toEqual([user]);
  }, 15_000);

  it("Delete user #0", async () => {
    try {
      const txSig = await glamClient.drift.deleteUser(0, txOptions);
      console.log("deleteUser", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions).toEqual([]);
  }, 15_000);

  it("Initialize user #1", async () => {
    try {
      const txSig = await glamClient.drift.initialize(1, txOptions);
      console.log("driftInitialize", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const { user } = glamClient.drift.getDriftUserPdas(1);
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions).toEqual([user]);
  }, 15_000);

  it("Set empty policy - deposit and borrow fail", async () => {
    await setEmptyPolicy();

    const amount = new BN(10_000_000_000);
    try {
      const txSig = await glamClient.drift.deposit(amount, 1, 1, txOptions);
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Protocol policy violation");
    }

    // At this point there's no SOL deposited, so withdraw == borrow
    try {
      const txSig = await glamClient.drift.withdraw(amount, 1, 1, txOptions);
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Protocol policy violation");
    }

    await restoreDefaultPolicy();
  });

  it("Deposit 10 SOL and 10_000 USDC", async () => {
    const amount = new BN(10_000_000_000);
    try {
      const txSig1 = await glamClient.drift.deposit(amount, 1, 1, txOptions);
      console.log("driftDeposit SOL", txSig1);

      const txSig2 = await glamClient.drift.deposit(amount, 0, 1, txOptions);
      console.log("driftDeposit USDC", txSig2);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Withdraw 10 SOL (closing position)", async () => {
    const amount = new BN(10_000_000_000);
    try {
      const txSig = await glamClient.drift.withdraw(amount, 1, 1);
      console.log("driftWithdraw", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Borrow 1 SOL without market in spot_markets_allowlist - fail", async () => {
    // At this point, user has 0 SOL deposited, withdrawing 1 SOL => borrowing 1 SOL

    // Update policy to remove market 1 from spot_markets_allowlist but keep borrow allowlist
    const policy = new DriftProtocolPolicy([], [0], [WSOL]);
    await setPolicy(policy);

    try {
      const amount = new BN(1_000_000_000);
      const txSig = await glamClient.drift.withdraw(amount, 1, 1, txOptions);
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Protocol policy violation");
    }

    await restoreDefaultPolicy();
  });

  it("Borrow 1 SOL without asset in borrow_allowlist - fail", async () => {
    // At this point, user has 0 SOL deposited, withdrawing 1 SOL => borrowing 1 SOL

    // Update policy to remove WSOL from borrow allowlist
    const policy = new DriftProtocolPolicy([1], [0], []);
    await setPolicy(policy);

    try {
      const amount = new BN(10_000_000_000); // Withdraw 10 SOL (9 deposit + 1 borrow)
      const txSig = await glamClient.drift.withdraw(amount, 1, 1, txOptions);
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toEqual("Protocol policy violation");
    }

    await restoreDefaultPolicy();
  });

  it("Deposit 5 SOL to create initial position for borrow test", async () => {
    const amount = new BN(5_000_000_000);
    try {
      const txSig = await glamClient.drift.deposit(amount, 1, 1, txOptions);
      console.log("driftDeposit for borrow setup", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Borrow 3 SOL (withdraw 8 SOL total from 5 SOL deposit)", async () => {
    const amount = new BN(8_000_000_000);
    try {
      const txSig = await glamClient.drift.withdraw(amount, 1, 1, txOptions);
      console.log("driftBorrow", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Repay borrow (deposit 3 SOL to close borrow position)", async () => {
    // Remove market 1 from spot_markets_allowlist to ensure repay bypasses the allowlist
    const policy = new DriftProtocolPolicy([], [0], [WSOL]);
    await setPolicy(policy);

    try {
      const amount = new BN(3_000_000_000); // Repay 3 SOL borrow
      const txSig = await glamClient.drift.deposit(amount, 1, 1, txOptions);
      console.log("driftRepay", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    await restoreDefaultPolicy();
  });

  it("Place perp order", async () => {
    const orderParams = getOrderParams({
      orderType: OrderType.LIMIT,
      marketType: MarketType.PERP,
      direction: PositionDirection.LONG,
      marketIndex: 0, // SOL perp market
      baseAssetAmount: new BN(10_0000_000),
      price: new BN(100_000_000), // set a very low limit price
    });

    try {
      const txSig = await glamClient.drift.placeOrder(orderParams, 1);
      console.log("driftPlaceOrders", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Cancel orders", async () => {
    const openOrdersBefore = await getOpenOrders(1);
    expect(openOrdersBefore.length).toEqual(1);

    try {
      // SOL perp market index is 0
      const txId = await glamClient.drift.cancelOrders(
        MarketType.PERP,
        0,
        PositionDirection.LONG,
        1,
      );

      console.log("driftCancelOrders", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const openOrdersAfter = await getOpenOrders(1);
    expect(openOrdersAfter.length).toEqual(0);
  });

  it("Place spot order and modify it", async () => {
    const orderParams = getOrderParams({
      orderType: OrderType.LIMIT,
      marketType: MarketType.SPOT,
      direction: PositionDirection.LONG,
      marketIndex: 1,
      baseAssetAmount: new BN(10_0000_000),
      price: new BN(100_000_000), // set a very low limit price
    });

    try {
      const txEnableMarginTrading =
        await glamClient.drift.updateUserMarginTradingEnabled(true, 1);
      console.log("enableMargin", txEnableMarginTrading);

      const txPlaceSpotOrder = await glamClient.drift.placeOrder(
        orderParams,
        1,
        txOptions,
      );
      console.log("driftPlaceOrders", txPlaceSpotOrder);

      const openOrders = await getOpenOrders(1);
      expect(openOrders.length).toEqual(1);

      const { marketIndex, marketType, orderId } = openOrders[0];
      const modifyOrderParams: ModifyOrderParams = {
        direction: null,
        baseAssetAmount: null,
        price: new BN(110_000_000),
        reduceOnly: null,
        postOnly: null,
        bitFlags: null,
        maxTs: null,
        triggerPrice: null,
        triggerCondition: null,
        oraclePriceOffset: null,
        auctionDuration: null,
        auctionStartPrice: null,
        auctionEndPrice: null,
        policy: null,
      };
      const txModifyOrder = await glamClient.drift.modifyOrder(
        modifyOrderParams,
        orderId,
        marketIndex,
        marketType,
        1,
        txOptions,
      );
      console.log("modifyOrder", txModifyOrder);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Cancel orders by IDs", async () => {
    const openOrdersBefore = await getOpenOrders(1);
    expect(openOrdersBefore.length).toEqual(1);

    console.log("openOrdersBefore", openOrdersBefore);

    try {
      const txSig = await glamClient.drift.cancelOrdersByIds(
        openOrdersBefore.map((o) => o.orderId),
        1,
      );

      console.log("cancelOrdersByIds", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const openOrdersAfter = await getOpenOrders(1);
    expect(openOrdersAfter.length).toEqual(0);
  });
});
