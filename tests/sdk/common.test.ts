import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { formatLamportsAsSol, toBn } from "../../src/utils";

describe("common utils", () => {
  describe("toBn", () => {
    it("preserves existing BN instances", () => {
      const value = new BN(42);
      expect(toBn(value)).toBe(value);
    });

    it("converts bigint, number, and string values", () => {
      expect(toBn(42n).eq(new BN(42))).toBe(true);
      expect(toBn(42).eq(new BN(42))).toBe(true);
      expect(toBn("42").eq(new BN(42))).toBe(true);
    });
  });

  describe("formatLamportsAsSol", () => {
    it.each([
      [0, "0"],
      [LAMPORTS_PER_SOL, "1"],
      [1_500_000_000, "1.5"],
      [38_196_480, "0.03819648"],
      [1, "0.000000001"],
    ])("formats %i lamports as %s SOL", (lamports, expected) => {
      expect(formatLamportsAsSol(lamports)).toBe(expected);
    });
  });
});
