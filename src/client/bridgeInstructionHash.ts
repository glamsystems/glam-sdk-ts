import { TransactionInstruction } from "@solana/web3.js";

// Internal bridge commitment format; keep byte-for-byte aligned with ext_bridge.
export async function hashMiddleInstructions(
  instructions: TransactionInstruction[],
): Promise<Buffer> {
  const parts: Buffer[] = [];
  const instructionCount = Buffer.alloc(2);
  instructionCount.writeUInt16LE(instructions.length);
  parts.push(instructionCount);

  for (const ix of instructions) {
    parts.push(ix.programId.toBuffer());
    const accountCount = Buffer.alloc(2);
    accountCount.writeUInt16LE(ix.keys.length);
    parts.push(accountCount);
    // The runtime promotes privileges transaction-wide, so flags cannot be committed here.
    for (const key of ix.keys) {
      parts.push(key.pubkey.toBuffer());
    }
    const dataLength = Buffer.alloc(4);
    dataLength.writeUInt32LE(ix.data.length);
    parts.push(dataLength, Buffer.from(ix.data));
  }

  return Buffer.from(
    await crypto.subtle.digest("SHA-256", Buffer.concat(parts)),
  );
}
