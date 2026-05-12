import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  VersionedTransaction,
  TransactionMessage,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
} from "@solana/web3.js";
import { resolveErrorCode, extractFailedProgramId } from "../error";

/**
 * Parses program logs to extract error message.
 * Checks in order: Anchor "Error Message:", insufficient funds/lamports,
 * and custom program error codes (resolved via IDL when possible).
 * Returns "Unknown error" if no recognizable error pattern is found.
 */
export function parseProgramLogs(logs: string[], staging: boolean): string {
  if (logs.length === 0) return "Invalid program logs";

  // Anchor "Error Message:" from program logs
  const errorMsgLog = logs.find((log) => log.includes("Error Message:"));
  if (errorMsgLog) {
    return errorMsgLog.split("Error Message:")[1].trim().replace(/\.$/, "");
  }

  // "insufficient funds" / "insufficient lamports" from logs
  const fundsLog = logs.find(
    (log) =>
      log.includes("Error: insufficient funds") ||
      log.includes("Transfer: insufficient lamports"),
  );
  if (fundsLog) return fundsLog;

  // Custom program error code in logs (covers GLAM, Jupiter, etc.)
  const customErrorLog = logs.find((log) =>
    log.includes("custom program error:"),
  );
  if (customErrorLog) {
    const match = customErrorLog.match(
      /custom program error: (0x[0-9a-fA-F]+)/,
    );
    if (match) {
      const failedProgramId = extractFailedProgramId(logs);
      const resolved = resolveErrorCode(match[1], failedProgramId, staging);
      if (resolved) return resolved;
      return `Program error: ${match[1]}`;
    }
  }

  return "Unknown error";
}

export const getSimulationResult = async (
  connection: Connection,
  instructions: Array<TransactionInstruction>,
  payer: PublicKey,
  lookupTables?: Array<AddressLookupTableAccount>,
  staging: boolean = false,
): Promise<{
  unitsConsumed?: number;
  error?: Error;
  serializedTx?: String;
}> => {
  const testIxs = [
    // Set an arbitrarily high number in simulation so we can be sure the transaction will succeed
    // and we get the real compute units used
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...instructions,
  ];

  let serializedTx;
  try {
    const testTx = new VersionedTransaction(
      new TransactionMessage({
        instructions: testIxs,
        payerKey: payer,
        // RecentBlockhash can by any public key during simulation
        // since 'replaceRecentBlockhash' is set to 'true' below
        recentBlockhash: PublicKey.default.toString(),
      }).compileToV0Message(lookupTables),
    );
    serializedTx = Buffer.from(testTx.serialize()).toString("base64");

    const rpcResponse = await connection.simulateTransaction(testTx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });
    getErrorFromRpcResponse(rpcResponse, staging);

    return {
      unitsConsumed: rpcResponse.value.unitsConsumed,
      serializedTx,
    };
  } catch (e) {
    return { error: e as Error, serializedTx };
  }
};

const getErrorFromRpcResponse = (
  rpcResponse: RpcResponseAndContext<SimulatedTransactionResponse>,
  staging: boolean,
) => {
  const error = rpcResponse.value.err;
  if (!error) return;

  if (typeof error === "object") {
    const errorKeys = Object.keys(error);
    if (errorKeys.length === 1) {
      if (errorKeys[0] !== "InstructionError") {
        throw new Error(`Unknown RPC error: ${JSON.stringify(error)}`);
      }
      // @ts-ignore due to missing typing information
      const instructionError = error["InstructionError"];
      const customErrorCode = instructionError?.[1]?.["Custom"];
      if (customErrorCode !== undefined) {
        const failedProgramId = extractFailedProgramId(rpcResponse.value.logs);
        const msg = resolveErrorCode(customErrorCode, failedProgramId, staging);
        if (msg) throw new Error(msg);
      }
      // Fallback to log-based parsing
      throw new Error(parseProgramLogs(rpcResponse.value.logs || [], staging));
    }
    throw new Error(`Unknown RPC error: ${JSON.stringify(error)}`);
  }

  throw new Error(typeof error === "string" ? error : "Unknown error");
};
