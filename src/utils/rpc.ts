import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { decompress } from "fzstd";
import {
  AccountInfo,
  Connection,
  Finality,
  GetProgramAccountsConfig,
  GetProgramAccountsResponse,
  PublicKey,
  SignaturesForAddressOptions,
  VersionedTransaction,
  VersionedTransactionResponse,
} from "@solana/web3.js";

function isHeliusRpc(rpcUrl: string): boolean {
  return rpcUrl.includes("helius-rpc.com");
}

function getHeliusApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_HELIUS_API_KEY || process.env.HELIUS_API_KEY;
}

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
  //   return await getProgramAccountsV2Helius(
  //     connection.rpcEndpoint,
  //     programId,
  //     config,
  //   );
  // }
  return await getProgramAccountsWithRetry(connection, programId, config);
}

export type HeliusGetProgramAccountsV2Config = {
  limit?: number;
  changedSinceSlot?: number;
};

async function rpcRequest(rpcUrl: string, method: string, params: any[]) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
  });

  const data: any = await response.json();
  if (data.error) {
    throw new Error(`${method} RPC error: ${data.error.message}`);
  }

  return data.result;
}

function decodeAccountData(accountData: string, encoding: string): Buffer {
  if (encoding === "base64") {
    return Buffer.from(accountData, "base64");
  } else if (encoding === "base64+zstd") {
    const compressed = Buffer.from(accountData, "base64");
    return Buffer.from(decompress(compressed));
  } else if (encoding === "base58") {
    return bs58.decode(accountData);
  }

  throw new Error(`Unsupported encoding: ${encoding}`);
}

async function getProgramAccountsV2Helius(
  rpcUrl: string,
  programId: PublicKey,
  config: GetProgramAccountsConfig & HeliusGetProgramAccountsV2Config,
): Promise<{ pubkey: PublicKey; account: AccountInfo<Buffer> }[]> {
  const allAccounts: { pubkey: PublicKey; account: AccountInfo<Buffer> }[] = [];
  let paginationKey: string | null = null;

  do {
    const result = await rpcRequest(rpcUrl, "getProgramAccountsV2", [
      programId.toBase58(),
      {
        encoding: config.encoding || "base64",
        filters: config.filters || [],
        ...(config.limit && { limit: config.limit }),
        ...(config.changedSinceSlot && {
          changedSinceSlot: config.changedSinceSlot,
        }),
        ...(paginationKey && { paginationKey }),
      },
    ]);

    for (const { pubkey, account } of result.accounts) {
      const [accountData, encoding] = account.data;

      allAccounts.push({
        pubkey: new PublicKey(pubkey),
        account: {
          ...account,
          owner: new PublicKey(account.owner),
          data: decodeAccountData(accountData, encoding),
        },
      });
    }

    paginationKey = result.accounts.length > 0 ? result.paginationKey : null;
  } while (paginationKey);

  return allAccounts;
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

export interface GetTransactionsOptions {
  commitment?: Finality;
  sinceSlot?: number;
  transactionDetails?: "full" | "signatures";
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
      await getTransactionsForAddressHelius(
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

// FIXME: The param `limit` now controls page size, not total results
async function getTransactionsForAddressHelius(
  rpcUrl: string,
  address: PublicKey,
  options?: SignaturesForAddressOptions & GetTransactionsOptions,
): Promise<(VersionedTransactionResponse | null)[]> {
  const {
    transactionDetails = "full",
    limit = 100,
    before,
    commitment,
  } = options || {};

  const allTransactions: (VersionedTransactionResponse | null)[] = [];
  let result: any;
  let paginationToken: any = before;
  do {
    result = await rpcRequest(rpcUrl, "getTransactionsForAddress", [
      address.toBase58(),
      {
        transactionDetails,
        limit,
        ...(paginationToken && { paginationToken }),
        ...(commitment && { commitment }),
      },
    ]);
    allTransactions.push(...(result?.data || []));
    paginationToken = result?.paginationToken;
  } while (paginationToken);

  return allTransactions;
}

// https://docs.helius.dev/guides/priority-fee-api
export type PriorityLevel =
  | "Recommended"
  | "Min"
  | "Low"
  | "Medium"
  | "High"
  | "VeryHigh"
  | "UnsafeMax"
  | "Default";
type GetPriorityFeeEstimateOptions = {
  heliusApiKey?: string;
  tx?: VersionedTransaction;
  accountKeys?: string[];
  priorityLevel?: PriorityLevel;
};

export async function getPriorityFeeEstimate(
  options: GetPriorityFeeEstimateOptions,
): Promise<number> {
  const {
    heliusApiKey = getHeliusApiKey(),
    tx,
    accountKeys,
    priorityLevel,
  } = options;

  if (!heliusApiKey) {
    console.warn(
      "getPriorityFeeEstimate is called but Helius API key not found",
    );
    return 0;
  }

  if (!tx && !accountKeys) {
    throw new Error("Either tx or accountKeys must be provided");
  }

  const requestOptions =
    priorityLevel && priorityLevel !== "Recommended"
      ? { priorityLevel }
      : { recommended: true };

  const param = tx
    ? { transaction: bs58.encode(tx.serialize()) }
    : { accountKeys };

  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  const result = await rpcRequest(rpcUrl, "getPriorityFeeEstimate", [
    {
      ...param,
      options: requestOptions,
    },
  ]);

  return result.priorityFeeEstimate as number;
}
