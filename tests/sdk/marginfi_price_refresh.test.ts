import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { PriceClient } from "../../src/client/price";
import {
  KAMINO_LENDING_PROGRAM,
  MARGINFI_PROGRAM_ID,
  WSOL,
} from "../../src/constants";
import { MARGINFI_PROTOCOL } from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap } from "../../src/utils";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const EXT_MARGINFI = PublicKey.unique();
const EXT_KAMINO = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const MARGINFI_ACCOUNT = PublicKey.unique();
const SOL_RESERVE = PublicKey.unique();
const BASE_RESERVE = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const MARKET = PublicKey.unique();

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
 * price_marginfi_accounts passes the SOL/USD and base asset oracles as named
 * accounts; both can be Kamino reserves. The chunk is covered today only
 * because its one caller also prices vault tokens, which reports them.
 */
function makeClient(oracles: Map<string, OracleSpec>) {
  const marginfiIx = new TransactionInstruction({
    programId: PublicKey.unique(),
    keys: [],
    data: Buffer.from([9]),
  });
  const pulseIx = new TransactionInstruction({
    programId: MARGINFI_PROGRAM_ID,
    keys: [],
    data: Buffer.from([10]),
  });

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

  const stateModel = {
    accountType: StateAccountType.VAULT,
    baseAssetMint: BASE_MINT,
    baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
    externalPositions: [MARGINFI_ACCOUNT],
    integrationAcls: [
      {
        integrationProgram: EXT_MARGINFI,
        protocolsBitmask: MARGINFI_PROTOCOL,
      },
    ],
  };

  const base = {
    statePda: STATE,
    vaultPda: VAULT,
    protocolProgram: { programId: PublicKey.unique() },
    extKaminoProgram: { programId: EXT_KAMINO },
    extMarginfiProgram: { programId: EXT_MARGINFI },
    extBridgeProgram: { programId: PublicKey.unique() },
    extRpiProgram: { programId: PublicKey.unique() },
    extPhoenixProgram: { programId: PublicKey.unique() },
    extOrcaProgram: { programId: PublicKey.unique() },
    extLoopscaleProgram: { programId: PublicKey.unique() },
    extNeutralProgram: { programId: PublicKey.unique() },
    fetchStateModel: jest.fn(async () => stateModel),
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
      getMultipleAccountsInfo: jest.fn(async (keys: PublicKey[]) =>
        keys.map(() => ({
          data: Buffer.alloc(0),
          executable: false,
          lamports: 0,
          owner: MARGINFI_PROGRAM_ID,
          rentEpoch: 0,
        })),
      ),
    },
    mintProgram: {
      methods: {
        priceMarginfiAccounts: jest.fn(() => methodBuilder(marginfiIx)),
      },
    },
  };

  const klend = {
    fetchAndParseReserves,
    txBuilder: { refreshReservesBatchIx },
  };
  const marginfi = { pulseHealthIx: jest.fn(async () => ({ ixs: [pulseIx] })) };

  const client = new PriceClient(
    base as any,
    klend as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    marginfi as any,
    (() => undefined) as any,
  );

  return { client, stateModel, marginfiIx, fetchAndParseReserves };
}

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

describe("Marginfi account pricing Kamino reserve reporting", () => {
  it("reports the SOL and base asset reserves it reads", async () => {
    const { client, stateModel } = makeClient(
      oracleMap([
        [WSOL, KAMINO(SOL_RESERVE)],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
      ]),
    );

    const chunk = await (client as any).priceMarginfiAccountsIx(stateModel);

    expectSameReserves(chunk.kaminoReserves, [SOL_RESERVE, BASE_RESERVE]);
  });

  it("reports a reserve once when SOL and the base asset share it", async () => {
    const { client, stateModel } = makeClient(
      oracleMap([
        [WSOL, KAMINO(SOL_RESERVE)],
        [BASE_MINT, KAMINO(SOL_RESERVE)],
      ]),
    );

    const chunk = await (client as any).priceMarginfiAccountsIx(stateModel);

    expectSameReserves(chunk.kaminoReserves, [SOL_RESERVE]);
  });

  it("reports no reserves when neither oracle is a Kamino reserve", async () => {
    const { client, stateModel, fetchAndParseReserves } = makeClient(
      oracleMap([
        [WSOL, PYTH],
        [BASE_MINT, PYTH],
      ]),
    );

    const chunk = await (client as any).priceMarginfiAccountsIx(stateModel);

    expect(chunk.kaminoReserves).toEqual([]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
  });

  it("puts one refresh ahead of the marginfi pricing instruction in the vault transaction", async () => {
    const { client, marginfiIx, fetchAndParseReserves } = makeClient(
      oracleMap([
        [WSOL, KAMINO(SOL_RESERVE)],
        [BASE_MINT, KAMINO(BASE_RESERVE)],
      ]),
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
    ]);
    expect(ixs.indexOf(refreshes[0])).toBeLessThan(ixs.indexOf(marginfiIx));
  });
});
