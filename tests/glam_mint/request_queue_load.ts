import { GlamClient, nameToChars, StateAccountType, WSOL } from "../../src";
import { BN, Wallet } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { InitMintParams } from "../../src/client/mint";

const txOptions = {
  simulate: true,
};

// Run heavy operations in smaller batches to avoid CI OOM
const BATCH_SIZE = Number(process.env.TEST_BATCH_SIZE || 10);
const TRANSFER_TX_CONCURRENCY = Number(
  process.env.TRANSFER_TX_CONCURRENCY || 5,
);

type Task<T = any> = () => Promise<T>;
async function runTasksInBatches<T>(
  tasks: Task<T>[],
  batchSize: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((task) => task());
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  return results;
}

/**
 * Load test for request queue and invest operations (subscribe, queued subscribe, queued redeem, fulfill, claim, cancel)
 *
 * Create 500 users and each queues 1 request (either subscription or redemption). During setup we transfer 1 SOL to each user from the manager.
 */
describe("request_queue_load", () => {
  const glamClientManager = new GlamClient();

  const userKeypairs = Array.from({ length: 1000 }, () => Keypair.generate());

  beforeAll(async () => {
    const ixs = userKeypairs.map((userKeypair) =>
      SystemProgram.transfer({
        fromPubkey: glamClientManager.signer,
        toPubkey: userKeypair.publicKey,
        lamports: 1_000_000_000,
      }),
    );

    // split ixs into chunks of 20, and pack each chunk into a transaction (~1200 bytes)
    const txns = ixs.reduce(
      (acc, ix, i) => {
        const chunkIndex = Math.floor(i / 20);
        if (!acc[chunkIndex]) {
          acc[chunkIndex] = new Transaction();
        }
        acc[chunkIndex].add(ix);
        return acc;
      },
      {} as Record<number, Transaction>,
    );

    const txnTasks = Object.values(txns).map(
      (txn) => () => glamClientManager.sendAndConfirm(txn),
    );
    const results = await runTasksInBatches(txnTasks, TRANSFER_TX_CONCURRENCY);
    console.log("Transfer results:", results);
  }, 15_000);

  it("Initialize mint", async () => {
    const name = "GLAM Mint Test Investor Flows";
    const params = {
      accountType: StateAccountType.TOKENIZED_VAULT,
      name: nameToChars(name),
      symbol: "GMT",
      uri: "https://glam.systems",
      baseAssetMint: WSOL,
      maxCap: new BN(1000_000_000_000), // 1000 SOL max cap
      minSubscription: new BN(100_000_000), // 0.1 SOL
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
    expect(stateModel.mintModel?.feeStructure.protocol.baseFeeBps).toEqual(1);
    expect(stateModel.mintModel?.feeStructure.protocol.flowFeeBps).toEqual(
      2000,
    );
  }, 25_000);

  it("250 users enqueue subscription requests #1", async () => {
    const tasks = userKeypairs.slice(0, 250).map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.subscribe(
        new BN(500_000_000),
        true,
        txOptions,
      );
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log("250 users enqueue requests results #1:", results);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue.data.length).toEqual(250);
  }, 120_000);

  it("250 users enqueue subscription requests #2", async () => {
    const tasks = userKeypairs.slice(250, 500).map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.subscribe(
        new BN(500_000_000),
        true,
        txOptions,
      );
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log("250 users enqueue requests results #2:", results);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue.data.length).toEqual(500);
  }, 120_000);

  it("250 users enqueue subscription requests #3", async () => {
    const tasks = userKeypairs.slice(500, 750).map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.subscribe(
        new BN(500_000_000),
        true,
        txOptions,
      );
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log("250 users enqueue requests results #3:", results);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue.data.length).toEqual(750);
  }, 120_000);

  it("250 users enqueue subscription requests #4", async () => {
    const tasks = userKeypairs.slice(750).map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.subscribe(
        new BN(500_000_000),
        true,
        txOptions,
      );
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log("250 users enqueue requests results #4:", results);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue.data.length).toEqual(1000);
  }, 120_000);

  it("Manager fulfills 500 subscription requests #1", async () => {
    try {
      const preInstructions = await glamClientManager.price.priceVaultIxs();
      const txSig = await glamClientManager.invest.fulfill(500, {
        ...txOptions,
        preInstructions,
      });
      console.log("Manager fulfills 500 subscription request #1:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Manager fulfills 500 subscription requests #2", async () => {
    try {
      const preInstructions = await glamClientManager.price.priceVaultIxs();
      const txSig = await glamClientManager.invest.fulfill(500, {
        ...txOptions,
        preInstructions,
      });
      console.log("Manager fulfills 500 subscription request #2:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Test apply timelock still works", async () => {
    try {
      const txSig = await glamClientManager.timelock.apply(txOptions);
      console.log("Manager apply:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Users claim shares from fulfilled subscription requests", async () => {
    // Last user claims first to test worst case scenario
    const tasks = userKeypairs.reverse().map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.claim(txOptions);
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "Users claim shares from fulfilled subscription requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue?.data.length).toBe(0);
  }, 120_000);

  it("[0, 200) users enqueue redemption requests", async () => {
    const tasks = userKeypairs.slice(0, 200).map((userKeypair) => async () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      const { amount } = await glamClientUser.getMintTokenBalance();
      return glamClientUser.invest.queuedRedeem(amount, txOptions);
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[0, 200) users enqueue redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 120_000);

  it("[200, 400) users enqueue redemption requests", async () => {
    const tasks = userKeypairs
      .slice(200, 400)
      .map((userKeypair) => async () => {
        const glamClientUser = new GlamClient({
          wallet: new Wallet(userKeypair),
        });
        glamClientUser.statePda = glamClientManager.statePda;
        const { amount } = await glamClientUser.getMintTokenBalance();
        return glamClientUser.invest.queuedRedeem(amount, txOptions);
      });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[200, 400) users enqueue redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 120_000);

  it("[400, 600) users enqueue redemption requests", async () => {
    const tasks = userKeypairs
      .slice(400, 600)
      .map((userKeypair) => async () => {
        const glamClientUser = new GlamClient({
          wallet: new Wallet(userKeypair),
        });
        glamClientUser.statePda = glamClientManager.statePda;
        const { amount } = await glamClientUser.getMintTokenBalance();
        return glamClientUser.invest.queuedRedeem(amount, txOptions);
      });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[400, 600) users enqueue redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 120_000);

  it("[600, 800) users enqueue redemption requests", async () => {
    const tasks = userKeypairs
      .slice(600, 800)
      .map((userKeypair) => async () => {
        const glamClientUser = new GlamClient({
          wallet: new Wallet(userKeypair),
        });
        glamClientUser.statePda = glamClientManager.statePda;
        const { amount } = await glamClientUser.getMintTokenBalance();
        return glamClientUser.invest.queuedRedeem(amount, txOptions);
      });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[600, 800) users enqueue redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 120_000);

  it("[800, 1000) users enqueue redemption requests", async () => {
    const tasks = userKeypairs.slice(800).map((userKeypair) => async () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      const { amount } = await glamClientUser.getMintTokenBalance();
      return glamClientUser.invest.queuedRedeem(amount, txOptions);
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[800, 1000) users enqueue redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 120_000);

  it("Manager fulfills 500 redemption requests #1", async () => {
    try {
      const preInstructions = await glamClientManager.price.priceVaultIxs();
      const txSig = await glamClientManager.invest.fulfill(500, {
        ...txOptions,
        preInstructions,
      });
      console.log("Manager fulfills 500 redemption request #1:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Manager fulfills 500 redemption requests #2", async () => {
    try {
      const preInstructions = await glamClientManager.price.priceVaultIxs();
      const txSig = await glamClientManager.invest.fulfill(500, {
        ...txOptions,
        preInstructions,
      });
      console.log("Manager fulfills 500 redemption request #2:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("[100, 1000) users claim tokens from fulfilled redemption requests", async () => {
    // Last user claims first to test worst case scenario
    const tasks = userKeypairs.slice(100, 1000).map((userKeypair) => () => {
      const glamClientUser = new GlamClient({
        wallet: new Wallet(userKeypair),
      });
      glamClientUser.statePda = glamClientManager.statePda;
      return glamClientUser.invest.claim(txOptions);
    });

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "[100, 1000) users claim tokens from fulfilled redemption requests results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue?.data.length).toBe(100);
  }, 120_000);

  it("Manager claims tokens for [0, 100) users", async () => {
    const tasks = userKeypairs
      .slice(0, 100)
      .map(
        (userKeypair) => () =>
          glamClientManager.invest.claimForUser(
            userKeypair.publicKey,
            txOptions,
          ),
      );

    try {
      const results = await runTasksInBatches(tasks, BATCH_SIZE);
      console.log(
        "Manager claimed tokens for [0, 100) users results:",
        results,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    const requestQueue = await glamClientManager.fetchRequestQueue();
    expect(requestQueue?.data.length).toBe(0);
  }, 120_000);

  it("Close mint and state", async () => {
    // Claim fees so that share supply becomes 0
    try {
      const txSig = await glamClientManager.fees.claimFees(txOptions);
      console.log("Manager claimed fees:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Disable state
    try {
      const txSig = await glamClientManager.access.emergencyAccessUpdate(
        { stateEnabled: false },
        txOptions,
      );
      console.log("Vault state disabled:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Close mint
    try {
      const txSig = await glamClientManager.mint.close(txOptions);
      console.log("Mint closed:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Close state
    try {
      const txSig = await glamClientManager.state.close(txOptions);
      console.log("Vault state closed:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 15_000);
});
