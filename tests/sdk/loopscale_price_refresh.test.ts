import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { PriceClient } from "../../src/client/price";
import { KAMINO_LENDING_PROGRAM, WSOL } from "../../src/constants";
import { LOOPSCALE_BORROW_PROTOCOL } from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap } from "../../src/utils";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const EXT_LOOPSCALE = PublicKey.unique();
const EXT_KAMINO = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const COLLATERAL_MINT = PublicKey.unique();
const PRINCIPAL_MINT = PublicKey.unique();
const COLLATERAL_RESERVE = PublicKey.unique();
const PRINCIPAL_RESERVE = PublicKey.unique();
const SOL_RESERVE = PublicKey.unique();
const BASE_RESERVE = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const MARKET = PublicKey.unique();
const LOAN = PublicKey.unique();
const STRATEGY = PublicKey.unique();
const LOOPSCALE_VAULT = PublicKey.unique();

type OracleSpec = { oracle: PublicKey; oracleSource: string };

function assetMeta(mint: PublicKey, spec: OracleSpec) {
  return {
    asset: mint,
    decimals: 6,
    oracle: spec.oracle,
    oracleSource: spec.oracleSource,
    programId: TOKEN_PROGRAM_ID,
  };
}

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
    accounts: jest.Mock;
    remainingAccounts: jest.Mock;
    instruction: jest.Mock;
  } = {
    accounts: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(async () => instruction),
  };
  return builder;
}

/**
 * The Loopscale pricing instructions read one oracle per priced asset plus the
 * SOL/USD and base asset oracles. Any of those can be a Kamino reserve, and
 * the chunk has to hand them to priceVaultIxs so the one batch refresh in
 * front of the transaction covers them.
 */
function makeClient(
  oracles: Map<string, OracleSpec>,
  accounts: {
    loans?: any;
    strategies?: any;
    vaults?: any;
  } = {},
) {
  const loansIx = new TransactionInstruction({
    programId: PublicKey.unique(),
    keys: [],
    data: Buffer.from([1]),
  });
  const strategiesIx = new TransactionInstruction({
    programId: PublicKey.unique(),
    keys: [],
    data: Buffer.from([2]),
  });
  const vaultsIx = new TransactionInstruction({
    programId: PublicKey.unique(),
    keys: [],
    data: Buffer.from([3]),
  });

  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const spec = oracles.get(mint.toBase58());
    if (!spec) {
      throw new Error(`Asset not supported: ${mint.toBase58()}`);
    }
    return assetMeta(mint, spec);
  });
  const assetMetas = new PkMap<any>();
  oracles.forEach((spec, mint) => {
    const pubkey = new PublicKey(mint);
    assetMetas.set(pubkey, assetMeta(pubkey, spec));
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

  const base = {
    statePda: STATE,
    vaultPda: VAULT,
    protocolProgram: { programId: PublicKey.unique() },
    extKaminoProgram: { programId: EXT_KAMINO },
    extLoopscaleProgram: { programId: EXT_LOOPSCALE },
    extBridgeProgram: { programId: PublicKey.unique() },
    extRpiProgram: { programId: PublicKey.unique() },
    extPhoenixProgram: { programId: PublicKey.unique() },
    extOrcaProgram: { programId: PublicKey.unique() },
    extNeutralProgram: { programId: PublicKey.unique() },
    extMarginfiProgram: { programId: PublicKey.unique() },
    fetchStateModel: jest.fn(async () => ({
      accountType: StateAccountType.VAULT,
      baseAssetMint: BASE_MINT,
      baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
      externalPositions: [LOAN],
      integrationAcls: [
        {
          integrationProgram: EXT_LOOPSCALE,
          protocolsBitmask: LOOPSCALE_BORROW_PROTOCOL,
        },
      ],
    })),
    fetchAssetMetas: jest.fn(async () => assetMetas),
    getAssetMeta,
    mintProgram: {
      methods: {
        priceLoopscaleLoans: jest.fn(() => methodBuilder(loansIx)),
        priceLoopscaleStrategies: jest.fn(() => methodBuilder(strategiesIx)),
        priceLoopscaleVaultPositions: jest.fn(() => methodBuilder(vaultsIx)),
      },
    },
  };

  const klend = {
    fetchAndParseReserves,
    txBuilder: { refreshReservesBatchIx },
  };
  const loopscaleBorrow = {
    getPriceLoansAccounts: jest.fn(async () => accounts.loans ?? null),
  };
  const loopscaleLend = {
    getPriceStrategiesAccounts: jest.fn(
      async () => accounts.strategies ?? null,
    ),
  };
  const loopscaleVault = {
    getPriceVaultsAccounts: jest.fn(async () => accounts.vaults ?? null),
  };

  const client = new PriceClient(
    base as any,
    klend as any,
    {} as any,
    {} as any,
    {} as any,
    loopscaleBorrow as any,
    loopscaleLend as any,
    loopscaleVault as any,
    {} as any,
    (() => undefined) as any,
  );

  return {
    client,
    loansIx,
    strategiesIx,
    vaultsIx,
    fetchAndParseReserves,
    refreshReservesBatchIx,
  };
}

const KAMINO = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});
const PYTH: OracleSpec = { oracle: PYTH_ORACLE, oracleSource: "Pyth" };

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

describe("Loopscale pricing Kamino reserve reporting", () => {
  it("reports the loan oracles' reserves and the SOL and base asset reserves", async () => {
    const { client } = makeClient(
      oracleMap([
        [COLLATERAL_MINT, KAMINO(COLLATERAL_RESERVE)],
        [PRINCIPAL_MINT, KAMINO(PRINCIPAL_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PRINCIPAL_RESERVE, COLLATERAL_RESERVE],
          kaminoReserves: [PRINCIPAL_RESERVE, COLLATERAL_RESERVE],
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expect(chunk?.ixs).toHaveLength(1);
    expectSameReserves(chunk!.kaminoReserves, [
      PRINCIPAL_RESERVE,
      COLLATERAL_RESERVE,
      SOL_RESERVE,
      BASE_RESERVE,
    ]);
  });

  it("reports the strategy oracles' reserves once when they repeat", async () => {
    const { client } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, KAMINO(PRINCIPAL_RESERVE)],
        [WSOL, KAMINO(PRINCIPAL_RESERVE)],
        [BASE_MINT, PYTH],
      ]),
      {
        strategies: {
          strategyAccounts: [STRATEGY],
          oracleAccounts: [PRINCIPAL_RESERVE],
          kaminoReserves: [PRINCIPAL_RESERVE],
        },
      },
    );

    const chunk = await client.priceLoopscaleStrategiesIxs();

    expectSameReserves(chunk!.kaminoReserves, [PRINCIPAL_RESERVE]);
  });

  it("reports the vault position oracles' reserves", async () => {
    const { client } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, KAMINO(PRINCIPAL_RESERVE)],
        [WSOL, PYTH],
        [BASE_MINT, PYTH],
      ]),
      {
        vaults: {
          numVaults: 1,
          vaultAccounts: [LOOPSCALE_VAULT],
          strategyAccounts: [STRATEGY],
          userLpTokenAccounts: [PublicKey.unique()],
          vaultStakeAccounts: [],
          oracleAccounts: [PRINCIPAL_RESERVE],
          kaminoReserves: [PRINCIPAL_RESERVE],
        },
      },
    );

    const chunk = await client.priceLoopscaleVaultPositionsIxs();

    expectSameReserves(chunk!.kaminoReserves, [PRINCIPAL_RESERVE]);
  });

  it("reports no reserves when no Loopscale oracle is a Kamino reserve", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, PYTH],
        [WSOL, PYTH],
        [BASE_MINT, PYTH],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PYTH_ORACLE],
          kaminoReserves: [],
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expect(chunk!.kaminoReserves).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  // A caller may pass solUsdOracle or baseAssetOracle itself, which skips the
  // asset meta the source would otherwise be read from. The address is still a
  // reserve when a fetched asset meta prices its mint through it.
  it("reports the reserve behind a caller-supplied SOL oracle override", async () => {
    const { client } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, PYTH],
        [WSOL, KAMINO(SOL_RESERVE)],
        [BASE_MINT, PYTH],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PYTH_ORACLE],
          kaminoReserves: [],
          solUsdOracle: SOL_RESERVE,
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expectSameReserves(chunk!.kaminoReserves, [SOL_RESERVE]);
  });

  it("reports the reserve behind a caller-supplied base asset oracle override", async () => {
    const { client } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, PYTH],
        [WSOL, PYTH],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PYTH_ORACLE],
          kaminoReserves: [],
          baseAssetOracle: BASE_RESERVE,
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expectSameReserves(chunk!.kaminoReserves, [BASE_RESERVE]);
  });

  it("reports nothing for an override that no asset meta prices as a reserve", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, PYTH],
        [WSOL, PYTH],
        [BASE_MINT, PYTH],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PYTH_ORACLE],
          kaminoReserves: [],
          solUsdOracle: PYTH_ORACLE,
          baseAssetOracle: PYTH_ORACLE,
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expect(chunk!.kaminoReserves).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  it("does not list an override twice when the loan oracles already carry it", async () => {
    const { client } = makeClient(
      oracleMap([
        [PRINCIPAL_MINT, KAMINO(PRINCIPAL_RESERVE)],
        [WSOL, KAMINO(PRINCIPAL_RESERVE)],
        [BASE_MINT, PYTH],
      ]),
      {
        loans: {
          loanAccounts: [LOAN],
          oracleAccounts: [PRINCIPAL_RESERVE],
          kaminoReserves: [PRINCIPAL_RESERVE],
          solUsdOracle: PRINCIPAL_RESERVE,
        },
      },
    );

    const chunk = await client.priceLoopscaleLoansIxs();

    expect(chunk!.kaminoReserves).toHaveLength(1);
    expectSameReserves(chunk!.kaminoReserves, [PRINCIPAL_RESERVE]);
  });

  it("puts one refresh ahead of the Loopscale pricing instruction in the vault transaction", async () => {
    const { client, loansIx, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient(
        oracleMap([
          [COLLATERAL_MINT, KAMINO(COLLATERAL_RESERVE)],
          [PRINCIPAL_MINT, KAMINO(PRINCIPAL_RESERVE)],
          [WSOL, KAMINO(SOL_RESERVE)],
          [BASE_MINT, KAMINO(BASE_RESERVE)],
        ]),
        {
          loans: {
            loanAccounts: [LOAN],
            oracleAccounts: [PRINCIPAL_RESERVE, COLLATERAL_RESERVE],
            kaminoReserves: [PRINCIPAL_RESERVE, COLLATERAL_RESERVE],
          },
        },
      );
    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [], kaminoReserves: [SOL_RESERVE] });

    const ixs = await client.priceVaultIxs();

    const refreshes = ixs.filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expectSameReserves(fetchAndParseReserves.mock.calls[0][0], [
      SOL_RESERVE,
      PRINCIPAL_RESERVE,
      COLLATERAL_RESERVE,
      BASE_RESERVE,
    ]);
    expect(ixs.indexOf(refreshes[0])).toBeLessThan(ixs.indexOf(loansIx));
  });
});
