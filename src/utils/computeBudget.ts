import {
  ComputeBudgetProgram,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { priorityFeeLamports } from "./messageV1";

const DEFAULT_PRIORITY_FEE = 10_000; // microLamports/CU

export type ComputeBudgetOptions = {
  vTx?: VersionedTransaction;
  getPriorityFeeMicroLamports?: (tx: VersionedTransaction) => Promise<number>;
  maxFeeLamports?: number;
  useMaxFee?: boolean;
};

/**
 * What a transaction asks the runtime for, as numbers.
 *
 * A version 0 transaction states these with Compute Budget instructions and a
 * version 1 transaction states them in its message header, so the arithmetic
 * that produces them has one owner and both versions read the same result.
 */
export type ComputeBudget = {
  /**
   * Compute units: the simulation's figure with this SDK's margins on top,
   * as the whole number both versions state. `setComputeUnitLimit` truncates
   * a float into its u32 field, so the margins are truncated here and the
   * header states the number the version 0 instruction encodes.
   */
  computeUnitLimit: number;
  /** Micro lamports per compute unit, as `setComputeUnitPrice` states it. */
  priceMicroLamports: number;
  /** The same priority fee as a total in lamports, as a version 1 header
   * states it: what the runtime charges for the price above, over the limit
   * clamped to its 1,400,000 ceiling, so the two are the same spend. */
  priorityFeeLamports: number;
};

/**
 * The compute unit limit and the priority fee for one transaction.
 *
 * @param computeUnitLimit The compute units the simulation consumed
 * @param options Compute budget options
 */
export async function resolveComputeBudget(
  computeUnitLimit: number,
  options?: ComputeBudgetOptions,
): Promise<ComputeBudget> {
  // ComputeBudgetProgram.setComputeUnitLimit costs 150 CUs
  // Add 20% more CUs to account for variable execution
  const withMargins = (computeUnitLimit + 150) * 1.2;
  // The u32 a version 0 instruction would encode, which is what the runtime
  // reads on either version: its field truncates, so truncating here leaves
  // the version 0 bytes as they were and gives the header the same number.
  const limit = Math.trunc(withMargins);

  // The price stays quoted against the margin figure, as the version 0 path
  // has always quoted it; the total below is what the runtime charges for that
  // price, which it charges over the limit above.
  const priceMicroLamports = await getPriorityFee(withMargins, options);
  return {
    computeUnitLimit: limit,
    priceMicroLamports,
    priorityFeeLamports: priorityFeeLamports(priceMicroLamports, limit),
  };
}

/**
 * The two instructions a version 0 transaction states its budget with. A
 * version 1 transaction states the same budget in its message header and gets
 * no instruction: `compileToV1Message` takes the numbers as its config.
 */
export function computeBudgetInstructions({
  computeUnitLimit,
  priceMicroLamports,
}: ComputeBudget): Array<TransactionInstruction> {
  return [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priceMicroLamports,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
  ];
}

/**
 * Builds compute budget instructions for a transaction
 *
 * @param computeUnitLimit The compute unit limit
 * @param options Compute budget options
 * @returns Array of compute budget instructions
 */
export async function buildComputeBudgetInstructions(
  computeUnitLimit: number,
  options?: ComputeBudgetOptions,
): Promise<Array<TransactionInstruction>> {
  return computeBudgetInstructions(
    await resolveComputeBudget(computeUnitLimit, options),
  );
}

const getPriorityFee = async (
  computeUnitLimit: number,
  options?: ComputeBudgetOptions,
) => {
  const {
    vTx,
    getPriorityFeeMicroLamports,
    maxFeeLamports,
    useMaxFee = false,
  } = options || {};

  if (useMaxFee && maxFeeLamports) {
    return Math.ceil((maxFeeLamports * 1_000_000) / computeUnitLimit);
  }

  if (getPriorityFeeMicroLamports && vTx) {
    try {
      const feeEstimate = await getPriorityFeeMicroLamports(vTx);
      if (
        maxFeeLamports &&
        feeEstimate * computeUnitLimit > maxFeeLamports * 1_000_000
      ) {
        const fee = Math.ceil((maxFeeLamports * 1_000_000) / computeUnitLimit);
        if (process.env.NODE_ENV === "development") {
          console.log(
            `Estimated priority fee: ${feeEstimate} microLamports/CU, ${computeUnitLimit} CUs, total ${(feeEstimate * computeUnitLimit) / 1_000_000} lamports`,
          );
          console.log(
            `Max fee ${maxFeeLamports} lamports exceeded, cap priority fee to ${fee} microLamports/CU`,
          );
        }
        return fee;
      }

      return Math.ceil(feeEstimate);
    } catch {}
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `Using default priority fee ${DEFAULT_PRIORITY_FEE} microLamports/CU`,
    );
  }
  return DEFAULT_PRIORITY_FEE;
};
