import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";

import {
  EXT_PRICER_DISCRIMINATORS,
  EXT_PRICER_U8_ARG,
  ExtPositionPricerName,
  ExtPricerName,
  extPricerIx,
  extRegisteredPositionsPricerIx,
} from "../../src/utils/extPricing";
import {
  getGlobalConfigPda,
  getIntegrationAuthorityPda,
} from "../../src/utils/glamPDAs";

/**
 * `extPricing.ts` encodes the ext-hosted pricers from the program source
 * rather than from a generated document, so this suite holds it to that
 * source: the discriminator rule, the `#[derive(Accounts)]` struct of each
 * pricer in `anchor_v1/programs`, and the argument list the mint pricer of the
 * same name declares in the tracked glam_mint document.
 */
const REPO = path.resolve(__dirname, "../../..");
const V1_PROGRAMS = path.join(REPO, "anchor_v1/programs");
const MINT_IDL = JSON.parse(
  fs.readFileSync(
    path.join(REPO, "anchor/target/idl/glam_mint-staging.json"),
    "utf8",
  ),
) as {
  instructions: Array<{
    name: string;
    discriminator: number[];
    args: Array<{ name: string; type: string }>;
  }>;
};

const NAMES = Object.keys(EXT_PRICER_DISCRIMINATORS) as ExtPricerName[];
const POSITION_PRICERS = NAMES.filter(
  (name) => name !== "price_registered_positions",
) as ExtPositionPricerName[];

// The Accounts struct each pricer takes, in the v1 tree.
const LOOPSCALE = {
  file: "ext_loopscale/src/instructions/pricing.rs",
  struct: "PriceLoopscalePositions",
};
const JUPITER = {
  file: "ext_jupiter/src/instructions/price_jupiter_positions.rs",
  struct: "PriceJupiterPositions",
};
const ACCOUNTS_STRUCTS: Record<
  ExtPricerName,
  { file: string; struct: string }
> = {
  price_registered_positions: {
    file: "ext_rpi/src/instructions/price_registered_positions.rs",
    struct: "PriceRegisteredPositions",
  },
  price_loopscale_loans: LOOPSCALE,
  price_loopscale_strategies: LOOPSCALE,
  price_loopscale_vault_positions: LOOPSCALE,
  price_phoenix_traders: {
    file: "ext_phoenix/src/instructions/price_phoenix_traders.rs",
    struct: "PricePhoenixTraders",
  },
  price_marginfi_accounts: {
    file: "ext_marginfi/src/instructions/price_marginfi_accounts.rs",
    struct: "PriceMarginfiAccounts",
  },
  price_neutral_bundle_depositors: {
    file: "ext_neutral/src/instructions/price_neutral_bundle_depositors.rs",
    struct: "PriceNeutralBundleDepositors",
  },
  price_orca_whirlpool_positions: {
    file: "ext_orca/src/instructions/price_orca_whirlpool_positions.rs",
    struct: "PriceOrcaWhirlpoolPositions",
  },
  price_jupiter_earn_positions: JUPITER,
  price_jupiter_borrow_positions: JUPITER,
};

/** The fields of a `#[derive(Accounts)]` struct in order, with `mut`. */
function accountsStruct(
  file: string,
  struct: string,
): Array<{ name: string; writable: boolean }> {
  const source = fs.readFileSync(path.join(V1_PROGRAMS, file), "utf8");
  const start = source.indexOf(`pub struct ${struct}<'info>`);
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf("\n}", start));
  const fields: Array<{ name: string; writable: boolean }> = [];
  let attributes = "";
  for (const line of body.split("\n").slice(1)) {
    const field = line.match(/^\s*pub (\w+):/);
    if (field) {
      fields.push({
        name: field[1],
        writable: /#\[account\(\s*mut\b/.test(attributes),
      });
      attributes = "";
    } else {
      attributes += `${line}\n`;
    }
  }
  return fields;
}

const PROGRAM_ID = PublicKey.unique();
const ROLES = {
  glam_state: PublicKey.unique(),
  glam_vault: PublicKey.unique(),
  sol_usd_oracle: PublicKey.unique(),
  base_asset_oracle: PublicKey.unique(),
  glam_protocol_program: PublicKey.unique(),
  observation_state: PublicKey.unique(),
  integration_authority: getIntegrationAuthorityPda(PROGRAM_ID),
  glam_config: getGlobalConfigPda(),
};
const ACCOUNTS = {
  glamState: ROLES.glam_state,
  glamVault: ROLES.glam_vault,
  solUsdOracle: ROLES.sol_usd_oracle,
  baseAssetOracle: ROLES.base_asset_oracle,
  glamProtocolProgram: ROLES.glam_protocol_program,
};

function roleOf(pubkey: PublicKey): string {
  const role = Object.entries(ROLES).find(([, key]) => key.equals(pubkey));
  return role ? role[0] : "remaining";
}

function build(name: ExtPricerName, count?: number) {
  return name === "price_registered_positions"
    ? extRegisteredPositionsPricerIx({
        programId: PROGRAM_ID,
        glamState: ROLES.glam_state,
        observationState: ROLES.observation_state,
        glamProtocolProgram: ROLES.glam_protocol_program,
      })
    : extPricerIx({
        programId: PROGRAM_ID,
        name,
        accounts: ACCOUNTS,
        remainingAccounts: [],
        count,
      });
}

function countFor(name: ExtPricerName): number | undefined {
  return name in EXT_PRICER_U8_ARG ? 2 : undefined;
}

describe.each(NAMES)("%s", (name) => {
  const mintPricer = MINT_IDL.instructions.find(
    (instruction) => instruction.name === name,
  )!;

  it("carries the discriminator Anchor derives from its name, the mint pricer's", () => {
    const derived = createHash("sha256")
      .update(`global:${name}`)
      .digest()
      .subarray(0, 8);
    expect(Buffer.from(EXT_PRICER_DISCRIMINATORS[name])).toEqual(derived);
    expect(mintPricer.discriminator).toEqual([
      ...EXT_PRICER_DISCRIMINATORS[name],
    ]);
  });

  it("names the accounts of the program's Accounts struct, in its order", () => {
    const { file, struct } = ACCOUNTS_STRUCTS[name];
    const fields = accountsStruct(file, struct);
    const ix = build(name, countFor(name));
    expect(ix.programId.equals(PROGRAM_ID)).toBe(true);
    expect(ix.keys.map(({ pubkey }) => roleOf(pubkey))).toEqual(
      fields.map(({ name }) => name),
    );
    expect(ix.keys.map(({ isWritable }) => isWritable)).toEqual(
      fields.map(({ writable }) => writable),
    );
    expect(ix.keys.every(({ isSigner }) => !isSigner)).toBe(true);
  });

  it("takes the arguments the mint pricer of the same name takes", () => {
    const u8Arg = (EXT_PRICER_U8_ARG as Record<string, string | undefined>)[
      name
    ];
    expect(mintPricer.args).toEqual(
      u8Arg === undefined ? [] : [{ name: u8Arg, type: "u8" }],
    );
    const ix = build(name, countFor(name));
    expect(ix.data).toEqual(
      Buffer.from(
        u8Arg === undefined
          ? EXT_PRICER_DISCRIMINATORS[name]
          : [...EXT_PRICER_DISCRIMINATORS[name], 2],
      ),
    );
  });
});

describe("extPricerIx", () => {
  it("appends the remaining accounts as given", () => {
    const remaining = [
      { pubkey: PublicKey.unique(), isSigner: false, isWritable: false },
      { pubkey: PublicKey.unique(), isSigner: false, isWritable: true },
    ];
    const ix = extPricerIx({
      programId: PROGRAM_ID,
      name: "price_marginfi_accounts",
      accounts: ACCOUNTS,
      remainingAccounts: remaining,
    });
    expect(ix.keys.slice(7)).toEqual(remaining);
  });

  it("refuses a count the instruction does not take, and a missing or out-of-range one", () => {
    expect(() =>
      extPricerIx({
        programId: PROGRAM_ID,
        name: "price_marginfi_accounts",
        accounts: ACCOUNTS,
        remainingAccounts: [],
        count: 1,
      }),
    ).toThrow("price_marginfi_accounts takes no argument");
    for (const count of [undefined, -1, 256, 1.5]) {
      expect(() =>
        extPricerIx({
          programId: PROGRAM_ID,
          name: "price_orca_whirlpool_positions",
          accounts: ACCOUNTS,
          remainingAccounts: [],
          count,
        }),
      ).toThrow("price_orca_whirlpool_positions takes num_positions as a u8");
    }
  });

  it("covers every ext-hosted pricer the v1 tree declares", () => {
    const additions = JSON.parse(
      fs.readFileSync(
        path.join(REPO, "anchor_v1/tools/idl-additions.json"),
        "utf8",
      ),
    ).additions as Record<string, { instructions: string[] }>;
    const declared = Object.values(additions).flatMap(
      ({ instructions }) => instructions,
    );
    expect([...declared].sort()).toEqual([...NAMES].sort());
    expect(POSITION_PRICERS).toHaveLength(NAMES.length - 1);
  });
});
