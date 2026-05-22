import { BN } from "@coral-xyz/anchor";
import { toBn } from "../../src/utils";

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
});
