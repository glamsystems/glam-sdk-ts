import {
  ComputeBudgetProgram,
  Connection,
  MessageV1,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  DEFAULT_HEAP_SIZE,
  RUNTIME_COMPUTE_UNIT_LIMIT,
  RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
  SerializableMessageV1,
  V1Transaction,
  assertV1TransactionLimits,
  compileToV1Message,
} from "../../src/utils/messageV1";
import {
  computeBudgetInstructions,
  resolveComputeBudget,
} from "../../src/utils/computeBudget";
import { getSimulationResult } from "../../src/utils/transaction";

// A version 1 message states its budget in the message header, so the SDK has
// no reason to build a Compute Budget instruction on that path: it computes the
// numbers and writes them down. The fold in `compileToV1Message` stays, but as
// the safety net for instruction lists that arrive from outside — a caller's
// preInstructions, a route a quote API returned, a builder that hands back a
// flat list — and never as the way the SDK states its own budget.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

function key(index: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = index;
  bytes[31] = 13;
  return new PublicKey(bytes);
}

const PAYER = key(100);
const PROGRAM = key(101);

/** The heap frame `pricePhoenixTradersIxs` puts in front of its pricing ix. */
const PHOENIX_REQUEST_HEAP_FRAME_BYTES = 256 * 1024;

function plainIx(seed = 1): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [{ pubkey: key(seed), isSigner: false, isWritable: true }],
    data: Buffer.from([seed]),
  });
}

function legacyTx(instructions: TransactionInstruction[]) {
  const tx = new Transaction();
  tx.add(...instructions);
  return tx;
}

/**
 * Compute unit figures a simulation can report. The margins add 150 units and
 * multiply by 1.2, so a figure whose result is not whole gives a fractional
 * limit, and that is where the two versions could state different numbers:
 * `setComputeUnitLimit` truncates a float into its u32 field, and the header's
 * own field is written from the same number. 200,000 is the one entry here
 * that lands on an integer, so a case that uses it alone cannot tell the two
 * roundings apart.
 */
const BUDGET_FIXTURES: Array<[unitsConsumed: number, limit: number]> = [
  [7, 188], // 157 * 1.2 = 188.4
  [1_151, 1_561], // 1,301 * 1.2 = 1,561.2
  [123_457, 148_328], // 123,607 * 1.2 = 148,328.4
  [200_000, 240_180], // 200,150 * 1.2 = 240,180, the one whole result
];
const SIMULATED_UNITS = BUDGET_FIXTURES.map(([unitsConsumed]) => unitsConsumed);

function createClient(unitsConsumed = 200_000) {
  const connection = {
    commitment: "confirmed",
    rpcEndpoint: "http://localhost:8899",
    simulateTransaction: jest.fn(async () => ({
      context: { slot: 1 },
      value: { err: null, unitsConsumed },
    })),
  };
  const client = Object.create(BaseClient.prototype) as BaseClient;
  Object.assign(client, {
    cluster: ClusterNetwork.Devnet,
    provider: { connection, publicKey: PAYER },
    blockhashWithCache: {
      get: jest.fn(async () => ({
        blockhash: BLOCKHASH,
        lastValidBlockHeight: 1,
      })),
    },
    onSentListeners: new Set(),
    staging: false,
  });
  return client;
}

/**
 * Every way this SDK could build a Compute Budget instruction, watched at once.
 * `ComputeBudgetProgram` is the only door: an instruction assembled by hand
 * would still be folded, and the post condition below is what catches that.
 */
function watchComputeBudgetProgram() {
  const spies = {
    setComputeUnitLimit: jest.spyOn(
      ComputeBudgetProgram,
      "setComputeUnitLimit",
    ),
    setComputeUnitPrice: jest.spyOn(
      ComputeBudgetProgram,
      "setComputeUnitPrice",
    ),
    requestHeapFrame: jest.spyOn(ComputeBudgetProgram, "requestHeapFrame"),
    requestUnits: jest.spyOn(ComputeBudgetProgram, "requestUnits"),
  };
  return {
    callCount: () =>
      Object.values(spies).reduce((n, spy) => n + spy.mock.calls.length, 0),
    restore: () => Object.values(spies).forEach((spy) => spy.mockRestore()),
  };
}

describe("the version 1 path builds no Compute Budget instruction", () => {
  it("states the budget and constructs nothing", async () => {
    const client = createClient();
    const watch = watchComputeBudgetProgram();
    try {
      const built = await client.intoVersionedTransaction(
        legacyTx([plainIx(7)]),
        { transactionVersion: 1 },
      );

      expect(watch.callCount()).toBe(0);
      const config = (built.message as MessageV1).transactionConfig;
      // The numbers the version 0 path would have stated: (200,000 + 150) *
      // 1.2 = 240,180 units at the default 10,000 microLamports a unit, which
      // is 2,401.8 lamports in total, rounded up.
      expect(config.computeUnitLimit).toBe(240_180);
      expect(config.priorityFee).toBe(2_402);
      expect(config.heapSize).toBe(DEFAULT_HEAP_SIZE);
      expect(config.loadedAccountsDataSizeLimit).toBe(
        RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
      );
      expect(built.message.compiledInstructions).toHaveLength(1);
    } finally {
      watch.restore();
    }
  });

  it.each(SIMULATED_UNITS)(
    "states the same numbers the version 0 path encodes (%i units consumed)",
    async (unitsConsumed) => {
      const v0 = await createClient(unitsConsumed).intoVersionedTransaction(
        legacyTx([plainIx(7)]),
        { transactionVersion: 0 },
      );
      const v1 = await createClient(unitsConsumed).intoVersionedTransaction(
        legacyTx([plainIx(7)]),
        { transactionVersion: 1 },
      );

      // Read the two Compute Budget instructions back out of the version 0
      // message: the price in micro lamports a unit and the limit in units.
      const cbIndex = v0.message.staticAccountKeys.findIndex((k) =>
        k.equals(ComputeBudgetProgram.programId),
      );
      const cb = v0.message.compiledInstructions.filter(
        (ix) => ix.programIdIndex === cbIndex,
      );
      expect(cb).toHaveLength(2);
      const price = Number(Buffer.from(cb[0].data).readBigUInt64LE(1));
      const units = Buffer.from(cb[1].data).readUInt32LE(1);

      const config = (v1.message as MessageV1).transactionConfig;
      expect(config.computeUnitLimit).toBe(units);
      // The same fee: what the runtime charges for that price over that limit.
      expect(config.priorityFee).toBe(Math.ceil((price * units) / 1_000_000));
    },
  );

  it("still builds the version 0 instructions from the same arithmetic", async () => {
    const budget = await resolveComputeBudget(200_000);
    expect(budget.computeUnitLimit).toBe(240_180);
    expect(budget.priceMicroLamports).toBe(10_000);
    expect(budget.priorityFeeLamports).toBe(2_402);

    const ixs = computeBudgetInstructions(budget);
    expect(ixs.map((ix) => Buffer.from(ix.data).toString("hex"))).toEqual(
      [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 240_180 }),
      ].map((ix) => Buffer.from(ix.data).toString("hex")),
    );
  });

  it.each(BUDGET_FIXTURES)(
    "states a limit of %i units as the whole number %i, the one both versions encode",
    async (unitsConsumed, limit) => {
      const budget = await resolveComputeBudget(unitsConsumed);
      expect(budget.computeUnitLimit).toBe(limit);
      expect(budget.priorityFeeLamports).toBe(
        Math.ceil((budget.priceMicroLamports * limit) / 1_000_000),
      );

      // The version 0 bytes are the bytes the margin figure has always
      // produced: `setComputeUnitLimit` truncates a float into its u32 field,
      // and truncating first writes that same number.
      const [, limitIx] = computeBudgetInstructions(budget);
      expect(Buffer.from(limitIx.data).toString("hex")).toBe(
        Buffer.from(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: (unitsConsumed + 150) * 1.2,
          }).data,
        ).toString("hex"),
      );
      expect(Buffer.from(limitIx.data).readUInt32LE(1)).toBe(limit);
    },
  );

  it.each(BUDGET_FIXTURES)(
    "caps the total fee exactly as the version 0 price does (%i units consumed)",
    async (unitsConsumed, limit) => {
      // useMaxFee states the whole budget as a price per unit; the version 1
      // header states the same spend as one total.
      const budget = await resolveComputeBudget(unitsConsumed, {
        maxFeeLamports: 1_000,
        useMaxFee: true,
      });
      // The price is quoted against the margin figure, as the version 0 path
      // has always quoted it, so its instruction's bytes do not move.
      expect(budget.priceMicroLamports).toBe(
        Math.ceil((1_000 * 1_000_000) / ((unitsConsumed + 150) * 1.2)),
      );
      // The total is what the runtime charges for that price over the limit
      // both versions state.
      expect(budget.priorityFeeLamports).toBe(
        Math.ceil((budget.priceMicroLamports * limit) / 1_000_000),
      );
      expect(budget.priorityFeeLamports).toBeLessThanOrEqual(1_001);
    },
  );

  it("simulates a version 1 message without constructing one", async () => {
    const captured: { base64?: string } = {};
    const connection = {
      simulateTransaction: jest.fn(async (tx: VersionedTransaction) => {
        captured.base64 = Buffer.from(tx.serialize()).toString("base64");
        return { context: { slot: 1 }, value: { err: null, unitsConsumed: 7 } };
      }),
    } as unknown as Connection;

    const watch = watchComputeBudgetProgram();
    try {
      await getSimulationResult(connection, [plainIx()], PAYER, [], false, 1);
      expect(watch.callCount()).toBe(0);
    } finally {
      watch.restore();
    }

    const tx = VersionedTransaction.deserialize(
      Buffer.from(captured.base64!, "base64"),
    );
    expect((tx.message as MessageV1).transactionConfig.computeUnitLimit).toBe(
      RUNTIME_COMPUTE_UNIT_LIMIT,
    );
    expect(tx.message.compiledInstructions).toHaveLength(1);
  });

  it("carries a builder's heap frame into the header", async () => {
    // `pricePhoenixTradersIxs` returns its heap frame in front of the pricing
    // instruction and callers pass that list as preInstructions: the fold is
    // what turns it into the header's heapSize.
    const built = await createClient().intoVersionedTransaction(
      legacyTx([
        ComputeBudgetProgram.requestHeapFrame({
          bytes: PHOENIX_REQUEST_HEAP_FRAME_BYTES,
        }),
        plainIx(7),
      ]),
      { transactionVersion: 1 },
    );
    const config = (built.message as MessageV1).transactionConfig;
    expect(config.heapSize).toBe(PHOENIX_REQUEST_HEAP_FRAME_BYTES);
    expect(built.message.compiledInstructions).toHaveLength(1);
  });

  it("folds a caller's Compute Budget instruction rather than compiling it", () => {
    const message = compileToV1Message({
      payerKey: PAYER,
      recentBlockhash: BLOCKHASH,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 111_000 }),
        plainIx(),
      ],
    });
    expect(message.transactionConfig.computeUnitLimit).toBe(111_000);
    expect(
      message.staticAccountKeys.some((k) =>
        k.equals(ComputeBudgetProgram.programId),
      ),
    ).toBe(false);
  });
});

// ------------------------------------------- a margin past the runtime ceiling

// The runtime allows one transaction 1,400,000 compute units and clamps a
// larger request to that. A version 0 message states a price, so its fee is
// charged over the clamped units; a version 1 header states a total, which is
// charged as stated. The total is therefore converted over the clamped units.
describe("a compute unit limit past the runtime ceiling", () => {
  // (1,300,000 + 150) * 1.2 = 1,560,180, which is 160,180 past the ceiling.
  const UNITS_CONSUMED = 1_300_000;
  const REQUESTED_LIMIT = 1_560_180;
  const DEFAULT_PRICE = 10_000;
  // What the version 0 runtime charges: 10,000 micro lamports over 1,400,000.
  const RUNTIME_FEE = 14_000;

  it("states the total the version 0 runtime charges for the same price", async () => {
    const budget = await resolveComputeBudget(UNITS_CONSUMED);
    expect(budget.computeUnitLimit).toBe(REQUESTED_LIMIT);
    expect(budget.priceMicroLamports).toBe(DEFAULT_PRICE);
    expect(budget.priorityFeeLamports).toBe(RUNTIME_FEE);
    expect(budget.priorityFeeLamports).toBe(
      Math.ceil((DEFAULT_PRICE * RUNTIME_COMPUTE_UNIT_LIMIT) / 1_000_000),
    );
  });

  it("converts a folded price over the clamped units too", () => {
    const message = compileToV1Message({
      payerKey: PAYER,
      recentBlockhash: BLOCKHASH,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: DEFAULT_PRICE,
        }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: REQUESTED_LIMIT }),
        plainIx(),
      ],
    });
    expect(message.transactionConfig.priorityFee).toBe(RUNTIME_FEE);
  });

  it("leaves a limit under the ceiling charged over the limit itself", async () => {
    const budget = await resolveComputeBudget(200_000);
    expect(budget.priorityFeeLamports).toBe(
      Math.ceil((budget.priceMicroLamports * 240_180) / 1_000_000),
    );
  });
});

// ------------------------------------------------- the checkable guarantee

/** A version 1 message that names the Compute Budget program, built by hand. */
function messageNamingComputeBudget(): SerializableMessageV1 {
  const legacy = new TransactionMessage({
    payerKey: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      plainIx(),
    ],
  }).compileToLegacyMessage();
  return SerializableMessageV1.fromLegacy(legacy, {
    computeUnitLimit: 300_000,
    heapSize: DEFAULT_HEAP_SIZE,
    loadedAccountsDataSizeLimit: RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
    priorityFee: 0,
  });
}

describe("a version 1 transaction may name no Compute Budget instruction", () => {
  it("is refused on the assembled transaction", () => {
    const tx = new V1Transaction(messageNamingComputeBudget());
    expect(() => assertV1TransactionLimits(tx)).toThrow(
      /runs the Compute Budget program/,
    );
    expect(() => assertV1TransactionLimits(tx)).toThrow(/Nothing was sent/);
  });

  it("passes for a transaction this SDK compiled", async () => {
    const built = await createClient().intoVersionedTransaction(
      legacyTx([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 123_000 }),
        plainIx(7),
      ]),
      { transactionVersion: 1 },
    );
    expect(() =>
      assertV1TransactionLimits(built as VersionedTransaction),
    ).not.toThrow();
  });
});
