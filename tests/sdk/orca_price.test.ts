import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  deriveTickArrayForPosition,
  OrcaClient,
  parseOrcaPosition,
  parseOrcaWhirlpool,
} from "../../src/client/orca";
import {
  ORCA_POSITION_DISCRIMINATOR,
  ORCA_TICK_ARRAY_DISCRIMINATOR,
  ORCA_WHIRLPOOL_DISCRIMINATOR,
  ORCA_WHIRLPOOLS_PROGRAM_ID,
} from "../../src/constants";
import { PkMap, PositionCategorizer } from "../../src/utils";

const VAULT = new PublicKey("31xmCqzfdYT4GHjo39BQiTHVPjpugw6JqXNwckVL9cEf");
const POSITION = PublicKey.unique();
const POSITION_MINT = PublicKey.unique();
const WHIRLPOOL = PublicKey.unique();
const TOKEN_MINT_A = PublicKey.unique();
const TOKEN_MINT_B = PublicKey.unique();
const REWARD_MINT = PublicKey.unique();
const ORACLE_A = PublicKey.unique();
const ORACLE_B = PublicKey.unique();
const REWARD_ORACLE = PublicKey.unique();

const PUBKEY_LEN = 32;
const NUM_REWARDS = 3;
const POSITION_WHIRLPOOL_OFFSET = 8;
const POSITION_MINT_OFFSET = 40;
const POSITION_LIQUIDITY_OFFSET = 72;
const POSITION_TICK_LOWER_INDEX_OFFSET = 88;
const POSITION_TICK_UPPER_INDEX_OFFSET = 92;
const POSITION_REWARD_INFOS_OFFSET = 144;
const POSITION_REWARD_INFO_SIZE = 24;
const POSITION_REWARD_GROWTH_INSIDE_CHECKPOINT_OFFSET = 0;
const POSITION_REWARD_AMOUNT_OWED_OFFSET = 16;
const WHIRLPOOL_TICK_SPACING_OFFSET = 41;
const WHIRLPOOL_LIQUIDITY_OFFSET = 49;
const WHIRLPOOL_TICK_CURRENT_INDEX_OFFSET = 81;
const WHIRLPOOL_TOKEN_MINT_A_OFFSET = 101;
const WHIRLPOOL_TOKEN_MINT_B_OFFSET = 181;
const WHIRLPOOL_REWARD_LAST_UPDATED_TIMESTAMP_OFFSET = 261;
const WHIRLPOOL_REWARD_INFOS_OFFSET = 269;
const WHIRLPOOL_REWARD_INFO_SIZE = 128;
const WHIRLPOOL_REWARD_MINT_OFFSET = 0;
const WHIRLPOOL_REWARD_EMISSIONS_PER_SECOND_X64_OFFSET = 96;
const WHIRLPOOL_REWARD_GROWTH_GLOBAL_X64_OFFSET = 112;
const TICK_ARRAY_SIZE = 88;
const TICK_ARRAY_START_TICK_INDEX_OFFSET = 8;
const TICK_ARRAY_TICKS_OFFSET = 12;
const TICK_SIZE = 113;
const TICK_ARRAY_WHIRLPOOL_OFFSET =
  TICK_ARRAY_TICKS_OFFSET + TICK_SIZE * TICK_ARRAY_SIZE;
const TICK_INITIALIZED_OFFSET = 0;

function accountInfo(owner: PublicKey, data: Buffer = Buffer.alloc(0)) {
  return {
    data,
    executable: false,
    lamports: 0,
    owner,
    rentEpoch: 0,
  };
}

function writeDiscriminator(data: Buffer, discriminator: readonly number[]) {
  discriminator.forEach((byte, i) => {
    data[i] = byte;
  });
}

function writePubkey(data: Buffer, offset: number, pubkey: PublicKey) {
  pubkey.toBuffer().copy(data, offset, 0, PUBKEY_LEN);
}

function orcaPositionData({
  whirlpool = WHIRLPOOL,
  positionMint = POSITION_MINT,
  liquidity = 1n,
  tickLowerIndex = -90,
  tickUpperIndex = 175,
  rewardGrowthInsideCheckpoint = 0n,
  rewardAmountOwed = 3n,
} = {}) {
  const data = Buffer.alloc(
    POSITION_REWARD_INFOS_OFFSET + POSITION_REWARD_INFO_SIZE * NUM_REWARDS,
  );
  writeDiscriminator(data, ORCA_POSITION_DISCRIMINATOR);
  writePubkey(data, POSITION_WHIRLPOOL_OFFSET, whirlpool);
  writePubkey(data, POSITION_MINT_OFFSET, positionMint);
  data.writeBigUInt64LE(liquidity, POSITION_LIQUIDITY_OFFSET);
  data.writeInt32LE(tickLowerIndex, POSITION_TICK_LOWER_INDEX_OFFSET);
  data.writeInt32LE(tickUpperIndex, POSITION_TICK_UPPER_INDEX_OFFSET);
  data.writeBigUInt64LE(
    rewardGrowthInsideCheckpoint,
    POSITION_REWARD_INFOS_OFFSET +
      POSITION_REWARD_GROWTH_INSIDE_CHECKPOINT_OFFSET,
  );
  data.writeBigUInt64LE(
    rewardAmountOwed,
    POSITION_REWARD_INFOS_OFFSET + POSITION_REWARD_AMOUNT_OWED_OFFSET,
  );
  return data;
}

function orcaWhirlpoolData({
  tokenMintA = TOKEN_MINT_A,
  tokenMintB = TOKEN_MINT_B,
  rewardMint = REWARD_MINT,
  tickSpacing = 5,
  liquidity = 10n,
  tickCurrentIndex = 0,
  rewardLastUpdatedTimestamp = BigInt(Math.floor(Date.now() / 1000)),
  rewardGrowthGlobalX64 = 0n,
} = {}) {
  const data = Buffer.alloc(
    WHIRLPOOL_REWARD_INFOS_OFFSET + WHIRLPOOL_REWARD_INFO_SIZE * NUM_REWARDS,
  );
  writeDiscriminator(data, ORCA_WHIRLPOOL_DISCRIMINATOR);
  data.writeUInt16LE(tickSpacing, WHIRLPOOL_TICK_SPACING_OFFSET);
  data.writeBigUInt64LE(liquidity, WHIRLPOOL_LIQUIDITY_OFFSET);
  data.writeInt32LE(tickCurrentIndex, WHIRLPOOL_TICK_CURRENT_INDEX_OFFSET);
  writePubkey(data, WHIRLPOOL_TOKEN_MINT_A_OFFSET, tokenMintA);
  writePubkey(data, WHIRLPOOL_TOKEN_MINT_B_OFFSET, tokenMintB);
  data.writeBigUInt64LE(
    rewardLastUpdatedTimestamp,
    WHIRLPOOL_REWARD_LAST_UPDATED_TIMESTAMP_OFFSET,
  );
  writePubkey(
    data,
    WHIRLPOOL_REWARD_INFOS_OFFSET + WHIRLPOOL_REWARD_MINT_OFFSET,
    rewardMint,
  );
  data.writeBigUInt64LE(
    7n,
    WHIRLPOOL_REWARD_INFOS_OFFSET +
      WHIRLPOOL_REWARD_EMISSIONS_PER_SECOND_X64_OFFSET,
  );
  data.writeBigUInt64LE(
    rewardGrowthGlobalX64,
    WHIRLPOOL_REWARD_INFOS_OFFSET + WHIRLPOOL_REWARD_GROWTH_GLOBAL_X64_OFFSET,
  );
  return data;
}

function orcaTickArrayData({
  whirlpool = WHIRLPOOL,
  startTickIndex,
  tickIndex,
  tickSpacing = 5,
}: {
  whirlpool?: PublicKey;
  startTickIndex: number;
  tickIndex: number;
  tickSpacing?: number;
}) {
  const data = Buffer.alloc(TICK_ARRAY_WHIRLPOOL_OFFSET + PUBKEY_LEN);
  writeDiscriminator(data, ORCA_TICK_ARRAY_DISCRIMINATOR);
  data.writeInt32LE(startTickIndex, TICK_ARRAY_START_TICK_INDEX_OFFSET);
  writePubkey(data, TICK_ARRAY_WHIRLPOOL_OFFSET, whirlpool);

  const offset = (tickIndex - startTickIndex) / tickSpacing;
  data[TICK_ARRAY_TICKS_OFFSET + TICK_SIZE * offset + TICK_INITIALIZED_OFFSET] =
    1;
  return data;
}

function expectPubkeys(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58())).toEqual(
    expected.map((pubkey) => pubkey.toBase58()),
  );
}

describe("Orca Whirlpool pricing SDK helpers", () => {
  it("parses Orca position and Whirlpool accounts from fixed offsets", () => {
    const position = parseOrcaPosition(orcaPositionData());
    const whirlpool = parseOrcaWhirlpool(orcaWhirlpoolData());

    expect(position.whirlpool.equals(WHIRLPOOL)).toBe(true);
    expect(position.positionMint.equals(POSITION_MINT)).toBe(true);
    expect(position.liquidity).toBe(1n);
    expect(position.tickLowerIndex).toBe(-90);
    expect(position.tickUpperIndex).toBe(175);
    expect(position.rewardInfos[0].amountOwed).toBe(3n);
    expect(position.rewardAmountsOwed[0]).toBe(3n);
    expect(whirlpool.tokenMintA.equals(TOKEN_MINT_A)).toBe(true);
    expect(whirlpool.tokenMintB.equals(TOKEN_MINT_B)).toBe(true);
    expect(whirlpool.tickSpacing).toBe(5);
    expect(whirlpool.liquidity).toBe(10n);
    expect(whirlpool.tickCurrentIndex).toBe(0);
    expect(whirlpool.rewardInfos[0].mint.equals(REWARD_MINT)).toBe(true);
    expect(whirlpool.rewardInfos[0].emissionsPerSecondX64).toBe(7n);
  });

  it("categorizes Orca position accounts by owner and discriminator", async () => {
    const tokenAccount = PublicKey.unique();
    const unknown = PublicKey.unique();
    const categorizer = new PositionCategorizer({
      getMultipleAccountsInfo: jest.fn(async () => [
        accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, orcaPositionData()),
        accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, Buffer.alloc(216)),
        accountInfo(TOKEN_2022_PROGRAM_ID),
        null,
      ]),
    } as any);

    const result = await categorizer.categorizePositions(
      [POSITION, unknown, tokenAccount, PublicKey.unique()],
      "confirmed",
    );

    expectPubkeys(result.orcaWhirlpoolPositions, [POSITION]);
    expectPubkeys(result.kaminoVaultShareAtas, [tokenAccount]);
    expect(result.unknown).toHaveLength(2);
  });

  it("builds Orca pricing remaining accounts with tick arrays and token oracles", async () => {
    const assetMetas = new PkMap([
      [
        TOKEN_MINT_A,
        {
          asset: TOKEN_MINT_A,
          oracle: ORACLE_A,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
        },
      ],
      [
        TOKEN_MINT_B,
        {
          asset: TOKEN_MINT_B,
          oracle: ORACLE_B,
          oracleSource: "KaminoReserve",
          programId: TOKEN_PROGRAM_ID,
        },
      ],
      [
        REWARD_MINT,
        {
          asset: REWARD_MINT,
          oracle: REWARD_ORACLE,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
        },
      ],
    ]);
    const getMultipleAccountsInfo = jest
      .fn()
      .mockResolvedValueOnce([
        accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, orcaPositionData()),
      ])
      .mockResolvedValueOnce([
        accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, orcaWhirlpoolData()),
      ])
      .mockResolvedValueOnce([
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaTickArrayData({
            startTickIndex: -440,
            tickIndex: -90,
          }),
        ),
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaTickArrayData({
            startTickIndex: 0,
            tickIndex: 175,
          }),
        ),
      ]);
    const orca = new OrcaClient({
      vaultPda: VAULT,
      connection: { getMultipleAccountsInfo },
      fetchAssetMetas: jest.fn(async () => assetMetas),
    } as any);

    const accounts = await orca.remainingAccountsForPricingWhirlpoolPositions([
      POSITION,
    ]);

    const tickArrayLower = deriveTickArrayForPosition(WHIRLPOOL, -90, 5);
    const tickArrayUpper = deriveTickArrayForPosition(WHIRLPOOL, 175, 5);
    expect(accounts?.numPositions).toBe(1);
    expectPubkeys(
      accounts?.remainingAccounts.map(({ pubkey }) => pubkey) || [],
      [
        POSITION,
        orca.getPositionTokenAta(POSITION_MINT),
        WHIRLPOOL,
        tickArrayLower,
        tickArrayUpper,
        TOKEN_MINT_A,
        ORACLE_A,
        TOKEN_MINT_B,
        ORACLE_B,
        REWARD_MINT,
        REWARD_ORACLE,
      ],
    );
    expectPubkeys(accounts?.kaminoReserves || [], [ORACLE_B]);
  });

  it("omits initialized Orca reward mints when the reward has no value", async () => {
    const assetMetas = new PkMap([
      [
        TOKEN_MINT_A,
        {
          asset: TOKEN_MINT_A,
          oracle: ORACLE_A,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
        },
      ],
      [
        TOKEN_MINT_B,
        {
          asset: TOKEN_MINT_B,
          oracle: ORACLE_B,
          oracleSource: "Pyth",
          programId: TOKEN_PROGRAM_ID,
        },
      ],
    ]);
    const getMultipleAccountsInfo = jest
      .fn()
      .mockResolvedValueOnce([
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaPositionData({ liquidity: 0n, rewardAmountOwed: 0n }),
        ),
      ])
      .mockResolvedValueOnce([
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaWhirlpoolData({ rewardLastUpdatedTimestamp: 0n }),
        ),
      ])
      .mockResolvedValueOnce([
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaTickArrayData({
            startTickIndex: -440,
            tickIndex: -90,
          }),
        ),
        accountInfo(
          ORCA_WHIRLPOOLS_PROGRAM_ID,
          orcaTickArrayData({
            startTickIndex: 0,
            tickIndex: 175,
          }),
        ),
      ]);
    const orca = new OrcaClient({
      vaultPda: VAULT,
      connection: { getMultipleAccountsInfo },
      fetchAssetMetas: jest.fn(async () => assetMetas),
    } as any);

    const accounts = await orca.remainingAccountsForPricingWhirlpoolPositions([
      POSITION,
    ]);

    expectPubkeys(
      accounts?.remainingAccounts.map(({ pubkey }) => pubkey) || [],
      [
        POSITION,
        orca.getPositionTokenAta(POSITION_MINT),
        WHIRLPOOL,
        deriveTickArrayForPosition(WHIRLPOOL, -90, 5),
        deriveTickArrayForPosition(WHIRLPOOL, 175, 5),
        TOKEN_MINT_A,
        ORACLE_A,
        TOKEN_MINT_B,
        ORACLE_B,
      ],
    );
  });

  it("rejects duplicate Orca positions before fetching account data", async () => {
    const getMultipleAccountsInfo = jest.fn();
    const orca = new OrcaClient({
      vaultPda: VAULT,
      connection: { getMultipleAccountsInfo },
      fetchAssetMetas: jest.fn(),
    } as any);

    await expect(
      orca.remainingAccountsForPricingWhirlpoolPositions([POSITION, POSITION]),
    ).rejects.toThrow("Duplicate Orca positions cannot be priced together");
    expect(getMultipleAccountsInfo).not.toHaveBeenCalled();
  });
});
