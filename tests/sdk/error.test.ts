import { extractFailedProgramId, resolveErrorCode } from "../../src/error";
import {
  getGlamProtocolIdl,
  getExtSplIdl,
  getExtNeutralProgramId,
} from "../../src/glamExports";
import { JUPITER_PROGRAM_ID } from "../../src/constants";

describe("extractFailedProgramId", () => {
  it("extracts the failed Jupiter program from real RouteV2 logs", () => {
    const logs = [
      "Program ComputeBudget111111111111111111111111111111 invoke [1]",
      "Program ComputeBudget111111111111111111111111111111 success",
      "Program ComputeBudget111111111111111111111111111111 invoke [1]",
      "Program ComputeBudget111111111111111111111111111111 success",
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [1]",
      "...",
      "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb success",
      "Program CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK success",
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [2]",
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 success",
      "Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 failed: custom program error: 0x1771",
    ];

    expect(extractFailedProgramId(logs)).toBe(
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    );
  });
});

describe("resolveErrorCode", () => {
  const protocolId = getGlamProtocolIdl(false).address;
  const protocolError = getGlamProtocolIdl(false).errors[0];
  const splId = getExtSplIdl(false).address;
  const jupiterId = JUPITER_PROGRAM_ID.toBase58();

  it("resolves a GLAM protocol error by programId", () => {
    expect(resolveErrorCode(protocolError.code, protocolId)).toBe(
      protocolError.msg,
    );
  });

  it("scopes lookup to the matching IDL when programId is provided", () => {
    // ext_spl programId paired with a protocol-only error code returns
    // undefined (falls through to Jupiter, which doesn't have it either),
    // proving the resolver isn't blindly scanning every IDL.
    expect(resolveErrorCode(protocolError.code, splId)).toBeUndefined();
  });

  it("resolves Jupiter errors when programId is Jupiter", () => {
    expect(resolveErrorCode(6001, jupiterId)).toContain(
      "Slippage tolerance exceeded",
    );
  });

  it("accepts hex codes", () => {
    expect(resolveErrorCode("0x1771", jupiterId)).toContain(
      "Slippage tolerance exceeded",
    );
  });

  it("resolves ext_neutral errors without falling through to Jupiter code collisions", () => {
    expect(
      resolveErrorCode(6008, getExtNeutralProgramId(false).toBase58(), false),
    ).toBe("Neutral bundle permission mode does not match the instruction");
  });

  it("keeps Jupiter mappings for Jupiter program failures", () => {
    expect(resolveErrorCode(6008, jupiterId)).toBe(
      "Jupiter swap failed: Not enough account keys",
    );
  });

  it("returns undefined for unknown codes from unknown programs", () => {
    const unknownProgram = "11111111111111111111111111111111";
    expect(resolveErrorCode(99999, unknownProgram)).toBeUndefined();
  });

  it("returns undefined for NaN inputs", () => {
    expect(resolveErrorCode("not-a-number")).toBeUndefined();
  });
});
