import {
  Connection,
  MessageV1,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
  assertLoadedAccountsDataSizeLimit,
  compileToV1Message,
} from "../../src/utils/messageV1";
import { getSimulationResult } from "../../src/utils/transaction";

// What a version 1 message says about the account bytes it may load.
//
// Measured on an Agave 4.2.2 validator (see tests/sdk/v1_validator.test.ts):
// a version 1 message that leaves the field unset is budgeted zero and fails
// with MaxLoadedAccountsDataSizeExceeded before it executes — a 149-byte
// transfer included — and the fee is charged anyway. A stated limit costs the
// payer nothing: the same transfer pays 5,000 lamports at 100,000 bytes and at
// the 67,108,864-byte ceiling. A tight limit is what costs: one ordinary
// Token-2022 call loads 507,254 bytes, so 100,000 refuses it outright.
//
// The default is therefore the ceiling, always stated, and a caller who wants
// a tighter value asks for it.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

function key(index: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = index;
  bytes[31] = 17;
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

describe("the loaded accounts data size limit a version 1 message states", () => {
  it("is never left unset", () => {
    const configs: Array<Parameters<typeof compileToV1Message>[0]["config"]> = [
      undefined,
      {},
      { computeUnitLimit: 300_000 },
      { loadedAccountsDataSizeLimit: undefined },
      // A caller that hands the field through as the absent value the type
      // allows still gets the default rather than a message budgeted zero.
      { loadedAccountsDataSizeLimit: null },
    ];
    configs.forEach((config) => {
      const message = compileToV1Message({
        payerKey: PAYER,
        recentBlockhash: BLOCKHASH,
        instructions: [plainIx()],
        config,
      });
      expect(message.transactionConfig.loadedAccountsDataSizeLimit).toBe(
        RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
      );
    });
  });

  it("defaults to the runtime ceiling, which the payer is not charged for", () => {
    expect(RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT).toBe(67_108_864);
  });

  it("takes a caller's tighter value from the transaction options", async () => {
    const built = await createClient().intoVersionedTransaction(
      legacyTx([plainIx(7)]),
      { transactionVersion: 1, loadedAccountsDataSizeLimit: 1_000_000 },
    );
    expect(
      (built.message as MessageV1).transactionConfig
        .loadedAccountsDataSizeLimit,
    ).toBe(1_000_000);
  });

  it("refuses a value the field cannot hold", () => {
    expect(() => assertLoadedAccountsDataSizeLimit(0)).toThrow(/Nothing was/);
    expect(() =>
      assertLoadedAccountsDataSizeLimit(
        RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT + 1,
      ),
    ).toThrow(/Nothing was/);
    expect(() => assertLoadedAccountsDataSizeLimit(1.5)).toThrow(/Nothing was/);
    expect(() => assertLoadedAccountsDataSizeLimit(-1)).toThrow(/Nothing was/);
    expect(() => assertLoadedAccountsDataSizeLimit(Number.NaN)).toThrow(
      /Nothing was/,
    );
    expect(assertLoadedAccountsDataSizeLimit(1)).toBe(1);
    expect(
      assertLoadedAccountsDataSizeLimit(
        RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
      ),
    ).toBe(RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT);
  });

  it("is refused on the version 0 path, which has no field to state it in", async () => {
    await expect(
      createClient().intoVersionedTransaction(legacyTx([plainIx(7)]), {
        transactionVersion: 0,
        loadedAccountsDataSizeLimit: 1_000_000,
      }),
    ).rejects.toThrow(/version 1/);
  });
});

describe("what a simulation reports about the bytes it loaded", () => {
  function connectionThatReports(value: Record<string, unknown>) {
    return {
      simulateTransaction: jest.fn(async () => ({
        context: { slot: 1 },
        value: { err: null, unitsConsumed: 42, ...value },
      })),
    } as unknown as Connection;
  }

  it("surfaces the measured loaded size", async () => {
    const result = await getSimulationResult(
      connectionThatReports({ loadedAccountsDataSize: 507_254 }),
      [plainIx()],
      PAYER,
      [],
      false,
      1,
    );
    expect(result.unitsConsumed).toBe(42);
    expect(result.loadedAccountsDataSize).toBe(507_254);
  });

  it("reports nothing when the RPC does not", async () => {
    const result = await getSimulationResult(
      connectionThatReports({}),
      [plainIx()],
      PAYER,
      [],
      false,
      1,
    );
    expect(result.loadedAccountsDataSize).toBeUndefined();
  });

  it("simulates against the same limit the transaction will state", async () => {
    const captured: { base64?: string } = {};
    const connection = {
      simulateTransaction: jest.fn(async (tx: VersionedTransaction) => {
        captured.base64 = Buffer.from(tx.serialize()).toString("base64");
        return { context: { slot: 1 }, value: { err: null, unitsConsumed: 1 } };
      }),
    } as unknown as Connection;

    await getSimulationResult(
      connection,
      [plainIx()],
      PAYER,
      [],
      false,
      1,
      123_456,
    );
    const tx = VersionedTransaction.deserialize(
      Buffer.from(captured.base64!, "base64"),
    );
    expect(
      (tx.message as MessageV1).transactionConfig.loadedAccountsDataSizeLimit,
    ).toBe(123_456);
  });
});
