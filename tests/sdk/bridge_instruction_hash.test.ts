import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { hashMiddleInstructions } from "../../src/client/bridgeInstructionHash";

function fixture(): TransactionInstruction[] {
  return [
    new TransactionInstruction({
      programId: new PublicKey(Buffer.alloc(32, 1)),
      keys: [
        {
          pubkey: new PublicKey(Buffer.alloc(32, 2)),
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: new PublicKey(Buffer.alloc(32, 3)),
          isSigner: true,
          isWritable: true,
        },
      ],
      data: Buffer.from([0, 1, 254, 255]),
    }),
    new TransactionInstruction({
      programId: new PublicKey(Buffer.alloc(32, 4)),
      keys: [],
      data: Buffer.alloc(0),
    }),
  ];
}

describe("bridge middle instruction commitment", () => {
  it("matches the ext_bridge Rust fixed vector", async () => {
    expect((await hashMiddleInstructions(fixture())).toString("hex")).toBe(
      "67713de4e05d69c7df66d292f8b5f8171f7c5f46cab31a1ec7a3bea127959253",
    );
    expect((await hashMiddleInstructions([])).toString("hex")).toBe(
      "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7",
    );
  });

  it.each([
    ["instruction order", (ixs: TransactionInstruction[]) => ixs.reverse()],
    ["instruction count", (ixs: TransactionInstruction[]) => ixs.pop()],
    ["account order", (ixs: TransactionInstruction[]) => ixs[0].keys.reverse()],
    ["account count", (ixs: TransactionInstruction[]) => ixs[0].keys.pop()],
    [
      "program id",
      (ixs: TransactionInstruction[]) => {
        ixs[0].programId = new PublicKey(Buffer.alloc(32, 5));
      },
    ],
    [
      "account pubkey",
      (ixs: TransactionInstruction[]) => {
        ixs[0].keys[0].pubkey = new PublicKey(Buffer.alloc(32, 5));
      },
    ],
    [
      "data bytes",
      (ixs: TransactionInstruction[]) => {
        ixs[0].data[0] = 2;
      },
    ],
    [
      "data length",
      (ixs: TransactionInstruction[]) => {
        ixs[0].data = ixs[0].data.subarray(0, 3);
      },
    ],
  ])("commits to %s", async (_, change) => {
    const instructions = fixture();
    const original = await hashMiddleInstructions(instructions);
    change(instructions);
    expect(await hashMiddleInstructions(instructions)).not.toEqual(original);
  });

  it.each(["isSigner", "isWritable"] as const)(
    "ignores %s promotion",
    async (flag) => {
      const instructions = fixture();
      const original = await hashMiddleInstructions(instructions);
      for (const key of instructions[0].keys) {
        key[flag] = !key[flag];
      }
      expect(await hashMiddleInstructions(instructions)).toEqual(original);
    },
  );

  it("rejects instruction counts that do not fit u16", async () => {
    await expect(
      hashMiddleInstructions(new Array(65_536)),
    ).rejects.toMatchObject({
      code: "ERR_OUT_OF_RANGE",
    });
  });

  it("rejects account counts that do not fit u16", async () => {
    const instructions = fixture();
    instructions[0].keys = new Array(65_536);
    await expect(hashMiddleInstructions(instructions)).rejects.toMatchObject({
      code: "ERR_OUT_OF_RANGE",
    });
  });
});
