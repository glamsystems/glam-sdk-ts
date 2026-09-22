import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

import { getGlobalConfigPda, getIntegrationAuthorityPda } from "./glamPDAs";

/**
 * The pricing instructions the integration programs host
 * (anchor_v1/PRICING.md). The `anchor/` build no longer carries them, so the
 * SDK encodes each one from three facts of the program source: the
 * discriminator Anchor derives from the instruction's name, the accounts its
 * `#[derive(Accounts)]` struct declares in that order, and the remaining
 * accounts, which are those of the glam_mint pricer of the same name.
 * `tests/sdk/ext_pricing.test.ts` holds this file to the anchor_v1 source.
 */

// sha256("global:<name>")[..8]. A pricer keeps the name of the mint pricer it
// replaces, so these are the bytes the tracked glam_mint document carries.
export const EXT_PRICER_DISCRIMINATORS = Object.freeze({
  price_registered_positions: [90, 157, 162, 50, 236, 16, 188, 3],
  price_loopscale_loans: [106, 180, 138, 193, 90, 3, 24, 42],
  price_loopscale_strategies: [169, 52, 25, 11, 96, 138, 10, 174],
  price_loopscale_vault_positions: [98, 229, 99, 154, 94, 139, 124, 220],
  price_phoenix_traders: [112, 90, 177, 46, 145, 191, 219, 213],
  price_marginfi_accounts: [146, 215, 180, 231, 191, 188, 42, 235],
  price_neutral_bundle_depositors: [202, 93, 205, 29, 37, 180, 127, 102],
  price_orca_whirlpool_positions: [3, 81, 117, 34, 5, 238, 158, 232],
  price_jupiter_earn_positions: [120, 10, 10, 137, 145, 60, 164, 16],
  price_jupiter_borrow_positions: [55, 251, 33, 55, 80, 17, 18, 154],
} as const);

export type ExtPricerName = keyof typeof EXT_PRICER_DISCRIMINATORS;

/** The pricers that take one `u8` argument after the discriminator. */
export const EXT_PRICER_U8_ARG = Object.freeze({
  price_loopscale_vault_positions: "num_vaults",
  price_orca_whirlpool_positions: "num_positions",
} as const);

/** A pricer over the vault's positions: every one except the RPI pricer. */
export type ExtPositionPricerName = Exclude<
  ExtPricerName,
  "price_registered_positions"
>;

export type ExtPricerAccounts = {
  glamState: PublicKey;
  glamVault: PublicKey;
  solUsdOracle: PublicKey;
  baseAssetOracle: PublicKey;
  glamProtocolProgram: PublicKey;
};

function readonly(pubkey: PublicKey): AccountMeta {
  return { pubkey, isSigner: false, isWritable: false };
}

function pricerData(name: ExtPricerName, count?: number): Buffer {
  const arg = (EXT_PRICER_U8_ARG as Record<string, string | undefined>)[name];
  if (arg === undefined) {
    if (count !== undefined) {
      throw new Error(`${name} takes no argument`);
    }
    return Buffer.from(EXT_PRICER_DISCRIMINATORS[name]);
  }
  if (
    count === undefined ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 255
  ) {
    throw new Error(`${name} takes ${arg} as a u8, got ${count}`);
  }
  return Buffer.from([...EXT_PRICER_DISCRIMINATORS[name], count]);
}

/**
 * A pricing instruction of the integration program `programId`, over the
 * positions its remaining accounts name. `count` is the u8 the instruction
 * takes, where it takes one (`EXT_PRICER_U8_ARG`).
 */
export function extPricerIx(params: {
  programId: PublicKey;
  name: ExtPositionPricerName;
  accounts: ExtPricerAccounts;
  remainingAccounts: AccountMeta[];
  count?: number;
}): TransactionInstruction {
  const { programId, name, accounts, remainingAccounts, count } = params;
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: accounts.glamState, isSigner: false, isWritable: true },
      readonly(accounts.glamVault),
      readonly(accounts.solUsdOracle),
      readonly(accounts.baseAssetOracle),
      readonly(getIntegrationAuthorityPda(programId)),
      readonly(getGlobalConfigPda()),
      readonly(accounts.glamProtocolProgram),
      ...remainingAccounts,
    ],
    data: pricerData(name, count),
  });
}

/**
 * ext_rpi's `price_registered_positions`, which reads the observation state
 * it owns for the vault and takes no oracle or remaining account.
 */
export function extRegisteredPositionsPricerIx(params: {
  programId: PublicKey;
  glamState: PublicKey;
  observationState: PublicKey;
  glamProtocolProgram: PublicKey;
}): TransactionInstruction {
  const { programId, glamState, observationState, glamProtocolProgram } =
    params;
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: glamState, isSigner: false, isWritable: true },
      readonly(observationState),
      readonly(getIntegrationAuthorityPda(programId)),
      readonly(glamProtocolProgram),
    ],
    data: pricerData("price_registered_positions"),
  });
}
