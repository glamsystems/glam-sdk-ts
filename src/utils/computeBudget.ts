import {
  ComputeBudgetProgram,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";

const DEFAULT_PRIORITY_FEE = 10_000; // microLamports/CU

export type ComputeBudgetOptions = {
  vTx?: VersionedTransaction;
  getPriorityFeeMicroLamports?: (tx: VersionedTransaction) => Promise<number>;
  maxFeeLamports?: number;
  useMaxFee?: boolean;
};

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
  // ComputeBudgetProgram.setComputeUnitLimit costs 150 CUs
  // Add 20% more CUs to account for variable execution
  computeUnitLimit += 150;
  computeUnitLimit *= 1.2;

  const microLamports = await getPriorityFee(computeUnitLimit, options);
  return [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
  ];
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
