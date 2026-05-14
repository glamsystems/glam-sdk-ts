import {
  Connection,
  GetProgramAccountsConfig,
  GetProgramAccountsResponse,
  PublicKey,
  SignaturesForAddressOptions,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import {
  GetTransactionsOptions,
  HeliusGetProgramAccountsV2Config,
  heliusGetTransactionsForAddress,
  isHeliusRpc,
} from "./helius";

export {
  getAsset,
  getHeliusApiKey,
  getHeliusRpcUrl,
  getPriorityFeeEstimate,
  getTokenAccountsByMint,
  getTokenAccountsByMintResult,
  heliusFetch,
  heliusGetProgramAccountsV2,
  heliusGetTransactionsForAddress,
  isHeliusRpc,
} from "./helius";
export type {
  GetTokenAccountsByMintOptions,
  GetPriorityFeeEstimateOptions,
  GetTransactionsOptions,
  HeliusAsset,
  HeliusFetchOptions,
  HeliusGetProgramAccountsV2Config,
  HeliusTokenAccount,
  HeliusTokenAccountsByMintResult,
  PriorityLevel,
} from "./helius";

/**
 * Fetches program accounts using Helius getProgramAccountsV2 if available.
 * Otherwise falls back to standard getProgramAccounts with retry logic.
 */
export async function getProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  config: GetProgramAccountsConfig & HeliusGetProgramAccountsV2Config,
): Promise<GetProgramAccountsResponse> {
  // 2026-03-02: Helius getProgramAccountsV2 cannot find ALTs, disable it for now
  // if (isHeliusRpc(connection.rpcEndpoint)) {
  //   return await heliusGetProgramAccountsV2(
  //     connection.rpcEndpoint,
  //     programId,
  //     config,
  //   );
  // }
  return await getProgramAccountsWithRetry(connection, programId, config);
}

/**
 * Standard getProgramAccounts with retry logic for transient errors.
 */
export async function getProgramAccountsWithRetry(
  connection: Connection,
  programId: PublicKey,
  config: GetProgramAccountsConfig,
): Promise<GetProgramAccountsResponse> {
  const maxRetries = 3;
  const delayMs = 1000;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await connection.getProgramAccounts(programId, config);
    } catch (error: any) {
      lastError = error;

      if (error.code !== -32600 || attempt === maxRetries) {
        break;
      }

      const retryDelayMs = delayMs * attempt;
      console.warn(
        `getProgramAccounts attempt ${attempt} failed, retrying in ${retryDelayMs}ms:`,
        error.message,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(
    `getProgramAccounts failed after ${maxRetries} attempts. Last error: ${
      lastError?.message || "Unknown error"
    }`,
  );
}

/**
 * Fetches transactions for an address using Helius getTransactionsForAddress if available.
 * Otherwise falls back to getSignaturesForAddress + getTransaction.
 */
export async function getTransactionsForAddress(
  connection: Connection,
  address: PublicKey,
  options?: SignaturesForAddressOptions & GetTransactionsOptions,
): Promise<VersionedTransactionResponse[]> {
  if (isHeliusRpc(connection.rpcEndpoint)) {
    return (
      await heliusGetTransactionsForAddress(
        connection.rpcEndpoint,
        address,
        options,
      )
    ).filter((tx) => tx !== null);
  }

  const signatures = await connection.getSignaturesForAddress(
    address,
    {
      limit: options?.limit,
      before: options?.before,
    },
    options?.commitment,
  );

  const transactions = await Promise.all(
    signatures.map((sig) =>
      connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      }),
    ),
  );

  return transactions.filter((tx) => tx !== null);
}
