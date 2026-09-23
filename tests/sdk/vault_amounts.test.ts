import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  decodeTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BaseClient } from "../../src/client/base";
import { VaultClient } from "../../src/client/vault";
import { ClusterNetwork } from "../../src/clientConfig";

const U64_MAX = new BN("18446744073709551615");

function makeClient() {
  const signer = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const mintData = Buffer.alloc(82);
  mintData[44] = 6;
  mintData[45] = 1;
  const connection = {
    rpcEndpoint: "http://localhost:8899",
    commitment: "confirmed",
    getAccountInfo: jest.fn().mockResolvedValue({
      data: mintData,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
      lamports: 1,
      rentEpoch: 0,
    }),
    getTokenAccountBalance: jest
      .fn()
      .mockResolvedValue({ value: { amount: "0" } }),
    getBalance: jest.fn().mockResolvedValue(100),
  };
  const base = new BaseClient({
    cluster: ClusterNetwork.Localnet,
    provider: { connection, publicKey: signer } as any,
    statePda: Keypair.generate().publicKey,
    useStaging: false,
  });
  const client = new VaultClient(base);
  const send = jest.spyOn(base, "sendAndConfirm").mockResolvedValue("unused");
  const build = jest
    .spyOn(client.txBuilder, "buildVersionedTx")
    .mockResolvedValue({} as VersionedTransaction);
  return { client, base, signer, mint, recipient, connection, send, build };
}

type Fixture = ReturnType<typeof makeClient>;
type Entry = (fixture: Fixture, amount: BN) => Promise<unknown>;
const bnEntries: [string, Entry][] = [
  ["wrapIxs", (f, a) => f.client.txBuilder.wrapIxs(a, f.signer)],
  [
    "systemTransferIx",
    (f, a) => f.client.txBuilder.systemTransferIx(a, f.recipient, f.signer),
  ],
  [
    "tokenTransferIxs",
    (f, a) =>
      f.client.txBuilder.tokenTransferIxs(f.mint, a, f.recipient, f.signer),
  ],
  ["depositIxs", (f, a) => f.client.txBuilder.depositIxs(f.mint, a, f.signer)],
  [
    "depositSolIxs",
    (f, a) => f.client.txBuilder.depositSolIxs(a, true, f.signer),
  ],
  ["maybeWrapSol", (f, a) => f.client.maybeWrapSol(a)],
];

const numberEntries: [
  string,
  (fixture: Fixture, amount: number) => Promise<unknown>,
][] = [
  ["wrap", (f, a) => f.client.wrap(a)],
  ["systemTransfer", (f, a) => f.client.systemTransfer(a, f.recipient)],
  ["tokenTransfer", (f, a) => f.client.tokenTransfer(f.mint, a, f.recipient)],
  ["deposit", (f, a) => f.client.deposit(f.mint, a)],
  ["depositSol", (f, a) => f.client.depositSol(a)],
  ["maybeWrapSol", (f, a) => f.client.maybeWrapSol(a)],
];

function expectNoEffects(f: Fixture) {
  expect(f.connection.getAccountInfo).not.toHaveBeenCalled();
  expect(f.connection.getTokenAccountBalance).not.toHaveBeenCalled();
  expect(f.connection.getBalance).not.toHaveBeenCalled();
  expect(f.build).not.toHaveBeenCalled();
  expect(f.send).not.toHaveBeenCalled();
}

function builtInstructions(f: Fixture): TransactionInstruction[] {
  expect(f.build).toHaveBeenCalledTimes(1);
  return f.build.mock.calls[0][0];
}

describe("vault unsigned amounts", () => {
  describe.each(bnEntries)("%s", (_name, invoke) => {
    it.each([new BN(-1), U64_MAX.neg(), U64_MAX.addn(1)])(
      "rejects invalid BN %s before account reads or submission",
      async (amount) => {
        const f = makeClient();
        await expect(invoke(f, amount)).rejects.toThrow(
          /must be an unsigned 64-bit integer/,
        );
        expectNoEffects(f);
      },
    );
  });

  describe.each(numberEntries)("%s public number input", (_name, invoke) => {
    it.each([-1, -0.5, 0.5, NaN, Infinity, -Infinity, 2 ** 53])(
      "rejects %s before lossy conversion or side effects",
      async (amount) => {
        const f = makeClient();
        await expect(invoke(f, amount)).rejects.toThrow(
          /must be an unsigned 64-bit integer/,
        );
        expectNoEffects(f);
      },
    );
  });

  describe.each([
    ["wrap", (f: Fixture, amount: number) => f.client.wrap(amount)],
    [
      "systemTransfer",
      (f: Fixture, amount: number) =>
        f.client.systemTransfer(amount, f.recipient),
    ],
    [
      "tokenTransfer",
      (f: Fixture, amount: number) =>
        f.client.tokenTransfer(f.mint, amount, f.recipient),
    ],
    [
      "deposit",
      (f: Fixture, amount: number) => f.client.deposit(f.mint, amount),
    ],
    ["depositSol", (f: Fixture, amount: number) => f.client.depositSol(amount)],
  ] as const)("%s public number input", (name, invoke) => {
    it.each([0, 1, Number.MAX_SAFE_INTEGER])(
      "encodes accepted amount %s in the submitted instructions",
      async (amount) => {
        const f = makeClient();
        await invoke(f, amount);
        const ixs = builtInstructions(f);
        const expected = BigInt(amount);

        switch (name) {
          case "wrap":
          case "systemTransfer":
            expect(ixs).toHaveLength(name === "wrap" ? 2 : 1);
            expect(ixs[ixs.length - 1].data.readBigUInt64LE(8)).toBe(expected);
            break;
          case "tokenTransfer":
            expect(ixs).toHaveLength(2);
            expect(ixs[1].data.readBigUInt64LE(8)).toBe(expected);
            break;
          case "deposit":
            expect(ixs).toHaveLength(2);
            expect(decodeTransferCheckedInstruction(ixs[1]).data.amount).toBe(
              expected,
            );
            break;
          case "depositSol":
            expect(ixs).toHaveLength(3);
            expect(ixs[1].data.readBigUInt64LE(4)).toBe(expected);
            break;
        }
        expect(f.send).toHaveBeenCalledTimes(1);
      },
    );
  });

  it.each([0, 1, Number.MAX_SAFE_INTEGER])(
    "maybeWrapSol encodes accepted amount %s and keeps zero as a no-op",
    async (amount) => {
      const f = makeClient();
      f.connection.getBalance.mockResolvedValue(amount);
      const ixs = await f.client.maybeWrapSol(amount);

      if (amount === 0) {
        expect(ixs).toEqual([]);
      } else {
        expect(ixs).toHaveLength(2);
        expect(ixs[1].data.readBigUInt64LE(8)).toBe(BigInt(amount));
      }
      expect(f.build).not.toHaveBeenCalled();
      expect(f.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    new BN(0),
    new BN(1),
    new BN(Number.MAX_SAFE_INTEGER),
    new BN("9007199254740993"),
    U64_MAX,
  ])("preserves unsigned transfer and wrap bytes for %s", async (amount) => {
    const f = makeClient();
    const expected = BigInt(amount.toString());
    const transfer = await f.client.txBuilder.systemTransferIx(
      amount,
      f.recipient,
      f.signer,
    );
    const wrap = await f.client.txBuilder.wrapIxs(amount, f.signer);
    const tokens = await f.client.txBuilder.tokenTransferIxs(
      f.mint,
      amount,
      f.recipient,
      f.signer,
    );
    expect(transfer.data.readBigUInt64LE(8)).toBe(expected);
    expect(wrap).toHaveLength(2);
    expect(wrap[1].data.readBigUInt64LE(8)).toBe(expected);
    expect(wrap[1].data.subarray(0, 8)).toEqual(transfer.data.subarray(0, 8));
    expect(tokens).toHaveLength(2);
    expect(tokens[1].data.readBigUInt64LE(8)).toBe(expected);
    expect(tokens[1].data[16]).toBe(6);
    expect(amount.toString()).toBe(expected.toString());
    for (const shouldWrap of [false, true]) {
      const deposit = await f.client.txBuilder.depositSolIxs(
        amount,
        shouldWrap,
        f.signer,
      );
      expect(deposit).toHaveLength(shouldWrap ? 3 : 1);
      expect(deposit[shouldWrap ? 1 : 0].data.readBigUInt64LE(4)).toBe(
        expected,
      );
    }
    expect(f.send).not.toHaveBeenCalled();
  });

  it("preserves SPL deposit bytes and the existing safe-number ceiling", async () => {
    const f = makeClient();
    const ixs = await f.client.txBuilder.depositIxs(
      f.mint,
      new BN(Number.MAX_SAFE_INTEGER),
      f.signer,
    );
    expect(decodeTransferCheckedInstruction(ixs[1]).data.amount).toBe(
      BigInt(Number.MAX_SAFE_INTEGER),
    );
    await expect(
      f.client.txBuilder.depositIxs(f.mint, U64_MAX, f.signer),
    ).rejects.toThrow("Number can only safely store up to 53 bits");
  });

  it.each(bnEntries.slice(0, 4))(
    "%s snapshots a caller-owned BN before asynchronous construction",
    async (name, invoke) => {
      const f = makeClient();
      const amount = new BN(5);
      const pending = invoke(f, amount);
      amount.iaddn(2);
      const result = await pending;
      const ix: TransactionInstruction = Array.isArray(result)
        ? result[result.length - 1]
        : (result as TransactionInstruction);
      const encoded =
        name === "depositIxs"
          ? decodeTransferCheckedInstruction(ix).data.amount
          : ix.data.readBigUInt64LE(8);
      expect(encoded).toBe(5n);
      expect(amount.toNumber()).toBe(7);
    },
  );

  it("snapshots desired wSOL and preserves delta, no-op and insufficient SOL behavior", async () => {
    const f = makeClient();
    f.connection.getTokenAccountBalance.mockResolvedValue({
      value: { amount: "3" },
    });
    const desired = new BN(5);
    const pending = f.client.maybeWrapSol(desired);
    desired.iaddn(20);
    const ixs = await pending;
    expect(ixs[1].data.readBigUInt64LE(8)).toBe(2n);
    await expect(f.client.maybeWrapSol(new BN(3))).resolves.toEqual([]);
    await expect(f.client.maybeWrapSol(new BN(0))).resolves.toEqual([]);
    await expect(f.client.maybeWrapSol(new BN(104))).rejects.toThrow(
      "Insufficient lamports in vault",
    );
  });
});
