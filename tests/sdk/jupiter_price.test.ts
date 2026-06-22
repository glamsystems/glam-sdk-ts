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
} from "../../src/constants";
import { StateAccountType } from "../../src/models";
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
const PRICE_IX = new TransactionInstruction({
  programId: PublicKey.unique(),
  keys: [],
  data: Buffer.from([9]),
});

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

function methodBuilder(instruction: TransactionInstruction) {
  const builder = {
    accounts: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(async () => instruction),
  };
  return builder;
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
    const fTokenAta = PublicKey.unique();
    const fTokenMint = PublicKey.unique();
    const underlyingMint = PublicKey.unique();
    const lending = PublicKey.unique();
    const reserve = PublicKey.unique();
    const underlyingOracle = PublicKey.unique();
    const priceBuilder = methodBuilder(PRICE_IX);

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
          externalPositions: [fTokenAta],
        })),
        getAssetMeta: jest.fn(async () => ({
          asset: underlyingMint,
          oracle: underlyingOracle,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
          decimals: 6,
        })),
        getSolOracle: jest.fn(async () => SOL_ORACLE),
        mintProgram: {
          methods: {
            priceJupiterEarnPositions: jest.fn(() => priceBuilder),
          },
        },
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
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(BASE_ORACLE);

    const chunk = await client.priceJupiterEarnPositionsIxs();

    expect(chunk.ixs).toHaveLength(2);
    expect(chunk.ixs[0].programId.equals(JUPITER_LENDING_PROGRAM_ID)).toBe(
      true,
    );
    expect(chunk.ixs[0].data.equals(UPDATE_RATE_DISCRIMINATOR)).toBe(true);
    expect(chunk.ixs[1]).toBe(PRICE_IX);
    expect(priceBuilder.accounts).toHaveBeenCalledWith({
      glamState: STATE,
      solUsdOracle: SOL_ORACLE,
      baseAssetOracle: BASE_ORACLE,
    });
    expect(priceBuilder.remainingAccounts).toHaveBeenCalledWith([
      { pubkey: fTokenAta, isSigner: false, isWritable: false },
      { pubkey: lending, isSigner: false, isWritable: false },
      { pubkey: underlyingOracle, isSigner: false, isWritable: false },
    ]);
  });

  it("prepends update_exchange_prices before Jupiter Borrow pricing", async () => {
    const vaultId = 11;
    const nftId = 7;
    const position = getPositionPda(vaultId, nftId);
    const positionMint = getPositionMintPda(vaultId, nftId);
    const positionTokenAccount = PublicKey.unique();
    const supplyToken = PublicKey.unique();
    const borrowToken = PublicKey.unique();
    const supplyReserve = PublicKey.unique();
    const borrowReserve = PublicKey.unique();
    const supplyOracle = PublicKey.unique();
    const borrowOracle = PublicKey.unique();
    const vaultConfig = getVaultConfigPda(vaultId);
    const supplyLending = getLendingPda(
      supplyToken,
      getFTokenMintPda(supplyToken),
    );
    const borrowLending = getLendingPda(
      borrowToken,
      getFTokenMintPda(borrowToken),
    );
    const priceBuilder = methodBuilder(PRICE_IX);

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
        accountInfo(
          JUPITER_LIQUIDITY_PROGRAM_ID,
          tokenReserveData(supplyToken),
        ),
      ],
      [
        borrowReserve.toBase58(),
        accountInfo(
          JUPITER_LIQUIDITY_PROGRAM_ID,
          tokenReserveData(borrowToken),
        ),
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
            accountInfo(
              TOKEN_PROGRAM_ID,
              tokenAccountData(positionMint, VAULT),
            ),
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
          externalPositions: [position],
        })),
        getAssetMeta: jest.fn(async (mint: PublicKey) => ({
          asset: mint,
          oracle: mint.equals(supplyToken) ? supplyOracle : borrowOracle,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
          decimals: 6,
        })),
        getSolOracle: jest.fn(async () => SOL_ORACLE),
        mintProgram: {
          methods: {
            priceJupiterBorrowPositions: jest.fn(() => priceBuilder),
          },
        },
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
    jest.spyOn(client, "getBaseAssetOracle").mockResolvedValue(BASE_ORACLE);

    const chunk = await client.priceJupiterBorrowPositionsIxs();

    expect(chunk.ixs).toHaveLength(2);
    expect(chunk.ixs[0].programId.equals(JUPITER_VAULTS_PROGRAM_ID)).toBe(true);
    expect(
      chunk.ixs[0].data
        .subarray(0, 8)
        .equals(UPDATE_EXCHANGE_PRICES_DISCRIMINATOR),
    ).toBe(true);
    expect(chunk.ixs[1]).toBe(PRICE_IX);
    expect(priceBuilder.remainingAccounts.mock.calls[0][0]).toEqual([
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
