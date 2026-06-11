import {
  JupTokenList,
  JupiterApiClient,
  withStakePoolTokens,
} from "../../src/utils/jupiterApi";

describe("JupiterApiClient", () => {
  const originalFetch = global.fetch;
  const starSolMint = "STARxPuRLr3R6huwJ2ppqoTZ65WtA6S2unEzYiYV8bh";

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("keeps price entries without usdPrice as zero-priced tokens", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pricedMint: {
          usdPrice: 1.23,
          decimals: 6,
          blockId: 123,
        },
        unpricedMint: {
          createdAt: "2025-04-15T13:19:40Z",
          liquidity: 1222.757,
          blockId: 124,
          decimals: 6,
        },
      }),
    }) as any;

    const client = new JupiterApiClient({ apiKey: "test" });

    await expect(
      client.fetchTokenPrices(["pricedMint", "unpricedMint"]),
    ).resolves.toEqual([
      {
        mint: "pricedMint",
        usdPrice: 1.23,
        decimals: 6,
        blockId: 123,
      },
      {
        mint: "unpricedMint",
        usdPrice: 0,
        decimals: 6,
        blockId: 124,
      },
    ]);
  });

  it("can augment the token list with stake-pool LSTs", () => {
    const tokenList = withStakePoolTokens(new JupTokenList([]));

    expect(tokenList.getByMint(starSolMint)).toMatchObject({
      address: starSolMint,
      name: "StarPool staked SOL",
      symbol: "StarSOL",
      decimals: 9,
      tags: expect.arrayContaining(["lst", "verified"]),
    });
  });

  it("does not overwrite Jupiter metadata when augmenting stake-pool LSTs", () => {
    const tokenList = withStakePoolTokens(
      new JupTokenList([
        {
          address: starSolMint,
          name: "Jupiter StarSOL",
          symbol: "jSTAR",
          decimals: 9,
          logoURI: "https://example.com/star.svg",
          tags: ["verified"],
          usdPrice: 123,
          slot: 456,
        },
      ]),
    );

    expect(tokenList.getByMint(starSolMint)).toMatchObject({
      name: "Jupiter StarSOL",
      symbol: "jSTAR",
      usdPrice: 123,
      slot: 456,
    });
  });

  it("applies stake-pool augmentation when returning a cached token list", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;

    const client = new JupiterApiClient({ apiKey: "test" });
    await expect(client.fetchTokensList(true)).resolves.toHaveProperty(
      "tokens",
      [],
    );

    const augmented = await client.fetchTokensListV2({
      forceRefresh: false,
      includeStakePools: true,
    });

    expect(augmented.getByMint(starSolMint)?.symbol).toBe("StarSOL");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the original token list unaugmented", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;

    const client = new JupiterApiClient({ apiKey: "test" });
    const tokenList = await client.fetchTokensList(true);

    expect(tokenList.getByMint(starSolMint)).toBeUndefined();
  });
});
