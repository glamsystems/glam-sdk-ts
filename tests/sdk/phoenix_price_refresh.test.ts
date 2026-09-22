import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { PriceClient } from "../../src/client/price";
import {
  KAMINO_LENDING_PROGRAM,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  USDC,
  WSOL,
} from "../../src/constants";
import { PHOENIX_PROTOCOL } from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap } from "../../src/utils";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const EXT_PHOENIX = PublicKey.unique();
const EXT_KAMINO = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const USDC_RESERVE = PublicKey.unique();
const SOL_RESERVE = PublicKey.unique();
const BASE_RESERVE = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const MARKET = PublicKey.unique();
const PHOENIX_TRADER = PublicKey.unique();
const PHOENIX_PERP_ASSET_MAP = PublicKey.unique();

type OracleSpec = { oracle: PublicKey; oracleSource: string };

const KAMINO = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});
const PYTH: OracleSpec = { oracle: PYTH_ORACLE, oracleSource: "Pyth" };

function accountInfo(owner: PublicKey, data: Buffer = Buffer.alloc(0)) {
  return { data, executable: false, lamports: 0, owner, rentEpoch: 0 };
}

function phoenixTraderAccountInfo() {
  return accountInfo(
    PHOENIX_PROGRAM_ID,
    Buffer.from([41, 97, 73, 105, 110, 214, 112, 9]),
  );
}

function phoenixGlobalConfigAccountInfo() {
  const data = Buffer.alloc(392);
  PHOENIX_PERP_ASSET_MAP.toBuffer().copy(data, 360);
  return accountInfo(PHOENIX_PROGRAM_ID, data);
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

/**
 * pricePhoenixTraders reads the SOL/USD oracle, the base asset oracle and,
 * when the base asset is not USDC, the USDC oracle that denominates the
 * Phoenix quote. Any of the three can be a Kamino reserve.
 */
function makeClient(
  oracles: Map<string, OracleSpec>,
  baseAssetMint: PublicKey,
) {
  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const spec = oracles.get(mint.toBase58());
    if (!spec) {
      throw new Error(`Asset not supported: ${mint.toBase58()}`);
    }
    return {
      asset: mint,
      decimals: 6,
      oracle: spec.oracle,
      oracleSource: spec.oracleSource,
      programId: TOKEN_PROGRAM_ID,
    };
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
    extPhoenixProgram: { programId: EXT_PHOENIX },
    extBridgeProgram: { programId: PublicKey.unique() },
    extRpiProgram: { programId: PublicKey.unique() },
    extOrcaProgram: { programId: PublicKey.unique() },
    extLoopscaleProgram: { programId: PublicKey.unique() },
    extNeutralProgram: { programId: PublicKey.unique() },
    extMarginfiProgram: { programId: PublicKey.unique() },
    fetchStateModel: jest.fn(async () => ({
      accountType: StateAccountType.VAULT,
      baseAssetMint,
      baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
      externalPositions: [PHOENIX_TRADER],
      integrationAcls: [
        {
          integrationProgram: EXT_PHOENIX,
          protocolsBitmask: PHOENIX_PROTOCOL,
        },
      ],
    })),
    fetchAssetMetas: jest.fn(async () => new PkMap()),
    getAssetMeta,
    getSolOracle: jest.fn(async () => {
      const spec = oracles.get(WSOL.toBase58());
      if (!spec) {
        throw new Error("Asset not supported: WSOL");
      }
      return spec.oracle;
    }),
    connection: {
      getMultipleAccountsInfo: jest.fn(async () => [
        phoenixTraderAccountInfo(),
      ]),
      getAccountInfo: jest.fn(async (pubkey: PublicKey) =>
        pubkey.equals(PHOENIX_GLOBAL_CONFIG)
          ? phoenixGlobalConfigAccountInfo()
          : null,
      ),
    },
  };

  const klend = {
    fetchAndParseReserves,
    txBuilder: { refreshReservesBatchIx },
  };

  const client = new PriceClient(
    base as any,
    klend as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );

  return { client, fetchAndParseReserves };
}

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

describe("Phoenix trader pricing Kamino reserve reporting", () => {
  it("reports the USDC quote oracle's reserve when the base asset is not USDC", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, KAMINO(USDC_RESERVE)],
        [BASE_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      BASE_MINT,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expectSameReserves(chunk!.kaminoReserves, [USDC_RESERVE]);
    // The USDC oracle is passed as the last remaining account of the pricing
    // instruction, which follows the heap frame.
    const pricing = chunk!.ixs[1];
    expect(pricing.programId.equals(EXT_PHOENIX)).toBe(true);
    expect(pricing.keys[pricing.keys.length - 1].pubkey.toBase58()).toBe(
      USDC_RESERVE.toBase58(),
    );
  });

  it("reports the SOL and base asset reserves the instruction reads", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, PYTH],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      BASE_MINT,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expectSameReserves(chunk!.kaminoReserves, [BASE_RESERVE, SOL_RESERVE]);
  });

  it("reports each reserve once when the quote and base oracles share one", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, KAMINO(USDC_RESERVE)],
        [BASE_MINT, KAMINO(USDC_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      BASE_MINT,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expectSameReserves(chunk!.kaminoReserves, [USDC_RESERVE, SOL_RESERVE]);
  });

  it("does not read the USDC oracle when the base asset is USDC", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, KAMINO(USDC_RESERVE)],
        [WSOL, PYTH],
      ]),
      USDC,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expectSameReserves(chunk!.kaminoReserves, [USDC_RESERVE]);
  });

  it("reports no reserves when no Phoenix pricing oracle is a Kamino reserve", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [USDC, PYTH],
        [BASE_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      BASE_MINT,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expect(chunk!.kaminoReserves).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  it("puts one refresh ahead of the Phoenix pricing instruction in the vault transaction", async () => {
    const { client, fetchAndParseReserves } = makeClient(
      oracleMap([
        [USDC, KAMINO(USDC_RESERVE)],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
        [WSOL, KAMINO(SOL_RESERVE)],
      ]),
      BASE_MINT,
    );
    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [], kaminoReserves: [SOL_RESERVE] });

    const ixs = await client.priceVaultIxs();

    const refreshes = ixs.filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expectSameReserves(fetchAndParseReserves.mock.calls[0][0], [
      SOL_RESERVE,
      BASE_RESERVE,
      USDC_RESERVE,
    ]);
    const phoenixIx = ixs.find((ix) => ix.programId.equals(EXT_PHOENIX))!;
    expect(ixs.indexOf(refreshes[0])).toBeLessThan(ixs.indexOf(phoenixIx));
  });
});
