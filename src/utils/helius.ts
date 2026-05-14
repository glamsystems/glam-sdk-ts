import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { decompress } from "fzstd";
import {
  AccountInfo,
  Finality,
  GetProgramAccountsConfig,
  PublicKey,
  SignaturesForAddressOptions,
  VersionedTransaction,
  VersionedTransactionResponse,
} from "@solana/web3.js";

export function isHeliusRpc(rpcUrl: string): boolean {
  return rpcUrl.includes("helius-rpc.com");
}

export function getHeliusApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_HELIUS_API_KEY || process.env.HELIUS_API_KEY;
}

export function getHeliusRpcUrl(apiKey?: string): string {
  const key = apiKey ?? getHeliusApiKey();
  if (!key) {
    throw new Error("Helius API key not found");
  }
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

export type HeliusFetchOptions = {
  rpcUrl?: string;
  apiKey?: string;
};

export async function heliusFetch<T = any>(
  method: string,
  params: unknown,
  options?: HeliusFetchOptions,
): Promise<T> {
  const rpcUrl = options?.rpcUrl ?? getHeliusRpcUrl(options?.apiKey);

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
  });
  if (!response.ok) {
    throw new Error(`${method} HTTP error: ${response.status}`);
  }

  const data: any = await response.json();
  if (data.error) {
    throw new Error(`${method} RPC error: ${data.error.message}`);
  }
  return data.result as T;
}

// ---------------------------------------------------------------------------
// getAsset (DAS)
// ---------------------------------------------------------------------------

export type HeliusAsset = {
  id: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
  };
  token_info?: { symbol?: string; decimals?: number };
};

export async function getAsset(
  mint: string,
  options?: HeliusFetchOptions,
): Promise<HeliusAsset | null> {
  const result = await heliusFetch<HeliusAsset | null>(
    "getAsset",
    { id: mint },
    options,
  );
  return result ?? null;
}

// ---------------------------------------------------------------------------
// getTokenAccounts (by mint)
// ---------------------------------------------------------------------------

export type HeliusTokenAccount = {
  address: string;
  owner: string;
  mint: string;
  amount: string | number;
  delegated_amount?: string | number;
  frozen?: boolean;
};

export type GetTokenAccountsByMintOptions = HeliusFetchOptions & {
  showZeroBalance?: boolean;
  limit?: number;
};

export type HeliusTokenAccountsByMintResult = {
  token_accounts: HeliusTokenAccount[];
  total?: number;
};

export async function getTokenAccountsByMintResult(
  mint: PublicKey | string,
  options?: GetTokenAccountsByMintOptions,
): Promise<HeliusTokenAccountsByMintResult> {
  const mintStr = typeof mint === "string" ? mint : mint.toBase58();
  const result = await heliusFetch<{
    token_accounts?: HeliusTokenAccount[];
    total?: number;
  }>(
    "getTokenAccounts",
    {
      mint: mintStr,
      ...(options?.limit !== undefined && { limit: options.limit }),
      options: { showZeroBalance: options?.showZeroBalance ?? true },
    },
    options,
  );
  return {
    token_accounts: result?.token_accounts ?? [],
    total: result?.total,
  };
}

export async function getTokenAccountsByMint(
  mint: PublicKey | string,
  options?: GetTokenAccountsByMintOptions,
): Promise<HeliusTokenAccount[]> {
  return (await getTokenAccountsByMintResult(mint, options)).token_accounts;
}

// ---------------------------------------------------------------------------
// getPriorityFeeEstimate
// https://docs.helius.dev/guides/priority-fee-api
// ---------------------------------------------------------------------------

export type PriorityLevel =
  | "Recommended"
  | "Min"
  | "Low"
  | "Medium"
  | "High"
  | "VeryHigh"
  | "UnsafeMax"
  | "Default";

export type GetPriorityFeeEstimateOptions = {
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

  const result = await heliusFetch<{ priorityFeeEstimate: number }>(
    "getPriorityFeeEstimate",
    [{ ...param, options: requestOptions }],
    { apiKey: heliusApiKey },
  );
  return result.priorityFeeEstimate;
}

// ---------------------------------------------------------------------------
// getTransactionsForAddress
// ---------------------------------------------------------------------------

export interface GetTransactionsOptions {
  commitment?: Finality;
  sinceSlot?: number;
  transactionDetails?: "full" | "signatures";
}

// FIXME: The param `limit` now controls page size, not total results
export async function heliusGetTransactionsForAddress(
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
    result = await heliusFetch<any>(
      "getTransactionsForAddress",
      [
        address.toBase58(),
        {
          transactionDetails,
          limit,
          ...(paginationToken && { paginationToken }),
          ...(commitment && { commitment }),
        },
      ],
      { rpcUrl },
    );
    allTransactions.push(...(result?.data || []));
    paginationToken = result?.paginationToken;
  } while (paginationToken);

  return allTransactions;
}

// ---------------------------------------------------------------------------
// getProgramAccountsV2 (currently disabled at the dispatcher level)
// ---------------------------------------------------------------------------

export type HeliusGetProgramAccountsV2Config = {
  limit?: number;
  changedSinceSlot?: number;
};

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

export async function heliusGetProgramAccountsV2(
  rpcUrl: string,
  programId: PublicKey,
  config: GetProgramAccountsConfig & HeliusGetProgramAccountsV2Config,
): Promise<{ pubkey: PublicKey; account: AccountInfo<Buffer> }[]> {
  const allAccounts: { pubkey: PublicKey; account: AccountInfo<Buffer> }[] = [];
  let paginationKey: string | null = null;

  do {
    const result: any = await heliusFetch<any>(
      "getProgramAccountsV2",
      [
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
      ],
      { rpcUrl },
    );

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
