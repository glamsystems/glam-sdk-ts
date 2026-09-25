import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  AccountLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PriceClient } from "../../src/client/price";
import {
  JUPITER_LENDING_PROGRAM_ID,
  JUPITER_LIQUIDITY_PROGRAM_ID,
  JUPITER_VAULTS_PROGRAM_ID,
  KAMINO_LENDING_PROGRAM,
  KAMINO_OBTRIGATION_SIZE,
  WSOL,
} from "../../src/constants";
import { StateAccountType } from "../../src/models";
import {
  EXT_PRICER_DISCRIMINATORS,
  getGlobalConfigPda,
  getIntegrationAuthorityPda,
} from "../../src/utils";
import { PositionCategorizer } from "../../src/utils/positionCategorizer";
import {
  LENDING_ACCOUNT_SIZE,
  LENDING_DISCRIMINATOR,
  LENDING_F_TOKEN_MINT_OFFSET,
  LENDING_MINT_OFFSET,
  LENDING_REWARDS_RATE_MODEL_OFFSET,
  LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET,
  JUPITER_BORROW_PROTOCOL,
  JUPITER_EARN_PROTOCOL,
  POSITION_DISCRIMINATOR,
  POSITION_IS_SUPPLY_ONLY_OFFSET,
  POSITION_MINT_OFFSET,
  POSITION_SUPPLY_AMOUNT_OFFSET,
  POSITION_TICK_ID_OFFSET,
  POSITION_TICK_OFFSET,
  POSITION_VAULT_ID_OFFSET,
  TOKEN_RESERVE_DISCRIMINATOR,
  TOKEN_RESERVE_VAULT_OFFSET,
  UPDATE_EXCHANGE_PRICES_DISCRIMINATOR,
  UPDATE_RATE_DISCRIMINATOR,
  VAULT_CONFIG_BORROW_TOKEN_OFFSET,
  VAULT_CONFIG_DISCRIMINATOR,
  VAULT_CONFIG_SUPPLY_TOKEN_OFFSET,
  getFTokenMintPda,
  getLendingPda,
  getPositionMintPda,
  getPositionPda,
  getVaultConfigPda,
} from "../../src/client/jupiter-lend/shared";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const BASE_ORACLE = PublicKey.unique();
const SOL_ORACLE = PublicKey.unique();
const EXT_JUPITER = PublicKey.unique();
const PROTOCOL_PROGRAM = PublicKey.unique();
const BASE_MINT = PublicKey.unique();

function accountInfo(owner: PublicKey, data: Buffer = Buffer.alloc(0)) {
  return {
    data,
    executable: false,
    lamports: 0,
    owner,
    rentEpoch: 0,
  };
}

function tokenAccountData(mint: PublicKey, owner: PublicKey, amount = 1n) {
  const data = Buffer.alloc(AccountLayout.span);
  mint.toBuffer().copy(data, 0);
  owner.toBuffer().copy(data, 32);
  data.writeBigUInt64LE(amount, 64);
  return data;
}

function lendingData({
  mint,
  fTokenMint,
  reserve,
  rewardsRateModel = PublicKey.unique(),
}: {
  mint: PublicKey;
  fTokenMint: PublicKey;
  reserve: PublicKey;
  rewardsRateModel?: PublicKey;
}) {
  const data = Buffer.alloc(LENDING_ACCOUNT_SIZE);
  LENDING_DISCRIMINATOR.copy(data, 0);
  mint.toBuffer().copy(data, LENDING_MINT_OFFSET);
  fTokenMint.toBuffer().copy(data, LENDING_F_TOKEN_MINT_OFFSET);
  rewardsRateModel.toBuffer().copy(data, LENDING_REWARDS_RATE_MODEL_OFFSET);
  reserve.toBuffer().copy(data, LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET);
  return data;
}

function positionData({
  vaultId,
  nftId,
  positionMint,
  tick = 0,
  tickId = 1,
  supplyAmount = 1_000n,
}: {
  vaultId: number;
  nftId: number;
  positionMint: PublicKey;
  tick?: number;
  tickId?: number;
  supplyAmount?: bigint;
}) {
  const data = Buffer.alloc(71);
  POSITION_DISCRIMINATOR.copy(data, 0);
  data.writeUInt16LE(vaultId, POSITION_VAULT_ID_OFFSET);
  data.writeUInt32LE(nftId, POSITION_VAULT_ID_OFFSET + 2);
  positionMint.toBuffer().copy(data, POSITION_MINT_OFFSET);
  data.writeUInt8(0, POSITION_IS_SUPPLY_ONLY_OFFSET);
  data.writeInt32LE(tick, POSITION_TICK_OFFSET);
  data.writeUInt32LE(tickId, POSITION_TICK_ID_OFFSET);
  data.writeBigUInt64LE(supplyAmount, POSITION_SUPPLY_AMOUNT_OFFSET);
  return data;
}

function vaultConfigData({
  vaultId,
  supplyToken,
  borrowToken,
}: {
  vaultId: number;
  supplyToken: PublicKey;
  borrowToken: PublicKey;
}) {
  const data = Buffer.alloc(219);
  VAULT_CONFIG_DISCRIMINATOR.copy(data, 0);
  data.writeUInt16LE(vaultId, 8);
  supplyToken.toBuffer().copy(data, VAULT_CONFIG_SUPPLY_TOKEN_OFFSET);
  borrowToken.toBuffer().copy(data, VAULT_CONFIG_BORROW_TOKEN_OFFSET);
  return data;
}

function tokenReserveData(mint: PublicKey, vault = PublicKey.unique()) {
  const data = Buffer.alloc(72);
  TOKEN_RESERVE_DISCRIMINATOR.copy(data, 0);
  mint.toBuffer().copy(data, 8);
  vault.toBuffer().copy(data, TOKEN_RESERVE_VAULT_OFFSET);
  return data;
}

/** The named accounts of an ext-hosted pricer over this test's vault. */
function extPricerNamedKeys(
  programId: PublicKey,
  solUsdOracle: PublicKey,
  baseAssetOracle: PublicKey,
) {
  return [
    { pubkey: STATE, isSigner: false, isWritable: true },
    ...[
      VAULT,
      solUsdOracle,
      baseAssetOracle,
      getIntegrationAuthorityPda(programId),
      getGlobalConfigPda(),
      PROTOCOL_PROGRAM,
    ].map((pubkey) => ({ pubkey, isSigner: false, isWritable: false })),
  ];
}

type OracleSpec = { oracle: PublicKey; oracleSource: string };

const KAMINO = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "KaminoReserve",
});
const PYTH = (oracle: PublicKey): OracleSpec => ({
  oracle,
  oracleSource: "Pyth",
});

/** SOL/USD and base asset oracles that are not Kamino reserves. */
const PYTH_ROLES = { sol: PYTH(SOL_ORACLE), base: PYTH(BASE_ORACLE) };

/**
 * The asset meta lookups of a client whose registrations are `oracles`.
 * getSolOracle reads the WSOL meta, as BaseClient's does.
 */
function assetMetaLookups(oracles: Array<[PublicKey, OracleSpec]>) {
  const byMint = new Map(
    oracles.map(([mint, spec]) => [mint.toBase58(), spec]),
  );
  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const spec = byMint.get(mint.toBase58());
    if (!spec) {
      throw new Error(`Asset not supported: ${mint.toBase58()}`);
    }
    return { asset: mint, decimals: 6, programId: TOKEN_PROGRAM_ID, ...spec };
  });
  const getSolOracle = jest.fn(async () => (await getAssetMeta(WSOL)).oracle);
  return { getAssetMeta, getSolOracle };
}

/**
 * The refresh covers a set of reserves, and their order in it carries no
 * meaning.
 */
function expectSameReserves(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58()).sort()).toEqual(
    expected.map((pubkey) => pubkey.toBase58()).sort(),
  );
}

/**
 * A vault holding one Jupiter Earn position whose underlying asset reads
 * `underlying`.
 */
function jupiterEarnFixture(
  roles: { sol: OracleSpec; base: OracleSpec },
  underlying: OracleSpec,
) {
  const fTokenAta = PublicKey.unique();
  const fTokenMint = PublicKey.unique();
  const underlyingMint = PublicKey.unique();
  const lending = PublicKey.unique();
  const reserve = PublicKey.unique();

  const client = new PriceClient(
    {
      statePda: STATE,
      vaultPda: VAULT,
      connection: {
        getMultipleAccountsInfo: jest.fn(async () => [
          accountInfo(TOKEN_PROGRAM_ID, tokenAccountData(fTokenMint, VAULT)),
        ]),
        getProgramAccounts: jest.fn(async () => [
          {
            pubkey: lending,
            account: accountInfo(
              JUPITER_LENDING_PROGRAM_ID,
              lendingData({ mint: underlyingMint, fTokenMint, reserve }),
            ),
          },
        ]),
      },
      fetchStateModel: jest.fn(async () => ({
        accountType: StateAccountType.VAULT,
        baseAssetMint: BASE_MINT,
        externalPositions: [fTokenAta],
      })),
      ...assetMetaLookups([
        [WSOL, roles.sol],
        [BASE_MINT, roles.base],
        [underlyingMint, underlying],
      ]),
      protocolProgram: { programId: PROTOCOL_PROGRAM },
      extJupiterProgram: { programId: EXT_JUPITER },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );
  jest
    .spyOn(client as any, "categorizeExternalPositions")
    .mockResolvedValue({ jupiterEarnAtas: [fTokenAta] });

  return { client, fTokenAta, lending };
}

/**
 * A vault holding one Jupiter Borrow position over a supply and a borrow
 * asset.
 */
function jupiterBorrowFixture(
  roles: { sol: OracleSpec; base: OracleSpec },
  supply: OracleSpec,
  borrow: OracleSpec,
) {
  const vaultId = 11;
  const nftId = 7;
  const position = getPositionPda(vaultId, nftId);
  const positionMint = getPositionMintPda(vaultId, nftId);
  const positionTokenAccount = PublicKey.unique();
  const supplyToken = PublicKey.unique();
  const borrowToken = PublicKey.unique();
  const supplyReserve = PublicKey.unique();
  const borrowReserve = PublicKey.unique();
  const vaultConfig = getVaultConfigPda(vaultId);
  const supplyLending = getLendingPda(
    supplyToken,
    getFTokenMintPda(supplyToken),
  );
  const borrowLending = getLendingPda(
    borrowToken,
    getFTokenMintPda(borrowToken),
  );

  const accountByKey = new Map<string, ReturnType<typeof accountInfo>>([
    [
      position.toBase58(),
      accountInfo(
        JUPITER_VAULTS_PROGRAM_ID,
        positionData({ vaultId, nftId, positionMint }),
      ),
    ],
    [
      vaultConfig.toBase58(),
      accountInfo(
        JUPITER_VAULTS_PROGRAM_ID,
        vaultConfigData({ vaultId, supplyToken, borrowToken }),
      ),
    ],
    [
      supplyLending.toBase58(),
      accountInfo(
        JUPITER_LENDING_PROGRAM_ID,
        lendingData({
          mint: supplyToken,
          fTokenMint: getFTokenMintPda(supplyToken),
          reserve: supplyReserve,
        }),
      ),
    ],
    [
      borrowLending.toBase58(),
      accountInfo(
        JUPITER_LENDING_PROGRAM_ID,
        lendingData({
          mint: borrowToken,
          fTokenMint: getFTokenMintPda(borrowToken),
          reserve: borrowReserve,
        }),
      ),
    ],
    [
      supplyReserve.toBase58(),
      accountInfo(JUPITER_LIQUIDITY_PROGRAM_ID, tokenReserveData(supplyToken)),
    ],
    [
      borrowReserve.toBase58(),
      accountInfo(JUPITER_LIQUIDITY_PROGRAM_ID, tokenReserveData(borrowToken)),
    ],
  ]);

  const client = new PriceClient(
    {
      statePda: STATE,
      vaultPda: VAULT,
      connection: {
        getAccountInfo: jest.fn(
          async (pubkey: PublicKey) =>
            accountByKey.get(pubkey.toBase58()) ?? null,
        ),
        getMultipleAccountsInfo: jest.fn(async () => [
          accountInfo(TOKEN_PROGRAM_ID, tokenAccountData(positionMint, VAULT)),
          null,
        ]),
      },
      getVaultAta: jest.fn((mint: PublicKey, programId: PublicKey) =>
        programId.equals(TOKEN_PROGRAM_ID)
          ? positionTokenAccount
          : PublicKey.unique(),
      ),
      fetchStateModel: jest.fn(async () => ({
        accountType: StateAccountType.VAULT,
        baseAssetMint: BASE_MINT,
        externalPositions: [position],
      })),
      ...assetMetaLookups([
        [WSOL, roles.sol],
        [BASE_MINT, roles.base],
        [supplyToken, supply],
        [borrowToken, borrow],
      ]),
      protocolProgram: { programId: PROTOCOL_PROGRAM },
      extJupiterProgram: { programId: EXT_JUPITER },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );
  jest
    .spyOn(client as any, "categorizeExternalPositions")
    .mockResolvedValue({ jupiterBorrowPositions: [position] });

  return { client, position, positionTokenAccount, vaultConfig };
}

describe("PositionCategorizer Jupiter lend branches", () => {
  it("separates Jupiter Earn fToken ATAs and Jupiter Borrow positions", async () => {
    const jupiterEarnAta = PublicKey.unique();
    const kaminoVaultAta = PublicKey.unique();
    const borrowPosition = PublicKey.unique();
    const kaminoObligation = PublicKey.unique();
    const fTokenMint = PublicKey.unique();
    const kaminoShareMint = PublicKey.unique();
    const lending = PublicKey.unique();

    const connection = {
      getMultipleAccountsInfo: jest.fn(async () => [
        accountInfo(TOKEN_PROGRAM_ID, tokenAccountData(fTokenMint, VAULT)),
        accountInfo(
          TOKEN_2022_PROGRAM_ID,
          tokenAccountData(kaminoShareMint, VAULT),
        ),
        accountInfo(
          JUPITER_VAULTS_PROGRAM_ID,
          Buffer.concat([POSITION_DISCRIMINATOR, Buffer.alloc(63)]),
        ),
        accountInfo(
          KAMINO_LENDING_PROGRAM,
          Buffer.alloc(KAMINO_OBTRIGATION_SIZE),
        ),
      ]),
      getProgramAccounts: jest
        .fn()
        .mockResolvedValueOnce([
          {
            pubkey: lending,
            account: accountInfo(
              JUPITER_LENDING_PROGRAM_ID,
              lendingData({
                mint: PublicKey.unique(),
                fTokenMint,
                reserve: PublicKey.unique(),
              }),
            ),
          },
        ])
        .mockResolvedValueOnce([]),
    } as any;

    const categorizer = new PositionCategorizer(connection);
    const result = await categorizer.categorizePositions(
      [jupiterEarnAta, kaminoVaultAta, borrowPosition, kaminoObligation],
      "confirmed",
    );

    expect(result.jupiterEarnAtas.map((p) => p.toBase58())).toEqual([
      jupiterEarnAta.toBase58(),
    ]);
    expect(result.kaminoVaultShareAtas.map((p) => p.toBase58())).toEqual([
      kaminoVaultAta.toBase58(),
    ]);
    expect(result.jupiterBorrowPositions.map((p) => p.toBase58())).toEqual([
      borrowPosition.toBase58(),
    ]);
    expect(result.kaminoObligations.map((p) => p.toBase58())).toEqual([
      kaminoObligation.toBase58(),
    ]);
  });
});

describe("PriceClient Jupiter lend pricing builders", () => {
  it("prepends update_rate before Jupiter Earn pricing", async () => {
    const underlyingOracle = PublicKey.unique();
    const { client, fTokenAta, lending } = jupiterEarnFixture(
      PYTH_ROLES,
      PYTH(underlyingOracle),
    );

    const chunk = await client.priceJupiterEarnPositionsIxs();

    expect(chunk.ixs).toHaveLength(2);
    expect(chunk.ixs[0].programId.equals(JUPITER_LENDING_PROGRAM_ID)).toBe(
      true,
    );
    expect(chunk.ixs[0].data.equals(UPDATE_RATE_DISCRIMINATOR)).toBe(true);
    const pricing = chunk.ixs[1];
    expect(pricing.programId.equals(EXT_JUPITER)).toBe(true);
    expect(pricing.data).toEqual(
      Buffer.from(EXT_PRICER_DISCRIMINATORS.price_jupiter_earn_positions),
    );
    expect(pricing.keys.slice(0, 7)).toEqual(
      extPricerNamedKeys(EXT_JUPITER, SOL_ORACLE, BASE_ORACLE),
    );
    expect(pricing.keys.slice(7)).toEqual([
      { pubkey: fTokenAta, isSigner: false, isWritable: false },
      { pubkey: lending, isSigner: false, isWritable: false },
      { pubkey: underlyingOracle, isSigner: false, isWritable: false },
    ]);
  });

  it("prepends update_exchange_prices before Jupiter Borrow pricing", async () => {
    const supplyOracle = PublicKey.unique();
    const borrowOracle = PublicKey.unique();
    const { client, position, positionTokenAccount, vaultConfig } =
      jupiterBorrowFixture(PYTH_ROLES, PYTH(supplyOracle), PYTH(borrowOracle));

    const chunk = await client.priceJupiterBorrowPositionsIxs();

    expect(chunk.ixs).toHaveLength(2);
    expect(chunk.ixs[0].programId.equals(JUPITER_VAULTS_PROGRAM_ID)).toBe(true);
    expect(
      chunk.ixs[0].data
        .subarray(0, 8)
        .equals(UPDATE_EXCHANGE_PRICES_DISCRIMINATOR),
    ).toBe(true);
    const pricing = chunk.ixs[1];
    expect(pricing.programId.equals(EXT_JUPITER)).toBe(true);
    expect(pricing.data).toEqual(
      Buffer.from(EXT_PRICER_DISCRIMINATORS.price_jupiter_borrow_positions),
    );
    expect(pricing.keys.slice(0, 7)).toEqual(
      extPricerNamedKeys(EXT_JUPITER, SOL_ORACLE, BASE_ORACLE),
    );
    expect(pricing.keys.slice(7)).toEqual([
      { pubkey: position, isSigner: false, isWritable: false },
      { pubkey: positionTokenAccount, isSigner: false, isWritable: false },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      expect.objectContaining({ isSigner: false, isWritable: false }),
      expect.objectContaining({ isSigner: false, isWritable: false }),
      { pubkey: supplyOracle, isSigner: false, isWritable: false },
      { pubkey: borrowOracle, isSigner: false, isWritable: false },
    ]);
  });

  it("wires Jupiter pricing only for enabled ext_jupiter protocol bits", async () => {
    const extJupiter = PublicKey.unique();
    const extKamino = PublicKey.unique();
    const extBridge = PublicKey.unique();
    const extEpi = PublicKey.unique();
    const extLoopscale = PublicKey.unique();
    const extMarginfi = PublicKey.unique();
    const extNeutral = PublicKey.unique();
    const extPhoenix = PublicKey.unique();
    const extRpi = PublicKey.unique();
    const protocol = PublicKey.unique();
    const earnIx = new TransactionInstruction({
      programId: PublicKey.unique(),
      keys: [],
      data: Buffer.from([1]),
    });
    const borrowIx = new TransactionInstruction({
      programId: PublicKey.unique(),
      keys: [],
      data: Buffer.from([2]),
    });

    function clientWithJupiterBits(protocolsBitmask: number) {
      const client = new PriceClient(
        {
          vaultPda: VAULT,
          statePda: STATE,
          protocolProgram: { programId: protocol },
          extKaminoProgram: { programId: extKamino },
          extBridgeProgram: { programId: extBridge },
          extEpiProgram: { programId: extEpi },
          extLoopscaleProgram: { programId: extLoopscale },
          extMarginfiProgram: { programId: extMarginfi },
          extNeutralProgram: { programId: extNeutral },
          extPhoenixProgram: { programId: extPhoenix },
          extRpiProgram: { programId: extRpi },
          extJupiterProgram: { programId: extJupiter },
          fetchStateModel: jest.fn(async () => ({
            accountType: StateAccountType.VAULT,
            baseAssetMint: PublicKey.default,
            baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
            externalPositions: [PublicKey.unique()],
            integrationAcls: [
              {
                integrationProgram: extJupiter,
                protocolsBitmask,
              },
            ],
          })),
          fetchAssetMetas: jest.fn(async () => new Map()),
        } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        (() => undefined) as any,
      );
      jest
        .spyOn(client, "priceVaultTokensIx")
        .mockResolvedValue({ ixs: [], kaminoReserves: [] });
      const earnSpy = jest
        .spyOn(client, "priceJupiterEarnPositionsIxs")
        .mockResolvedValue({ ixs: [earnIx], kaminoReserves: [] });
      const borrowSpy = jest
        .spyOn(client, "priceJupiterBorrowPositionsIxs")
        .mockResolvedValue({ ixs: [borrowIx], kaminoReserves: [] });
      return { client, earnSpy, borrowSpy };
    }

    const earnOnly = clientWithJupiterBits(JUPITER_EARN_PROTOCOL);
    await expect(earnOnly.client.priceVaultIxs()).resolves.toEqual([earnIx]);
    expect(earnOnly.earnSpy).toHaveBeenCalledTimes(1);
    expect(earnOnly.borrowSpy).not.toHaveBeenCalled();

    const borrowOnly = clientWithJupiterBits(JUPITER_BORROW_PROTOCOL);
    await expect(borrowOnly.client.priceVaultIxs()).resolves.toEqual([
      borrowIx,
    ]);
    expect(borrowOnly.earnSpy).not.toHaveBeenCalled();
    expect(borrowOnly.borrowSpy).toHaveBeenCalledTimes(1);

    const neither = clientWithJupiterBits(0);
    await expect(neither.client.priceVaultIxs()).resolves.toEqual([]);
    expect(neither.earnSpy).not.toHaveBeenCalled();
    expect(neither.borrowSpy).not.toHaveBeenCalled();
  });
});

/**
 * ext_jupiter's pricers pass the SOL/USD and base asset oracles as named
 * accounts, and a stale Kamino reserve among them is refused. The chunk
 * reports every reserve it reads so the batch refresh ahead of it covers them.
 */
describe("Jupiter pricing Kamino reserve reporting", () => {
  const SOL_RESERVE = PublicKey.unique();
  const BASE_RESERVE = PublicKey.unique();
  const KAMINO_ROLES = { sol: KAMINO(SOL_RESERVE), base: KAMINO(BASE_RESERVE) };

  it("reports the SOL, base asset and Earn position reserves once each", async () => {
    const earnReserve = PublicKey.unique();
    const { client } = jupiterEarnFixture(KAMINO_ROLES, KAMINO(earnReserve));

    const chunk = await client.priceJupiterEarnPositionsIxs();

    expectSameReserves(chunk.kaminoReserves, [
      SOL_RESERVE,
      BASE_RESERVE,
      earnReserve,
    ]);
    expect(chunk.ixs[1].keys.slice(0, 7)).toEqual(
      extPricerNamedKeys(EXT_JUPITER, SOL_RESERVE, BASE_RESERVE),
    );
  });

  it("reports the SOL, base asset, supply and borrow reserves once each", async () => {
    const supplyReserve = PublicKey.unique();
    const borrowReserve = PublicKey.unique();
    const { client } = jupiterBorrowFixture(
      KAMINO_ROLES,
      KAMINO(supplyReserve),
      KAMINO(borrowReserve),
    );

    const chunk = await client.priceJupiterBorrowPositionsIxs();

    expectSameReserves(chunk.kaminoReserves, [
      SOL_RESERVE,
      BASE_RESERVE,
      supplyReserve,
      borrowReserve,
    ]);
    expect(chunk.ixs[1].keys.slice(0, 7)).toEqual(
      extPricerNamedKeys(EXT_JUPITER, SOL_RESERVE, BASE_RESERVE),
    );
  });

  it("reports no reserve for a Pyth sourced base asset", async () => {
    const earnReserve = PublicKey.unique();
    const { client } = jupiterEarnFixture(
      { sol: KAMINO(SOL_RESERVE), base: PYTH(BASE_ORACLE) },
      KAMINO(earnReserve),
    );

    const chunk = await client.priceJupiterEarnPositionsIxs();

    expectSameReserves(chunk.kaminoReserves, [SOL_RESERVE, earnReserve]);
  });
});
