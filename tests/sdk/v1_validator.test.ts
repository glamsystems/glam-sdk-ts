import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  DEFAULT_HEAP_SIZE,
  RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
  SerializableMessageV1,
  assertV1TransactionLimits,
  compileToV1Message,
  V1Transaction,
} from "../../src/utils/messageV1";
import {
  computeBudgetInstructions,
  resolveComputeBudget,
} from "../../src/utils/computeBudget";
import { getSimulationResult } from "../../src/utils/transaction";

/** The biggest program the test validator ships: ~507 KB of program data. */
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

// The one proof the byte cases cannot give: a validator that takes version 1
// transactions accepts what this SDK writes. The repository's localnet is
// Agave 3.1.9, which cannot decode a version 1 transaction, so this suite runs
// only when it is pointed at a validator that can (Agave 4.2.0 or newer):
//
//   solana-test-validator --reset            # from an Agave 4.2.x release
//   GLAM_V1_VALIDATOR_URL=http://127.0.0.1:8899 \
//     npx nx run --skip-nx-cache anchor:jest --testFile tests/sdk/v1_validator
//
// It funds a throwaway keypair from the validator's faucet and signs with
// nothing else. Without the variable every case is skipped.
const url = process.env.GLAM_V1_VALIDATOR_URL;
const suite = url ? describe : describe.skip;

suite("a version 1 transaction against a validator that takes them", () => {
  const connection = new Connection(
    url ?? "http://127.0.0.1:8899",
    "confirmed",
  );
  const payer = Keypair.generate();

  beforeAll(async () => {
    const airdrop = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdrop, "confirmed");
  }, 60_000);

  it("is simulated, confirmed and read back as version 1, with the folded budget charged", async () => {
    const recipient = Keypair.generate().publicKey;
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const message = compileToV1Message({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient,
          lamports: LAMPORTS_PER_SOL / 4,
        }),
      ],
    });
    // Both Compute Budget instructions are folded into the message's fields:
    // 250,000 micro lamports a unit over 20,000 units is 5,000 lamports.
    expect(message.compiledInstructions).toHaveLength(1);
    expect(message.transactionConfig.computeUnitLimit).toBe(20_000);
    expect(message.transactionConfig.priorityFee).toBe(5_000);

    const tx = new V1Transaction(message);
    tx.sign([payer]);
    assertV1TransactionLimits(tx);

    const simulation = await connection.simulateTransaction(tx, {
      sigVerify: true,
    });
    expect(simulation.value.err).toBeNull();

    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    expect(confirmation.value.err).toBeNull();

    const row = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 1,
      commitment: "confirmed",
    });
    expect(row?.version).toBe(1);
    // One signature at 5,000 lamports plus the 5,000 lamport priority fee.
    expect(row?.meta?.fee).toBe(10_000);
    expect(await connection.getBalance(recipient)).toBe(LAMPORTS_PER_SOL / 4);
  }, 60_000);

  it("is refused in the version 0 envelope the library would have written", async () => {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = compileToV1Message({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1_000,
        }),
      ],
    });
    const tx = new V1Transaction(message);
    tx.sign([payer]);
    // Signature count and signatures first, then the message: the version 0
    // wire order. A version 1 transaction is the message first.
    const wrongEnvelope = Buffer.concat([
      Buffer.from([1]),
      Buffer.from(tx.signatures[0]),
      Buffer.from(message.serialize()),
    ]);
    await expect(
      connection.sendRawTransaction(wrongEnvelope),
    ).rejects.toThrow();
  }, 60_000);
});

// --------------------------------------------- the loaded accounts data size
//
// What the runtime does with the field a version 1 message states, measured
// rather than assumed. The account bytes counted include the program data of
// every program the transaction calls, which is what makes a tight limit
// dangerous: one Token-2022 call loads about half a megabyte.

suite("the loaded accounts data size a version 1 message states", () => {
  const connection = new Connection(
    url ?? "http://127.0.0.1:8899",
    "confirmed",
  );
  const payer = Keypair.generate();

  beforeAll(async () => {
    const airdrop = await connection.requestAirdrop(
      payer.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdrop, "confirmed");
  }, 60_000);

  /** A version 1 message with the field written by hand, `null` included. */
  function withLimit(
    blockhash: string,
    instructions: TransactionInstruction[],
    loadedAccountsDataSizeLimit: number | null,
  ): SerializableMessageV1 {
    return SerializableMessageV1.fromLegacy(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToLegacyMessage(),
      {
        computeUnitLimit: 200_000,
        heapSize: DEFAULT_HEAP_SIZE,
        loadedAccountsDataSizeLimit,
        priorityFee: 0,
      },
    );
  }

  function transferIx() {
    return SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1_000_000,
    });
  }

  /** Initializing a Token-2022 mint: ~507 KB of program data is loaded. */
  function tokenMint() {
    const mint = Keypair.generate();
    const data = Buffer.alloc(35);
    data.writeUInt8(20, 0); // InitializeMint2
    data.writeUInt8(9, 1); // decimals
    Buffer.from(payer.publicKey.toBytes()).copy(data, 2);
    data.writeUInt8(0, 34); // no freeze authority
    return {
      mint,
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: 5_000_000,
          space: 82,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        new TransactionInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          keys: [{ pubkey: mint.publicKey, isSigner: false, isWritable: true }],
          data,
        }),
      ],
    };
  }

  async function land(
    instructions: TransactionInstruction[],
    signers: Keypair[],
    limit: number | null,
  ) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new V1Transaction(withLimit(blockhash, instructions, limit));
    tx.sign(signers);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
    });
    await connection
      .confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      )
      .catch(() => undefined);
    const row = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 1,
      commitment: "confirmed",
    });
    return row?.meta ?? null;
  }

  it("is budgeted zero when the message leaves it unset, and even a transfer fails", async () => {
    const meta = await land([transferIx()], [payer], null);
    expect(JSON.stringify(meta?.err)).toContain(
      "MaxLoadedAccountsDataSizeExceeded",
    );
    // The fee is charged for a transaction that never ran an instruction.
    expect(meta?.fee).toBe(5_000);
    expect(meta?.logMessages ?? []).toEqual([]);
  }, 60_000);

  it("refuses a program whose data does not fit the stated limit", async () => {
    const { mint, instructions } = tokenMint();
    const meta = await land(instructions, [payer, mint], 100_000);
    expect(JSON.stringify(meta?.err)).toContain(
      "MaxLoadedAccountsDataSizeExceeded",
    );
  }, 60_000);

  it("accepts the same transaction at the runtime ceiling", async () => {
    const { mint, instructions } = tokenMint();
    const meta = await land(
      instructions,
      [payer, mint],
      RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
    );
    expect(meta?.err).toBeNull();
    expect(meta?.logMessages?.join("\n")).toContain("InitializeMint2");
  }, 60_000);

  it("charges the same fee at a tight limit and at the ceiling", async () => {
    const tight = await land([transferIx()], [payer], 100_000);
    const ceiling = await land(
      [transferIx()],
      [payer],
      RUNTIME_LOADED_ACCOUNTS_DATA_SIZE_LIMIT,
    );
    expect(tight?.err).toBeNull();
    expect(ceiling?.err).toBeNull();
    expect(ceiling?.fee).toBe(tight?.fee);
  }, 60_000);

  it("reports the bytes it loaded, and getSimulationResult surfaces them", async () => {
    const result = await getSimulationResult(
      connection,
      tokenMint().instructions,
      payer.publicKey,
      [],
      false,
      1,
    );
    expect(result.error).toBeUndefined();
    // The mint account, the payer, the two programs and Token-2022's program
    // data: far more than the accounts the message names would suggest.
    expect(result.loadedAccountsDataSize).toBeGreaterThan(500_000);
  }, 60_000);
});

// ------------------------------------- what this SDK's own path puts on chain

suite("a transaction this SDK builds for version 1", () => {
  const connection = new Connection(
    url ?? "http://127.0.0.1:8899",
    "confirmed",
  );
  const payer = Keypair.generate();

  beforeAll(async () => {
    const airdrop = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdrop, "confirmed");
  }, 60_000);

  it("names no Compute Budget instruction and is charged the fee it stated", async () => {
    const recipient = Keypair.generate().publicKey;
    const instructions = [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        // Rent exempt, so the simulation the budget is measured from succeeds.
        lamports: 2_000_000,
      }),
    ];

    // The SDK's own two steps: measure, then state what was measured.
    const { unitsConsumed, error } = await getSimulationResult(
      connection,
      instructions,
      payer.publicKey,
      [],
      false,
      1,
    );
    expect(error).toBeUndefined();
    const budget = await resolveComputeBudget(unitsConsumed!);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const message = compileToV1Message({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
      config: {
        computeUnitLimit: budget.computeUnitLimit,
        priorityFee: budget.priorityFeeLamports,
      },
    });
    // Nothing in the message runs the Compute Budget program.
    expect(
      message.staticAccountKeys.some((key) =>
        key.equals(ComputeBudgetProgram.programId),
      ),
    ).toBe(false);

    const tx = new V1Transaction(message);
    tx.sign([payer]);
    assertV1TransactionLimits(tx);

    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    expect(confirmation.value.err).toBeNull();

    const row = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 1,
      commitment: "confirmed",
    });
    expect(row?.version).toBe(1);
    // One signature at 5,000 lamports plus exactly the stated priority fee:
    // the header alone carries it, with no instruction to ask for it.
    expect(row?.meta?.fee).toBe(5_000 + budget.priorityFeeLamports);
    expect(await connection.getBalance(recipient)).toBe(2_000_000);
  }, 60_000);

  it("is charged the stated total when the margins do not land on a whole number", async () => {
    // A transfer consumes 150 units, and (150 + 150) * 1.2 = 360 exactly, so
    // the case above cannot tell the two versions' rounding apart. 1,151 units
    // give 1,561.2: `setComputeUnitLimit` truncates that into its u32, the
    // header states the same 1,561, and the runtime charges the one total.
    const budget = await resolveComputeBudget(1_151);
    expect(budget.computeUnitLimit).toBe(1_561);
    const [, limitIx] = computeBudgetInstructions(budget);
    expect(Buffer.from(limitIx.data).readUInt32LE(1)).toBe(
      budget.computeUnitLimit,
    );

    const recipient = Keypair.generate().publicKey;
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const tx = new V1Transaction(
      compileToV1Message({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient,
            lamports: 2_000_000,
          }),
        ],
        config: {
          computeUnitLimit: budget.computeUnitLimit,
          priorityFee: budget.priorityFeeLamports,
        },
      }),
    );
    tx.sign([payer]);

    const signature = await connection.sendRawTransaction(tx.serialize());
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    expect(confirmation.value.err).toBeNull();

    const row = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 1,
      commitment: "confirmed",
    });
    expect(row?.meta?.fee).toBe(5_000 + budget.priorityFeeLamports);
    expect(row?.meta?.computeUnitsConsumed).toBeLessThanOrEqual(
      budget.computeUnitLimit,
    );
  }, 60_000);

  it("pays what a version 0 transaction pays when the margin passes the runtime ceiling", async () => {
    // 1,300,000 units consumed ask for 1,560,180 with the margins, past the
    // 1,400,000 the runtime allows. The runtime clamps the units on both
    // versions, and charges a version 0 price over the clamped units, so the
    // total a version 1 header states is converted over the clamped units too.
    const budget = await resolveComputeBudget(1_300_000);
    expect(budget.computeUnitLimit).toBe(1_560_180);

    const send = async (version: 0 | 1) => {
      const recipient = Keypair.generate().publicKey;
      const transfer = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: 2_000_000,
      });
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      let raw: Uint8Array;
      if (version === 1) {
        const tx = new V1Transaction(
          compileToV1Message({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions: [transfer],
            config: {
              computeUnitLimit: budget.computeUnitLimit,
              priorityFee: budget.priorityFeeLamports,
            },
          }),
        );
        tx.sign([payer]);
        raw = tx.serialize();
      } else {
        const tx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions: [...computeBudgetInstructions(budget), transfer],
          }).compileToV0Message(),
        );
        tx.sign([payer]);
        raw = tx.serialize();
      }
      const signature = await connection.sendRawTransaction(raw);
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      expect(confirmation.value.err).toBeNull();
      const row = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 1,
        commitment: "confirmed",
      });
      expect(row?.version).toBe(version);
      return row?.meta?.fee;
    };

    const feeV0 = await send(0);
    const feeV1 = await send(1);
    // One signature at 5,000 lamports plus 10,000 micro lamports over the
    // clamped 1,400,000 units.
    expect(feeV0).toBe(5_000 + 14_000);
    expect(feeV1).toBe(feeV0);
  }, 60_000);
});
