import { BN } from "@coral-xyz/anchor";
import {
  AccountMeta,
  AddressLookupTableAccount,
  Connection,
  PublicKey,
} from "@solana/web3.js";

import {
  JUPITER_LENDING_PROGRAM_ID,
  JUPITER_LIQUIDITY_PROGRAM_ID,
  JUPITER_ORACLE_PROGRAM_ID,
  JUPITER_VAULTS_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
} from "../../constants";
import { findGlamLookupTables } from "../../utils/accounts";
import { fetchAddressLookupTableAccounts } from "../../utils/lookupTables";
import { getProgramAccounts } from "../../utils/rpc";

export const JUPITER_EARN_PROTOCOL = 1 << 0;
export const JUPITER_BORROW_PROTOCOL = 1 << 1;

export type JupiterTransferType =
  | { skip: Record<string, never> }
  | { direct: Record<string, never> }
  | { claim: Record<string, never> };

export const PUBKEY_BYTES = 32;
export const U64_MAX = new BN("18446744073709551615");

// Account discriminators for Jupiter Lending/Liquidity/Vaults/Oracle programs.
export const LENDING_DISCRIMINATOR = Buffer.from([
  135, 199, 82, 16, 249, 131, 182, 241,
]);
export const TOKEN_RESERVE_DISCRIMINATOR = Buffer.from([
  21, 18, 59, 135, 120, 20, 31, 12,
]);
export const VAULT_STATE_DISCRIMINATOR = Buffer.from([
  228, 196, 82, 165, 98, 210, 235, 152,
]);
export const VAULT_CONFIG_DISCRIMINATOR = Buffer.from([
  99, 86, 43, 216, 184, 102, 119, 77,
]);
export const VAULT_METADATA_DISCRIMINATOR = Buffer.from([
  248, 177, 244, 93, 67, 19, 117, 57,
]);
export const POSITION_DISCRIMINATOR = Buffer.from([
  170, 188, 143, 228, 122, 64, 247, 208,
]);
export const ORACLE_DISCRIMINATOR = Buffer.from([
  139, 194, 131, 179, 140, 179, 229, 244,
]);
export const TICK_DISCRIMINATOR = Buffer.from([
  176, 94, 67, 247, 133, 173, 7, 115,
]);
export const TICK_ID_LIQUIDATION_DISCRIMINATOR = Buffer.from([
  41, 28, 190, 197, 68, 213, 31, 181,
]);
export const LIQUIDITY_SUPPLY_POSITION_DISCRIMINATOR = Buffer.from([
  202, 219, 136, 118, 61, 177, 21, 146,
]);
export const LIQUIDITY_BORROW_POSITION_DISCRIMINATOR = Buffer.from([
  73, 126, 65, 123, 220, 126, 197, 24,
]);

// `Lending` (Anchor) layout: discriminator(8) + mint(32) + f_token_mint(32) +
//   lending_id(2) + decimals(1) + rewards_rate_model(32) + liquidity_exchange_price(8) +
//   token_exchange_price(8) + last_update_timestamp(8) + token_reserves_liquidity(32) +
//   supply_position_on_liquidity(32) + bump(1) = 196 bytes.
export const LENDING_REWARDS_RATE_MODEL_OFFSET = 8 + 32 + 32 + 2 + 1;
export const LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET =
  8 + 32 + 32 + 2 + 1 + 32 + 8 + 8 + 8;
export const LENDING_SUPPLY_POSITION_OFFSET =
  LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET + 32;

// `TokenReserve` (bytemuck repr(C, packed)): discriminator(8) + mint(32) + vault(32) ...
export const TOKEN_RESERVE_VAULT_OFFSET = 8 + 32;

// `VaultConfig` (bytemuck): discriminator(8) + vault_id(2) + supply_rate_magnifier(2) +
//   borrow_rate_magnifier(2) + collateral_factor(2) + liquidation_threshold(2) +
//   liquidation_max_limit(2) + withdraw_gap(2) + liquidation_penalty(2) + borrow_fee(2) +
//   oracle(32) + rebalancer(32) + liquidity_program(32) + oracle_program(32) +
//   supply_token(32) + borrow_token(32) + bump(1).
export const VAULT_CONFIG_ORACLE_OFFSET = 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2;
export const VAULT_CONFIG_SUPPLY_TOKEN_OFFSET =
  VAULT_CONFIG_ORACLE_OFFSET + 32 + 32 + 32 + 32;
export const VAULT_CONFIG_BORROW_TOKEN_OFFSET =
  VAULT_CONFIG_SUPPLY_TOKEN_OFFSET + 32;
export const VAULT_METADATA_LOOKUP_TABLE_OFFSET = 8 + 2;

// `VaultState` (borsh): discriminator(8) + vault_id(2) + branch_liquidated(1) +
//   topmost_tick(4) + current_branch_id(4) + total_branch_id(4) + total_supply(8) +
//   total_borrow(8) + total_positions(4) + absorbed_debt_amount(16) + absorbed_col_amount(16) +
//   absorbed_dust_debt(8) + liquidity_supply_exchange_price(8) + liquidity_borrow_exchange_price(8) +
//   vault_supply_exchange_price(8) + vault_borrow_exchange_price(8) + next_position_id(4) +
//   last_update_timestamp(8).
export const VAULT_STATE_VAULT_ID_OFFSET = 8;
export const VAULT_STATE_CURRENT_BRANCH_ID_OFFSET = 8 + 2 + 1 + 4;
export const VAULT_STATE_NEXT_POSITION_ID_OFFSET =
  8 + 2 + 1 + 4 + 4 + 4 + 8 + 8 + 4 + 16 + 16 + 8 + 8 + 8 + 8 + 8;

// `Position` (borsh): discriminator(8) + vault_id(2) + nft_id(4) + position_mint(32) + ...
export const POSITION_VAULT_ID_OFFSET = 8;
export const POSITION_MINT_OFFSET = 8 + 2 + 4;
export const POSITION_IS_SUPPLY_ONLY_OFFSET =
  POSITION_MINT_OFFSET + PUBKEY_BYTES;
export const POSITION_TICK_OFFSET = POSITION_IS_SUPPLY_ONLY_OFFSET + 1;
export const POSITION_TICK_ID_OFFSET = POSITION_TICK_OFFSET + 4;

// Jupiter Vaults remaining-account layout for `operate`:
//   <oracle sources> <branch accounts (unused here)> <tick_has_debt arrays>.
export const ORACLE_SOURCE_BYTES = PUBKEY_BYTES + 1 + 16 + 16 + 1;
export const TICK_VALUE_OFFSET = 8 + 2;
export const TICK_TOTAL_IDS_OFFSET = TICK_VALUE_OFFSET + 4 + 1;
export const TICK_ID_VALUE_OFFSET = 8 + 2;
export const TICK_ID_MAP_OFFSET = TICK_ID_VALUE_OFFSET + 4;
export const MIN_TICK = -16383;
export const TICKS_PER_TICK_HAS_DEBT_ARRAY = 2048;
export const LIQUIDITY_POSITION_VAULT_CONFIG_OFFSET = 8;
export const LIQUIDITY_POSITION_MINT_OFFSET =
  LIQUIDITY_POSITION_VAULT_CONFIG_OFFSET + PUBKEY_BYTES;
export const LIQUIDITY_SUPPLY_POSITION_SIZE = 124;
export const LIQUIDITY_BORROW_POSITION_SIZE = 120;
export const BORROW_OPERATE_EXPECTED_TICK_RE =
  /Tick mismatch: expected (-?\d+) but got (-?\d+)/;

export type JupiterPosition = {
  pubkey: PublicKey;
  vaultId: number;
  positionMint: PublicKey;
  isSupplyOnlyPosition: boolean;
  tick: number;
  tickId: number;
};

export type JupiterVault = {
  vaultId: number;
  vaultConfig: PublicKey;
  vaultState: PublicKey;
  oracle: PublicKey;
  supplyToken: PublicKey;
  borrowToken: PublicKey;
};

export type VaultStateInfo = {
  vaultId: number;
  currentBranchId: number;
  nextPositionId: number;
};

export type TickInfo = {
  pubkey: PublicKey;
  tick: number;
  totalIds: number;
};

export type BorrowOperateRemainingAccounts = {
  indices: Buffer;
  accounts: AccountMeta[];
};

export function decodePositionInfo(
  pubkey: PublicKey,
  data: Buffer,
): JupiterPosition {
  return {
    pubkey,
    vaultId: data.readUInt16LE(POSITION_VAULT_ID_OFFSET),
    positionMint: new PublicKey(
      data.subarray(POSITION_MINT_OFFSET, POSITION_MINT_OFFSET + PUBKEY_BYTES),
    ),
    isSupplyOnlyPosition: data.readUInt8(POSITION_IS_SUPPLY_ONLY_OFFSET) !== 0,
    tick: data.readInt32LE(POSITION_TICK_OFFSET),
    tickId: data.readUInt32LE(POSITION_TICK_ID_OFFSET),
  };
}

export function u16LeBytes(value: number): Buffer {
  if (value < 0 || value > 0xffff || !Number.isInteger(value)) {
    throw new Error(`vault_id must be a u16, got ${value}`);
  }
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

export function u32LeBytes(value: number): Buffer {
  if (value < 0 || value > 0xffffffff || !Number.isInteger(value)) {
    throw new Error(`position_id must be a u32, got ${value}`);
  }
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

export function i32LeBytes(value: number): Buffer {
  if (value < -0x80000000 || value > 0x7fffffff || !Number.isInteger(value)) {
    throw new Error(`tick must be an i32, got ${value}`);
  }
  const buf = Buffer.alloc(4);
  buf.writeInt32LE(value, 0);
  return buf;
}

export function memcmpFilter(offset: number, data: Buffer) {
  return {
    memcmp: {
      offset,
      bytes: data.toString("base64"),
      encoding: "base64" as const,
    },
  };
}

export function toBn(value: BN | bigint | number): BN {
  if (BN.isBN(value)) {
    return value;
  }
  return new BN(value.toString());
}

export function toU8Buffer(value: Buffer | Uint8Array | number[]): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

export function getTokenMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];
}

export function getLendingAdminPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lending_admin")],
    JUPITER_LENDING_PROGRAM_ID,
  )[0];
}

export function getFTokenMintPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("f_token_mint"), mint.toBuffer()],
    JUPITER_LENDING_PROGRAM_ID,
  )[0];
}

export function getLendingPda(
  mint: PublicKey,
  fTokenMint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lending"), mint.toBuffer(), fTokenMint.toBuffer()],
    JUPITER_LENDING_PROGRAM_ID,
  )[0];
}

export function getClaimAccountPda(
  mint: PublicKey,
  lendingAdmin: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_claim"), lendingAdmin.toBuffer(), mint.toBuffer()],
    JUPITER_LIQUIDITY_PROGRAM_ID,
  )[0];
}

export function getRateModelPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rate_model"), mint.toBuffer()],
    JUPITER_LIQUIDITY_PROGRAM_ID,
  )[0];
}

export function getLiquidityPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity")],
    JUPITER_LIQUIDITY_PROGRAM_ID,
  )[0];
}

export function getVaultAdminPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_admin")],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getVaultConfigPda(vaultId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), u16LeBytes(vaultId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getVaultMetadataPda(vaultId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_metadata"), u16LeBytes(vaultId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getVaultStatePda(vaultId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state"), u16LeBytes(vaultId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getPositionPda(vaultId: number, positionId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), u16LeBytes(vaultId), u32LeBytes(positionId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getPositionMintPda(
  vaultId: number,
  positionId: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position_mint"), u16LeBytes(vaultId), u32LeBytes(positionId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getBranchPda(vaultId: number, branchId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("branch"), u16LeBytes(vaultId), u32LeBytes(branchId)],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getTickHasDebtPda(vaultId: number, index: number): PublicKey {
  if (index < 0 || index > 0xff || !Number.isInteger(index)) {
    throw new Error(`tick_has_debt index must be a u8, got ${index}`);
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tick_has_debt"), u16LeBytes(vaultId), Buffer.from([index])],
    JUPITER_VAULTS_PROGRAM_ID,
  )[0];
}

export function getTickHasDebtIndex(tick: number): number {
  return Math.floor((tick - MIN_TICK) / TICKS_PER_TICK_HAS_DEBT_ARRAY);
}

export async function fetchAndValidate(
  connection: Connection,
  pubkey: PublicKey,
  expectedOwner: PublicKey,
  expectedDiscriminator: Buffer,
  label: string,
): Promise<Buffer> {
  const acc = await connection.getAccountInfo(pubkey);
  if (!acc) {
    throw new Error(`${label} account not found at ${pubkey.toBase58()}`);
  }
  if (!acc.owner.equals(expectedOwner)) {
    throw new Error(
      `${label} ${pubkey.toBase58()} owned by ${acc.owner.toBase58()}, expected ${expectedOwner.toBase58()}`,
    );
  }
  if (!acc.data.subarray(0, 8).equals(expectedDiscriminator)) {
    throw new Error(
      `Account ${pubkey.toBase58()} is not a ${label} (discriminator mismatch)`,
    );
  }
  return acc.data;
}

export async function resolveLookupTableAccounts(
  connection: Connection,
  statePda: PublicKey,
  vaultPda: PublicKey,
  lookupTable?: PublicKey,
): Promise<AddressLookupTableAccount[]> {
  const accounts: AddressLookupTableAccount[] = lookupTable
    ? await fetchAddressLookupTableAccounts(connection, [lookupTable])
    : [];
  try {
    accounts.push(
      ...(await findGlamLookupTables(statePda, vaultPda, connection)),
    );
  } catch {
    // Best-effort; the send path also resolves lookup tables.
  }
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = account.key.toBase58();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function fetchPositionInfo(
  connection: Connection,
  position: PublicKey,
): Promise<JupiterPosition> {
  const data = await fetchAndValidate(
    connection,
    position,
    JUPITER_VAULTS_PROGRAM_ID,
    POSITION_DISCRIMINATOR,
    "Position",
  );
  return decodePositionInfo(position, data);
}

export async function fetchVaultStateInfo(
  connection: Connection,
  vaultState: PublicKey,
): Promise<VaultStateInfo> {
  const data = await fetchAndValidate(
    connection,
    vaultState,
    JUPITER_VAULTS_PROGRAM_ID,
    VAULT_STATE_DISCRIMINATOR,
    "VaultState",
  );
  return {
    vaultId: data.readUInt16LE(VAULT_STATE_VAULT_ID_OFFSET),
    currentBranchId: data.readUInt32LE(VAULT_STATE_CURRENT_BRANCH_ID_OFFSET),
    nextPositionId: data.readUInt32LE(VAULT_STATE_NEXT_POSITION_ID_OFFSET),
  };
}

export async function fetchVaultConfigInfo(
  connection: Connection,
  vaultConfig: PublicKey,
): Promise<{
  oracle: PublicKey;
  supplyToken: PublicKey;
  borrowToken: PublicKey;
}> {
  const data = await fetchAndValidate(
    connection,
    vaultConfig,
    JUPITER_VAULTS_PROGRAM_ID,
    VAULT_CONFIG_DISCRIMINATOR,
    "VaultConfig",
  );
  return {
    oracle: new PublicKey(
      data.subarray(
        VAULT_CONFIG_ORACLE_OFFSET,
        VAULT_CONFIG_ORACLE_OFFSET + PUBKEY_BYTES,
      ),
    ),
    supplyToken: new PublicKey(
      data.subarray(
        VAULT_CONFIG_SUPPLY_TOKEN_OFFSET,
        VAULT_CONFIG_SUPPLY_TOKEN_OFFSET + PUBKEY_BYTES,
      ),
    ),
    borrowToken: new PublicKey(
      data.subarray(
        VAULT_CONFIG_BORROW_TOKEN_OFFSET,
        VAULT_CONFIG_BORROW_TOKEN_OFFSET + PUBKEY_BYTES,
      ),
    ),
  };
}

export async function fetchVaultMetadataLookupTable(
  connection: Connection,
  vaultMetadata: PublicKey,
): Promise<PublicKey | null> {
  const acc = await connection.getAccountInfo(vaultMetadata);
  if (!acc) {
    return null;
  }
  if (!acc.owner.equals(JUPITER_VAULTS_PROGRAM_ID)) {
    throw new Error(
      `VaultMetadata ${vaultMetadata.toBase58()} owned by ${acc.owner.toBase58()}, expected ${JUPITER_VAULTS_PROGRAM_ID.toBase58()}`,
    );
  }
  if (!acc.data.subarray(0, 8).equals(VAULT_METADATA_DISCRIMINATOR)) {
    throw new Error(
      `Account ${vaultMetadata.toBase58()} is not a Jupiter VaultMetadata`,
    );
  }
  const lookupTable = new PublicKey(
    acc.data.subarray(
      VAULT_METADATA_LOOKUP_TABLE_OFFSET,
      VAULT_METADATA_LOOKUP_TABLE_OFFSET + PUBKEY_BYTES,
    ),
  );
  return lookupTable.equals(PublicKey.default) ? null : lookupTable;
}

export async function fetchReserveVault(
  connection: Connection,
  reserve: PublicKey,
  expectedMint: PublicKey,
): Promise<PublicKey> {
  const data = await fetchAndValidate(
    connection,
    reserve,
    JUPITER_LIQUIDITY_PROGRAM_ID,
    TOKEN_RESERVE_DISCRIMINATOR,
    "TokenReserve",
  );
  const mint = new PublicKey(data.subarray(8, 8 + PUBKEY_BYTES));
  if (!mint.equals(expectedMint)) {
    throw new Error(
      `TokenReserve ${reserve.toBase58()} mint ${mint.toBase58()} does not match expected mint ${expectedMint.toBase58()}`,
    );
  }
  return new PublicKey(
    data.subarray(
      TOKEN_RESERVE_VAULT_OFFSET,
      TOKEN_RESERVE_VAULT_OFFSET + PUBKEY_BYTES,
    ),
  );
}

export async function fetchLendingReserveAndVault(
  connection: Connection,
  mint: PublicKey,
): Promise<{ reserve: PublicKey; vault: PublicKey }> {
  const fTokenMint = getFTokenMintPda(mint);
  const lending = getLendingPda(mint, fTokenMint);
  const data = await fetchAndValidate(
    connection,
    lending,
    JUPITER_LENDING_PROGRAM_ID,
    LENDING_DISCRIMINATOR,
    "Lending",
  );
  const reserve = new PublicKey(
    data.subarray(
      LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET,
      LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET + PUBKEY_BYTES,
    ),
  );
  const vault = await fetchReserveVault(connection, reserve, mint);
  return { reserve, vault };
}

export async function fetchLiquidityPosition(
  connection: Connection,
  discriminator: Buffer,
  dataSize: number,
  vaultConfig: PublicKey,
  mint: PublicKey,
  label: string,
): Promise<PublicKey> {
  const accounts = await getProgramAccounts(
    connection,
    JUPITER_LIQUIDITY_PROGRAM_ID,
    {
      filters: [
        { dataSize },
        memcmpFilter(0, discriminator),
        memcmpFilter(
          LIQUIDITY_POSITION_VAULT_CONFIG_OFFSET,
          vaultConfig.toBuffer(),
        ),
        memcmpFilter(LIQUIDITY_POSITION_MINT_OFFSET, mint.toBuffer()),
      ],
    },
  );
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one Jupiter Liquidity ${label} position for vault ${vaultConfig.toBase58()} and mint ${mint.toBase58()}, found ${accounts.length}`,
    );
  }
  return accounts[0].pubkey;
}

export async function fetchTickByValue(
  connection: Connection,
  vaultId: number,
  tick: number,
): Promise<TickInfo> {
  const accounts = await getProgramAccounts(
    connection,
    JUPITER_VAULTS_PROGRAM_ID,
    {
      filters: [
        { dataSize: 40 },
        memcmpFilter(0, TICK_DISCRIMINATOR),
        memcmpFilter(8, u16LeBytes(vaultId)),
        memcmpFilter(TICK_VALUE_OFFSET, i32LeBytes(tick)),
      ],
    },
  );
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one Jupiter Tick for vault ${vaultId} and tick ${tick}, found ${accounts.length}. Tick may not be initialized.`,
    );
  }
  const data = accounts[0].account.data;
  return {
    pubkey: accounts[0].pubkey,
    tick: data.readInt32LE(TICK_VALUE_OFFSET),
    totalIds: data.readUInt32LE(TICK_TOTAL_IDS_OFFSET),
  };
}

export async function fetchTickIdLiquidationByTick(
  connection: Connection,
  vaultId: number,
  tick: number,
  tickMap: number,
): Promise<PublicKey> {
  const accounts = await getProgramAccounts(
    connection,
    JUPITER_VAULTS_PROGRAM_ID,
    {
      filters: [
        memcmpFilter(0, TICK_ID_LIQUIDATION_DISCRIMINATOR),
        memcmpFilter(8, u16LeBytes(vaultId)),
        memcmpFilter(TICK_ID_VALUE_OFFSET, i32LeBytes(tick)),
        memcmpFilter(TICK_ID_MAP_OFFSET, u32LeBytes(tickMap)),
      ],
    },
  );
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one Jupiter TickIdLiquidation for vault ${vaultId}, tick ${tick}, tick id ${tickMap}; found ${accounts.length}. TickIdLiquidation may not be initialized.`,
    );
  }
  return accounts[0].pubkey;
}

export async function resolveOracleRemainingAccounts(
  connection: Connection,
  oracle: PublicKey,
): Promise<AccountMeta[]> {
  const data = await fetchAndValidate(
    connection,
    oracle,
    JUPITER_ORACLE_PROGRAM_ID,
    ORACLE_DISCRIMINATOR,
    "Oracle",
  );
  let offset = 8 + 2;
  if (data.length < offset + 4) {
    throw new Error(`Oracle account ${oracle.toBase58()} is too small`);
  }
  const sourceCount = data.readUInt32LE(offset);
  offset += 4;
  if (sourceCount > 0xff) {
    throw new Error(
      `Oracle ${oracle.toBase58()} has ${sourceCount} sources; borrow operate supports at most 255`,
    );
  }
  const accounts: AccountMeta[] = [];
  for (let i = 0; i < sourceCount; i++) {
    if (data.length < offset + ORACLE_SOURCE_BYTES) {
      throw new Error(
        `Oracle account ${oracle.toBase58()} is truncated at source ${i}`,
      );
    }
    accounts.push({
      pubkey: new PublicKey(data.subarray(offset, offset + PUBKEY_BYTES)),
      isSigner: false,
      isWritable: false,
    });
    offset += ORACLE_SOURCE_BYTES;
  }
  return accounts;
}

export function buildBorrowOperateRemainingAccounts(
  vaultId: number,
  oracleAccounts: AccountMeta[],
  currentTickValue: number,
  finalTickValue: number,
): BorrowOperateRemainingAccounts {
  const tickHasDebtAccounts: AccountMeta[] = [];
  const tickHasDebtIndexes = new Set<number>();
  for (const tickValue of [currentTickValue, finalTickValue]) {
    if (tickValue !== MIN_TICK) {
      tickHasDebtIndexes.add(getTickHasDebtIndex(tickValue));
    }
  }
  for (const index of tickHasDebtIndexes) {
    tickHasDebtAccounts.push({
      pubkey: getTickHasDebtPda(vaultId, index),
      isSigner: false,
      isWritable: true,
    });
  }

  if (oracleAccounts.length > 0xff || tickHasDebtAccounts.length > 0xff) {
    throw new Error(`Too many Jupiter Vaults remaining accounts`);
  }

  return {
    indices: Buffer.from([
      oracleAccounts.length,
      0,
      tickHasDebtAccounts.length,
    ]),
    accounts: [...oracleAccounts, ...tickHasDebtAccounts],
  };
}
