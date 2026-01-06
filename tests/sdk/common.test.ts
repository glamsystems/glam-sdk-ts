import { BN } from "@coral-xyz/anchor";
import {
  charsToString,
  stringToChars,
  toUiAmount,
  fromUiAmount,
} from "../../src/utils/common";

describe("charsToString", () => {
  it("should convert character codes array to string", () => {
    const chars = [72, 101, 108, 108, 111]; // "Hello"
    expect(charsToString(chars)).toBe("Hello");
  });

  it("should convert Buffer to string", () => {
    const buffer = Buffer.from("World");
    expect(charsToString(buffer)).toBe("World");
  });

  it("should remove null characters", () => {
    const chars = [72, 105, 0, 0, 0]; // "Hi" followed by null chars
    expect(charsToString(chars)).toBe("Hi");
  });

  it("should trim whitespace", () => {
    const chars = [32, 84, 101, 115, 116, 32]; // " Test "
    expect(charsToString(chars)).toBe("Test");
  });

  it("should handle empty array", () => {
    expect(charsToString([])).toBe("");
  });

  it("should handle empty buffer", () => {
    expect(charsToString(Buffer.from(""))).toBe("");
  });

  it("should handle mixed null chars and whitespace", () => {
    const chars = [32, 65, 66, 67, 0, 0, 32]; // " ABC\0\0 "
    expect(charsToString(chars)).toBe("ABC");
  });

  it("should handle special characters", () => {
    const chars = [64, 35, 36, 37]; // "@#$%"
    expect(charsToString(chars)).toBe("@#$%");
  });
});

describe("stringToChars", () => {
  it("should convert string to character codes array", () => {
    const result = stringToChars("Hi");
    expect(result).toEqual([72, 105]);
  });

  it("should default to length 32", () => {
    const result = stringToChars("A");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(65); // 'A'
  });

  it("should truncate string to specified length", () => {
    const longString = "This is a very long string that exceeds the limit";
    const result = stringToChars(longString, 10);
    expect(result).toHaveLength(10);
    expect(result).toEqual([84, 104, 105, 115, 32, 105, 115, 32, 97, 32]); // "This is a "
  });

  it("should handle empty string", () => {
    const result = stringToChars("");
    expect(result).toEqual([]);
  });

  it("should handle special characters", () => {
    const result = stringToChars("@#$");
    expect(result).toEqual([64, 35, 36]);
  });

  it("should handle unicode characters", () => {
    const result = stringToChars("café");
    expect(result).toEqual([99, 97, 102, 195, 169]); // UTF-8 encoding
  });

  it("should use custom length parameter", () => {
    const result = stringToChars("Hello World", 5);
    expect(result).toHaveLength(5);
    expect(result).toEqual([72, 101, 108, 108, 111]); // "Hello"
  });
});

describe("charsToString and stringToChars round-trip", () => {
  it("should round-trip convert simple strings", () => {
    const original = "Test String";
    const chars = stringToChars(original);
    const result = charsToString(chars);
    expect(result).toBe(original);
  });

  it("should round-trip convert with truncation", () => {
    const original = "Very Long String That Gets Truncated";
    const chars = stringToChars(original, 10);
    const result = charsToString(chars);
    // charsToString trims the result, so trailing space is removed
    expect(result).toBe("Very Long");
  });

  it("should round-trip convert empty string", () => {
    const original = "";
    const chars = stringToChars(original);
    const result = charsToString(chars);
    expect(result).toBe(original);
  });
});

describe("toUiAmount", () => {
  it("should convert BN to UI amount with 9 decimals", () => {
    const amount = new BN(10010000000); // 10.01 with 9 decimals
    const result = toUiAmount(amount, 9);
    expect(result).toBe(10.01);
  });

  it("should handle zero amount", () => {
    const amount = new BN(0);
    const result = toUiAmount(amount, 9);
    expect(result).toBe(0);
  });

  it("should handle amount with no fractional part", () => {
    const amount = new BN(5000000000); // 5.0 with 9 decimals
    const result = toUiAmount(amount, 9);
    expect(result).toBe(5);
  });

  it("should handle amount with only fractional part", () => {
    const amount = new BN(123456789); // 0.123456789 with 9 decimals
    const result = toUiAmount(amount, 9);
    expect(result).toBeCloseTo(0.123456789, 9);
  });

  it("should handle different decimal places (6 decimals)", () => {
    const amount = new BN(1500000); // 1.5 with 6 decimals
    const result = toUiAmount(amount, 6);
    expect(result).toBe(1.5);
  });

  it("should handle different decimal places (2 decimals)", () => {
    const amount = new BN(12345); // 123.45 with 2 decimals
    const result = toUiAmount(amount, 2);
    expect(result).toBe(123.45);
  });

  it("should handle large integer amounts", () => {
    const amount = new BN(1000000000000); // 1000 with 9 decimals
    const result = toUiAmount(amount, 9);
    expect(result).toBe(1000);
  });

  it("should handle very small amounts", () => {
    const amount = new BN(1); // 0.000000001 with 9 decimals
    const result = toUiAmount(amount, 9);
    expect(result).toBe(0.000000001);
  });

  it("should throw error for amounts too large to convert safely", () => {
    // Number.MAX_SAFE_INTEGER is 9007199254740991
    const amount = new BN("10000000000000000000000"); // Extremely large number
    expect(() => toUiAmount(amount, 0)).toThrow();
  });
});

describe("fromUiAmount", () => {
  it("should convert UI amount to BN with 9 decimals", () => {
    const result = fromUiAmount(10.01, 9);
    expect(result.toString()).toBe("10010000000");
  });

  it("should handle zero amount", () => {
    const result = fromUiAmount(0, 9);
    expect(result.toString()).toBe("0");
  });

  it("should handle integer amounts", () => {
    const result = fromUiAmount(5, 9);
    expect(result.toString()).toBe("5000000000");
  });

  it("should handle different decimal places (6 decimals)", () => {
    const result = fromUiAmount(1.5, 6);
    expect(result.toString()).toBe("1500000");
  });

  it("should handle different decimal places (2 decimals)", () => {
    const result = fromUiAmount(123.45, 2);
    expect(result.toString()).toBe("12345");
  });

  it("should handle string input", () => {
    const result = fromUiAmount("10.5", 9);
    expect(result.toString()).toBe("10500000000");
  });

  it("should handle large amounts", () => {
    const result = fromUiAmount(1000000, 9);
    expect(result.toString()).toBe("1000000000000000");
  });

  it("should handle very small amounts (fractional)", () => {
    const result = fromUiAmount(0.000000001, 9);
    expect(result.toString()).toBe("1");
  });

  it("should handle string with many decimal places", () => {
    const result = fromUiAmount("0.123456789", 9);
    expect(result.toString()).toBe("123456789");
  });
});

describe("toUiAmount and fromUiAmount round-trip", () => {
  it("should round-trip with 9 decimals", () => {
    const original = 10.01;
    const bn = fromUiAmount(original, 9);
    const result = toUiAmount(bn, 9);
    expect(result).toBeCloseTo(original, 9);
  });

  it("should round-trip with 6 decimals", () => {
    const original = 123.456789;
    const bn = fromUiAmount(original, 6);
    const result = toUiAmount(bn, 6);
    expect(result).toBeCloseTo(original, 6);
  });

  it("should round-trip with 2 decimals", () => {
    const original = 999.99;
    const bn = fromUiAmount(original, 2);
    const result = toUiAmount(bn, 2);
    expect(result).toBe(original);
  });

  it("should round-trip zero", () => {
    const original = 0;
    const bn = fromUiAmount(original, 9);
    const result = toUiAmount(bn, 9);
    expect(result).toBe(original);
  });

  it("should round-trip integer amounts", () => {
    const original = 42;
    const bn = fromUiAmount(original, 9);
    const result = toUiAmount(bn, 9);
    expect(result).toBe(original);
  });

  it("should handle precision limits correctly", () => {
    // Test that we don't lose precision within safe integer range
    const original = 1234567.89;
    const bn = fromUiAmount(original, 9);
    const result = toUiAmount(bn, 9);
    expect(result).toBeCloseTo(original, 9);
  });
});

describe("Edge cases and error handling", () => {
  it("toUiAmount should handle BN with zero decimals", () => {
    const amount = new BN(100);
    const result = toUiAmount(amount, 0);
    expect(result).toBe(100);
  });

  it("fromUiAmount should handle zero decimals", () => {
    const result = fromUiAmount(100, 0);
    expect(result.toString()).toBe("100");
  });

  it("fromUiAmount should handle negative numbers in string", () => {
    // BN constructor will handle negative strings
    const result = fromUiAmount("-10", 9);
    expect(result.isNeg()).toBe(true);
  });

  it("stringToChars should handle string longer than buffer size", () => {
    const longString = "a".repeat(100);
    const result = stringToChars(longString, 50);
    expect(result).toHaveLength(50);
    expect(result.every((code) => code === 97)).toBe(true); // all 'a'
  });

  it("charsToString should handle buffer with only null characters", () => {
    const chars = [0, 0, 0, 0];
    expect(charsToString(chars)).toBe("");
  });

  it("charsToString should handle buffer with only whitespace", () => {
    const chars = [32, 32, 32]; // spaces
    expect(charsToString(chars)).toBe("");
  });
});
