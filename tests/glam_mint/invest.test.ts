import {
  GlamClient,
  stringToChars,
  StateAccountType,
  WSOL,
  fetchMintAndTokenProgram,
} from "../../src";
import { airdrop, str2seed } from "../test-utils";
import { BN, Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";

const txOptions = {
  simulate: true,
};

describe("invest", () => {
  const glamClientManager = new GlamClient({
    jupiterApiKey: "jupiter-api-key-mock",
  });

  const userKeypairs = [
    Keypair.fromSeed(str2seed("alice")),
    Keypair.fromSeed(str2seed("bob")),
    Keypair.fromSeed(str2seed("eve")),
    Keypair.fromSeed(str2seed("rich")),
  ];
  const alice = userKeypairs[0];
  const bob = userKeypairs[1];
  const eve = userKeypairs[2];
  const rich = userKeypairs[3];
  const glamClientAlice = new GlamClient({
    wallet: new Wallet(alice),
    jupiterApiKey: "jupiter-api-key-mock",
  });
  const glamClientBob = new GlamClient({
    wallet: new Wallet(bob),
    jupiterApiKey: "jupiter-api-key-mock",
  });
  const glamClientEve = new GlamClient({
    wallet: new Wallet(eve),
    jupiterApiKey: "jupiter-api-key-mock",
  });
  const glamClientRich = new GlamClient({
    wallet: new Wallet(rich),
    jupiterApiKey: "jupiter-api-key-mock",
  });

  const fetchGlamMintSupply = async () => {
    const { mint } = await fetchMintAndTokenProgram(
      glamClientAlice.connection,
      glamClientManager.mintPda,
    );
    return Number(mint.supply.toString());
  };

  beforeAll(async () => {
    let connection = glamClientManager.provider.connection;
    let tenSOL = 10_000_000_000;
    await Promise.all([
      airdrop(connection, alice.publicKey, tenSOL),
      airdrop(connection, bob.publicKey, tenSOL),
      airdrop(connection, eve.publicKey, tenSOL),
      airdrop(connection, rich.publicKey, tenSOL * 10000),
    ]);
  }, 15_000);

  it("Initialize mint", async () => {
    const name = "GLAM Mint Test Investor Flows";
    const params = {
      accountType: StateAccountType.TOKENIZED_VAULT,
      name: stringToChars(name),
      symbol: "GMT",
      uri: "https://glam.systems",
      baseAssetMint: WSOL,
      blocklist: [eve.publicKey],
      maxCap: new BN(1000_000_000_000), // 1000 SOL max cap
      minSubscription: new BN(1_000_000_000),
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
      notifyAndSettle: {
        model: { continuous: {} },
        permissionlessFulfillment: false,
        subscribeNoticePeriodType: { soft: {} },
        subscribeNoticePeriod: new BN(5),
        subscribeSettlementPeriod: new BN(15),
        subscribeCancellationWindow: new BN(5),
        redeemNoticePeriodType: { soft: {} },
        redeemNoticePeriod: new BN(5),
        redeemSettlementPeriod: new BN(15),
        redeemCancellationWindow: new BN(5),
        timeUnit: { slot: {} },
        padding: [0, 0, 0],
      },
    };

    try {
      const txSig = await glamClientManager.mint.initialize(params, txOptions);
      console.log("Initialize mint txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    console.log("State PDA:", glamClientManager.statePda.toBase58());
    console.log("Vault PDA:", glamClientManager.vaultPda.toBase58());
    console.log("Mint PDA:", glamClientManager.mintPda.toBase58());
    console.log("Escrow PDA:", glamClientManager.escrowPda.toBase58());

    const stateModel = await glamClientManager.fetchStateModel();
    expect(stateModel.nameStr).toEqual(name);
    expect(stateModel.mintModel?.feeStructure.protocol.baseFeeBps).toEqual(20);
    expect(stateModel.mintModel?.feeStructure.protocol.flowFeeBps).toEqual(0);
    expect(stateModel.mintModel?.minSubscription.toNumber()).toEqual(
      1_000_000_000,
    );
    expect(stateModel.mintModel?.blocklist).toEqual([eve.publicKey]);

    // Set state PDA for user glam clients
    glamClientAlice.statePda = glamClientManager.statePda;
    glamClientBob.statePda = glamClientManager.statePda;
    glamClientEve.statePda = glamClientManager.statePda;
    glamClientRich.statePda = glamClientManager.statePda;
  }, 25_000);

  it("Update protocol fees", async () => {
    try {
      const txSig = await glamClientManager.fees.setProtocolFees(
        1,
        2000,
        txOptions,
      );
      console.log("Update protocol fees:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Pause subscription", async () => {
    try {
      const txSig = await glamClientManager.mint.pauseSubscription(txOptions);
      console.log("Pause subscription", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Bob fails to subscribe: subscription paused", async () => {
    const preInstructions = await glamClientBob.price.priceVaultIxs();
    try {
      const txSig = await glamClientBob.invest.subscribe(
        new BN(500_000_000),
        true,
        { ...txOptions, preInstructions },
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toBe("Requested action is paused.");
    }
  });

  it("Unpause subscription", async () => {
    try {
      const txSig = await glamClientManager.mint.unpauseSubscription(txOptions);
      console.log("Unpause subscription", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Bob fails to subscribe: amount < min subscription amount", async () => {
    const preInstructions = await glamClientBob.price.priceVaultIxs();
    try {
      const txSig = await glamClientBob.invest.subscribe(
        new BN(500_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Amount below minimum threshold");
    }
  });

  it("Eve fails to subscribe due to blocklist", async () => {
    const preInstructions = await glamClientEve.price.priceVaultIxs();
    try {
      const txSig = await glamClientEve.invest.subscribe(
        new BN(5_000_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Signer is not authorized");
    }
  });

  it("Rich fails to subscribe: max cap exceeded", async () => {
    const preInstructions = await glamClientRich.price.priceVaultIxs();
    try {
      const txSig = await glamClientRich.invest.subscribe(
        new BN(2_000_000_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Max cap exceeded");
    }
  });

  it("Alice subscribes with 5 SOL", async () => {
    const preInstructions = await glamClientAlice.price.priceVaultIxs();
    try {
      const txSig = await glamClientAlice.invest.subscribe(
        new BN(5_000_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      console.log("Alice instant subscription:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const { uiAmount: vaultWsolBalance } =
      await glamClientAlice.getVaultTokenBalance(WSOL);
    expect(vaultWsolBalance).toEqual(5);

    // Alice is the first investor, getting 1 share per SOL
    // share_supply == alice_deposit_amount - 0.1% shares burned as vault subscription fee
    // also share_supply == alice_share + escrow_share (manager subscription fee)
    const { mint: glamMint } = await fetchMintAndTokenProgram(
      glamClientAlice.connection,
      glamClientAlice.mintPda,
    );
    const aliceShares = await glamClientAlice.getMintTokenBalance(
      alice.publicKey,
    );
    const escrowShares = await glamClientAlice.getMintTokenBalance(
      glamClientAlice.escrowPda,
    );
    expect(glamMint.supply.toString()).toEqual("4995000000");
    expect(aliceShares.amount).toEqual(new BN("4990000000"));
    expect(escrowShares.amount).toEqual(new BN("5000000"));

    // Verify fees recorded
    const claimableFees = await glamClientAlice.fees.getClaimableFees();
    const claimedFees = await glamClientAlice.fees.getClaimedFees();
    expect(claimableFees.managerSubscriptionFee.toString()).toEqual(
      "5000000000000000",
    ); // precision adjusted
    expect(claimedFees.vaultSubscriptionFee.toString()).toEqual(
      "5000000000000000",
    ); // precision adjusted
  });

  it("Bob requests to subscribe with 5 SOL", async () => {
    try {
      const txSig = await glamClientBob.invest.subscribe(
        new BN(5_000_000_000),
        true,
        txOptions,
      );
      console.log("Bob requests to subscribe:", txSig);
    } catch (e) {
      throw e;
    }

    const escrowWSol = (
      await glamClientBob.getSolAndTokenBalances(glamClientBob.escrowPda)
    ).tokenAccounts.find((ta) => ta.mint.equals(WSOL));
    expect(escrowWSol?.uiAmount).toEqual(5);
  });

  it("Rich requests to subscribe with 5 SOL and cancels", async () => {
    try {
      const txSig = await glamClientRich.invest.subscribe(
        new BN(5_000_000_000),
        true,
        txOptions,
      );
      console.log("Rich requests to subscribe:", txSig);
    } catch (e) {
      throw e;
    }

    const escrowWSol = (
      await glamClientRich.getSolAndTokenBalances(glamClientRich.escrowPda)
    ).tokenAccounts.find((ta) => ta.mint.equals(WSOL));
    expect(escrowWSol?.uiAmount).toEqual(10);

    try {
      const txSig = await glamClientRich.invest.cancel(txOptions);
      console.log("Rich cancels subscription request:", txSig);
    } catch (e) {
      throw e;
    }

    const escrowWSolAfterCancel = (
      await glamClientRich.getSolAndTokenBalances(glamClientRich.escrowPda)
    ).tokenAccounts.find((ta) => ta.mint.equals(WSOL));

    expect(escrowWSolAfterCancel?.uiAmount).toEqual(5);
  });

  it("Pause redemption", async () => {
    try {
      const txSig = await glamClientManager.mint.pauseRedemption(txOptions);
      console.log("Pause redemption", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Alice fails to redeem: redemption paused", async () => {
    try {
      const txSig = await glamClientAlice.invest.queuedRedeem(
        new BN(1_000_000_000),
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toBe("Requested action is paused.");
    }
  });

  it("Unpause redemption", async () => {
    try {
      const txSig = await glamClientManager.mint.unpauseRedemption(txOptions);
      console.log("Unpause redemption", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Alice requests to redeem 1 share", async () => {
    const shares = new BN(1_000_000_000);
    const glamMintSupplyBefore = await fetchGlamMintSupply();
    const aliceSharesBefore = await glamClientAlice.getMintTokenBalance();
    const escrowSharesBefore = await glamClientAlice.getMintTokenBalance(
      glamClientAlice.escrowPda,
    );

    // 1st request - success
    try {
      const txSig = await glamClientAlice.invest.queuedRedeem(
        shares,
        txOptions,
      );
      console.log("Alice requests to redeem:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // 2nd request - fail
    try {
      const txSig = await glamClientAlice.invest.queuedRedeem(
        shares,
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toBe("New request is not allowed.");
    }

    const glamMintSupplyAfter = await fetchGlamMintSupply();
    const aliceSharesAfter = await glamClientAlice.getMintTokenBalance();
    const escrowSharesAfter = await glamClientAlice.getMintTokenBalance(
      glamClientAlice.escrowPda,
    );

    // No shares burned when redemption request is not fulfilled
    // Alice shares++, escrow shares--
    expect(glamMintSupplyBefore).toEqual(glamMintSupplyAfter);
    expect(aliceSharesAfter.amount).toEqual(
      aliceSharesBefore.amount.sub(shares),
    );
    expect(escrowSharesAfter.amount).toEqual(
      escrowSharesBefore.amount.add(shares),
    );

    // Fetch subscriber account and verify redemption request
    const pendingRequest = await glamClientAlice.invest.fetchPendingRequest();
    console.log("Alice's pending redemption request:", pendingRequest);
    expect(pendingRequest.incoming.toString()).toEqual(shares.toString());
    expect(pendingRequest.createdAt.toNumber()).toBeGreaterThan(0);
    expect(pendingRequest.outgoing.toNumber()).toEqual(0);
    expect(pendingRequest.fulfilledAt.toNumber()).toEqual(0);
  });

  it("Alice fails to fulfill", async () => {
    // Alice attempts to fulfill, should fail due to permissionless fulfillment disabled
    try {
      const preInstructions = await glamClientAlice.price.priceVaultIxs();
      const txFulfill = await glamClientAlice.invest.fulfill(null, {
        ...txOptions,
        preInstructions,
      });
      expect(txFulfill).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Signer is not authorized");
    }
  });

  it("Manager fulfills Alice's redemption request and Bob's subscription request", async () => {
    const glamMintSupplyBefore = await fetchGlamMintSupply();
    try {
      const preInstructions = await glamClientManager.price.priceVaultIxs();
      const txFulfill = await glamClientManager.invest.fulfill(null, {
        ...txOptions,
        preInstructions,
      });
      console.log("Manager fulfills Alice's redemption request:", txFulfill);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const glamMintSupplyAfter = await fetchGlamMintSupply();
    const claimableFees = await glamClientManager.fees.getClaimableFees();
    const claimedFees = await glamClientManager.fees.getClaimedFees();

    // Fulfilled Bob's 5 SOL subscription and Alice's 1 share redemption
    // New shares will be issued
    const sharesMinted = glamMintSupplyAfter - glamMintSupplyBefore;
    expect(sharesMinted).toBeLessThan(4_000_000_000);
    expect(sharesMinted).toBeGreaterThan(3_990_000_000);

    // The following are all fee shares that aren't burned
    // protocol flow fee = 20% of all manager fees
    // protocol base fee = 10% management fee
    const paManagerSubscriptionFee = new BN(
      claimableFees.managerSubscriptionFee,
    );
    const paManagerRedemptionFee = new BN(claimableFees.managerRedemptionFee);
    const paManagementFee = new BN(claimableFees.managementFee);
    const paPerformanceFee = new BN(claimableFees.performanceFee);
    const paProtocolBaseFee = new BN(claimableFees.protocolBaseFee);
    const paAllManagerFees = paManagerSubscriptionFee
      .add(paManagerRedemptionFee)
      .add(paManagementFee)
      .add(paPerformanceFee)
      .add(paProtocolBaseFee);

    const paProtocolFlowFee = new BN(claimableFees.protocolFlowFee);
    expect(
      paAllManagerFees
        .mul(new BN(20))
        .div(new BN(100))
        .div(new BN(1e9))
        .toString(),
    ).toEqual(paProtocolFlowFee.div(new BN(1e9)).toString());
    expect(
      paManagementFee
        .mul(new BN(10))
        .div(new BN(100))
        .div(new BN(1e9))
        .toString(),
    ).toEqual(paProtocolBaseFee.div(new BN(1e9)).toString());

    // Vault redemption fee is considered immediately claimed after crystallization
    expect(claimedFees.vaultRedemptionFee.toString()).toEqual(
      "2000000000000000",
    );
  }, 15_000);

  it("Alice claims deposit asset from redeemed shares", async () => {
    try {
      const txClaim = await glamClientAlice.invest.claim(txOptions);
      console.log("Alice claims redemption request:", txClaim);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Redemption request should be deleted
    const pendingRequest = await glamClientAlice.invest.fetchPendingRequest();
    expect(pendingRequest).toBeNull();
  });

  it("Bob claims shares from deposit", async () => {
    try {
      const txClaim = await glamClientBob.invest.claim(txOptions);
      console.log("Bob claims subscription request:", txClaim);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Pending request should be deleted
    const pendingRequest = await glamClientBob.invest.fetchPendingRequest();
    expect(pendingRequest).toBeNull();
  });

  it("Alice queues subscription, manager cancels it", async () => {
    try {
      const txSig = await glamClientAlice.invest.subscribe(
        new BN(1_000_000_000),
        true,
        txOptions,
      );
      console.log("Alice queues subscription:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const pendingRequest = await glamClientAlice.invest.fetchPendingRequest();
    expect(pendingRequest.user).toEqual(alice.publicKey);

    // Bob attempts to cancel Alice's request, fail
    try {
      const txSig = await glamClientBob.invest.cancelForUser(
        alice.publicKey,
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Signer is not authorized");
    }

    // Manager can cancel Alice's request
    try {
      const txSig = await glamClientManager.invest.cancelForUser(
        alice.publicKey,
        txOptions,
      );
      console.log("Manager cancels Alice's subscription:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const pendingRequestAfter =
      await glamClientAlice.invest.fetchPendingRequest();
    expect(pendingRequestAfter).toBeNull();
  });

  it("Bob queues redemption, manager cancels it", async () => {
    try {
      const txSig = await glamClientBob.invest.queuedRedeem(
        new BN(1_000_000_000),
        txOptions,
      );
      console.log("Bob queues redemption:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const pendingRequest = await glamClientBob.invest.fetchPendingRequest();
    expect(pendingRequest.user).toEqual(bob.publicKey);

    // Alice attempts to cancel Bob's request, fail
    try {
      const txSig = await glamClientAlice.invest.cancelForUser(
        bob.publicKey,
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toContain("Signer is not authorized");
    }

    // Manager can cancel Bob's request
    try {
      const txSig = await glamClientManager.invest.cancelForUser(
        bob.publicKey,
        txOptions,
      );
      console.log("Manager cancels Bob's redemption:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const pendingRequestAfter =
      await glamClientBob.invest.fetchPendingRequest();
    expect(pendingRequestAfter).toBeNull();
  });
});
