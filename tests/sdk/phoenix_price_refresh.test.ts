import {
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { buildUpdateTraderStateIx } from "@ellipsis-labs/rise";

import { PriceClient } from "../../src/client/price";
import {
  KAMINO_LENDING_PROGRAM,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_LOG_AUTHORITY,
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
const PHOENIX_GLOBAL_TRADER_INDEX = PublicKey.unique();
const PHOENIX_ACTIVE_TRADER_BUFFER = PublicKey.unique();
const SECOND_PHOENIX_TRADER = PublicKey.unique();
// Arena 1 of each group: the Phoenix PDA of the group's seed and the index
// as one byte (Rise's getArenaAddresses).
const [SECOND_GLOBAL_TRADER_INDEX_ARENA] = PublicKey.findProgramAddressSync(
  [Buffer.from("global_trader_index"), Buffer.from([1])],
  PHOENIX_PROGRAM_ID,
);
const [SECOND_ACTIVE_TRADER_BUFFER_ARENA] = PublicKey.findProgramAddressSync(
  [Buffer.from("active_trader_buffer"), Buffer.from([1])],
  PHOENIX_PROGRAM_ID,
);
const GLOBAL_TRADER_INDEX_HEADER_DISCRIMINATOR = [
  145, 92, 169, 6, 5, 144, 1, 205,
];
const ACTIVE_TRADER_BUFFER_HEADER_DISCRIMINATOR = [
  192, 255, 205, 165, 80, 154, 131, 5,
];

/** Each arena group's accounts, its header first; the recorded exchange has one per group. */
function arenaGroups(arenas: 1 | 2) {
  return {
    globalTraderIndex: [
      PHOENIX_GLOBAL_TRADER_INDEX,
      SECOND_GLOBAL_TRADER_INDEX_ARENA,
    ].slice(0, arenas),
    activeTraderBuffer: [
      PHOENIX_ACTIVE_TRADER_BUFFER,
      SECOND_ACTIVE_TRADER_BUFFER_ARENA,
    ].slice(0, arenas),
  };
}

/** An arena header stating `arenas` arenas and as many active, u16s at bytes 52 and 54. */
function arenaHeaderAccountInfo(discriminator: number[], arenas: number) {
  const data = Buffer.alloc(56);
  Buffer.from(discriminator).copy(data, 0);
  data.writeUInt16LE(arenas, 52);
  data.writeUInt16LE(arenas, 54);
  return accountInfo(PHOENIX_PROGRAM_ID, data);
}

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

// The headers at 392 and 424 are each group's first account.
function phoenixGlobalConfigAccountInfo() {
  const data = Buffer.alloc(456);
  PHOENIX_PERP_ASSET_MAP.toBuffer().copy(data, 360);
  PHOENIX_GLOBAL_TRADER_INDEX.toBuffer().copy(data, 392);
  PHOENIX_ACTIVE_TRADER_BUFFER.toBuffer().copy(data, 424);
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
  traders: PublicKey[] = [PHOENIX_TRADER],
  arenas: number = 1,
  headers: Map<string, ReturnType<typeof accountInfo>> = new Map([
    [
      PHOENIX_GLOBAL_TRADER_INDEX.toBase58(),
      arenaHeaderAccountInfo(GLOBAL_TRADER_INDEX_HEADER_DISCRIMINATOR, arenas),
    ],
    [
      PHOENIX_ACTIVE_TRADER_BUFFER.toBase58(),
      arenaHeaderAccountInfo(ACTIVE_TRADER_BUFFER_HEADER_DISCRIMINATOR, arenas),
    ],
  ]),
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
      externalPositions: traders,
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
      getMultipleAccountsInfo: jest.fn(async (keys: PublicKey[]) =>
        keys.map((key) =>
          headers.has(key.toBase58())
            ? headers.get(key.toBase58())!
            : traders.some((trader) => trader.equals(key))
              ? phoenixTraderAccountInfo()
              : null,
        ),
      ),
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
    // instruction, which is the chunk's last instruction.
    const pricing = chunk!.ixs[chunk!.ixs.length - 1];
    expect(pricing.programId.equals(EXT_PHOENIX)).toBe(true);
    expect(pricing.keys[pricing.keys.length - 1].pubkey.toBase58()).toBe(
      USDC_RESERVE.toBase58(),
    );
  });

  it("syncs each priced trader directly before the price instruction, the instructions sysvar at remaining index 2", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, PYTH],
        [BASE_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      BASE_MINT,
      [PHOENIX_TRADER, SECOND_PHOENIX_TRADER],
    );

    const { ixs } = (await client.pricePhoenixTradersIxs())!;

    expect(ixs).toHaveLength(4);
    expect(ixs[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true);
    const pricing = ixs[3];
    expect(pricing.programId.equals(EXT_PHOENIX)).toBe(true);
    [PHOENIX_TRADER, SECOND_PHOENIX_TRADER].forEach((trader, i) => {
      const sync = ixs[1 + i];
      expect(sync.programId.equals(PHOENIX_PROGRAM_ID)).toBe(true);
      expect([...sync.data]).toEqual([249, 139, 82, 44, 126, 66, 133, 220]);
      expect(
        sync.keys.map(({ pubkey, isSigner, isWritable }) => [
          pubkey.toBase58(),
          isSigner,
          isWritable,
        ]),
      ).toEqual([
        [PHOENIX_PROGRAM_ID.toBase58(), false, false],
        [PHOENIX_LOG_AUTHORITY.toBase58(), false, false],
        [PHOENIX_GLOBAL_CONFIG.toBase58(), false, false],
        [trader.toBase58(), false, true],
        [PHOENIX_PERP_ASSET_MAP.toBase58(), false, false],
        [PHOENIX_GLOBAL_TRADER_INDEX.toBase58(), false, true],
        [PHOENIX_ACTIVE_TRADER_BUFFER.toBase58(), false, true],
      ]);
    });
    // The remaining accounts begin at the Phoenix global config.
    const keys = pricing.keys.map(({ pubkey }) => pubkey.toBase58());
    const remaining = keys.slice(
      keys.indexOf(PHOENIX_GLOBAL_CONFIG.toBase58()),
    );
    expect(remaining).toEqual(
      [
        PHOENIX_GLOBAL_CONFIG,
        PHOENIX_PERP_ASSET_MAP,
        SYSVAR_INSTRUCTIONS_PUBKEY,
        PHOENIX_TRADER,
        SECOND_PHOENIX_TRADER,
        PYTH_ORACLE,
      ].map((pubkey) => pubkey.toBase58()),
    );
  });

  it.each([
    [1, 7],
    [2, 9],
  ] as const)(
    "a sync over %i arena(s) per group names %i accounts, the index group then the buffer group, as Phoenix's builder does",
    async (arenas, accounts) => {
      const { client } = makeClient(
        oracleMap([
          [USDC, PYTH],
          [BASE_MINT, PYTH],
          [WSOL, PYTH],
        ]),
        BASE_MINT,
        [PHOENIX_TRADER],
        arenas,
      );

      const sync = (await client.pricePhoenixTradersIxs())!.ixs[1];

      const groups = arenaGroups(arenas);
      const phoenix = buildUpdateTraderStateIx({
        programAddress: PHOENIX_PROGRAM_ID.toBase58(),
        trader: VAULT.toBase58(),
        traderAccount: PHOENIX_TRADER.toBase58(),
        perpAssetMap: PHOENIX_PERP_ASSET_MAP.toBase58(),
        globalTraderIndex: groups.globalTraderIndex.map((key) =>
          key.toBase58(),
        ),
        activeTraderBuffer: groups.activeTraderBuffer.map((key) =>
          key.toBase58(),
        ),
      } as any);
      expect(sync.keys).toHaveLength(accounts);
      expect(sync.keys.slice(5).map(({ pubkey }) => pubkey.toBase58())).toEqual(
        [...groups.globalTraderIndex, ...groups.activeTraderBuffer].map((key) =>
          key.toBase58(),
        ),
      );
      expect(sync.programId.toBase58()).toBe(phoenix.programAddress);
      expect([...sync.data]).toEqual([...phoenix.data!]);
      expect(
        sync.keys.map(({ pubkey, isSigner, isWritable }) => ({
          address: pubkey.toBase58(),
          role: (isSigner ? 2 : 0) | (isWritable ? 1 : 0),
        })),
      ).toEqual(phoenix.accounts);
    },
  );

  it.each([
    [
      "a header that is not a Phoenix global trader index header",
      accountInfo(PublicKey.unique(), Buffer.alloc(56)),
      `Phoenix global trader index header ${PHOENIX_GLOBAL_TRADER_INDEX.toBase58()} is not a Phoenix global trader index header of at least 56 bytes, and the sync reads its arena counts there`,
    ],
    [
      "a header that states no active arena",
      arenaHeaderAccountInfo(GLOBAL_TRADER_INDEX_HEADER_DISCRIMINATOR, 0),
      `Phoenix global trader index header ${PHOENIX_GLOBAL_TRADER_INDEX.toBase58()} states 0 arenas and 0 active, and a group holds 1 to 256, the header first`,
    ],
  ])("refuses %s", async (_, header, message) => {
    const { client } = makeClient(
      oracleMap([
        [USDC, PYTH],
        [BASE_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      BASE_MINT,
      [PHOENIX_TRADER],
      1,
      new Map([
        [PHOENIX_GLOBAL_TRADER_INDEX.toBase58(), header],
        [
          PHOENIX_ACTIVE_TRADER_BUFFER.toBase58(),
          arenaHeaderAccountInfo(ACTIVE_TRADER_BUFFER_HEADER_DISCRIMINATOR, 1),
        ],
      ]),
    );

    await expect(client.pricePhoenixTradersIxs()).rejects.toThrow(message);
  });

  it("refuses a global config shorter than the three keys the composer reads", async () => {
    const { client } = makeClient(
      oracleMap([
        [USDC, PYTH],
        [BASE_MINT, PYTH],
        [WSOL, PYTH],
      ]),
      BASE_MINT,
    );
    (client.base.connection.getAccountInfo as jest.Mock).mockImplementation(
      async (pubkey: PublicKey) =>
        pubkey.equals(PHOENIX_GLOBAL_CONFIG)
          ? accountInfo(PHOENIX_PROGRAM_ID, Buffer.alloc(455))
          : null,
    );

    await expect(client.pricePhoenixTradersIxs()).rejects.toThrow(
      "Phoenix global config is 455 bytes, and the pricing reads its perp asset map at 360, its global trader index header at 392 and its active trader buffer header at 424, 456 bytes in all",
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
