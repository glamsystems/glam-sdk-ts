import { TransactionError } from "@solana/web3.js";
import {
  getGlamProtocolIdl,
  getGlamMintIdl,
  getExtSplIdl,
  getExtKaminoIdl,
  getExtMarinadeIdl,
  getExtStakePoolIdl,
  getExtCctpIdl,
  getExtBridgeIdl,
  getExtRpiIdl,
  getExtJupiterIdl,
  getExtLoopscaleIdl,
  getExtOrcaIdl,
  getExtNeutralIdl,
  resolveStaging,
} from "./glamExports";
import { JUPITER_PROGRAM_ID } from "./constants";

export class GlamError extends Error {
  message: string;
  rawError: TransactionError | null | undefined;
  programLogs?: string[];

  constructor(
    message: string,
    rawError: TransactionError | null | undefined,
    programLogs?: string[],
  ) {
    super(message);
    this.message = message;
    this.rawError = rawError;
    this.programLogs = programLogs;
  }
}

const JUPITER_SWAP_ERRORS: Record<number, string> = {
  6001: "Jupiter swap failed: Slippage tolerance exceeded",
  6008: "Jupiter swap failed: Not enough account keys",
  6014: "Jupiter swap failed: Incorrect token program ID",
  6024: "Jupiter swap failed: Insufficient funds",
  6025: "Jupiter swap failed: Invalid token account",
};

/**
 * Extract the program ID that failed from transaction logs.
 * Looks for "Program <ID> failed:" log lines and returns the first match,
 * which corresponds to the innermost CPI that produced the root cause.
 */
export function extractFailedProgramId(
  logs?: string[] | null,
): string | undefined {
  if (!logs) return undefined;
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(/^Program (\w+) failed/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Resolve a custom program error code to a human-readable message.
 * When programId is provided, matches against the specific program's IDL
 * to avoid collisions between programs using the same error code range.
 * Accepts either a decimal number or a hex string (e.g. "0xBB80").
 */
export function resolveErrorCode(
  code: number | string,
  programId?: string,
  staging?: boolean,
): string | undefined {
  const decimal =
    typeof code === "string"
      ? (() => {
          const normalized = code.trim().toLowerCase();
          return normalized.startsWith("0x")
            ? parseInt(normalized, 16)
            : parseInt(normalized, 10);
        })()
      : code;
  if (isNaN(decimal)) return undefined;

  if (programId === JUPITER_PROGRAM_ID.toBase58()) {
    return JUPITER_SWAP_ERRORS[decimal];
  }

  const isStaging = resolveStaging(staging);

  type IdlWithErrors = {
    address: string;
    errors?: Array<{ code: number; msg?: string }>;
  };
  const glamIdls: IdlWithErrors[] = [
    getGlamProtocolIdl(isStaging),
    getGlamMintIdl(isStaging),
    getExtSplIdl(isStaging),
    getExtKaminoIdl(isStaging),
    getExtMarinadeIdl(isStaging),
    getExtStakePoolIdl(isStaging),
    getExtCctpIdl(isStaging),
    getExtBridgeIdl(isStaging),
    getExtRpiIdl(isStaging),
    getExtLoopscaleIdl(isStaging),
    getExtJupiterIdl(isStaging),
    getExtOrcaIdl(isStaging),
    getExtNeutralIdl(isStaging),
  ];

  if (programId) {
    // Match against the specific program that failed
    const idl = glamIdls.find((i) => i.address === programId);
    if (idl) {
      const err = idl.errors?.find((e) => e.code === decimal);
      if (err?.msg) return err.msg;
    }
  }

  return undefined;
}

/**
 * Parse the error message from a transaction error.
 * Environment-agnostic: handles Anchor errors, program error codes,
 * simulation failures, and common RPC/network errors.
 *
 * Callers (GUI, CLI) can handle environment-specific error types
 * (e.g. WalletSignTransactionError) before delegating to this function.
 */
export function parseTxError(error: any): string {
  const raw = error?.message || error?.toString?.() || "";
  const msg: string = raw === "[object Object]" ? "" : raw;

  // Transaction expired
  if (msg.includes("block height exceeded")) {
    return "Transaction expired";
  }

  // Transaction too large
  if (
    msg.includes("encoding overruns") ||
    msg.includes("exceeded maximum size")
  ) {
    return "Transaction too large: the transaction exceeds the maximum size limit.";
  }

  // RPC rate limiting
  if (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("rate limit")
  ) {
    return "RPC rate limited: please wait a moment and try again";
  }

  // RPC unavailable
  if (msg.includes("503") || msg.includes("Service Unavailable")) {
    return "RPC service unavailable: try again shortly";
  }

  // Connection errors
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return "Cannot connect to RPC: check your network or endpoint";
  }

  // Timeout
  if (
    msg.includes("timeout") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("TimeoutError")
  ) {
    return "Request timed out: try again";
  }

  return msg || "Unknown error";
}
