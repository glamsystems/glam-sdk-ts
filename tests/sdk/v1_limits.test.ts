import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  V1Transaction,
  V1_MAX_ACCOUNT_KEYS,
  V1_TRANSACTION_SIZE_LIMIT,
  assertV1TransactionLimits,
  compileToV1Message,
  serializeV1Transaction,
} from "../../src/utils/messageV1";

// Without address lookup tables a version 1 transaction is bounded twice: 64
// account keys and 4,096 bytes on the wire. Both are checked on the assembled
// transaction, after the compute budget has been folded in and the signature
// slots are in place, so nothing that would be refused by the cluster leaves
// the SDK.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

function key(index: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = index & 0xff;
  bytes[1] = (index >> 8) & 0xff;
  bytes[31] = 13;
  return new PublicKey(bytes);
}

const PAYER = key(900);
const PROGRAM = key(901);

/** One instruction naming `count` distinct readonly accounts. */
function ixOverAccounts(count: number, dataBytes = 1): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: Array.from({ length: count }, (_, i) => ({
      pubkey: key(i),
      isSigner: false,
      isWritable: false,
    })),
    data: Buffer.alloc(dataBytes, 3),
  });
}

function transactionOver(
  instructions: TransactionInstruction[],
): V1Transaction {
  return new V1Transaction(
    compileToV1Message({
      payerKey: PAYER,
      recentBlockhash: BLOCKHASH,
      instructions,
    }),
  );
}

describe("the version 1 limits", () => {
  it("accepts a transaction that names exactly 64 accounts", () => {
    // 62 named accounts plus the payer plus the program.
    const tx = transactionOver([ixOverAccounts(62)]);
    expect(tx.message.staticAccountKeys).toHaveLength(V1_MAX_ACCOUNT_KEYS);
    expect(() => assertV1TransactionLimits(tx)).not.toThrow();
  });

  it("refuses a transaction that names 65 accounts", () => {
    const tx = transactionOver([ixOverAccounts(63)]);
    expect(tx.message.staticAccountKeys).toHaveLength(65);
    expect(() => assertV1TransactionLimits(tx)).toThrow(
      "The transaction names 65 accounts and a version 1 transaction allows at most 64. Nothing was sent. Use fewer accounts in this transaction, or split the operation into smaller ones.",
    );
  });

  it("accepts a transaction of exactly 4096 bytes", () => {
    // Grow the payload until the wire size lands on the limit.
    const fixed = serializeV1Transaction(
      transactionOver([ixOverAccounts(1, 0)]),
    ).length;
    const tx = transactionOver([
      ixOverAccounts(1, V1_TRANSACTION_SIZE_LIMIT - fixed),
    ]);
    expect(serializeV1Transaction(tx).length).toBe(V1_TRANSACTION_SIZE_LIMIT);
    expect(() => assertV1TransactionLimits(tx)).not.toThrow();
  });

  it("refuses a transaction one byte over 4096", () => {
    const fixed = serializeV1Transaction(
      transactionOver([ixOverAccounts(1, 0)]),
    ).length;
    const tx = transactionOver([
      ixOverAccounts(1, V1_TRANSACTION_SIZE_LIMIT - fixed + 1),
    ]);
    expect(serializeV1Transaction(tx).length).toBe(
      V1_TRANSACTION_SIZE_LIMIT + 1,
    );
    expect(() => assertV1TransactionLimits(tx)).toThrow(
      "The transaction is 4097 bytes and a version 1 transaction allows at most 4096. Nothing was sent. Send fewer instructions in this transaction, or split the operation into smaller ones.",
    );
  });
});

// --------------------------------------------- checked on what is returned

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

describe("BaseClient.intoVersionedTransaction and the version 1 limits", () => {
  it("refuses to hand back a transaction that names too many accounts", async () => {
    const client = createClient();
    await expect(
      client.intoVersionedTransaction(legacyTx([ixOverAccounts(63)]), {
        transactionVersion: 1,
      }),
    ).rejects.toThrow(/names 65 accounts .* Nothing was sent\./);
  });

  it("refuses to hand back a transaction over the size limit", async () => {
    const client = createClient();
    await expect(
      client.intoVersionedTransaction(legacyTx([ixOverAccounts(1, 4_200)]), {
        transactionVersion: 1,
      }),
    ).rejects.toThrow(/is \d+ bytes .* Nothing was sent\./);
  });

  it("leaves the version 0 path to the cluster's own limits", async () => {
    // A version 0 transaction is bounded by the 1,232-byte packet and by what
    // its lookup tables can absorb, neither of which this check knows about.
    const client = createClient();
    const tx = await client.intoVersionedTransaction(
      legacyTx([ixOverAccounts(63)]),
      { transactionVersion: 0 },
    );
    expect(tx.message.staticAccountKeys.length).toBeGreaterThan(
      V1_MAX_ACCOUNT_KEYS,
    );
  });
});
