import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  GlamClient,
  nameToChars,
  StateAccountType,
  fetchMintAndTokenProgram,
} from "../../src";
import { airdrop, str2seed } from "../test-utils";
import { BN, Wallet } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";

const txOptions = {
  simulate: true,
};

describe("single_asset_vault", () => {
  const glamClientManager = new GlamClient({
    jupiterApiKey: "jupiter-api-key-mock",
  });
  const baseAssetMint = Keypair.fromSeed(str2seed("base_asset"));

  const userKeypairs = [
    Keypair.fromSeed(str2seed("alice")),
    Keypair.fromSeed(str2seed("bob")),
  ];
  const alice = userKeypairs[0];
  const bob = userKeypairs[1];

  const glamClientAlice = new GlamClient({
    wallet: new Wallet(alice),
    jupiterApiKey: "jupiter-api-key-mock",
  });
  const glamClientBob = new GlamClient({
    wallet: new Wallet(bob),
    jupiterApiKey: "jupiter-api-key-mock",
  });

  const fetchGlamMintSupply = async () => {
    const { connection, mintPda } = glamClientManager;
    const { mint } = await fetchMintAndTokenProgram(connection, mintPda);
    return Number(mint.supply.toString());
  };

  it("Initialize base asset mint", async () => {
    const { connection } = glamClientManager;

    //
    // Create a custom base asset mint with 6 decimals
    //
    const createMintAccountIx = SystemProgram.createAccount({
      fromPubkey: glamClientManager.signer,
      newAccountPubkey: baseAssetMint.publicKey,
      space: MINT_SIZE,
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      programId: TOKEN_PROGRAM_ID,
    });
    const initializeMintIx = createInitializeMintInstruction(
      baseAssetMint.publicKey,
      6,
      baseAssetMint.publicKey,
      null,
    );
    const transferSolToMintAuthorityIx = SystemProgram.transfer({
      fromPubkey: glamClientManager.signer,
      toPubkey: baseAssetMint.publicKey,
      lamports: 1_000_000_000,
    });
    const tx = new Transaction().add(
      createMintAccountIx,
      initializeMintIx,
      transferSolToMintAuthorityIx,
    );
    const txSig = await glamClientManager.sendAndConfirm(tx, [baseAssetMint]);
    console.log("Initialize base asset mint", txSig);

    //
    // Airdrop base asset to users
    //
    const amount = 1_000_000_000; // 1000 base asset
    const aliceAta = getAssociatedTokenAddressSync(
      baseAssetMint.publicKey,
      alice.publicKey,
    );
    const bobAta = getAssociatedTokenAddressSync(
      baseAssetMint.publicKey,
      bob.publicKey,
    );
    const createAliceAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClientManager.signer,
      aliceAta,
      alice.publicKey,
      baseAssetMint.publicKey,
    );
    const createBobAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClientManager.signer,
      bobAta,
      bob.publicKey,
      baseAssetMint.publicKey,
    );
    const mintToAliceIx = createMintToInstruction(
      baseAssetMint.publicKey,
      aliceAta,
      baseAssetMint.publicKey,
      amount,
    );
    const mintToBobIx = createMintToInstruction(
      baseAssetMint.publicKey,
      bobAta,
      baseAssetMint.publicKey,
      amount,
    );
    const txAirdropBaseAsset = new Transaction().add(
      createAliceAtaIx,
      createBobAtaIx,
      mintToAliceIx,
      mintToBobIx,
    );
    const txSigAirdropBaseAsset = await glamClientManager.sendAndConfirm(
      txAirdropBaseAsset,
      [baseAssetMint],
    );
    console.log("Airdrop base asset", txSigAirdropBaseAsset);

    //
    // Airdrop SOL to users to pay for fees
    //
    await Promise.all([
      airdrop(connection, alice.publicKey, 1_000_000_000),
      airdrop(connection, bob.publicKey, 1_000_000_000),
    ]);
  }, 15_000);

  it("Initialize mint", async () => {
    const name = "Single Asset Vault Investor Flow";
    const params = {
      accountType: StateAccountType.SINGLE_ASSET_VAULT,
      name: nameToChars(name),
      symbol: "SAV",
      uri: "https://glam.systems",
      baseAssetMint: baseAssetMint.publicKey,
      maxCap: new BN(1_000_000_000), // 1000 base asset
      minSubscription: new BN(1_000_000),
      feeStructure: {
        vault: {
          subscriptionFeeBps: 10,
          redemptionFeeBps: 10,
        },
        manager: {
          subscriptionFeeBps: 0,
          redemptionFeeBps: 0,
        },
        management: {
          feeBps: 0,
        },
        performance: {
          feeBps: 0,
          hurdleRateBps: 0,
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
        subscribeNoticePeriod: new BN(0),
        subscribeSettlementPeriod: new BN(0),
        subscribeCancellationWindow: new BN(0),
        redeemNoticePeriodType: { soft: {} },
        redeemNoticePeriod: new BN(0),
        redeemSettlementPeriod: new BN(0),
        redeemCancellationWindow: new BN(0),
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
    expect(stateModel.mintModel?.minSubscription.toNumber()).toEqual(1_000_000);

    // Set state PDA for user glam clients
    glamClientAlice.statePda = glamClientManager.statePda;
    glamClientBob.statePda = glamClientManager.statePda;
  }, 25_000);

  it("Alice subscribes with 5 base asset", async () => {
    const preInstructions = await glamClientAlice.price.priceVaultIxs();

    try {
      const txSig = await glamClientAlice.invest.subscribe(
        new BN(5_000_000),
        false,
        { ...txOptions, preInstructions },
      );
      console.log("Alice instant subscription:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const { uiAmount: vaultBaseAssetBalance } =
      await glamClientAlice.getVaultTokenBalance(baseAssetMint.publicKey);
    expect(vaultBaseAssetBalance).toEqual(5);

    // Alice is the first investor, getting 1 share per USDC
    // share_supply == alice_deposit_amount - 0.1% shares burned as vault subscription fee
    const sharesSupply = await fetchGlamMintSupply();
    const aliceShares = await glamClientAlice.getMintTokenBalance(
      alice.publicKey,
    );
    const escrowShares = await glamClientAlice.getMintTokenBalance(
      glamClientAlice.escrowPda,
    );
    expect(sharesSupply.toString()).toEqual("4995000");
    expect(aliceShares.amount).toEqual(new BN("4995000"));
    expect(escrowShares.amount).toEqual(new BN(0));

    // Verify fees recorded
    const claimableFees = await glamClientAlice.fees.getClaimableFees();
    const claimedFees = await glamClientAlice.fees.getClaimedFees();
    expect(claimableFees.managerSubscriptionFee.toString()).toEqual("0"); // precision adjusted
    expect(claimedFees.vaultSubscriptionFee.toString()).toEqual(
      "5000000000000",
    ); // precision adjusted
  });

  it("Alice requests to redeem 1 share", async () => {
    const shares = new BN(1_000_000);
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

  it("Manager fulfills Alice's redemption request", async () => {
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

    // Fetch subscriber account and verify redemption request
    const pendingRequest = await glamClientAlice.invest.fetchPendingRequest();
    console.log("Alice's fulfilled redemption request:", pendingRequest);
    expect(pendingRequest.outgoing.toNumber()).toBeGreaterThan(0);
    expect(pendingRequest.fulfilledAt.toNumber()).toBeGreaterThan(0);
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
});
