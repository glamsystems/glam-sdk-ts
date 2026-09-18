/*
 * Generates tests/sdk/fixtures/kit_v1_messages.json: version 1 transaction
 * messages encoded by @solana/kit, whose encoder is what GLAM's Kit SDK signs
 * and what an Agave 4.2 validator verifies. The SDK's own serializer is held
 * to these bytes in tests/sdk/message_v1.test.ts.
 *
 * Kit lives in the apps workspace, which the anchor workspace does not depend
 * on, so it is resolved from a package directory there rather than imported.
 *
 * Two byte strings are recorded per case:
 *
 *   messageHex        Kit's encoder run over the message web3.js's
 *                     `compileToLegacyMessage` produced. This isolates the
 *                     encoding, which is what the SDK's serializer supplies.
 *   kitCompiledHex    Kit's own compiler and encoder run over the same
 *                     instructions, recorded only when Kit's compiler ordered
 *                     the static accounts the way web3.js did.
 *
 * The two compilers do not always agree on that order: Kit sorts the accounts
 * within each privilege category by address, while web3.js keeps the order in
 * which the instructions first named them. Both messages are valid and mean
 * the same thing; only their bytes differ. The SDK keeps web3.js's compiler,
 * so every case records `messageHex` and the cases where the orders agree
 * record `kitCompiledHex` as well.
 *
 * Run by hand, from the repository root, when a case is added or Kit moves:
 *
 *   node anchor/tests/sdk/fixtures/generate_kit_v1_messages.cjs
 *
 * It is deliberately not wired into any test run: the committed bytes are the
 * fixture, and regenerating them is a decision, not a side effect.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const KIT_HOST = path.join(REPO_ROOT, "packages", "glam", "core");

const kitEntry = require.resolve("@solana/kit", { paths: [KIT_HOST] });
const kit = require(kitEntry);
// The package root is the directory above the entry's "dist/".
const kitVersion = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(path.dirname(kitEntry)), "package.json"),
    "utf8",
  ),
).version;
const web3 = require(
  require.resolve("@solana/web3.js", {
    paths: [path.join(REPO_ROOT, "anchor")],
  }),
);

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

/** The same deterministic keys the test builds: byte 0 is the index, byte 31 is 7. */
function key(index) {
  const bytes = new Uint8Array(32);
  bytes[0] = index;
  bytes[31] = 7;
  return new web3.PublicKey(bytes).toBase58();
}

const PAYER = key(200);
const PROGRAM = key(201);

function meta(pubkey, isSigner, isWritable) {
  return { pubkey, isSigner, isWritable };
}

function hex(length, seed) {
  return Buffer.from(
    Array.from({ length }, (_, i) => (i * 7 + seed) % 251),
  ).toString("hex");
}

const NO_CONFIG = {
  computeUnitLimit: null,
  heapSize: null,
  loadedAccountsDataSizeLimit: null,
  priorityFee: null,
};

const CASES = [
  {
    name: "one instruction, every config field set",
    payer: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [
      {
        programId: PROGRAM,
        keys: [meta(key(1), false, true), meta(key(2), false, false)],
        dataHex: "090807",
      },
    ],
    config: {
      computeUnitLimit: 1_400_000,
      heapSize: 32_768,
      loadedAccountsDataSizeLimit: 67_108_864,
      priorityFee: 12_345,
    },
  },
  {
    name: "many instructions, compute unit limit only",
    payer: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: Array.from({ length: 12 }, (_, i) => ({
      programId: PROGRAM,
      keys: [meta(key(i % 8), false, i % 2 === 0)],
      dataHex: hex(3, i),
    })),
    config: { ...NO_CONFIG, computeUnitLimit: 200_000 },
  },
  {
    name: "64 account keys",
    payer: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [
      {
        programId: PROGRAM,
        // 62 named accounts plus the payer plus the program: 64 keys.
        keys: Array.from({ length: 62 }, (_, i) => meta(key(i), false, i < 31)),
        dataHex: "01",
      },
    ],
    config: {
      ...NO_CONFIG,
      computeUnitLimit: 1_400_000,
      loadedAccountsDataSizeLimit: 67_108_864,
    },
  },
  {
    name: "no config at all",
    payer: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [
      { programId: PROGRAM, keys: [meta(key(5), false, true)], dataHex: "" },
    ],
    config: { ...NO_CONFIG },
  },
  {
    name: "empty data and a payload over 255 bytes, config at its maxima",
    payer: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [
      { programId: PROGRAM, keys: [], dataHex: "" },
      {
        programId: PROGRAM,
        keys: [meta(key(9), false, false)],
        dataHex: hex(1_200, 3),
      },
    ],
    config: {
      computeUnitLimit: 0xffffffff,
      heapSize: 0xffffffff,
      loadedAccountsDataSizeLimit: 0xffffffff,
      priorityFee: Number.MAX_SAFE_INTEGER,
    },
  },
];

function role(isSigner, isWritable) {
  if (isSigner) {
    return isWritable
      ? kit.AccountRole.WRITABLE_SIGNER
      : kit.AccountRole.READONLY_SIGNER;
  }
  return isWritable ? kit.AccountRole.WRITABLE : kit.AccountRole.READONLY;
}

const CONFIG_MASK_PRIORITY_FEE_BITS = 0b00011;
const CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT = 0b00100;
const CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT = 0b01000;
const CONFIG_MASK_HEAP_SIZE_BIT = 0b10000;

/** The config as Kit's v1 encoder takes it: a mask and the values it selects. */
function kitConfig(config) {
  let configMask = 0;
  const configValues = [];
  if (config.priorityFee !== null) {
    configMask |= CONFIG_MASK_PRIORITY_FEE_BITS;
    configValues.push({ kind: "u64", value: BigInt(config.priorityFee) });
  }
  if (config.computeUnitLimit !== null) {
    configMask |= CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT;
    configValues.push({ kind: "u32", value: config.computeUnitLimit });
  }
  if (config.loadedAccountsDataSizeLimit !== null) {
    configMask |= CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT;
    configValues.push({
      kind: "u32",
      value: config.loadedAccountsDataSizeLimit,
    });
  }
  if (config.heapSize !== null) {
    configMask |= CONFIG_MASK_HEAP_SIZE_BIT;
    configValues.push({ kind: "u32", value: config.heapSize });
  }
  return { configMask, configValues };
}

const encoder = kit.getCompiledTransactionMessageEncoder();

/** Kit's encoder run over a message web3.js compiled. */
function encodeCompiledWithKit(legacy, config) {
  const { configMask, configValues } = kitConfig(config);
  return Buffer.from(
    encoder.encode({
      version: 1,
      header: {
        numSignerAccounts: legacy.header.numRequiredSignatures,
        numReadonlySignerAccounts: legacy.header.numReadonlySignedAccounts,
        numReadonlyNonSignerAccounts: legacy.header.numReadonlyUnsignedAccounts,
      },
      configMask,
      configValues,
      lifetimeToken: legacy.recentBlockhash,
      numInstructions: legacy.compiledInstructions.length,
      numStaticAccounts: legacy.staticAccountKeys.length,
      staticAccounts: legacy.staticAccountKeys.map((k) =>
        kit.address(k.toBase58()),
      ),
      instructionHeaders: legacy.compiledInstructions.map((ix) => ({
        programAccountIndex: ix.programIdIndex,
        numInstructionAccounts: ix.accountKeyIndexes.length,
        numInstructionDataBytes: ix.data.length,
      })),
      instructionPayloads: legacy.compiledInstructions.map((ix) => ({
        instructionAccountIndices: [...ix.accountKeyIndexes],
        instructionData: new Uint8Array(ix.data),
      })),
    }),
  ).toString("hex");
}

/** Kit's own compiler and encoder, from the instructions up. */
function compileAndEncodeWithKit(testCase) {
  let message = kit.pipe(
    kit.createTransactionMessage({ version: 1 }),
    (m) => kit.setTransactionMessageFeePayer(kit.address(testCase.payer), m),
    (m) =>
      kit.setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: kit.blockhash(testCase.recentBlockhash),
          lastValidBlockHeight: 1n,
        },
        m,
      ),
    (m) =>
      kit.appendTransactionMessageInstructions(
        testCase.instructions.map((ix) => ({
          programAddress: kit.address(ix.programId),
          ...(ix.keys.length > 0 && {
            accounts: ix.keys.map((k) => ({
              address: kit.address(k.pubkey),
              role: role(k.isSigner, k.isWritable),
            })),
          }),
          ...(ix.dataHex.length > 0 && {
            data: new Uint8Array(Buffer.from(ix.dataHex, "hex")),
          }),
        })),
        m,
      ),
  );
  const {
    computeUnitLimit,
    heapSize,
    loadedAccountsDataSizeLimit,
    priorityFee,
  } = testCase.config;
  if (computeUnitLimit !== null)
    message = kit.setTransactionMessageComputeUnitLimit(
      computeUnitLimit,
      message,
    );
  if (loadedAccountsDataSizeLimit !== null)
    message = kit.setTransactionMessageLoadedAccountsDataSizeLimit(
      loadedAccountsDataSizeLimit,
      message,
    );
  if (heapSize !== null)
    message = kit.setTransactionMessageHeapSize(heapSize, message);
  if (priorityFee !== null)
    message = kit.setTransactionMessagePriorityFeeLamports(
      BigInt(priorityFee),
      message,
    );

  const compiled = kit.compileTransactionMessage(message);
  return {
    staticAccounts: compiled.staticAccounts,
    hex: Buffer.from(encoder.encode(compiled)).toString("hex"),
  };
}

let agreements = 0;
const cases = CASES.map((testCase) => {
  const legacy = new web3.TransactionMessage({
    payerKey: new web3.PublicKey(testCase.payer),
    recentBlockhash: testCase.recentBlockhash,
    instructions: testCase.instructions.map(
      (ix) =>
        new web3.TransactionInstruction({
          programId: new web3.PublicKey(ix.programId),
          keys: ix.keys.map((k) => ({
            pubkey: new web3.PublicKey(k.pubkey),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          data: Buffer.from(ix.dataHex, "hex"),
        }),
    ),
  }).compileToLegacyMessage();

  const messageHex = encodeCompiledWithKit(legacy, testCase.config);

  const kitCompiled = compileAndEncodeWithKit(testCase);
  const sameOrder =
    kitCompiled.staticAccounts.join(",") ===
    legacy.staticAccountKeys.map((k) => k.toBase58()).join(",");
  if (sameOrder) {
    agreements += 1;
    if (kitCompiled.hex !== messageHex) {
      throw new Error(
        `${testCase.name}: Kit's compiler and web3.js's ordered the accounts alike but the bytes differ.`,
      );
    }
  }

  return {
    ...testCase,
    messageHex,
    ...(sameOrder && { kitCompiledHex: kitCompiled.hex }),
  };
});

const output = {
  kitVersion,
  generator: "anchor/tests/sdk/fixtures/generate_kit_v1_messages.cjs",
  command: "node anchor/tests/sdk/fixtures/generate_kit_v1_messages.cjs",
  generatedOn: "2026-09-18",
  note: "Version 1 transaction messages encoded by @solana/kit. messageHex is Kit's encoder over the message web3.js compiled; kitCompiledHex, where present, is Kit's own compiler and encoder over the same instructions, which agrees only when Kit's address ordering happens to match web3.js's first-appearance ordering. Regenerated by hand only.",
  cases,
};

const target = path.join(__dirname, "kit_v1_messages.json");
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote ${cases.length} cases (${agreements} with matching compiler order) to ${target} from @solana/kit ${kitVersion}`,
);
