import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { OrcaWhirlpoolsClient } from "../../src/client/orca";
import { KAMINO_LENDING_PROGRAM, WSOL } from "../../src/constants";
import { PkMap } from "../../src/utils";
import {
  OracleSpec,
  assetMetaOf,
  loadReserveFixture,
  mintAccountInfo,
} from "./kaminoRefreshFakes";

const GLAM_STATE = PublicKey.unique();
const GLAM_VAULT = PublicKey.unique();
const SIGNER = PublicKey.unique();
const PROTOCOL = PublicKey.unique();
const EXT_ORCA = PublicKey.unique();
const TOKEN_MINT_A = PublicKey.unique();
const TOKEN_MINT_B = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();

const RESERVE_A = loadReserveFixture("reserve_usdc_main_market");
const RESERVE_B = loadReserveFixture("reserve_wsol_main_market");
const RESERVE_SOL = loadReserveFixture("reserve_cbbtc_main_market");

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

/** The refresh covers a set of reserves; their order in it carries no meaning. */
function expectSameReserves(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58()).sort()).toEqual(
    expected.map((pubkey) => pubkey.toBase58()).sort(),
  );
}

function reservesOf(ix: TransactionInstruction): PublicKey[] {
  // refresh_reserves_batch takes six keys per reserve, the reserve first.
  return ix.keys.filter((_, index) => index % 6 === 0).map((k) => k.pubkey);
}

function makeOrcaClient(
  oracles: Map<string, OracleSpec>,
  // What BaseClient.getAssetMeta falls back to (ASSETS_MAINNET) for a mint the
  // fetched asset metas do not carry.
  fallbackOracles: Map<string, OracleSpec> = new Map(),
) {
  const liquidityIx = new TransactionInstruction({
    programId: EXT_ORCA,
    keys: [],
    data: Buffer.from([4]),
  });
  const builders = {
    increaseLiquidityV2: methodBuilder(liquidityIx),
    decreaseLiquidityV2: methodBuilder(liquidityIx),
  };
  const assetMetas = new PkMap<any>();
  oracles.forEach((spec, mint) => {
    const pubkey = new PublicKey(mint);
    assetMetas.set(pubkey, assetMetaOf(pubkey, spec));
  });
  // Mirrors BaseClient.getAssetMeta: the fetched metas, then the mainnet
  // fallback, then no asset at all.
  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const fetched = assetMetas.get(mint);
    if (fetched) {
      return fetched;
    }
    const fallback = fallbackOracles.get(mint.toBase58());
    if (fallback) {
      return assetMetaOf(mint, fallback);
    }
    throw new Error(`Asset not supported: ${mint.toBase58()}`);
  });

  const reservesByKey = new PkMap<any>([
    [RESERVE_A.pubkey, RESERVE_A.accountInfo],
    [RESERVE_B.pubkey, RESERVE_B.accountInfo],
    [RESERVE_SOL.pubkey, RESERVE_SOL.accountInfo],
  ]);
  const getMultipleAccountsInfo = jest.fn(async (keys: PublicKey[]) =>
    keys.map((key) => reservesByKey.get(key) ?? null),
  );
  const fetchAssetMetas = jest.fn(async () => assetMetas);

  const base = {
    statePda: GLAM_STATE,
    vaultPda: GLAM_VAULT,
    signer: SIGNER,
    protocolProgram: { programId: PROTOCOL },
    extOrcaProgram: {
      programId: EXT_ORCA,
      methods: {
        increaseLiquidityV2: jest.fn(() => builders.increaseLiquidityV2),
        decreaseLiquidityV2: jest.fn(() => builders.decreaseLiquidityV2),
      },
    },
    connection: {
      getAccountInfo: jest.fn(async () => mintAccountInfo()),
      getMultipleAccountsInfo,
    },
    getVaultAta: (mint: PublicKey, tokenProgram?: PublicKey) =>
      getAssociatedTokenAddressSync(mint, GLAM_VAULT, true, tokenProgram),
    fetchAssetMetas,
    getAssetMeta,
  };

  const client = new OrcaWhirlpoolsClient(base as any);
  const buildVersionedTx = jest
    .spyOn(client.txBuilder as any, "buildVersionedTx")
    .mockResolvedValue({} as any);

  return {
    client,
    buildVersionedTx,
    fetchAssetMetas,
    getAssetMeta,
    liquidityIx,
  };
}

function liquidityAccounts(
  priceDeviationAccounts?: Record<string, unknown>,
): any {
  return {
    whirlpool: PublicKey.unique(),
    position: PublicKey.unique(),
    positionMint: PublicKey.unique(),
    tokenMintA: TOKEN_MINT_A,
    tokenMintB: TOKEN_MINT_B,
    tokenVaultA: PublicKey.unique(),
    tokenVaultB: PublicKey.unique(),
    tickArrayLower: PublicKey.unique(),
    tickArrayUpper: PublicKey.unique(),
    tokenProgramA: TOKEN_PROGRAM_ID,
    tokenProgramB: TOKEN_PROGRAM_ID,
    priceDeviationAccounts,
  };
}

function preInstructions(buildVersionedTx: jest.SpyInstance) {
  const [, txOptions] = buildVersionedTx.mock.calls[0] as [
    TransactionInstruction[],
    { preInstructions?: TransactionInstruction[] },
  ];
  return txOptions.preInstructions ?? [];
}

const KAMINO = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});
const PYTH: OracleSpec = { oracle: PYTH_ORACLE, oracleSource: "Pyth" };

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

describe("Orca liquidity price-deviation Kamino reserve refresh", () => {
  it("derives the pool token reserves the SDK caller did not pass", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)],
        [TOKEN_MINT_B, KAMINO(RESERVE_B.pubkey)],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts({
        tokenMintAOracle: RESERVE_A.pubkey,
        tokenMintBOracle: RESERVE_B.pubkey,
      }),
    );

    const refreshes = preInstructions(buildVersionedTx).filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expectSameReserves(reservesOf(refreshes[0]), [
      RESERVE_A.pubkey,
      RESERVE_B.pubkey,
    ]);
  });

  it("derives the SOL oracle's reserve when the instruction reads it", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)],
        [TOKEN_MINT_B, PYTH],
        [WSOL, KAMINO(RESERVE_SOL.pubkey)],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts({
        tokenMintAOracle: RESERVE_A.pubkey,
        tokenMintBOracle: PYTH_ORACLE,
        solUsdOracle: RESERVE_SOL.pubkey,
      }),
    );

    const refreshes = preInstructions(buildVersionedTx).filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expectSameReserves(reservesOf(refreshes[0]), [
      RESERVE_A.pubkey,
      RESERVE_SOL.pubkey,
    ]);
  });

  it("adds no second refresh when the caller already derived the reserves", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)],
        [TOKEN_MINT_B, KAMINO(RESERVE_B.pubkey)],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts({
        tokenMintAOracle: RESERVE_A.pubkey,
        tokenMintBOracle: RESERVE_B.pubkey,
        // What cli/src/cmds/orca.ts passes today.
        kaminoReserves: [RESERVE_A.pubkey, RESERVE_B.pubkey],
      }),
    );

    const refreshes = preInstructions(buildVersionedTx).filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expectSameReserves(reservesOf(refreshes[0]), [
      RESERVE_A.pubkey,
      RESERVE_B.pubkey,
    ]);
  });

  it("refreshes for decrease liquidity too", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)],
        [TOKEN_MINT_B, PYTH],
      ]),
    );

    await client.txBuilder.decreaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMinA: 0, tokenMinB: 0 },
      liquidityAccounts({
        tokenMintAOracle: RESERVE_A.pubkey,
        tokenMintBOracle: PYTH_ORACLE,
      }),
    );

    const refreshes = preInstructions(buildVersionedTx).filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expectSameReserves(reservesOf(refreshes[0]), [RESERVE_A.pubkey]);
  });

  // The derivation resolves a priced mint the way the pricing path does, so
  // an asset the fetched metas miss is still refreshed, and one nobody can
  // resolve stops the transaction instead of losing its refresh in silence.
  it("derives the reserve of a mint only the mainnet fallback knows", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([[TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)]]),
      oracleMap([[TOKEN_MINT_B, KAMINO(RESERVE_B.pubkey)]]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts({
        tokenMintAOracle: RESERVE_A.pubkey,
        tokenMintBOracle: RESERVE_B.pubkey,
      }),
    );

    const refreshes = preInstructions(buildVersionedTx).filter((ix) =>
      ix.programId.equals(KAMINO_LENDING_PROGRAM),
    );
    expect(refreshes).toHaveLength(1);
    expectSameReserves(reservesOf(refreshes[0]), [
      RESERVE_A.pubkey,
      RESERVE_B.pubkey,
    ]);
  });

  it("fails with the pricing path's sentence when a priced mint cannot be resolved", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([[TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)]]),
    );

    await expect(
      client.txBuilder.increaseLiquidityV2Tx(
        { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
        liquidityAccounts({
          tokenMintAOracle: RESERVE_A.pubkey,
          tokenMintBOracle: PYTH_ORACLE,
        }),
      ),
    ).rejects.toThrow(`Oracle unavailable for Orca asset ${TOKEN_MINT_B}`);

    expect(buildVersionedTx).not.toHaveBeenCalled();
  });

  it("adds no refresh when neither pool oracle is a Kamino reserve", async () => {
    const { client, buildVersionedTx } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, PYTH],
        [TOKEN_MINT_B, PYTH],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts({
        tokenMintAOracle: PYTH_ORACLE,
        tokenMintBOracle: PYTH_ORACLE,
      }),
    );

    expect(preInstructions(buildVersionedTx)).toEqual([]);
  });

  it("looks up no asset metas when the instruction reads no oracles", async () => {
    const { client, buildVersionedTx, fetchAssetMetas } = makeOrcaClient(
      oracleMap([
        [TOKEN_MINT_A, KAMINO(RESERVE_A.pubkey)],
        [TOKEN_MINT_B, KAMINO(RESERVE_B.pubkey)],
      ]),
    );

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      liquidityAccounts(),
    );

    expect(preInstructions(buildVersionedTx)).toEqual([]);
    expect(fetchAssetMetas).not.toHaveBeenCalled();
  });
});
