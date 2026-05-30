import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { OrcaWhirlpoolsClient } from "../../src/client/orca";
import { PriceClient } from "../../src/client/price";
import {
  KAMINO_LENDING_PROGRAM,
  ORCA_POSITION_DISCRIMINATOR,
  ORCA_WHIRLPOOLS_PROGRAM_ID,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  USDC,
  WSOL,
} from "../../src/constants";
import {
  EPI_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  LAYERZERO_OFT_PROTOCOL,
  ORCA_WHIRLPOOLS_PROTOCOL,
  PHOENIX_PROTOCOL,
} from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap } from "../../src/utils";

const VAULT = new PublicKey("31xmCqzfdYT4GHjo39BQiTHVPjpugw6JqXNwckVL9cEf");
const STATE = new PublicKey("3XYX3QvpHQ7TqvjhZcoBBmykNDruV9PtrGXRxJFzsiCF");
const EXT_KAMINO = PublicKey.unique();
const EXT_BRIDGE = PublicKey.unique();
const EXT_EPI = PublicKey.unique();
const EXT_PHOENIX = PublicKey.unique();
const EXT_ORCA = PublicKey.unique();
const OBLIGATION = new PublicKey(
  "65iwhmFa5mRSmeBGNGEzSfG6y66Pk6r5eksYDMFSMRb6",
);
const ORCA_POSITION = PublicKey.unique();
const MARKET = new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF");
const RESERVE_A = new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
const RESERVE_B = new PublicKey("Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo");
const RESERVE_C = new PublicKey("d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q");
const PRIME = new PublicKey("3b8X44fLF9ooXaUm3hhSgjpmVs6rZZ3pPoGnGahc3Uu7");
const PHOENIX_TRADER = new PublicKey(
  "9T3f2Qsmucy63CiqVGMFMSuuh7qs68cc26DpRXGRXN48",
);
const PHOENIX_PERP_ASSET_MAP = new PublicKey(
  "Fe1oM7qbtp6bFUrE1qFjCcqpUEEUrYdw7qkhjUZBjA8s",
);
const SOL_USD_ORACLE = PublicKey.unique();
const USDC_ORACLE = PublicKey.unique();

function ix(data: number): TransactionInstruction {
  return new TransactionInstruction({
    programId: PublicKey.default,
    keys: [],
    data: Buffer.from([data]),
  });
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

function accountInfo(owner: PublicKey, data: Buffer = Buffer.alloc(0)) {
  return {
    data,
    executable: false,
    lamports: 0,
    owner,
    rentEpoch: 0,
  };
}

function phoenixTraderAccountInfo() {
  return accountInfo(
    PHOENIX_PROGRAM_ID,
    Buffer.from([41, 97, 73, 105, 110, 214, 112, 9]),
  );
}

function phoenixGlobalConfigAccountInfo(perpAssetMap: PublicKey) {
  const data = Buffer.alloc(392);
  perpAssetMap.toBuffer().copy(data, 360);
  return accountInfo(PHOENIX_PROGRAM_ID, data);
}

const KAMINO_LENDING_ACL = {
  integrationProgram: EXT_KAMINO,
  protocolsBitmask: KAMINO_LENDING_PROTOCOL,
};
const BRIDGE_ACL = {
  integrationProgram: EXT_BRIDGE,
  protocolsBitmask: LAYERZERO_OFT_PROTOCOL,
};
const EPI_ACL = {
  integrationProgram: EXT_EPI,
  protocolsBitmask: EPI_PROTOCOL,
};
const PHOENIX_ACL = {
  integrationProgram: EXT_PHOENIX,
  protocolsBitmask: PHOENIX_PROTOCOL,
};
const ORCA_ACL = {
  integrationProgram: EXT_ORCA,
  protocolsBitmask: ORCA_WHIRLPOOLS_PROTOCOL,
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
      extPhoenixProgram: { programId: EXT_PHOENIX },
      extOrcaProgram: { programId: EXT_ORCA },
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

function orcaPositionAccountInfo() {
  const data = Buffer.alloc(216);
  ORCA_POSITION_DISCRIMINATOR.forEach((byte, i) => {
    data[i] = byte;
  });
  return accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, data);
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

  it("returns reserves and ixs separately for vault token pricing", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient([RESERVE_A, RESERVE_B]);

    const chunk = await client.priceVaultTokensIx();

    expect(chunk.ixs).toHaveLength(1);
    expectPubkeys(chunk.kaminoReserves, [RESERVE_A, RESERVE_B]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
    expect(refreshReservesBatchIx).not.toHaveBeenCalled();
  });

  it("returns obligation-only reserves and ixs without refreshing", async () => {
    const { client, fetchAndParseReserves, refreshReservesBatchIx } =
      makeClient([RESERVE_A, RESERVE_C]);

    const chunk = await client.priceKaminoObligationsIxs();

    expect(chunk.ixs).toHaveLength(2);
    expectPubkeys(chunk.kaminoReserves, [RESERVE_A, RESERVE_C]);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
    expect(refreshReservesBatchIx).not.toHaveBeenCalled();
  });

  it("coalesces all kamino reserves into a single front-loaded refresh ix", async () => {
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
    expect(ixs[0].programId.toBase58()).toBe(KAMINO_LENDING_PROGRAM.toBase58());
  });

  it("does not duplicate reserves shared between obligation and vault-token pricing", async () => {
    const { client, fetchAndParseReserves } = makeClient([
      RESERVE_A,
      RESERVE_B,
    ]);

    await client.priceVaultIxs();

    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expectPubkeys(fetchAndParseReserves.mock.calls[0][0], [
      RESERVE_A,
      RESERVE_B,
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

  it("skips Phoenix trader pricing when ext_phoenix is not enabled", async () => {
    const phoenixIx = ix(5);
    const { client } = makeClient([RESERVE_A, RESERVE_C]);
    const pricePhoenixSpy = jest
      .spyOn(client, "pricePhoenixTradersIxs")
      .mockResolvedValue({ ixs: [phoenixIx], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(pricePhoenixSpy).not.toHaveBeenCalled();
    expect(ixs).not.toContain(phoenixIx);
  });

  it("prices Phoenix traders when ext_phoenix is enabled", async () => {
    const phoenixIx = ix(5);
    const { client } = makeClient(
      [RESERVE_A, RESERVE_C],
      [KAMINO_LENDING_ACL, PHOENIX_ACL],
    );
    const pricePhoenixSpy = jest
      .spyOn(client, "pricePhoenixTradersIxs")
      .mockResolvedValue({ ixs: [phoenixIx], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(pricePhoenixSpy).toHaveBeenCalledTimes(1);
    expect(ixs).toContain(phoenixIx);
  });

  it("skips Orca Whirlpool position pricing when ext_orca is not enabled", async () => {
    const orcaIx = ix(6);
    const { client } = makeClient([RESERVE_A, RESERVE_C]);
    const priceOrcaSpy = jest
      .spyOn(client, "priceOrcaWhirlpoolPositionsIxs")
      .mockResolvedValue({ ixs: [orcaIx], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(priceOrcaSpy).not.toHaveBeenCalled();
    expect(ixs).not.toContain(orcaIx);
  });

  it("prices Orca Whirlpool positions when ext_orca Whirlpools is enabled", async () => {
    const orcaIx = ix(6);
    const { client } = makeClient(
      [RESERVE_A, RESERVE_C],
      [KAMINO_LENDING_ACL, ORCA_ACL],
    );
    const priceOrcaSpy = jest
      .spyOn(client, "priceOrcaWhirlpoolPositionsIxs")
      .mockResolvedValue({ ixs: [orcaIx], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(priceOrcaSpy).toHaveBeenCalledTimes(1);
    expect(ixs).toContain(orcaIx);
  });

  it("fails clearly when an Orca pricing instruction exceeds the account-key budget", async () => {
    const stateModel = {
      accountType: StateAccountType.VAULT,
      baseAssetMint: PublicKey.default,
      baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
      externalPositions: [ORCA_POSITION],
      integrationAcls: [ORCA_ACL],
    };
    const priceOrcaBuilder = methodBuilder(
      new TransactionInstruction({
        programId: PublicKey.unique(),
        keys: Array.from({ length: 64 }, () => ({
          pubkey: PublicKey.unique(),
          isSigner: false,
          isWritable: false,
        })),
        data: Buffer.from([6]),
      }),
    );
    const client = new PriceClient(
      {
        vaultPda: VAULT,
        statePda: STATE,
        connection: {
          getMultipleAccountsInfo: jest.fn(async () => [
            orcaPositionAccountInfo(),
          ]),
        },
        fetchStateModel: jest.fn(async () => stateModel),
        fetchAssetMetas: jest.fn(async () => new PkMap()),
        getSolOracle: jest.fn(async () => SOL_USD_ORACLE),
        mintProgram: {
          methods: {
            priceOrcaWhirlpoolPositions: jest.fn(() => priceOrcaBuilder),
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      (() => undefined) as any,
    );
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(USDC_ORACLE);
    const remainingAccountsSpy = jest
      .spyOn(
        OrcaWhirlpoolsClient.prototype,
        "remainingAccountsForPricingWhirlpoolPositions",
      )
      .mockResolvedValue({
        numPositions: 1,
        remainingAccounts: [],
        kaminoReserves: [],
      });

    await expect(
      client.priceOrcaWhirlpoolPositionsIxs(stateModel as any),
    ).rejects.toThrow(
      "oversized Orca pricing cannot be spread across multiple instructions",
    );

    remainingAccountsSpy.mockRestore();
  });

  it("builds Phoenix trader pricing remaining accounts from registered external positions", async () => {
    const phoenixPriceIx = ix(5);
    const pricePhoenixBuilder = methodBuilder(phoenixPriceIx);
    const getAssetMeta = jest.fn(async (mint: PublicKey) => {
      if (mint.equals(USDC)) {
        return {
          asset: USDC,
          decimals: 6,
          oracle: USDC_ORACLE,
          programId: TOKEN_PROGRAM_ID,
          oracleSource: "Pyth",
        };
      }
      throw new Error(`Unexpected asset meta lookup: ${mint.toBase58()}`);
    });
    const client = new PriceClient(
      {
        vaultPda: VAULT,
        statePda: STATE,
        fetchStateModel: jest.fn(async () => ({
          accountType: StateAccountType.VAULT,
          baseAssetMint: USDC,
          baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
          externalPositions: [OBLIGATION, PHOENIX_TRADER],
          integrationAcls: [PHOENIX_ACL],
        })),
        fetchAssetMetas: jest.fn(async () => new PkMap()),
        getSolOracle: jest.fn(async () => SOL_USD_ORACLE),
        getAssetMeta,
        connection: {
          getMultipleAccountsInfo: jest.fn(async () => [
            accountInfo(PublicKey.unique()),
            phoenixTraderAccountInfo(),
          ]),
          getAccountInfo: jest.fn(async (pubkey: PublicKey) =>
            pubkey.equals(PHOENIX_GLOBAL_CONFIG)
              ? phoenixGlobalConfigAccountInfo(PHOENIX_PERP_ASSET_MAP)
              : null,
          ),
        },
        mintProgram: {
          methods: {
            pricePhoenixTraders: jest.fn(() => pricePhoenixBuilder),
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      (() => undefined) as any,
    );

    const chunk = await client.pricePhoenixTradersIxs();

    expect(chunk).toBeTruthy();
    expect(chunk?.ixs).toHaveLength(2);
    expect(chunk?.ixs[0].programId.equals(ComputeBudgetProgram.programId)).toBe(
      true,
    );
    expect(
      chunk?.ixs[0].data.equals(
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }).data,
      ),
    ).toBe(true);
    expect(chunk?.ixs[1]).toBe(phoenixPriceIx);
    expect(getAssetMeta).toHaveBeenCalledWith(USDC);
    expect(pricePhoenixBuilder.accounts).toHaveBeenCalledWith({
      glamState: STATE,
      solUsdOracle: SOL_USD_ORACLE,
      baseAssetOracle: USDC_ORACLE,
    });
    expect(pricePhoenixBuilder.remainingAccounts).toHaveBeenCalledWith([
      {
        pubkey: PHOENIX_GLOBAL_CONFIG,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: PHOENIX_PERP_ASSET_MAP,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: PHOENIX_TRADER,
        isSigner: false,
        isWritable: false,
      },
    ]);
  });

  it("skips bridge managed transfer pricing when ext_bridge is not enabled", async () => {
    const bridgeIx = ix(4);
    const { client } = makeClient([RESERVE_A, RESERVE_C]);
    const priceBridgeSpy = jest
      .spyOn(client as any, "priceManagedTransfersIxs")
      .mockResolvedValue({ ixs: [bridgeIx], kaminoReserves: [] });

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
      .mockResolvedValue({ ixs: [bridgeIx], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(priceBridgeSpy).toHaveBeenCalledTimes(1);
    expect(ixs).toContain(bridgeIx);
  });
});
