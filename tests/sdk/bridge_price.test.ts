import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PriceClient } from "../../src/client/price";

const STATE = new PublicKey("3XYX3QvpHQ7TqvjhZcoBBmykNDruV9PtrGXRxJFzsiCF");
const BRIDGE_REGISTRY = new PublicKey(
  "5z3FbV5wL5LGbcsy3vGQqW3aB4dHvQpqcZjfSL2zVXrM",
);
const EXT_BRIDGE = PublicKey.unique();
const PROTOCOL = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const SOURCE_MINT = PublicKey.unique();
const BASE_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
);
const SOURCE_RESERVE = new PublicKey(
  "Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo",
);

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
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );

  return price as any;
}

function methodBuilder() {
  const builder = {
    accountsPartial: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(
      async () =>
        new TransactionInstruction({
          programId: EXT_BRIDGE,
          keys: [],
          data: Buffer.from([42]),
        }),
    ),
  };
  return builder;
}

function makeBridgePriceClient() {
  const bridge = {
    fetchRegistry: jest.fn(async () => ({
      managedTransferCount: 1,
      transfers: [{ status: 0, sourceMint: SOURCE_MINT }],
    })),
    getRegistryPda: () => BRIDGE_REGISTRY,
  };
  const baseAssetMeta = {
    asset: BASE_MINT,
    oracle: BASE_RESERVE,
    oracleSource: "KaminoReserve",
  };
  const sourceAssetMeta = {
    asset: SOURCE_MINT,
    oracle: SOURCE_RESERVE,
    oracleSource: "KaminoReserve",
  };
  const price = new PriceClient(
    {
      statePda: STATE,
      protocolProgram: { programId: PROTOCOL },
      extBridgeProgram: {
        programId: EXT_BRIDGE,
        methods: { priceManagedTransfers: jest.fn(() => methodBuilder()) },
      },
      fetchStateAccount: jest.fn(async () => ({ baseAssetMint: BASE_MINT })),
      getAssetMeta: jest.fn(async (mint: PublicKey) =>
        mint.equals(BASE_MINT) ? baseAssetMeta : sourceAssetMeta,
      ),
    } as any,
    {} as any,
    {} as any,
    bridge as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );

  return price as any;
}

describe("Bridge managed transfer pricing", () => {
  it("returns an empty chunk when the bridge registry is missing", async () => {
    const price = makePriceClient();

    await expect(price.priceManagedTransfersIxs()).resolves.toEqual({
      ixs: [],
      kaminoReserves: [],
    });
  });

  it("reports kamino-backed oracles separately from the price ix", async () => {
    const price = makeBridgePriceClient();

    const chunk = await price.priceManagedTransfersIxs();

    expect(chunk.ixs).toHaveLength(1);
    expect(chunk.kaminoReserves.map((p: PublicKey) => p.toBase58())).toEqual([
      BASE_RESERVE.toBase58(),
      SOURCE_RESERVE.toBase58(),
    ]);
  });
});
