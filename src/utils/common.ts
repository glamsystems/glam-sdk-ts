import { BN } from "@coral-xyz/anchor";

/**
 * Converts a buffer or array of character codes to a string
 */
export function charsToString(chars: number[] | Buffer): string {
  return String.fromCharCode(...chars)
    .replace(/\0/g, "")
    .trim();
}

/**
 * @deprecated Use `charsToString` instead.
 */
export function charsToName(chars: number[] | Buffer): string {
  return charsToString(chars);
}

/**
 * Converts a string to an array of character codes
 */
export function stringToChars(name: string, length: number = 32): number[] {
  return Array.from(Buffer.from(name).subarray(0, length));
}

/**
 * @deprecated Use `stringToChars` instead.
 */
export function nameToChars(name: string, length: number = 32): number[] {
  return stringToChars(name, length);
}

/**
 * Returns the first 8 raw SHA-256 bytes for PDA seed derivation.
 */
export async function sha256First8Bytes(chars: number[]): Promise<number[]> {
  const bytes = Uint8Array.from(chars.filter((byte) => byte !== 0));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).subarray(0, 8));
}

/**
 * Values accepted by helpers that normalize integer/base-unit values into BN.
 */
export type BnInput = BN | bigint | number | string;

/**
 * Normalizes an integer/base-unit value into a BN while preserving existing BN values.
 */
export function toBn(value: BnInput): BN {
  return BN.isBN(value) ? value : new BN(value.toString());
}

/**
 * Backward-compatible alias for amount-oriented call sites.
 *
 * @deprecated Use `toBn` instead.
 */
export function toBnAmount(amount: BnInput): BN {
  return toBn(amount);
}

/**
 * Safely converts a BN amount to a UI amount (with decimals).
 *
 * @param amount - The amount in base units (BN)
 * @param decimals - The number of decimals (e.g., 9)
 * @returns The UI amount as a number
 *
 * @example
 * // Convert 10010000000 base units with 9 decimals
 * const uiAmount = toUiAmount(new BN(10010000000), 9); // Returns 10.01
 *
 * @throws Error if the BN amount is too large to safely convert to number
 */
export function toUiAmount(amount: BN, decimals: number): number {
  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = amount.div(divisor);
  const fractionalPart = amount.mod(divisor);

  // Convert to number - will throw if too large for Number.MAX_SAFE_INTEGER
  const intNum = integerPart.toNumber();
  const fracNum = fractionalPart.toNumber();

  return intNum + fracNum / Math.pow(10, decimals);
}

/**
 * Safely converts a UI amount (with decimals) to a BN amount.
 *
 * @param amount - The UI amount (e.g., 10.01)
 * @param decimals - The number of decimals (e.g., 9)
 * @returns BN representing the amount in base units
 *
 * @example
 * // Convert 10.01 with 9 decimals
 * const amount = fromUiAmount(10.01, 9); // Returns BN(10010000000)
 */
export function fromUiAmount(amount: number | string, decimals: number): BN {
  // Handle scientific notation by converting to fixed-point string
  let amountStr: string;
  if (typeof amount === "number") {
    // Convert number to fixed-point string to avoid scientific notation
    amountStr = amount.toFixed(decimals);
  } else {
    amountStr = amount;
  }

  const [integerPart, fractionalPart = ""] = amountStr.split(".");

  // Convert integer part
  const integerBN = new BN(integerPart || "0");

  // Convert fractional part
  let fractionalBN = new BN(0);
  if (fractionalPart) {
    // Pad or truncate fractional part to match decimals
    const paddedFractional = fractionalPart
      .padEnd(decimals, "0")
      .slice(0, decimals);
    fractionalBN = new BN(paddedFractional);
  }

  // Combine: (integer * 10^decimals) + fractional
  const multiplier = new BN(10).pow(new BN(decimals));
  return integerBN.mul(multiplier).add(fractionalBN);
}
