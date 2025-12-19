export * from "./types";
export * from "./orderParams";

import { BN } from "@coral-xyz/anchor";

export function readUnsignedBigInt64LE(buffer: Buffer, offset: number): BN {
  return new BN(buffer.subarray(offset, offset + 8), 10, "le");
}

export function readSignedBigInt64LE(buffer: Buffer, offset: number): BN {
  const unsignedValue = new BN(buffer.subarray(offset, offset + 8), 10, "le");
  if (unsignedValue.testn(63)) {
    const inverted = unsignedValue.notn(64).addn(1);
    return inverted.neg();
  } else {
    return unsignedValue;
  }
}
