import { PublicKey } from "@solana/web3.js";
import { PriceClient } from "../../src/client/price";

const STATE = new PublicKey("3XYX3QvpHQ7TqvjhZcoBBmykNDruV9PtrGXRxJFzsiCF");

function makePriceClient() {
  const bridge = {
    fetchRegistry: jest.fn(async () => null),
  };
  const price = new PriceClient(
    {
      statePda: STATE,
      fetchStateAccount: jest.fn(async () => ({
        baseAssetMint: PublicKey.default,
      })),
    } as any,
    {} as any,
    {} as any,
    bridge as any,
    {} as any,
    (() => undefined) as any,
  );

  return price as any;
}

describe("Bridge managed transfer pricing", () => {
  it("returns no instructions when the bridge registry is missing", async () => {
    const price = makePriceClient();

    await expect(price.priceManagedTransfersIxs()).resolves.toEqual([]);
  });
});
