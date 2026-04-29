import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PriceClient } from "../../src/client/price";
import { KAMINO_LENDING_PROGRAM, WSOL } from "../../src/constants";
import { StateAccountType } from "../../src/models";
import { PkMap, PkSet } from "../../src/utils";

const VAULT = new PublicKey("31xmCqzfdYT4GHjo39BQiTHVPjpugw6JqXNwckVL9cEf");
const STATE = new PublicKey("3XYX3QvpHQ7TqvjhZcoBBmykNDruV9PtrGXRxJFzsiCF");
const EXT_KAMINO = PublicKey.unique();
const EXT_BRIDGE = PublicKey.unique();
const EXT_EPI = PublicKey.unique();
const OBLIGATION = new PublicKey(
  "65iwhmFa5mRSmeBGNGEzSfG6y66Pk6r5eksYDMFSMRb6",
);
const MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const RESERVE_A = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
const RESERVE_B = new PublicKey("Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo");
const RESERVE_C = new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q");
const PRIME = new PublicKey("3b8X44fLF9ooXaUm3hhSgjpmVs6rZZ3pPoGnGahc3Uu7");

function ix(data: number): TransactionInstruction {
  return new TransactionInstruction({
    programId: PublicKey.default,
    keys: [],
    data: Buffer.from([data]),
  });
}

function methodBuilder(instruction: TransactionInstruction) {
  const builder = {
    accounts: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(async () => instruction),
  };
  return builder;
}

function reserve(pubkey: PublicKey) {
  return {
    getAddress: () => pubkey,
    lendingMarket: MARKET,
    scopePriceFeed: PublicKey.default,
  };
}

function expectPubkeys(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58())).toEqual(
    expected.map((pubkey) => pubkey.toBase58()),
  );
}

const KAMINO_LENDING_ACL = {
  integrationProgram: EXT_KAMINO,
  protocolsBitmask: 0b01,
};
const BRIDGE_ACL = {
  integrationProgram: EXT_BRIDGE,
  protocolsBitmask: 0b100,
};
const EPI_ACL = {
  integrationProgram: EXT_EPI,
  protocolsBitmask: 0b01,
};

function makeClient(
  activeReservePubkeys: PublicKey[],
  integrationAcls = [KAMINO_LENDING_ACL],
) {
  const fetchAndParseReserves = jest.fn(async (pubkeys: PublicKey[]) =>
    pubkeys.map((pubkey) => reserve(pubkey)),
  );
  const refreshReservesBatchIx = jest.fn(
    (reserves: ReturnType<typeof reserve>[]) =>
      new TransactionInstruction({
        programId: KAMINO_LENDING_PROGRAM,
        keys: reserves.map((reserve) => ({
          pubkey: reserve.getAddress(),
          isSigner: false,
          isWritable: true,
        })),
        data: Buffer.from([reserves.length]),
      }),
  );

  const client = new PriceClient(
    {
      vaultPda: VAULT,
      statePda: STATE,
      protocolProgram: { programId: PublicKey.unique() },
      extKaminoProgram: { programId: EXT_KAMINO },
      extBridgeProgram: { programId: EXT_BRIDGE },
      extEpiProgram: { programId: EXT_EPI },
      fetchStateModel: jest.fn(async () => ({
        accountType: StateAccountType.VAULT,
        baseAssetMint: PublicKey.default,
        baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
        externalPositions: [OBLIGATION],
        integrationAcls,
      })),
      fetchAssetMetas: jest.fn(async () => new PkMap()),
      getSolOracle: jest.fn(async () => PublicKey.default),
      mintProgram: {
        methods: {
          priceVaultTokens: jest.fn(() => methodBuilder(ix(1))),
          priceKaminoObligations: jest.fn(() => methodBuilder(ix(2))),
        },
      },
    } as any,
    {
      fetchAndParseReserves,
      findAndParseObligations: jest.fn(async () => [
        {
          activeDeposits: activeReservePubkeys.slice(0, 1).map((pubkey) => ({
            depositReserve: pubkey,
          })),
          activeBorrows: activeReservePubkeys.slice(1).map((pubkey) => ({
            borrowReserve: pubkey,
          })),
          getAddress: () => OBLIGATION,
          lendingMarket: MARKET,
        },
      ]),
      txBuilder: {
        refreshReservesBatchIx,
        refreshObligationIx: jest.fn(
          ({ obligation }: { obligation: PublicKey }) =>
            new TransactionInstruction({
              programId: KAMINO_LENDING_PROGRAM,
              keys: [{ pubkey: obligation, isSigner: false, isWritable: true }],
              data: Buffer.from([3]),
            }),
        ),
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );

  jest
    .spyOn(client, "remainingAccountsForPricingVaultAssets")
    .mockResolvedValue([[], [RESERVE_A, RESERVE_B]]);
  jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(PublicKey.default);

  return {
    client,
    fetchAndParseReserves,
    refreshReservesBatchIx,
  };
}

describe("PriceClient Kamino reserve refresh planning", () => {
  it("includes Kamino reserve-backed SOL and base asset oracles in vault token refreshes", async () => {
    const assetMetas = new PkMap([
      [
        PRIME,
        {
          asset: PRIME,
          decimals: 6,
          oracle: RESERVE_B,
          programId: TOKEN_PROGRAM_ID,
          oracleSource: "KaminoReserve",
        },
      ],
    ]);
    const baseAssetMeta = {
      asset: PublicKey.default,
      decimals: 6,
      oracle: RESERVE_A,
      programId: TOKEN_PROGRAM_ID,
      oracleSource: "KaminoReserve",
    };
    const solAssetMeta = {
      asset: WSOL,
      decimals: 9,
      oracle: RESERVE_C,
      programId: TOKEN_PROGRAM_ID,
      oracleSource: "KaminoReserve",
    };
    const client = new PriceClient(
      {
        fetchStateModel: jest.fn(async () => ({
          assetsForPricing: [PRIME],
          baseAssetMint: PublicKey.default,
        })),
        fetchAssetMetas: jest.fn(async () => assetMetas),
        getAssetMeta: jest.fn(async (mint: PublicKey) =>
          mint.equals(WSOL) ? solAssetMeta : baseAssetMeta,
        ),
        getVaultAta: jest.fn(() => PublicKey.unique()),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      (() => undefined) as any,
    );

    const [, kaminoReserves] =
      await client.remainingAccountsForPricingVaultAssets();

    expectPubkeys(kaminoReserves, [RESERVE_B, RESERVE_C, RESERVE_A]);
  });

  it("does not refresh obligation reserves already refreshed by vault token pricing", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient([RESERVE_A, RESERVE_B]);
    const refreshedKaminoReserves = new PkSet();

    const vaultIxs = await client.priceVaultTokensIx(refreshedKaminoReserves);
    const obligationIxs = await client.priceKaminoObligationsIxs(
      refreshedKaminoReserves,
    );

    expect(vaultIxs).toHaveLength(2);
    expect(obligationIxs).toHaveLength(2);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
    expectPubkeys(fetchAndParseReserves.mock.calls[0][0], [
      RESERVE_A,
      RESERVE_B,
    ]);
  });

  it("refreshes only obligation reserves missing from the shared pricing context", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient([RESERVE_A, RESERVE_C]);
    const refreshedKaminoReserves = new PkSet();

    await client.priceVaultTokensIx(refreshedKaminoReserves);
    const obligationIxs = await client.priceKaminoObligationsIxs(
      refreshedKaminoReserves,
    );

    expect(obligationIxs).toHaveLength(3);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(2);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(2);
    expectPubkeys(fetchAndParseReserves.mock.calls[1][0], [RESERVE_C]);
  });

  it("preloads obligation-only reserves into the first aggregate refresh", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient([RESERVE_A, RESERVE_C]);

    const ixs = await client.priceVaultIxs();

    expect(ixs).toHaveLength(4);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
    expectPubkeys(fetchAndParseReserves.mock.calls[0][0], [
      RESERVE_A,
      RESERVE_B,
      RESERVE_C,
    ]);
  });

  it("skips EPI validated position pricing when ext_epi is not enabled", async () => {
    const epiIx = ix(4);
    const { client } = makeClient([RESERVE_A, RESERVE_C]);
    const priceEpiSpy = jest
      .spyOn(client as any, "priceEpiValidatedPositionsIx")
      .mockResolvedValue(epiIx);

    const ixs = await client.priceVaultIxs();

    expect(priceEpiSpy).not.toHaveBeenCalled();
    expect(ixs).not.toContain(epiIx);
  });

  it("prices EPI validated positions when ext_epi is enabled", async () => {
    const epiIx = ix(4);
    const { client } = makeClient(
      [RESERVE_A, RESERVE_C],
      [KAMINO_LENDING_ACL, EPI_ACL],
    );
    const priceEpiSpy = jest
      .spyOn(client as any, "priceEpiValidatedPositionsIx")
      .mockResolvedValue(epiIx);

    const ixs = await client.priceVaultIxs();

    expect(priceEpiSpy).toHaveBeenCalledTimes(1);
    expect(ixs).toContain(epiIx);
  });

  it("skips bridge managed transfer pricing when ext_bridge is not enabled", async () => {
    const bridgeIx = ix(4);
    const { client } = makeClient([RESERVE_A, RESERVE_C]);
    const priceBridgeSpy = jest
      .spyOn(client as any, "priceManagedTransfersIxs")
      .mockResolvedValue([bridgeIx]);

    const ixs = await client.priceVaultIxs();

    expect(priceBridgeSpy).not.toHaveBeenCalled();
    expect(ixs).not.toContain(bridgeIx);
  });

  it("prices bridge managed transfers when ext_bridge is enabled", async () => {
    const bridgeIx = ix(4);
    const { client } = makeClient(
      [RESERVE_A, RESERVE_C],
      [KAMINO_LENDING_ACL, BRIDGE_ACL],
    );
    const priceBridgeSpy = jest
      .spyOn(client as any, "priceManagedTransfersIxs")
      .mockResolvedValue([bridgeIx]);

    const ixs = await client.priceVaultIxs();

    expect(priceBridgeSpy).toHaveBeenCalledTimes(1);
    expect(ixs).toContain(bridgeIx);
  });
});
