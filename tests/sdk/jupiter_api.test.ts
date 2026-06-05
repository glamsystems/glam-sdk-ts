import { JupiterApiClient } from "../../src/utils/jupiterApi";

describe("JupiterApiClient", () => {
  const originalFetch = global.fetch;

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
});
