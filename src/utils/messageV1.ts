import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  ComputeBudgetProgram,
  Message,
  MessageV1,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const COMPUTE_BUDGET_PROGRAM_ID = ComputeBudgetProgram.programId;

/**
 * Writing a version 1 transaction message.
 *
 * @solana/web3.js 1.99.0 reads a version 1 message and refuses to write one:
 * `MessageV1.serialize()` throws, and `VersionedTransaction.serialize()` and
 * `.sign()` both go through it. Everything below is the missing direction,
 * written as the exact inverse of `MessageV1.deserialize` (lib/index.cjs.js,
 * the `static deserialize` of `class MessageV1`) so that the library's own
 * deserializer is the oracle for these bytes, and checked byte for byte
 * against @solana/kit 8.0.0, whose encoder is what GLAM's Kit SDK signs.
 *
 * The layout, in the order the deserializer reads it:
 *
 *   u8    version prefix, 0x81
 *   u8    numRequiredSignatures
 *   u8    numReadonlySignedAccounts
 *   u8    numReadonlyUnsignedAccounts
 *   u32   config mask, little endian
 *   [32]  recent blockhash
 *   u8    instruction count
 *   u8    static account key count
 *   [32]* static account keys
 *   u64   priority fee, total lamports   (only if both priority fee bits set)
 *   u32   compute unit limit             (only if its bit is set)
 *   u32   loaded accounts data size limit(only if its bit is set)
 *   u32   heap size                      (only if its bit is set)
 *   {u8 programIdIndex, u8 accountKeyIndexesLength, u16 dataLength}*
 *   {account key indexes, data}*
 *
 * Every integer is little endian. A field the mask leaves unset is absent from
 * the bytes, and the runtime budgets zero for it.
 */

/** The transaction versions this SDK builds. */
export type TransactionVersion = 0 | 1;

/** The first byte of a version 1 message: 0x80 | 1. */
export const V1_MESSAGE_PREFIX = 0x81;

/** SIMD 0385: a version 1 transaction is at most this many bytes on the wire. */
export const V1_TRANSACTION_SIZE_LIMIT = 4_096;

/** SIMD 0385: a version 1 message names at most this many accounts. */
export const V1_MAX_ACCOUNT_KEYS = 64;

const SIGNATURE_LENGTH_IN_BYTES = 64;
const PUBLIC_KEY_LENGTH = 32;

// The four config bits, as the library's deserializer masks them. The priority
// fee occupies two bits and both must be set or neither.
const CONFIG_MASK_PRIORITY_FEE_BITS = 0b00011;
const CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT = 0b00100;
const CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT = 0b01000;
const CONFIG_MASK_HEAP_SIZE_BIT = 0b10000;

/**
 * The four resources a version 1 message states for itself instead of asking
 * for them with Compute Budget instructions. `null` means the field is absent
 * from the message, which the runtime budgets as zero.
 */
export type V1TransactionConfig = {
  computeUnitLimit: number | null;
  heapSize: number | null;
  loadedAccountsDataSizeLimit: number | null;
  priorityFee: number | null;
};

type MessageHeader = {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
};

type CompiledInstruction = {
  programIdIndex: number;
  accountKeyIndexes: number[];
  data: Uint8Array;
};

function u32(bytes: number[], value: number, what: string) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(
      `${what} must be an integer in 0..=4294967295, got ${value}`,
    );
  }
  bytes.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function u64(bytes: number[], value: number, what: string) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(
      `${what} must be an integer in 0..=${Number.MAX_SAFE_INTEGER}, got ${value}`,
    );
  }
  let remaining = BigInt(value);
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(remaining & 0xffn));
    remaining >>= 8n;
  }
}

function u8(bytes: number[], value: number, what: string) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${what} must be an integer in 0..=255, got ${value}`);
  }
  bytes.push(value);
}

/**
 * A `MessageV1` that can write itself. Nothing else about the message changes:
 * the version, the account keys, the writability rules and the (always empty)
 * address table lookups are the library's.
 */
export class SerializableMessageV1 extends MessageV1 {
  /** Wrap a message the library produced, for example by deserializing one. */
  static from(message: MessageV1): SerializableMessageV1 {
    return new SerializableMessageV1({
      header: message.header,
      staticAccountKeys: message.staticAccountKeys,
      recentBlockhash: message.recentBlockhash,
      compiledInstructions: message.compiledInstructions,
      transactionConfig: message.transactionConfig,
    });
  }

  /**
   * Carry a legacy message into version 1. `compileToLegacyMessage` has
   * already done the work a version 1 message needs — key ordering, the
   * signer and writability merge, the instruction indexes — and a version 1
   * message has no address table lookups, so the only thing added here is the
   * config.
   */
  static fromLegacy(
    message: Message,
    transactionConfig: V1TransactionConfig,
  ): SerializableMessageV1 {
    return new SerializableMessageV1({
      header: message.header,
      staticAccountKeys: message.staticAccountKeys,
      recentBlockhash: message.recentBlockhash,
      compiledInstructions: message.compiledInstructions,
      transactionConfig,
    });
  }

  serialize(): Uint8Array {
    const header = this.header as MessageHeader;
    const keys = this.staticAccountKeys as PublicKey[];
    const instructions = this.compiledInstructions as CompiledInstruction[];
    const config = this.transactionConfig as V1TransactionConfig;

    if (keys.length > 0xff) {
      throw new Error(
        `A version 1 message states ${keys.length} account keys and the wire layout counts them in one byte.`,
      );
    }
    if (instructions.length > 0xff) {
      throw new Error(
        `A version 1 message carries ${instructions.length} instructions and the wire layout counts them in one byte.`,
      );
    }

    let configMask = 0;
    if (config.priorityFee !== null)
      configMask |= CONFIG_MASK_PRIORITY_FEE_BITS;
    if (config.computeUnitLimit !== null)
      configMask |= CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT;
    if (config.loadedAccountsDataSizeLimit !== null)
      configMask |= CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT;
    if (config.heapSize !== null) configMask |= CONFIG_MASK_HEAP_SIZE_BIT;

    const bytes: number[] = [];
    bytes.push(V1_MESSAGE_PREFIX);
    u8(bytes, header.numRequiredSignatures, "numRequiredSignatures");
    u8(bytes, header.numReadonlySignedAccounts, "numReadonlySignedAccounts");
    u8(
      bytes,
      header.numReadonlyUnsignedAccounts,
      "numReadonlyUnsignedAccounts",
    );
    u32(bytes, configMask, "configMask");

    const blockhash = bs58.decode(this.recentBlockhash);
    if (blockhash.length !== PUBLIC_KEY_LENGTH) {
      throw new Error(
        `A recent blockhash is 32 bytes and this one is ${blockhash.length}.`,
      );
    }
    bytes.push(...blockhash);

    bytes.push(instructions.length, keys.length);
    keys.forEach((key) => bytes.push(...key.toBytes()));

    // The config values, in the order the deserializer reads them.
    if (config.priorityFee !== null)
      u64(bytes, config.priorityFee, "priorityFee");
    if (config.computeUnitLimit !== null)
      u32(bytes, config.computeUnitLimit, "computeUnitLimit");
    if (config.loadedAccountsDataSizeLimit !== null)
      u32(
        bytes,
        config.loadedAccountsDataSizeLimit,
        "loadedAccountsDataSizeLimit",
      );
    if (config.heapSize !== null) u32(bytes, config.heapSize, "heapSize");

    // Every instruction's header, then every instruction's payload.
    instructions.forEach((ix) => {
      if (ix.accountKeyIndexes.length > 0xff) {
        throw new Error(
          `An instruction names ${ix.accountKeyIndexes.length} accounts and the wire layout counts them in one byte.`,
        );
      }
      if (ix.data.length > 0xffff) {
        throw new Error(
          `An instruction data is ${ix.data.length} bytes and the wire layout counts them in two bytes.`,
        );
      }
      u8(bytes, ix.programIdIndex, "programIdIndex");
      bytes.push(ix.accountKeyIndexes.length);
      bytes.push(ix.data.length & 0xff, (ix.data.length >>> 8) & 0xff);
    });
    instructions.forEach((ix) => {
      ix.accountKeyIndexes.forEach((index) =>
        u8(bytes, index, "accountKeyIndex"),
      );
      bytes.push(...ix.data);
    });

    return Uint8Array.from(bytes);
  }
}

/**
 * The wire bytes of a version 1 transaction: the message, then one signature
 * per required signer, with no count prefix. `VersionedTransaction.deserialize`
 * dispatches on the 0x81 in byte 0 and reads the count out of the message
 * header, which is the same envelope @solana/kit encodes and an Agave 4.2
 * validator reads. The library's own `VersionedTransaction.serialize()` always
 * writes the version 0 envelope — signatures first, behind a compact-u16 count
 * — so it is not used for a version 1 transaction.
 */
export function serializeV1Transaction(tx: VersionedTransaction): Uint8Array {
  const message =
    tx.message instanceof SerializableMessageV1
      ? tx.message
      : SerializableMessageV1.from(tx.message as MessageV1);
  const messageBytes = message.serialize();
  const expected = message.header.numRequiredSignatures;
  if (tx.signatures.length !== expected) {
    throw new Error(
      `A version 1 transaction carries one signature per required signer: this message requires ${expected} and the transaction holds ${tx.signatures.length}.`,
    );
  }
  const wire = new Uint8Array(
    messageBytes.length + expected * SIGNATURE_LENGTH_IN_BYTES,
  );
  wire.set(messageBytes, 0);
  tx.signatures.forEach((signature, index) =>
    wire.set(
      signature,
      messageBytes.length + index * SIGNATURE_LENGTH_IN_BYTES,
    ),
  );
  return wire;
}

/**
 * A `VersionedTransaction` that writes the version 1 envelope. Overriding
 * `serialize()` is what makes the rest of the library work on these bytes:
 * `Connection.simulateTransaction` and every caller that sends
 * `tx.serialize()` go through it, while `sign()` and `addSignature()` keep
 * using `message.serialize()`, which the subclass above supplies.
 */
export class V1Transaction extends VersionedTransaction {
  serialize(): Uint8Array {
    return serializeV1Transaction(this);
  }
}

/**
 * The version 1 envelope, checked where the bytes leave this SDK.
 *
 * The envelope above is written by `V1Transaction.serialize()` alone. The
 * library's own `VersionedTransaction.serialize()` wraps the very same message
 * in the version 0 envelope and reports no error, and transactions are sent
 * with preflight disabled, so wrong bytes would reach the cluster unremarked.
 * The subclass is dropped silently by a `VersionedTransaction.deserialize`
 * round trip (a co-signing API, a relayer) and by a wallet adapter that returns
 * a transaction it rebuilt. What is checked here is therefore the bytes, not
 * the class, so a transaction built by another copy of this SDK passes too.
 *
 * `bytes` is the serialization the caller already has, when it has one; with no
 * bytes the transaction is asked to write itself, and a message that cannot
 * (the library's own `MessageV1`) is reported the same way.
 */
export function assertV1Envelope(tx: unknown, bytes?: Uint8Array): void {
  const message = (tx as { message?: { version?: number } } | null | undefined)
    ?.message;
  if (message?.version !== 1) return;

  let wire = bytes;
  if (wire === undefined) {
    try {
      wire = (tx as VersionedTransaction).serialize();
    } catch {
      wire = undefined;
    }
  }
  if (wire !== undefined && wire.length > 0 && wire[0] === V1_MESSAGE_PREFIX) {
    return;
  }

  const wrote =
    wire === undefined
      ? "its serialize() throws"
      : wire.length === 0
        ? "its serialize() returns no bytes"
        : `its serialize() starts the bytes with 0x${wire[0]
            .toString(16)
            .padStart(2, "0")} instead of 0x${V1_MESSAGE_PREFIX.toString(16)}`;
  throw new Error(
    `This transaction holds a version 1 message and does not write the version 1 envelope: ${wrote}. Nothing was signed or sent. A version 1 message stays correct only inside the V1Transaction this SDK compiled it into: pass that object through unchanged, rather than one rebuilt by VersionedTransaction.deserialize or returned by a wallet that reconstructs what it signs.`,
  );
}

// ------------------------------------------------------------- the compile

/**
 * The compute units and the loaded account bytes the runtime allows one
 * transaction, and the heap size GLAM's Kit SDK states. A version 1 message
 * budgets ZERO for a field it leaves unset, so a message that states nothing
 * is refused at execution for a budget it never asked for: `compileToV1Message`
 * always states all four.
 */
export const RUNTIME_COMPUTE_UNIT_LIMIT = 1_400_000;
export const RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 67_108_864;
export const DEFAULT_HEAP_SIZE = 32_768;

/**
 * A caller's own loaded accounts data size limit, checked before it reaches a
 * message. The field is a u32 and the runtime refuses to load more than the
 * ceiling, so anything outside 1..=67,108,864 is a value no message can state.
 *
 * Measured on an Agave 4.2.2 validator: the runtime counts the account data a
 * transaction loads INCLUDING the program data of every program it calls, so a
 * limit that looks generous is not. One ordinary Token-2022 call loads 507,254
 * bytes and a 100,000-byte limit refuses it with MaxLoadedAccountsDataSizeExceeded
 * before any instruction runs, having charged the fee. The ceiling is the
 * default for that reason, and it costs the payer nothing: the same transfer
 * pays 5,000 lamports at 100,000 bytes and at the ceiling.
 */
export function assertLoadedAccountsDataSizeLimit(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT
  ) {
    throw new Error(
      `A loaded accounts data size limit of ${value} is not a value a version 1 message can state: it is a whole number of bytes from 1 to ${RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT}. Nothing was built. Pass a limit in that range, or leave the option out to take the runtime ceiling, which is what this SDK states by default.`,
    );
  }
  return value;
}

const COMPUTE_BUDGET_REQUEST_UNITS = 0;
const COMPUTE_BUDGET_REQUEST_HEAP_FRAME = 1;
const COMPUTE_BUDGET_SET_COMPUTE_UNIT_LIMIT = 2;
const COMPUTE_BUDGET_SET_COMPUTE_UNIT_PRICE = 3;
const COMPUTE_BUDGET_SET_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 4;

/** What a run of Compute Budget instructions asked for. */
type FoldedBudget = {
  computeUnitLimit?: number;
  heapSize?: number;
  loadedAccountsDataSizeLimit?: number;
  /** As `setComputeUnitPrice` states it: micro lamports per compute unit. */
  priceMicroLamports?: number;
  /** As `requestUnits` states it: lamports, already a total. */
  additionalFeeLamports?: number;
};

function readU32(data: Buffer | Uint8Array, offset: number): number {
  return Buffer.from(data).readUInt32LE(offset);
}

/**
 * What one Compute Budget instruction asks for, read out of its own bytes.
 * web3.js 1.99.0 decodes the first four kinds and has no factory or decoder
 * for `SetLoadedAccountsDataSizeLimit`, which route builders do send, so all
 * five are read here from the tag byte and the little-endian value behind it.
 */
function foldComputeBudgetInstruction(
  into: FoldedBudget,
  ix: TransactionInstruction,
): void {
  const data = ix.data;
  if (data.length < 1) return;
  switch (data[0]) {
    case COMPUTE_BUDGET_REQUEST_UNITS:
      into.computeUnitLimit = readU32(data, 1);
      into.additionalFeeLamports = readU32(data, 5);
      return;
    case COMPUTE_BUDGET_REQUEST_HEAP_FRAME:
      into.heapSize = readU32(data, 1);
      return;
    case COMPUTE_BUDGET_SET_COMPUTE_UNIT_LIMIT:
      into.computeUnitLimit = readU32(data, 1);
      return;
    case COMPUTE_BUDGET_SET_COMPUTE_UNIT_PRICE:
      into.priceMicroLamports = Number(Buffer.from(data).readBigUInt64LE(1));
      return;
    case COMPUTE_BUDGET_SET_LOADED_ACCOUNTS_DATA_SIZE_LIMIT:
      into.loadedAccountsDataSizeLimit = readU32(data, 1);
      return;
    default:
      throw new Error(
        `A Compute Budget instruction of kind ${data[0]} cannot be carried into a version 1 message's fields. Nothing was compiled. Remove it and state the budget through the transaction options instead.`,
      );
  }
}

/** A u32 field takes an integer; a compute unit limit is rounded up to one. */
function asU32(value: number): number {
  return Math.ceil(value);
}

/**
 * A price per compute unit as the total a version 1 header states, in
 * lamports. The runtime clamps a limit past its ceiling and charges a version
 * 0 price over the clamped units, while it charges a stated total as it is,
 * so the total is converted over the clamped units: both versions pay the same.
 */
export function priorityFeeLamports(
  priceMicroLamports: number,
  computeUnitLimit: number,
): number {
  const chargedUnits = Math.min(computeUnitLimit, RUNTIME_COMPUTE_UNIT_LIMIT);
  return Math.ceil((priceMicroLamports * chargedUnits) / 1_000_000);
}

export type CompileToV1MessageInput = {
  payerKey: PublicKey;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
  /** What the caller states outright; anything absent is folded or defaulted. */
  config?: Partial<V1TransactionConfig>;
};

/**
 * Compile instructions into a version 1 message.
 *
 * `compileToLegacyMessage` does the work a version 1 message needs — key
 * ordering, the signer and writability merge, the instruction indexes — and a
 * version 1 message has no address table lookups, so nothing is resolved or
 * fetched here.
 *
 * Compute Budget instructions are taken out of the list and folded into the
 * message's own fields, because the runtime treats one inside a version 1
 * message as no operation: the priority fee a version 0 message states as
 * micro lamports per compute unit becomes a total in lamports, rounded up.
 * What the caller states outright wins over what the instructions said, and
 * every field a message would otherwise leave unset takes its default.
 *
 * The SDK's own budget arrives as `config`, from `resolveComputeBudget`: on
 * the version 1 path nothing builds a Compute Budget instruction for the fold
 * to undo. The fold is the safety net for instruction lists that arrive from
 * elsewhere — a caller's preInstructions, a route a quote API returned, a
 * builder that hands back a flat list with a heap frame in front of it.
 */
export function compileToV1Message({
  payerKey,
  recentBlockhash,
  instructions,
  config,
}: CompileToV1MessageInput): SerializableMessageV1 {
  const folded: FoldedBudget = {};
  const rest: TransactionInstruction[] = [];
  instructions.forEach((ix) => {
    if (ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) {
      foldComputeBudgetInstruction(folded, ix);
    } else {
      rest.push(ix);
    }
  });

  const computeUnitLimit = asU32(
    config?.computeUnitLimit ??
      folded.computeUnitLimit ??
      RUNTIME_COMPUTE_UNIT_LIMIT,
  );
  const loadedAccountsDataSizeLimit = asU32(
    config?.loadedAccountsDataSizeLimit ??
      folded.loadedAccountsDataSizeLimit ??
      RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
  );
  const heapSize = asU32(
    config?.heapSize ?? folded.heapSize ?? DEFAULT_HEAP_SIZE,
  );
  const priorityFee =
    config?.priorityFee ??
    folded.additionalFeeLamports ??
    (folded.priceMicroLamports === undefined
      ? 0
      : priorityFeeLamports(folded.priceMicroLamports, computeUnitLimit));

  const message = SerializableMessageV1.fromLegacy(
    new TransactionMessage({
      payerKey,
      recentBlockhash,
      instructions: rest,
    }).compileToLegacyMessage(),
    {
      computeUnitLimit,
      heapSize,
      loadedAccountsDataSizeLimit,
      priorityFee,
    },
  );

  // The post condition the fold above exists for: whatever arrived, no
  // compiled instruction runs the Compute Budget program, because the runtime
  // treats one inside a version 1 message as no operation and the budget it
  // asked for would be silently lost.
  if (computeBudgetInstructionIndex(message) !== -1) {
    throw new Error(
      `Compiling this version 1 message left a Compute Budget instruction in it, which the runtime ignores. Nothing was compiled. Report this: every Compute Budget instruction is meant to be folded into the message's own fields here.`,
    );
  }
  return message;
}

/**
 * The first compiled instruction that runs the Compute Budget program, or -1.
 * Read off the message's own account keys, so an instruction assembled by hand
 * is seen the same as one a factory built.
 */
function computeBudgetInstructionIndex(message: {
  staticAccountKeys: PublicKey[];
  compiledInstructions: { programIdIndex: number }[];
}): number {
  const programIndex = message.staticAccountKeys.findIndex((key) =>
    key.equals(COMPUTE_BUDGET_PROGRAM_ID),
  );
  if (programIndex === -1) return -1;
  return message.compiledInstructions.findIndex(
    (ix) => ix.programIdIndex === programIndex,
  );
}

// -------------------------------------------------------------- the limits

/**
 * The version 1 rules, checked on the transaction this SDK assembled: that no
 * instruction runs the Compute Budget program, the accounts its message names,
 * and its own wire bytes with the signature slots in place. Without address
 * lookup tables the account count is the binding limit, and a transaction that
 * passes here is one the cluster will accept on size and account grounds and
 * will charge the budget it meant to ask for.
 */
export function assertV1TransactionLimits(tx: VersionedTransaction): void {
  const budgetIx = computeBudgetInstructionIndex(tx.message as any);
  if (budgetIx !== -1) {
    throw new Error(
      `Instruction ${budgetIx} of this version 1 transaction runs the Compute Budget program, which the runtime ignores inside a version 1 message: the compute unit limit, priority fee, heap size or loaded accounts data size it asks for would be lost. Nothing was sent. State the budget in the message's own fields instead — build the transaction through this SDK, which folds any such instruction into them, rather than assembling the message by hand.`,
    );
  }

  const accountCount = tx.message.staticAccountKeys.length;
  if (accountCount > V1_MAX_ACCOUNT_KEYS) {
    throw new Error(
      `The transaction names ${accountCount} accounts and a version 1 transaction allows at most ${V1_MAX_ACCOUNT_KEYS}. Nothing was sent. Use fewer accounts in this transaction, or split the operation into smaller ones.`,
    );
  }
  const size = serializeV1Transaction(tx).length;
  if (size > V1_TRANSACTION_SIZE_LIMIT) {
    throw new Error(
      `The transaction is ${size} bytes and a version 1 transaction allows at most ${V1_TRANSACTION_SIZE_LIMIT}. Nothing was sent. Send fewer instructions in this transaction, or split the operation into smaller ones.`,
    );
  }
}

/**
 * The transaction version the environment asks for, if it asks for one.
 * `GLAM_TRANSACTION_VERSION` is the lowest-priority default there is: it lets
 * a test run or an operator choose without a code change, and anything above
 * it — the client's own default, or one transaction's option — wins.
 */
export function transactionVersionFromEnv(): TransactionVersion | undefined {
  const value = process.env.GLAM_TRANSACTION_VERSION;
  if (value === undefined || value === "") return undefined;
  if (value === "0") return 0;
  if (value === "1") return 1;
  throw new Error(
    `GLAM_TRANSACTION_VERSION is "${value}" and the only values are "0" and "1". Nothing was built. Set it to 0 or 1, or unset it to let the client decide.`,
  );
}
