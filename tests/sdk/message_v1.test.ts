import * as fs from "fs";
import * as path from "path";
import { createPublicKey, verify as verifySignature } from "crypto";
import {
  Keypair,
  MessageV1,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  SerializableMessageV1,
  V1Transaction,
  V1_MESSAGE_PREFIX,
  V1_TRANSACTION_SIZE_LIMIT,
  serializeV1Transaction,
  type V1TransactionConfig,
} from "../../src/utils/messageV1";

// The library reads a version 1 message and refuses to write one:
// `MessageV1.serialize()` throws. `SerializableMessageV1.serialize()` is the
// exact inverse of `MessageV1.deserialize`, so the library's own deserializer
// is the oracle every case below measures against - bytes in, the same message
// out; a message in, the same bytes out.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

/** A deterministic key: 32 bytes whose first byte is the index. */
function key(index: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[0] = index;
  bytes[31] = 7;
  return new PublicKey(bytes);
}

const PAYER = key(200);
const PROGRAM = key(201);

const NO_CONFIG: V1TransactionConfig = {
  computeUnitLimit: null,
  heapSize: null,
  loadedAccountsDataSizeLimit: null,
  priorityFee: null,
};

function messageOf(
  staticAccountKeys: PublicKey[],
  compiledInstructions: Array<{
    programIdIndex: number;
    accountKeyIndexes: number[];
    data: Uint8Array;
  }>,
  transactionConfig: V1TransactionConfig = NO_CONFIG,
  header = {
    numRequiredSignatures: 1,
    numReadonlySignedAccounts: 0,
    numReadonlyUnsignedAccounts: 1,
  },
): SerializableMessageV1 {
  return new SerializableMessageV1({
    header,
    staticAccountKeys,
    recentBlockhash: BLOCKHASH,
    compiledInstructions,
    transactionConfig,
  });
}

/** Every field the wire carries, compared one by one. */
function expectSameMessage(actual: MessageV1, expected: MessageV1) {
  expect(actual.version).toBe(expected.version);
  expect(actual.header).toEqual(expected.header);
  expect(actual.staticAccountKeys.map((k) => k.toBase58())).toEqual(
    expected.staticAccountKeys.map((k) => k.toBase58()),
  );
  expect(actual.recentBlockhash).toBe(expected.recentBlockhash);
  expect(actual.transactionConfig).toEqual(expected.transactionConfig);
  expect(
    actual.compiledInstructions.map((ix) => ({
      programIdIndex: ix.programIdIndex,
      accountKeyIndexes: [...ix.accountKeyIndexes],
      data: [...ix.data],
    })),
  ).toEqual(
    expected.compiledInstructions.map((ix) => ({
      programIdIndex: ix.programIdIndex,
      accountKeyIndexes: [...ix.accountKeyIndexes],
      data: [...ix.data],
    })),
  );
}

/** Both directions: message to bytes to message, and bytes to message to bytes. */
function expectRoundTrip(message: SerializableMessageV1) {
  const bytes = message.serialize();
  expect(bytes[0]).toBe(V1_MESSAGE_PREFIX);
  const read = MessageV1.deserialize(bytes);
  expectSameMessage(read, message);
  const rewritten = SerializableMessageV1.from(read).serialize();
  expect(Buffer.from(rewritten).toString("hex")).toBe(
    Buffer.from(bytes).toString("hex"),
  );
}

describe("version 1 message serialization", () => {
  it("round trips a message with one instruction", () => {
    expectRoundTrip(
      messageOf(
        [PAYER, key(1), PROGRAM],
        [
          {
            programIdIndex: 2,
            accountKeyIndexes: [0, 1],
            data: new Uint8Array([9, 8, 7]),
          },
        ],
      ),
    );
  });

  it("round trips a message with many instructions", () => {
    const keys = [
      PAYER,
      ...Array.from({ length: 8 }, (_, i) => key(i)),
      PROGRAM,
    ];
    expectRoundTrip(
      messageOf(
        keys,
        Array.from({ length: 12 }, (_, i) => ({
          programIdIndex: keys.length - 1,
          accountKeyIndexes: [0, 1 + (i % 8)],
          data: new Uint8Array([i, i + 1]),
        })),
      ),
    );
  });

  it("round trips a message with 64 account keys", () => {
    const keys = [
      PAYER,
      ...Array.from({ length: 62 }, (_, i) => key(i)),
      PROGRAM,
    ];
    expect(keys).toHaveLength(64);
    expectRoundTrip(
      messageOf(keys, [
        {
          programIdIndex: 63,
          accountKeyIndexes: Array.from({ length: 63 }, (_, i) => i),
          data: new Uint8Array([1]),
        },
      ]),
    );
  });

  it("round trips every combination of set and unset config fields", () => {
    const values = {
      computeUnitLimit: 200_000,
      heapSize: 32_768,
      loadedAccountsDataSizeLimit: 67_108_864,
      priorityFee: 4_242,
    };
    const fields = Object.keys(values) as Array<keyof typeof values>;
    for (let mask = 0; mask < 16; mask++) {
      const config = { ...NO_CONFIG };
      fields.forEach((field, bit) => {
        if (mask & (1 << bit)) config[field] = values[field];
      });
      expectRoundTrip(
        messageOf(
          [PAYER, PROGRAM],
          [
            {
              programIdIndex: 1,
              accountKeyIndexes: [0],
              data: new Uint8Array([mask]),
            },
          ],
          config,
        ),
      );
    }
  });

  it("round trips the maximum value of every config field", () => {
    expectRoundTrip(
      messageOf(
        [PAYER, PROGRAM],
        [{ programIdIndex: 1, accountKeyIndexes: [0], data: new Uint8Array() }],
        {
          computeUnitLimit: 0xffffffff,
          heapSize: 0xffffffff,
          loadedAccountsDataSizeLimit: 0xffffffff,
          // The library's own u64 decoder refuses anything larger.
          priorityFee: Number.MAX_SAFE_INTEGER,
        },
      ),
    );
  });

  it("round trips an instruction with empty data", () => {
    expectRoundTrip(
      messageOf(
        [PAYER, PROGRAM],
        [{ programIdIndex: 1, accountKeyIndexes: [], data: new Uint8Array() }],
      ),
    );
  });

  it("round trips an instruction payload longer than 255 bytes", () => {
    const data = new Uint8Array(1_200);
    data.forEach((_, i) => {
      data[i] = i % 251;
    });
    expectRoundTrip(
      messageOf(
        [PAYER, PROGRAM],
        [{ programIdIndex: 1, accountKeyIndexes: [0], data }],
      ),
    );
  });

  it("refuses a message the wire layout cannot express", () => {
    const tooMuchData = messageOf(
      [PAYER, PROGRAM],
      [
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array(65_536),
        },
      ],
    );
    expect(() => tooMuchData.serialize()).toThrow(
      /instruction data is 65536 bytes/,
    );

    const tooManyKeys = messageOf(
      Array.from({ length: 256 }, (_, i) => key(i)),
      [{ programIdIndex: 1, accountKeyIndexes: [0], data: new Uint8Array() }],
    );
    expect(() => tooManyKeys.serialize()).toThrow(/256 account keys/);
  });
});

// --------------------------------------------------------- the Kit fixture

type KitFixture = {
  kitVersion: string;
  cases: Array<{
    name: string;
    payer: string;
    recentBlockhash: string;
    instructions: Array<{
      programId: string;
      keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
      dataHex: string;
    }>;
    config: V1TransactionConfig;
    messageHex: string;
    kitCompiledHex?: string;
  }>;
};

const FIXTURE: KitFixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures", "kit_v1_messages.json"),
    "utf8",
  ),
);

// `messageHex` is Kit 8.0.0's encoder run over the message web3.js's
// `compileToLegacyMessage` produced, so it measures the encoding this module
// supplies. `kitCompiledHex`, where the fixture carries one, is Kit's own
// compiler and encoder over the same instructions: it is present only for the
// cases where the two compilers ordered the static accounts alike, because Kit
// sorts them by address within each privilege category while web3.js keeps the
// order the instructions first named them in. Both orders are valid messages;
// the SDK keeps web3.js's compiler.
describe("version 1 messages encoded by Kit", () => {
  it("covers the five shapes the round trip covers", () => {
    expect(FIXTURE.kitVersion).toBe("8.0.0");
    expect(FIXTURE.cases.map((c) => c.name)).toEqual([
      "one instruction, every config field set",
      "many instructions, compute unit limit only",
      "64 account keys",
      "no config at all",
      "empty data and a payload over 255 bytes, config at its maxima",
    ]);
  });

  FIXTURE.cases.forEach((fixtureCase) => {
    it(`matches Kit byte for byte: ${fixtureCase.name}`, () => {
      const compiled = new TransactionMessage({
        payerKey: new PublicKey(fixtureCase.payer),
        recentBlockhash: fixtureCase.recentBlockhash,
        instructions: fixtureCase.instructions.map(
          (ix) =>
            new TransactionInstruction({
              programId: new PublicKey(ix.programId),
              keys: ix.keys.map((k) => ({
                pubkey: new PublicKey(k.pubkey),
                isSigner: k.isSigner,
                isWritable: k.isWritable,
              })),
              data: Buffer.from(ix.dataHex, "hex"),
            }),
        ),
      }).compileToLegacyMessage();

      const message = SerializableMessageV1.fromLegacy(
        compiled,
        fixtureCase.config,
      );

      expect(Buffer.from(message.serialize()).toString("hex")).toBe(
        fixtureCase.messageHex,
      );
      if (fixtureCase.kitCompiledHex !== undefined) {
        expect(Buffer.from(message.serialize()).toString("hex")).toBe(
          fixtureCase.kitCompiledHex,
        );
      }
    });
  });

  it("carries at least one case Kit compiled end to end", () => {
    expect(
      FIXTURE.cases.filter((c) => c.kitCompiledHex !== undefined).length,
    ).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------- the envelope

describe("version 1 transaction envelope", () => {
  // A version 1 transaction puts its message first and its signatures last,
  // with no count prefix: `VersionedTransaction.deserialize` dispatches on the
  // 0x81 in byte 0 and reads the signature count out of the message header.
  // The library's own `VersionedTransaction.serialize()` always writes the
  // signatures first, which is the version 0 envelope, so the bytes a version 1
  // transaction is sent as come from `serializeV1Transaction` instead.
  it("signs bytes that the library reads back and that verify", () => {
    const signer = Keypair.generate();
    const message = SerializableMessageV1.fromLegacy(
      new TransactionMessage({
        payerKey: signer.publicKey,
        recentBlockhash: BLOCKHASH,
        instructions: [
          new TransactionInstruction({
            programId: PROGRAM,
            keys: [{ pubkey: key(3), isSigner: false, isWritable: true }],
            data: Buffer.from([1, 2, 3, 4]),
          }),
        ],
      }).compileToLegacyMessage(),
      { ...NO_CONFIG, computeUnitLimit: 200_000 },
    );

    const tx = new V1Transaction(message);
    tx.sign([signer]);

    const wire = tx.serialize();
    expect(wire[0]).toBe(V1_MESSAGE_PREFIX);
    expect(wire.length).toBe(message.serialize().length + 64);

    const back = VersionedTransaction.deserialize(wire);
    expect(back.message.version).toBe(1);
    expectSameMessage(back.message as MessageV1, message);
    expect(back.signatures).toHaveLength(1);
    expect(Buffer.from(back.signatures[0]).toString("hex")).toBe(
      Buffer.from(tx.signatures[0]).toString("hex"),
    );

    // The bytes signed are exactly the serialized message, prefix byte
    // included. This is what Agave 4.2.0 and newer verify a version 1
    // signature over.
    // Verified by Node's own ed25519, not by the code under test: the raw
    // public key wrapped in the SubjectPublicKeyInfo header ed25519 uses.
    const ed25519Spki = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        signer.publicKey.toBuffer(),
      ]),
      format: "der",
      type: "spki",
    });
    expect(
      verifySignature(
        null,
        Buffer.from(message.serialize()),
        ed25519Spki,
        Buffer.from(back.signatures[0]),
      ),
    ).toBe(true);
    // A single flipped message byte no longer verifies under the same
    // signature, so the bytes above are the ones that were signed.
    const tampered = Buffer.from(message.serialize());
    tampered[tampered.length - 1] ^= 1;
    expect(
      verifySignature(
        null,
        tampered,
        ed25519Spki,
        Buffer.from(back.signatures[0]),
      ),
    ).toBe(false);
  });

  it("writes the message first and the signatures last", () => {
    const message = messageOf(
      [PAYER, PROGRAM],
      [
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array([5]),
        },
      ],
    );
    const tx = new V1Transaction(message);
    const wire = serializeV1Transaction(tx);
    const messageBytes = message.serialize();

    expect(Buffer.from(wire.subarray(0, messageBytes.length))).toEqual(
      Buffer.from(messageBytes),
    );
    expect(wire.subarray(messageBytes.length)).toEqual(new Uint8Array(64));
  });

  it("leaves a transaction over the size limit to the limits check", () => {
    // 4,200 bytes of instruction data in two instructions: the serializer
    // writes them, and refusing them is the limits check's job.
    const message = messageOf(
      [PAYER, PROGRAM],
      [
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array(3_000),
        },
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array(1_200),
        },
      ],
    );
    const wire = serializeV1Transaction(new V1Transaction(message));
    expect(wire.length).toBeGreaterThan(V1_TRANSACTION_SIZE_LIMIT);
    expectRoundTrip(message);
  });

  it("fits a transaction at the size limit", () => {
    const payloadSize =
      V1_TRANSACTION_SIZE_LIMIT -
      64 - // the one signature
      1 - // the version prefix
      3 - // the header
      4 - // the config mask
      32 - // the blockhash
      1 - // the instruction count
      1 - // the static account key count
      32 * 2 - // the two keys
      4 - // the one instruction header
      1; // the one account key index
    const message = messageOf(
      [PAYER, PROGRAM],
      [
        {
          programIdIndex: 1,
          accountKeyIndexes: [0],
          data: new Uint8Array(payloadSize),
        },
      ],
    );
    expect(serializeV1Transaction(new V1Transaction(message)).length).toBe(
      V1_TRANSACTION_SIZE_LIMIT,
    );
  });
});
