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
  compileToV1Message,
} from "../../src/utils/messageV1";
import { getSimulationResult } from "../../src/utils/transaction";

// A version 1 message states its compute unit limit, its priority fee, its
// heap size and its loaded accounts data size limit in its own fields. The
// Compute Budget instructions that carry the same numbers into a version 0
// message are folded into those fields instead of being compiled, because the
// runtime treats one inside a version 1 message as no operation. A field left
// unset is budgeted zero, so all four are always stated.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

function key(index: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = index;
  bytes[31] = 11;
  return new PublicKey(bytes);
}

const PAYER = key(100);
const PROGRAM = key(101);

function plainIx(seed = 1): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [{ pubkey: key(seed), isSigner: false, isWritable: true }],
    data: Buffer.from([seed]),
  });
}

/** The Compute Budget instruction web3.js 1.99.0 has no factory for. */
function setLoadedAccountsDataSizeLimitIx(bytes: number) {
  const data = Buffer.alloc(5);
  data.writeUInt8(4, 0);
  data.writeUInt32LE(bytes, 1);
  return new TransactionInstruction({
    programId: ComputeBudgetProgram.programId,
    keys: [],
    data,
  });
}

function compile(
  instructions: TransactionInstruction[],
  config?: Parameters<typeof compileToV1Message>[0]["config"],
) {
  return compileToV1Message({
    payerKey: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions,
    config,
  });
}

describe("compiling a version 1 message", () => {
  it("states all four fields when the caller states none", () => {
    const message = compile([plainIx()]);
    expect(message.version).toBe(1);
    expect(message.transactionConfig).toEqual({
      computeUnitLimit: RUNTIME_COMPUTE_UNIT_LIMIT,
      heapSize: DEFAULT_HEAP_SIZE,
      loadedAccountsDataSizeLimit: RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
      priorityFee: 0,
    });
    // The runtime ceilings the Kit SDK states, and the heap size it states.
    expect(RUNTIME_COMPUTE_UNIT_LIMIT).toBe(1_400_000);
    expect(RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT).toBe(67_108_864);
    expect(DEFAULT_HEAP_SIZE).toBe(32_768);
  });

  it("folds setComputeUnitLimit into the compute unit limit field", () => {
    const message = compile([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 321_000 }),
      plainIx(),
    ]);
    expect(message.transactionConfig.computeUnitLimit).toBe(321_000);
    expect(message.compiledInstructions).toHaveLength(1);
  });

  it("folds requestHeapFrame into the heap size field", () => {
    const message = compile([
      ComputeBudgetProgram.requestHeapFrame({ bytes: 131_072 }),
      plainIx(),
    ]);
    expect(message.transactionConfig.heapSize).toBe(131_072);
    expect(message.compiledInstructions).toHaveLength(1);
  });

  it("folds setLoadedAccountsDataSizeLimit into its field", () => {
    const message = compile([
      setLoadedAccountsDataSizeLimitIx(1_048_576),
      plainIx(),
    ]);
    expect(message.transactionConfig.loadedAccountsDataSizeLimit).toBe(
      1_048_576,
    );
    expect(message.compiledInstructions).toHaveLength(1);
  });

  it("folds setComputeUnitPrice into a total priority fee in lamports", () => {
    // A version 0 message prices in micro lamports per compute unit; a version
    // 1 message states the total in lamports. 10,000 * 300,000 / 1,000,000.
    const message = compile([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      plainIx(),
    ]);
    expect(message.transactionConfig.priorityFee).toBe(3_000);
    expect(message.transactionConfig.computeUnitLimit).toBe(300_000);
    expect(message.compiledInstructions).toHaveLength(1);
  });

  it("rounds a priority fee up", () => {
    // 1 * 200,001 / 1,000,000 is 0.200001 lamports: the fee is the whole
    // lamport rather than nothing.
    const message = compile([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      plainIx(),
    ]);
    expect(message.transactionConfig.priorityFee).toBe(1);
  });

  it("prices against the runtime ceiling when no limit instruction is given", () => {
    const message = compile([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
      plainIx(),
    ]);
    expect(message.transactionConfig.computeUnitLimit).toBe(
      RUNTIME_COMPUTE_UNIT_LIMIT,
    );
    expect(message.transactionConfig.priorityFee).toBe(7_000);
  });

  it("folds the deprecated requestUnits instruction", () => {
    const message = compile([
      ComputeBudgetProgram.requestUnits({
        units: 250_000,
        additionalFee: 4_321,
      }),
      plainIx(),
    ]);
    // requestUnits states its additional fee in lamports already.
    expect(message.transactionConfig.computeUnitLimit).toBe(250_000);
    expect(message.transactionConfig.priorityFee).toBe(4_321);
    expect(message.compiledInstructions).toHaveLength(1);
  });

  it("lets the caller's config override what the instructions said", () => {
    const message = compile(
      [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 321_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 131_072 }),
        plainIx(),
      ],
      { computeUnitLimit: 400_000, priorityFee: 99 },
    );
    expect(message.transactionConfig).toEqual({
      computeUnitLimit: 400_000,
      heapSize: 131_072,
      loadedAccountsDataSizeLimit: RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
      priorityFee: 99,
    });
  });

  it("rounds a fractional compute unit limit up", () => {
    // The SDK's own budget arrives whole — `resolveComputeBudget` truncates
    // its 1.2 margin to the u32 a version 0 instruction would encode — but the
    // field is a u32 and a caller may state anything, so a fraction is rounded
    // up rather than silently truncated.
    const message = compile([], { computeUnitLimit: 480_180.0000001 });
    expect(message.transactionConfig.computeUnitLimit).toBe(480_181);
  });

  it("leaves an instruction list without any compute budget instruction alone", () => {
    const instructions = [plainIx(1), plainIx(2), plainIx(3)];
    const message = compile(instructions);
    expect(message.compiledInstructions).toHaveLength(3);
    const legacy = new TransactionMessage({
      payerKey: PAYER,
      recentBlockhash: BLOCKHASH,
      instructions,
    }).compileToLegacyMessage();
    expect(message.staticAccountKeys.map((k) => k.toBase58())).toEqual(
      legacy.staticAccountKeys.map((k) => k.toBase58()),
    );
    expect(message.header).toEqual(legacy.header);
  });

  it("names no address table lookups", () => {
    expect(compile([plainIx()]).addressTableLookups).toEqual([]);
  });
});

// ------------------------------------------------------- the simulation path

describe("simulating on the version 1 path", () => {
  function connectionThatCaptures(captured: { base64?: string }) {
    return {
      simulateTransaction: jest.fn(async (tx: VersionedTransaction) => {
        captured.base64 = Buffer.from(tx.serialize()).toString("base64");
        return {
          context: { slot: 1 },
          value: { err: null, unitsConsumed: 42 },
        };
      }),
    } as unknown as Connection;
  }

  it("simulates a version 1 message with the ceiling in its own field", async () => {
    const captured: { base64?: string } = {};
    const result = await getSimulationResult(
      connectionThatCaptures(captured),
      [plainIx()],
      PAYER,
      [],
      false,
      1,
    );

    expect(result.unitsConsumed).toBe(42);
    const wire = Buffer.from(captured.base64!, "base64");
    const tx = VersionedTransaction.deserialize(wire);
    expect(tx.message.version).toBe(1);
    // The arbitrarily high limit the simulation asks for is stated, not
    // prepended as an instruction.
    expect((tx.message as MessageV1).transactionConfig.computeUnitLimit).toBe(
      RUNTIME_COMPUTE_UNIT_LIMIT,
    );
    expect(tx.message.compiledInstructions).toHaveLength(1);
  });

  it("still simulates a version 0 message with a compute budget instruction", async () => {
    const captured: { base64?: string } = {};
    await getSimulationResult(
      connectionThatCaptures(captured),
      [plainIx()],
      PAYER,
      [],
      false,
      0,
    );

    const tx = VersionedTransaction.deserialize(
      Buffer.from(captured.base64!, "base64"),
    );
    expect(tx.message.version).toBe(0);
    expect(tx.message.compiledInstructions).toHaveLength(2);
  });
});

// ------------------------------------------ intoVersionedTransaction, both paths

function createClient() {
  const connection = {
    commitment: "confirmed",
    rpcEndpoint: "http://localhost:8899",
    simulateTransaction: jest.fn(async () => ({
      context: { slot: 1 },
      value: { err: null, unitsConsumed: 200_000 },
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

function legacyTx(instructions: TransactionInstruction[]) {
  const tx = new Transaction();
  tx.add(...instructions);
  return tx;
}

describe("BaseClient.intoVersionedTransaction", () => {
  it("compiles version 0 exactly as it did before", async () => {
    const client = createClient();
    const built = await client.intoVersionedTransaction(
      legacyTx([plainIx(7)]),
      {
        transactionVersion: 0,
      },
    );

    // The formula the version 0 path has always used: the simulation's
    // compute units through buildComputeBudgetInstructions, those two
    // instructions unshifted, and compileToV0Message over the lookup tables.
    // (200,000 + 150) * 1.2 = 240,180 units, at the default 10,000
    // microLamports per unit.
    const expected = new TransactionMessage({
      payerKey: PAYER,
      recentBlockhash: BLOCKHASH,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 240_180 }),
        plainIx(7),
      ],
    }).compileToV0Message([]);

    expect(built.message.version).toBe(0);
    expect(Buffer.from(built.serialize()).toString("hex")).toBe(
      Buffer.from(new VersionedTransaction(expected).serialize()).toString(
        "hex",
      ),
    );
  });

  it("compiles version 1 with the same numbers in the message's fields", async () => {
    const client = createClient();
    const built = await client.intoVersionedTransaction(
      legacyTx([plainIx(7)]),
      {
        transactionVersion: 1,
      },
    );

    expect(built.message.version).toBe(1);
    const config = (built.message as MessageV1).transactionConfig;
    // The same 240,180 units, and 10,000 microLamports per unit over them:
    // 240,180 * 10,000 / 1,000,000 = 2,401.8, rounded up.
    expect(config.computeUnitLimit).toBe(240_180);
    expect(config.priorityFee).toBe(2_402);
    expect(config.heapSize).toBe(DEFAULT_HEAP_SIZE);
    expect(config.loadedAccountsDataSizeLimit).toBe(
      RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
    );
    // No compute budget instruction is compiled into the message.
    expect(built.message.compiledInstructions).toHaveLength(1);
    // The wire bytes are the version 1 envelope.
    expect(built.serialize()[0]).toBe(0x81);
  });

  it("neither resolves nor fetches lookup tables on the version 1 path", async () => {
    const client = createClient();
    const getDefault = jest.spyOn(
      BaseClient.prototype as any,
      "getDefaultLookupTables",
    );

    // A caller-supplied table would be read from the connection, which this
    // fake has no method for: resolving it would throw rather than be ignored.
    const built = await client.intoVersionedTransaction(
      legacyTx([plainIx(7)]),
      {
        transactionVersion: 1,
        lookupTables: [PublicKey.unique()],
      },
    );

    expect(getDefault).not.toHaveBeenCalled();
    expect(built.message.addressTableLookups).toEqual([]);
    getDefault.mockRestore();
  });
});
