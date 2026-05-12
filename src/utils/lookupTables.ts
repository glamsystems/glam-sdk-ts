import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { GLAM_CONFIG_PROGRAM, TRANSFER_HOOK_PROGRAM } from "../constants";
import { getGlobalConfigPda } from "./glamPDAs";
import { fetchMintsAndTokenPrograms } from "./accounts";
import { PkSet } from "./pkset";

/**
 * Fetches multiple address lookup table accounts
 *
 * @param connection Solana connection
 * @param pubkeys Array of lookup table public keys
 * @returns Array of address lookup table accounts
 */
export async function fetchAddressLookupTableAccounts(
  connection: Connection,
  pubkeys: string[] | PublicKey[],
): Promise<AddressLookupTableAccount[]> {
  if (pubkeys.length === 0) {
    return [];
  }

  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      pubkeys.map((key: string | PublicKey) => new PublicKey(key)),
    );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const tableAddress = pubkeys[index];
    if (accountInfo) {
      const tableAccount = new AddressLookupTableAccount({
        key: new PublicKey(tableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      });
      acc.push(tableAccount);
    }
    return acc;
  }, new Array<AddressLookupTableAccount>());
}

export interface VaultAccountsInfo {
  statePda: PublicKey;
  vaultPda: PublicKey;
  mintPda: PublicKey;
  escrowPda: PublicKey;
  requestQueuePda: PublicKey;
  extraMetasPda: PublicKey;
  protocolProgramId: PublicKey;
  mintProgramId: PublicKey;
  connection: Connection;
  stateAccount: {
    mint: PublicKey;
    baseAssetMint: PublicKey;
    assets: PublicKey[];
    externalPositions: PublicKey[];
    integrationAcls: { integrationProgram: PublicKey }[];
  };
  borrowable?: PublicKey[];
}

/**
 * Collects all pubkeys that should be included in a vault's Address Lookup Table.
 *
 * The first 3 entries are fixed (statePda, vaultPda, GLAM_CONFIG_PROGRAM) to
 * match the ALT discovery filter offsets used by findGlamLookupTables().
 */
export async function collectVaultLookupTableAddresses(
  info: VaultAccountsInfo,
): Promise<PublicKey[]> {
  const {
    statePda,
    vaultPda,
    mintPda,
    escrowPda,
    requestQueuePda,
    extraMetasPda,
    protocolProgramId,
    mintProgramId,
    connection,
    stateAccount,
  } = info;

  // Fixed first 3 entries (order matters for ALT discovery filters)
  const fixedEntries: PublicKey[] = [statePda, vaultPda, GLAM_CONFIG_PROGRAM];
  const fixedSet = new PkSet(fixedEntries);

  const addresses = new PkSet();

  // Global config PDA
  addresses.add(getGlobalConfigPda());

  // Core GLAM program IDs
  addresses.add(protocolProgramId);
  addresses.add(mintProgramId);
  addresses.add(TRANSFER_HOOK_PROGRAM);

  // Mint PDAs (if tokenized vault)
  const isTokenized = !stateAccount.mint.equals(PublicKey.default);
  if (isTokenized) {
    addresses.add(mintPda);
    addresses.add(escrowPda);
    addresses.add(requestQueuePda);
    addresses.add(extraMetasPda);
  }

  // Collect all unique mints: base asset + assets allowlist + borrowable
  const allMints = new PkSet([
    stateAccount.baseAssetMint,
    ...stateAccount.assets,
    ...(info.borrowable || []),
  ]);
  const uniqueMints = Array.from(allMints);

  // Fetch mint accounts to determine token programs for ATA derivation
  const mintInfos = await fetchMintsAndTokenPrograms(connection, uniqueMints);
  const mintTokenProgramMap = new Map<string, PublicKey>();
  uniqueMints.forEach((mint, i) => {
    mintTokenProgramMap.set(mint.toBase58(), mintInfos[i].tokenProgram);
  });

  // Add each mint and its vault ATA
  for (const mint of uniqueMints) {
    addresses.add(mint);
    const tokenProgram = mintTokenProgramMap.get(mint.toBase58())!;
    addresses.add(
      getAssociatedTokenAddressSync(mint, vaultPda, true, tokenProgram),
    );
  }

  // External positions
  for (const position of stateAccount.externalPositions) {
    addresses.add(position);
  }

  // Integration program IDs
  for (const acl of stateAccount.integrationAcls) {
    addresses.add(acl.integrationProgram);
  }

  // System programs
  addresses.add(SystemProgram.programId);
  addresses.add(TOKEN_PROGRAM_ID);
  addresses.add(TOKEN_2022_PROGRAM_ID);
  addresses.add(ASSOCIATED_TOKEN_PROGRAM_ID);

  // Remove any that overlap with fixed entries
  const remaining = Array.from(addresses).filter((pk) => !fixedSet.has(pk));

  return [...fixedEntries, ...remaining];
}

const MAX_ADDRESSES_PER_EXTEND = 20;

export interface CreateAltResult {
  createIx: TransactionInstruction;
  lookupTableAddress: PublicKey;
  extendIxBatches: TransactionInstruction[];
}

/**
 * Builds instructions to create an ALT and extend it with the given addresses.
 * Returns the create instruction, the derived lookup table address, and batched
 * extend instructions (each batch fits within a single transaction).
 */
export function buildCreateAltInstructions(
  addresses: PublicKey[],
  authority: PublicKey,
  payer: PublicKey,
  recentSlot: number,
): CreateAltResult {
  const [createIx, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority,
      payer,
      recentSlot,
    });

  const extendIxBatches: TransactionInstruction[] = [];
  for (let i = 0; i < addresses.length; i += MAX_ADDRESSES_PER_EXTEND) {
    const batch = addresses.slice(i, i + MAX_ADDRESSES_PER_EXTEND);
    extendIxBatches.push(
      AddressLookupTableProgram.extendLookupTable({
        lookupTable: lookupTableAddress,
        authority,
        payer,
        addresses: batch,
      }),
    );
  }

  return { createIx, lookupTableAddress, extendIxBatches };
}

/**
 * Builds batched extend instructions for an existing ALT.
 * Each instruction extends the table with up to 20 addresses.
 */
export function buildExtendAltInstructions(
  lookupTableAddress: PublicKey,
  newAddresses: PublicKey[],
  authority: PublicKey,
  payer: PublicKey,
): TransactionInstruction[] {
  const batches: TransactionInstruction[] = [];
  for (let i = 0; i < newAddresses.length; i += MAX_ADDRESSES_PER_EXTEND) {
    const batch = newAddresses.slice(i, i + MAX_ADDRESSES_PER_EXTEND);
    batches.push(
      AddressLookupTableProgram.extendLookupTable({
        lookupTable: lookupTableAddress,
        authority,
        payer,
        addresses: batch,
      }),
    );
  }
  return batches;
}
