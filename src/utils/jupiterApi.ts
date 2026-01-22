import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

export type QuoteParams = {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  swapMode?: string;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
  dexes?: string[];
  excludeDexes?: string[];
  instructionVersion: "V1" | "V2";
};

export type QuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any; // { amount, feeBps }
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
};

export type TokenListItem = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  usdPrice: number;
  slot: number;
};

export class JupTokenList {
  readonly mintMap: Map<string, TokenListItem>;

  constructor(readonly tokens: TokenListItem[]) {
    this.mintMap = new Map(tokens.map((token) => [token.address, token]));
  }

  getByMint(mintAddress: string | PublicKey): TokenListItem | undefined {
    return this.mintMap.get(mintAddress.toString());
  }

  getBySymbol(symbol: string): TokenListItem | undefined {
    return this.tokens.find((token) => token.symbol === symbol);
  }
}

export type JupiterInstruction = {
  programId: string;
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: string;
};

export type SwapInstructions = {
  tokenLedgerInstruction?: JupiterInstruction | null;
  otherInstructions?: JupiterInstruction[];
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions?: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
  addressLookupTableAddresses: string[];
};

const DEFAULT_TOKEN_LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const JUPITER_API_DEFAULT = "https://api.jup.ag";

// Zod schemas for runtime validation
const PriceDataSchema = z.object({
  usdPrice: z.number(),
  decimals: z.number(),
  blockId: z.number(),
});

const PriceResponseSchema = z.record(z.string(), PriceDataSchema);

export type TokenPrice = {
  mint: string;
  usdPrice: number;
  decimals: number;
  blockId: number;
};

export class JupiterApiClient {
  swapApiBaseUrl: string;
  isCustomSwapApi: boolean = false;
  apiKey: string | null = null;

  private tokenListCache: { data: JupTokenList; timestamp: number } | null =
    null;

  private tokenListCacheTtl: number;

  constructor(
    options: {
      apiKey?: string;
      swapApiBaseUrl?: string;
      cacheTtl?: number;
    } = {},
  ) {
    this.tokenListCacheTtl = options.cacheTtl ?? DEFAULT_TOKEN_LIST_CACHE_TTL;
    this.apiKey =
      options.apiKey ||
      process.env.NEXT_PUBLIC_JUPITER_API_KEY ||
      process.env.JUPITER_API_KEY ||
      null;
    this.swapApiBaseUrl =
      options.swapApiBaseUrl ||
      process.env.NEXT_PUBLIC_JUPITER_SWAP_API ||
      process.env.JUPITER_SWAP_API ||
      JUPITER_API_DEFAULT + "/swap/v1";

    // Custom swap API services (e.g., metis) don't require a Jupiter API key
    // Jupiter's official API requires a key (via constructor arg or environment variable)
    this.isCustomSwapApi = !this.swapApiBaseUrl.startsWith(JUPITER_API_DEFAULT);
    if (!this.isCustomSwapApi && !this.apiKey) {
      throw new Error(
        "Jupiter API key is required for official Jupiter API. Set JUPITER_API_KEY or NEXT_PUBLIC_JUPITER_API_KEY environment variable, or pass apiKey in constructor options.",
      );
    }
  }

  async fetchTokenPrices(mints: string[]): Promise<TokenPrice[]> {
    if (!this.apiKey) {
      throw new Error("Jupiter API key is required for the /price endpoint");
    }

    const response = await fetch(
      `${JUPITER_API_DEFAULT}/price/v3?ids=${mints.join(",")}`,
      { headers: { "x-api-key": this.apiKey } },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch token prices from Jupiter: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();
    const validated = PriceResponseSchema.parse(data);

    return Object.entries(validated).map(
      ([key, { usdPrice, decimals, blockId }]) => ({
        mint: key,
        usdPrice,
        decimals,
        blockId,
      }),
    );
  }

  async fetchTokensList(forceRefresh = false): Promise<JupTokenList> {
    if (
      !forceRefresh &&
      this.tokenListCache &&
      Date.now() - this.tokenListCache.timestamp < this.tokenListCacheTtl
    ) {
      return this.tokenListCache.data;
    }

    if (!this.apiKey) {
      throw new Error("Jupiter API key is required for the /tokens endpoint");
    }

    const response = await fetch(
      `${JUPITER_API_DEFAULT}/tokens/v2/tag?query=verified`,
      { headers: { "x-api-key": this.apiKey } },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch tokens list from Jupiter: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();

    const tokenList = data?.map((t: any) => ({
      address: t.id,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      logoURI: t.icon,
      tags: t.tags,
      usdPrice: t.usdPrice,
      slot: t.priceBlockId,
    }));

    const jupTokenList = new JupTokenList(tokenList);
    this.tokenListCache = { data: jupTokenList, timestamp: Date.now() };
    return jupTokenList;
  }

  async fetchProgramLabels(): Promise<{ [key: string]: string }> {
    if (!this.apiKey) {
      throw new Error(
        "Jupiter API key is required for the /swap/v1/program-id-to-label endpoint",
      );
    }
    const response = await fetch(`${this.swapApiBaseUrl}/program-id-to-label`, {
      headers: { "x-api-key": this.apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch program labels from Jupiter: ${response.status} ${errorText}`,
      );
    }

    return await response.json();
  }

  async getQuoteResponse(quoteParams: QuoteParams): Promise<any> {
    if (!this.isCustomSwapApi && !this.apiKey) {
      throw new Error("Jupiter API key must be set");
    }

    const queryParams = new URLSearchParams(
      Object.entries(quoteParams).map(([key, val]) => [key, String(val)]),
    );
    const headers: HeadersInit = this.isCustomSwapApi
      ? {}
      : { "x-api-key": this.apiKey! };
    const response = await fetch(
      `${this.swapApiBaseUrl}/quote?${queryParams}`,
      { headers },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch quote from Jupiter: ${response.status} ${errorText}`,
      );
    }

    return await response.json();
  }

  async getSwapInstructions(
    quoteResponse: any,
    from: PublicKey,
  ): Promise<SwapInstructions> {
    if (!this.isCustomSwapApi && !this.apiKey) {
      throw new Error("Jupiter API key must be set");
    }

    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(this.isCustomSwapApi ? {} : { "x-api-key": this.apiKey! }),
    };

    const response = await fetch(`${this.swapApiBaseUrl}/swap-instructions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: from.toBase58(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch swap instructions from Jupiter: ${response.status} ${errorText}`,
      );
    }

    return await response.json();
  }
}
