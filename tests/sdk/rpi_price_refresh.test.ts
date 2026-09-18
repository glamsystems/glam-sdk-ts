import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { RpiClient } from "../../src/client/rpi";
import { KAMINO_LENDING_PROGRAM, WSOL } from "../../src/constants";
import { PkMap } from "../../src/utils";

const EXT_RPI_PROGRAM = PublicKey.unique();
const STATE = PublicKey.unique();
const SIGNER = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const OBSERVED_MINT = PublicKey.unique();
const BASE_RESERVE = PublicKey.unique();
const OBSERVED_RESERVE = PublicKey.unique();
const SOL_RESERVE = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const MARKET = PublicKey.unique();
const VALIDATE_IX = new TransactionInstruction({
  programId: EXT_RPI_PROGRAM,
  keys: [],
  data: Buffer.from([8]),
});

type OracleSpec = { oracle: PublicKey; oracleSource: string };

const KAMINO = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});
const PYTH: OracleSpec = { oracle: PYTH_ORACLE, oracleSource: "Pyth" };

function reserve(pubkey: PublicKey) {
  return {
    getAddress: () => pubkey,
    lendingMarket: MARKET,
    scopePriceFeed: PublicKey.default,
  };
}

/** The refresh covers a set of reserves; their order in it carries no meaning. */
function expectSameReserves(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58()).sort()).toEqual(
    expected.map((pubkey) => pubkey.toBase58()).sort(),
  );
}

function methodBuilder(instruction: TransactionInstruction) {
  const builder: {
    accountsPartial: jest.Mock;
    remainingAccounts: jest.Mock;
    instruction: jest.Mock;
  } = {
    accountsPartial: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(async () => instruction),
  };
  return builder;
}

/**
 * validate_observation reads the SOL/USD oracle, the base asset oracle and,
 * for a mint-denominated observation, the observed mint's oracle. Any of them
 * can be a Kamino reserve that klend has marked stale.
 */
function makeClient(
  oracles: Map<string, OracleSpec>,
  positionId: Buffer,
  denomination: any,
) {
  const validateBuilder = methodBuilder(VALIDATE_IX);
  const assetMetaOf = (mint: PublicKey, spec: OracleSpec) => ({
    asset: mint,
    decimals: 6,
    oracle: spec.oracle,
    oracleSource: spec.oracleSource,
    programId: TOKEN_PROGRAM_ID,
  });
  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const spec = oracles.get(mint.toBase58());
    if (!spec) {
      throw new Error(`Asset not supported: ${mint.toBase58()}`);
    }
    return assetMetaOf(mint, spec);
  });
  const assetMetas = new PkMap<any>();
  oracles.forEach((spec, mint) => {
    const pubkey = new PublicKey(mint);
    assetMetas.set(pubkey, assetMetaOf(pubkey, spec));
  });

  const fetchAndParseReserves = jest.fn(async (pubkeys: PublicKey[]) =>
    pubkeys.map((pubkey) => reserve(pubkey)),
  );
  const refreshReservesBatchIx = jest.fn(
    (reserves: ReturnType<typeof reserve>[]) =>
      new TransactionInstruction({
        programId: KAMINO_LENDING_PROGRAM,
        keys: reserves.map((parsed) => ({
          pubkey: parsed.getAddress(),
          isSigner: false,
          isWritable: true,
        })),
        data: Buffer.from([reserves.length]),
      }),
  );

  const client = new RpiClient({
    statePda: STATE,
    signer: SIGNER,
    extRpiProgram: {
      programId: EXT_RPI_PROGRAM,
      methods: { validateObservation: jest.fn(() => validateBuilder) },
      account: {
        observationState: {
          fetchNullable: jest.fn(async () => ({
            positionsLen: 1,
            positions: [
              {
                positionId: Array.from(positionId),
                hasPending: true,
                pendingObservation: { denomination },
              },
            ],
          })),
        },
      },
    },
    fetchStateAccount: jest.fn(async () => ({
      baseAssetMint: BASE_MINT,
      baseAssetDecimals: 6,
    })),
    getSolOracle: jest.fn(async () => {
      const spec = oracles.get(WSOL.toBase58());
      if (!spec) {
        throw new Error("Asset not supported: WSOL");
      }
      return spec.oracle;
    }),
    getAssetMeta,
    fetchAssetMetas: jest.fn(async () => assetMetas),
    kaminoLending: {
      fetchAndParseReserves,
      txBuilder: { refreshReservesBatchIx },
    },
  } as any);

  return { client, fetchAndParseReserves, refreshReservesBatchIx };
}

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

const MINT_DENOMINATION = {
  denom: { mint: {} },
  mint: OBSERVED_MINT,
};

describe("RPI observation validation Kamino reserve refresh", () => {
  const positionId = Buffer.alloc(32, 5);

  it("collects the SOL oracle's reserve alongside the base and observed mint reserves", async () => {
    const { client } = makeClient(
      oracleMap([
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [OBSERVED_MINT, KAMINO(OBSERVED_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
    });

    expect(accounts.solUsdOracle?.toBase58()).toBe(SOL_RESERVE.toBase58());
    expectSameReserves(accounts.kaminoReservesToRefresh, [
      BASE_RESERVE,
      OBSERVED_RESERVE,
      SOL_RESERVE,
    ]);
  });

  it("collects the SOL oracle's reserve when it is the only Kamino reserve", async () => {
    const { client } = makeClient(
      oracleMap([
        [BASE_MINT, PYTH],
        [OBSERVED_MINT, PYTH],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
    });

    expectSameReserves(accounts.kaminoReservesToRefresh, [SOL_RESERVE]);
  });

  it("lists a reserve once when the base and observed oracles share it", async () => {
    const { client } = makeClient(
      oracleMap([
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [OBSERVED_MINT, KAMINO(BASE_RESERVE)],
        [WSOL, PYTH],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
    });

    expectSameReserves(accounts.kaminoReservesToRefresh, [BASE_RESERVE]);
  });

  // A caller may pass an oracle itself, which skips the asset meta the source
  // would otherwise be read from. The address is still a reserve when a
  // fetched asset meta prices its mint through it.
  it("collects the reserve behind a caller-supplied oracle override", async () => {
    const { client } = makeClient(
      oracleMap([
        [BASE_MINT, PYTH],
        [OBSERVED_MINT, PYTH],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
      solUsdOracle: SOL_RESERVE,
    } as any);

    expect(accounts.solUsdOracle?.toBase58()).toBe(SOL_RESERVE.toBase58());
    expectSameReserves(accounts.kaminoReservesToRefresh, [SOL_RESERVE]);
  });

  it("collects nothing for an override that no asset meta prices as a reserve", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [BASE_MINT, PYTH],
        [OBSERVED_MINT, PYTH],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
      solUsdOracle: PYTH_ORACLE,
    } as any);

    expect(accounts.kaminoReservesToRefresh).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  it("does not list an override twice when another oracle already carries it", async () => {
    const { client } = makeClient(
      oracleMap([
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [OBSERVED_MINT, PYTH],
        [WSOL, KAMINO(BASE_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
      solUsdOracle: BASE_RESERVE,
    } as any);

    expect(accounts.kaminoReservesToRefresh).toHaveLength(1);
    expectSameReserves(accounts.kaminoReservesToRefresh, [BASE_RESERVE]);
  });

  it("builds one refresh, before the validate instruction, and reports the reserves", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient(
        oracleMap([
          [BASE_MINT, KAMINO(BASE_RESERVE)],
          [OBSERVED_MINT, KAMINO(OBSERVED_RESERVE)],
          [WSOL, KAMINO(SOL_RESERVE)],
        ]),
        positionId,
        MINT_DENOMINATION,
      );

    const { ixs, kaminoReserves } =
      await client.txBuilder.validateObservationIxs({ positionId });

    const refreshes = ixs.filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expect(ixs[ixs.length - 1]).toBe(VALIDATE_IX);
    expect(ixs.indexOf(refreshes[0])).toBeLessThan(ixs.indexOf(VALIDATE_IX));
    expectSameReserves(kaminoReserves, [
      BASE_RESERVE,
      OBSERVED_RESERVE,
      SOL_RESERVE,
    ]);
    expectSameReserves(
      refreshes[0].keys.map(({ pubkey }) => pubkey),
      [BASE_RESERVE, OBSERVED_RESERVE, SOL_RESERVE],
    );
  });

  // What the doc comment on the deprecated validateObservationIx claims the
  // caller loses, over one input: the refresh in front and the reserve report.
  it("gives the deprecated builder no refresh and no reserve report, unlike validateObservationIxs", async () => {
    const { client, refreshReservesBatchIx } = makeClient(
      oracleMap([
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [OBSERVED_MINT, KAMINO(OBSERVED_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const bare = await client.txBuilder.validateObservationIx({ positionId });

    expect(bare).toBe(VALIDATE_IX);
    expect(refreshReservesBatchIx).not.toHaveBeenCalled();

    const { ixs, kaminoReserves } =
      await client.txBuilder.validateObservationIxs({ positionId });

    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId.equals(KAMINO_LENDING_PROGRAM)).toBe(true);
    expect(ixs[1]).toBe(VALIDATE_IX);
    expectSameReserves(kaminoReserves, [
      BASE_RESERVE,
      OBSERVED_RESERVE,
      SOL_RESERVE,
    ]);
  });

  it("builds no refresh when no observation oracle is a Kamino reserve", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [BASE_MINT, PYTH],
        [OBSERVED_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      positionId,
      MINT_DENOMINATION,
    );

    const { ixs, kaminoReserves } =
      await client.txBuilder.validateObservationIxs({ positionId });

    expect(ixs).toEqual([VALIDATE_IX]);
    expect(kaminoReserves).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  it("puts exactly one refresh in the validate transaction", async () => {
    const { client, refreshReservesBatchIx } = makeClient(
      oracleMap([
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [OBSERVED_MINT, KAMINO(OBSERVED_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      positionId,
      MINT_DENOMINATION,
    );
    const buildVersionedTx = jest
      .spyOn(client.txBuilder as any, "buildVersionedTx")
      .mockResolvedValue({} as any);

    await client.txBuilder.validateObservationTx({ positionId });

    const [ixs, txOptions] = buildVersionedTx.mock.calls[0] as [
      TransactionInstruction[],
      { preInstructions?: TransactionInstruction[] },
    ];
    const allIxs = [...(txOptions.preInstructions ?? []), ...ixs];
    expect(
      allIxs.filter((ix) => ix.programId.equals(KAMINO_LENDING_PROGRAM)),
    ).toHaveLength(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
  });
});
