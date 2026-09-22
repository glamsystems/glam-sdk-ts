import { readFileSync } from "fs";
import * as path from "path";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PriceClient } from "../../src/client/price";
import { STAKE_POOLS_MAP } from "../../src/assets";
import {
  MARINADE_PROGRAM_ID,
  SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID,
  SANCTUM_STAKE_POOL_PROGRAM_ID,
  SPL_STAKE_POOL_PROGRAM_ID,
  USDC,
  WSOL,
} from "../../src/constants";
import { PkMap } from "../../src/utils";

const VAULT = new PublicKey("31xmCqzfdYT4GHjo39BQiTHVPjpugw6JqXNwckVL9cEf");
const STATE = new PublicKey("3XYX3QvpHQ7TqvjhZcoBBmykNDruV9PtrGXRxJFzsiCF");
const SOL_USD_ORACLE = PublicKey.unique();
const USDC_ORACLE = PublicKey.unique();
const JITOSOL = new PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
const MSOL = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
// stacSOL: a Sanctum single validator pool whose mint is a Token 2022 mint.
const STACSOL = new PublicKey("6K4xdfEk5rvySM496rxm4x8AgC9wVt7N4C7mFFpNAj5f");
// dbcSOL: a Sanctum multi validator pool.
const DBCSOL = new PublicKey("dbcMcw2pC8EDt5eiYMiMBwe35mCWK4hRpec98bKAjML");

// anchor_v1/libs/common/src/stake_pool.rs: the type tag in byte 0, pool_mint at
// 162, and 282 bytes of fixed prefix.
const STAKE_POOL_ACCOUNT_TYPE = 1;
const POOL_MINT_OFFSET = 162;
const FIXED_PREFIX_LEN = 282;
// The State account in anchor_v1/deps/gen/marinade/finance_gen/src/lib.rs.
const MARINADE_STATE_DISCRIMINATOR = [216, 146, 107, 94, 104, 75, 182, 177];
const MSOL_MINT_OFFSET = 8;

const ANCHOR_V1 = path.resolve(__dirname, "../../../anchor_v1");

function poolStateOf(mint: PublicKey): PublicKey {
  const stakePool = STAKE_POOLS_MAP.get(mint.toBase58());
  if (!stakePool) {
    throw new Error(`Test fixture is stale: ${mint} is not a known LST`);
  }
  return stakePool.poolState;
}

function b58(pubkeys: PublicKey[]): string[] {
  return pubkeys.map((pubkey) => pubkey.toBase58());
}

function ata(mint: PublicKey, tokenProgramId: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgramId);
}

function accountInfo(owner: PublicKey, data: Buffer) {
  return { data, executable: false, lamports: 0, owner, rentEpoch: 0 };
}

function stakePoolAccountInfo(
  owner: PublicKey,
  poolMint: PublicKey,
  overrides: { length?: number; accountType?: number } = {},
) {
  const data = Buffer.alloc(overrides.length ?? FIXED_PREFIX_LEN);
  data[0] = overrides.accountType ?? STAKE_POOL_ACCOUNT_TYPE;
  poolMint.toBuffer().copy(data, POOL_MINT_OFFSET);
  return accountInfo(owner, data);
}

function marinadeStateAccountInfo(
  msolMint: PublicKey,
  overrides: { discriminator?: number[] } = {},
) {
  const data = Buffer.alloc(MSOL_MINT_OFFSET + 32);
  Buffer.from(overrides.discriminator ?? MARINADE_STATE_DISCRIMINATOR).copy(
    data,
    0,
  );
  msolMint.toBuffer().copy(data, MSOL_MINT_OFFSET);
  return accountInfo(MARINADE_PROGRAM_ID, data);
}

function mintAccountInfo(tokenProgramId: PublicKey) {
  return accountInfo(tokenProgramId, Buffer.alloc(82));
}

function assetMeta(
  asset: PublicKey,
  oracle: PublicKey,
  oracleSource: string,
  programId: PublicKey = TOKEN_PROGRAM_ID,
) {
  return { asset, decimals: 9, oracle, programId, oracleSource };
}

function makeClient({
  assetsForPricing,
  assetMetas = new PkMap<any>(),
  accounts = new PkMap<any>(),
}: {
  assetsForPricing: PublicKey[];
  assetMetas?: PkMap<any>;
  accounts?: PkMap<any>;
}) {
  const getMultipleAccountsInfo = jest.fn(async (pubkeys: PublicKey[]) =>
    pubkeys.map((pubkey) => accounts.get(pubkey) ?? null),
  );
  const getVaultAta = jest.fn(
    (mint: PublicKey, tokenProgramId: PublicKey = TOKEN_PROGRAM_ID) =>
      ata(mint, tokenProgramId),
  );
  const client = new PriceClient(
    {
      vaultPda: VAULT,
      statePda: STATE,
      connection: { getMultipleAccountsInfo },
      fetchStateModel: jest.fn(async () => ({
        assetsForPricing,
        baseAssetMint: USDC,
      })),
      fetchAssetMetas: jest.fn(async () => assetMetas),
      getAssetMeta: jest.fn(async (mint: PublicKey) =>
        mint.equals(WSOL)
          ? assetMeta(WSOL, SOL_USD_ORACLE, "Pyth")
          : assetMeta(USDC, USDC_ORACLE, "Pyth"),
      ),
      getVaultAta,
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    (() => undefined) as any,
  );
  return { client, getMultipleAccountsInfo, getVaultAta };
}

async function refusalOf(client: PriceClient): Promise<Error> {
  const error = await client
    .remainingAccountsForPricingVaultAssets()
    .then(() => null)
    .catch((e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}

describe("PriceClient pricing of unregistered liquid staking tokens", () => {
  it("prices an unregistered stake pool token through its pool state", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client, getMultipleAccountsInfo } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL)],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const [accMetas, kaminoReserves] =
      await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([ata(JITOSOL, TOKEN_PROGRAM_ID), JITOSOL, poolState]),
    );
    expect(
      accMetas.every((meta: AccountMeta) => !meta.isSigner && !meta.isWritable),
    ).toBe(true);
    expect(kaminoReserves).toEqual([]);
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    expect(b58(getMultipleAccountsInfo.mock.calls[0][0])).toEqual(
      b58([poolState, JITOSOL]),
    );
  });

  it("prices mSOL through the Marinade state", async () => {
    const poolState = poolStateOf(MSOL);
    const { client, getMultipleAccountsInfo } = makeClient({
      assetsForPricing: [MSOL],
      accounts: new PkMap<any>([
        [poolState, marinadeStateAccountInfo(MSOL)],
        [MSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const [accMetas] = await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([ata(MSOL, TOKEN_PROGRAM_ID), MSOL, poolState]),
    );
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    expect(b58(getMultipleAccountsInfo.mock.calls[0][0])).toEqual(
      b58([poolState, MSOL]),
    );
  });

  it("takes the Token 2022 vault ata when the mint is a Token 2022 mint", async () => {
    const poolState = poolStateOf(STACSOL);
    const { client, getVaultAta } = makeClient({
      assetsForPricing: [STACSOL],
      accounts: new PkMap<any>([
        [
          poolState,
          stakePoolAccountInfo(SANCTUM_STAKE_POOL_PROGRAM_ID, STACSOL),
        ],
        [STACSOL, mintAccountInfo(TOKEN_2022_PROGRAM_ID)],
      ]),
    });

    const [accMetas] = await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([ata(STACSOL, TOKEN_2022_PROGRAM_ID), STACSOL, poolState]),
    );
    expect(getVaultAta).toHaveBeenCalledWith(STACSOL, TOKEN_2022_PROGRAM_ID);
  });

  it("accepts a pool state owned by the Sanctum multi validator program", async () => {
    const poolState = poolStateOf(DBCSOL);
    const { client } = makeClient({
      assetsForPricing: [DBCSOL],
      accounts: new PkMap<any>([
        [
          poolState,
          stakePoolAccountInfo(
            SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID,
            DBCSOL,
          ),
        ],
        [DBCSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const [accMetas] = await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([ata(DBCSOL, TOKEN_PROGRAM_ID), DBCSOL, poolState]),
    );
  });

  it("refuses a mint that is neither registered nor a known liquid staking token", async () => {
    const unknown = PublicKey.unique();
    const { client, getMultipleAccountsInfo } = makeClient({
      assetsForPricing: [unknown],
    });

    await expect(
      client.remainingAccountsForPricingVaultAssets(),
    ).rejects.toThrow(`Asset meta not found for ${unknown}`);
    expect(getMultipleAccountsInfo).not.toHaveBeenCalled();
  });

  it("refuses a pool state that names a different mint", async () => {
    const poolState = poolStateOf(JITOSOL);
    const otherMint = PublicKey.unique();
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, otherMint)],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(otherMint.toBase58());
  });

  it("refuses a pool state owned by another program", async () => {
    const poolState = poolStateOf(JITOSOL);
    const otherOwner = PublicKey.unique();
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(otherOwner, JITOSOL)],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(otherOwner.toBase58());
  });

  it("refuses a pool state shorter than the stake pool prefix", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [
          poolState,
          stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL, {
            length: FIXED_PREFIX_LEN - 1,
          }),
        ],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(String(FIXED_PREFIX_LEN - 1));
  });

  it("refuses a pool state account that does not exist", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([[JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)]]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain("was not found");
  });

  it("refuses a stake pool account whose type byte is not a stake pool", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [
          poolState,
          stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL, {
            accountType: STAKE_POOL_ACCOUNT_TYPE + 1,
          }),
        ],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(String(STAKE_POOL_ACCOUNT_TYPE + 1));
  });

  it("refuses a Marinade owned account without the state discriminator", async () => {
    const poolState = poolStateOf(MSOL);
    const { client } = makeClient({
      assetsForPricing: [MSOL],
      accounts: new PkMap<any>([
        [
          poolState,
          marinadeStateAccountInfo(MSOL, {
            discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
          }),
        ],
        [MSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(MSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain("discriminator");
  });

  it("refuses a Marinade state that names a different mSOL mint", async () => {
    const poolState = poolStateOf(MSOL);
    const otherMint = PublicKey.unique();
    const { client } = makeClient({
      assetsForPricing: [MSOL],
      accounts: new PkMap<any>([
        [poolState, marinadeStateAccountInfo(otherMint)],
        [MSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(MSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(otherMint.toBase58());
  });

  it("refuses a mint account that does not exist", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain("mint account was not found");
    expect(error.message).toContain(
      `Check that ${JITOSOL.toBase58()} is a token mint owned by the Token or Token 2022 program.`,
    );
  });

  it("refuses a mint account that no token program owns", async () => {
    const poolState = poolStateOf(JITOSOL);
    const otherOwner = PublicKey.unique();
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL)],
        [JITOSOL, mintAccountInfo(otherOwner)],
      ]),
    });

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain(poolState.toBase58());
    expect(error.message).toContain(otherOwner.toBase58());
    expect(error.message).toContain(
      `Check that ${JITOSOL.toBase58()} is a token mint owned by the Token or Token 2022 program.`,
    );
  });

  it("keeps a registered liquid staking token on its registration", async () => {
    const registeredOracle = PublicKey.unique();
    const { client, getMultipleAccountsInfo } = makeClient({
      assetsForPricing: [JITOSOL],
      assetMetas: new PkMap<any>([
        [JITOSOL, assetMeta(JITOSOL, registeredOracle, "LstPoolState")],
      ]),
    });

    const [accMetas] = await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([ata(JITOSOL, TOKEN_PROGRAM_ID), JITOSOL, registeredOracle]),
    );
    expect(getMultipleAccountsInfo).not.toHaveBeenCalled();
  });

  it("keeps the order of assets for pricing when only some are registered", async () => {
    const poolState = poolStateOf(JITOSOL);
    const { client, getMultipleAccountsInfo } = makeClient({
      assetsForPricing: [USDC, JITOSOL],
      assetMetas: new PkMap<any>([
        [USDC, assetMeta(USDC, USDC_ORACLE, "Pyth")],
      ]),
      accounts: new PkMap<any>([
        [poolState, stakePoolAccountInfo(SPL_STAKE_POOL_PROGRAM_ID, JITOSOL)],
        [JITOSOL, mintAccountInfo(TOKEN_PROGRAM_ID)],
      ]),
    });

    const [accMetas] = await client.remainingAccountsForPricingVaultAssets();

    expect(b58(accMetas.map((meta: AccountMeta) => meta.pubkey))).toEqual(
      b58([
        ata(USDC, TOKEN_PROGRAM_ID),
        USDC,
        USDC_ORACLE,
        ata(JITOSOL, TOKEN_PROGRAM_ID),
        JITOSOL,
        poolState,
      ]),
    );
    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    expect(b58(getMultipleAccountsInfo.mock.calls[0][0])).toEqual(
      b58([poolState, JITOSOL]),
    );
  });

  it("refuses a mint the pool state lookup did not resolve, instead of throwing a TypeError", async () => {
    const { client } = makeClient({
      assetsForPricing: [JITOSOL],
    });
    // The filter at the call site selected JITOSOL because it has no asset meta, so the
    // lookup below would normally resolve it too. Forcing it to come back empty stands in
    // for a future mismatch between the two without touching the filter itself.
    jest
      .spyOn(client as any, "lstPoolStateOracles")
      .mockResolvedValue(new PkMap<{ ata: PublicKey; poolState: PublicKey }>());

    const error = await refusalOf(client);

    expect(error.message).toContain(JITOSOL.toBase58());
    expect(error.message).toContain("pool state lookup did not resolve");
  });

  it("carries the same program ids the program accepts as pool state owners", () => {
    const rustPubkey = (source: string, declaration: RegExp) => {
      const match = readFileSync(source, "utf-8").match(declaration);
      if (!match) {
        throw new Error(`${declaration} not found in ${source}`);
      }
      return match[1];
    };
    const rustNumber = (source: string, declaration: RegExp) => {
      const match = readFileSync(source, "utf-8").match(declaration);
      if (!match) {
        throw new Error(`${declaration} not found in ${source}`);
      }
      return Number(match[1]);
    };
    const commonConstants = path.join(
      ANCHOR_V1,
      "libs/common/src/constants.rs",
    );
    const stakePoolRs = path.join(ANCHOR_V1, "libs/common/src/stake_pool.rs");

    const sanctumSingle = rustPubkey(
      commonConstants,
      /SANCTUM_SINGLE_VALIDATOR: Pubkey = pubkey!\("([1-9A-HJ-NP-Za-km-z]+)"\)/,
    );
    const sanctumMulti = rustPubkey(
      commonConstants,
      /SANCTUM_MULTI_VALIDATOR: Pubkey = pubkey!\("([1-9A-HJ-NP-Za-km-z]+)"\)/,
    );
    const splStakePool = rustPubkey(
      path.join(ANCHOR_V1, "deps/abi_locks/src/spl_stake_pool.rs"),
      /PROGRAM: &str = "([1-9A-HJ-NP-Za-km-z]+)"/,
    );

    expect(SANCTUM_STAKE_POOL_PROGRAM_ID.toBase58()).toEqual(sanctumSingle);
    expect(SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID.toBase58()).toEqual(
      sanctumMulti,
    );
    expect(SPL_STAKE_POOL_PROGRAM_ID.toBase58()).toEqual(splStakePool);
    expect(MARINADE_PROGRAM_ID.toBase58()).toEqual(
      rustPubkey(
        path.join(ANCHOR_V1, "deps/gen/marinade/finance_gen/src/lib.rs"),
        /declare_id!\("([1-9A-HJ-NP-Za-km-z]+)"\)/,
      ),
    );

    // StakePoolProgramInterface::ids() in anchor_v1/libs/common/src/interfaces.rs: the
    // owner set glam_protocol's validate_oracle accepts for a stake pool account. price.ts's
    // STAKE_POOL_PROGRAM_IDS (SANCTUM_STAKE_POOL_PROGRAM_ID,
    // SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID, SPL_STAKE_POOL_PROGRAM_ID) must carry
    // the same set, by value and by count; the SDK's order need not match the Rust order.
    const idsBody = readFileSync(
      path.join(ANCHOR_V1, "libs/common/src/interfaces.rs"),
      "utf-8",
    ).match(/fn ids\(\) -> &'static \[Pubkey\] \{\s*&\[([^\]]+)\]/);
    if (!idsBody) {
      throw new Error("StakePoolProgramInterface::ids() not found");
    }
    const idsNames = idsBody[1]
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const nameToValue: Record<string, string> = {
      SANCTUM_SINGLE_VALIDATOR: sanctumSingle,
      SANCTUM_MULTI_VALIDATOR: sanctumMulti,
      SPL_STAKE_POOL: splStakePool,
    };
    const resolvedIds = idsNames.map((name) => {
      const value = nameToValue[name];
      if (!value) {
        throw new Error(`ids() names ${name}, which this test cannot resolve`);
      }
      return value;
    });
    const sdkOwnerIds = [
      SANCTUM_STAKE_POOL_PROGRAM_ID.toBase58(),
      SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID.toBase58(),
      SPL_STAKE_POOL_PROGRAM_ID.toBase58(),
    ];
    expect(resolvedIds.length).toEqual(sdkOwnerIds.length);
    expect(new Set(resolvedIds)).toEqual(new Set(sdkOwnerIds));

    // price.ts's STAKE_POOL_ACCOUNT_TYPE, STAKE_POOL_POOL_MINT_OFFSET, and
    // STAKE_POOL_FIXED_PREFIX_LEN carry these three, and this file's own
    // STAKE_POOL_ACCOUNT_TYPE, POOL_MINT_OFFSET, and FIXED_PREFIX_LEN (used to build the
    // fixtures above) carry them too.
    expect(STAKE_POOL_ACCOUNT_TYPE).toEqual(
      rustNumber(stakePoolRs, /ACCOUNT_TYPE_STAKE_POOL: u8 = (\d+);/),
    );
    expect(POOL_MINT_OFFSET).toEqual(
      rustNumber(commonConstants, /POOL_MINT_OFFSET: usize = (\d+);/),
    );
    expect(FIXED_PREFIX_LEN).toEqual(
      rustNumber(stakePoolRs, /FIXED_PREFIX_LEN: usize = (\d+);/),
    );
  });
});
