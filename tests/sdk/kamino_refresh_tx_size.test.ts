import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  JUPITER_V1_MAX_QUOTE_ACCOUNTS,
  JupiterSwapClient,
} from "../../src/client/jupiter";
import { KaminoLendingClient } from "../../src/client/kamino";
import { OrcaWhirlpoolsClient } from "../../src/client/orca";
import { PriceClient } from "../../src/client/price";
import { RpiClient } from "../../src/client/rpi";
import {
  NeutralBundleAccount,
  NTBUNDLE_PROGRAM_ID,
  NT_BUNDLE_PROTOCOL,
  getNeutralUserBundlePda,
} from "../../src/client/neutral";
import {
  KAMINO_LENDING_PROGRAM,
  MARGINFI_PROGRAM_ID,
  ORCA_POSITION_DISCRIMINATOR,
  ORCA_WHIRLPOOLS_PROGRAM_ID,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  SEED_OBSERVATION_STATE,
  USDC,
  WSOL,
} from "../../src/constants";
import {
  LOOPSCALE_BORROW_PROTOCOL,
  LOOPSCALE_LENDING_PROTOCOL,
  LOOPSCALE_VAULT_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  LAYERZERO_OFT_PROTOCOL,
  MARGINFI_PROTOCOL,
  PHOENIX_PROTOCOL,
  ORCA_WHIRLPOOLS_PROTOCOL,
  RPI_PROTOCOL,
  STAKE_PROTOCOL,
} from "../../src/protocols";
import { StateAccountType } from "../../src/models";
import { PkMap, PkSet, getIntegrationAuthorityPda } from "../../src/utils";
import {
  V1Transaction,
  V1_MAX_ACCOUNT_KEYS,
  V1_TRANSACTION_SIZE_LIMIT,
  assertV1TransactionLimits,
  compileToV1Message,
  priorityFeeLamports,
  serializeV1Transaction,
} from "../../src/utils/messageV1";
import { solToMsolSwapInstructionsForTest } from "../integrations/setup";
import {
  KAMINO_ORACLE,
  OracleSpec,
  accountInfo,
  assetMetaOf,
  loadReserveFixture,
  mintAccountInfo,
  realPrograms,
} from "./kaminoRefreshFakes";

// A Solana transaction is at most 1232 bytes on the wire. Each fix in this
// lane adds one refresh_reserves_batch instruction, six account keys per
// reserve (the reserve, its lending market, three klend program id
// placeholders and the reserve's Scope feed), so the transactions that carry
// it are measured here at the worst realistic case they now reach.
//
// Every row below is built by the SDK's own builders — the real Anchor
// programs, the real klend client, the real refresh — over faked account
// reads, and then compiled into a version 0 message exactly as
// BaseClient.intoVersionedTransaction compiles it: same compute budget
// instructions, same payer, the lookup tables the SDK would pass.
//
// Every row is measured a second time as a version 1 transaction, which is what
// the SDK builds by default outside localnet: no lookup tables, the budget in
// the message's own fields, and two limits rather than one — 4,096 bytes and 64
// account keys. The version 0 measurements stay for the GUI and Ledger paths.
const TRANSACTION_SIZE_LIMIT = 1232;

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const BASE_MINT = PublicKey.unique();
const PRICED_MINT = PublicKey.unique();
const INPUT_MINT = PublicKey.unique();
const OUTPUT_MINT = PublicKey.unique();
const COLLATERAL_MINT = PublicKey.unique();
const PRINCIPAL_MINT = PublicKey.unique();
const OBSERVED_MINT = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();

// Three markets: main, JLP and Maple, plus two more main-market reserves.
const RESERVES = [
  loadReserveFixture("reserve_usdc_main_market"),
  loadReserveFixture("reserve_usdc_jlp_market"),
  loadReserveFixture("reserve_usdc_maple_market"),
  loadReserveFixture("reserve_wsol_main_market"),
  loadReserveFixture("reserve_cbbtc_main_market"),
];
const RESERVE_KEYS = RESERVES.map(({ pubkey }) => pubkey);

const programs = realPrograms();
const PAYER = programs.signer;

function oracleMap(entries: Array<[PublicKey, OracleSpec]>) {
  return new Map(entries.map(([mint, spec]) => [mint.toBase58(), spec]));
}

const PYTH: OracleSpec = { oracle: PYTH_ORACLE, oracleSource: "Pyth" };

// ------------------------------------------------------------ measurement

const REFRESH_RESERVES_BATCH_DISCRIMINATOR = Buffer.from([
  144, 110, 26, 103, 162, 204, 252, 147,
]);

function isReserveRefresh(ix: TransactionInstruction): boolean {
  return (
    ix.programId.equals(KAMINO_LENDING_PROGRAM) &&
    ix.data.subarray(0, 8).equals(REFRESH_RESERVES_BATCH_DISCRIMINATOR)
  );
}

// The budget every transaction below carries. Both Compute Budget encodings
// are fixed width and a version 1 message always states all four of its own
// fields, so neither measurement moves with the values chosen here.
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 10_000;
const COMPUTE_UNIT_LIMIT = 400_000;

/**
 * The two compute budget instructions intoVersionedTransaction prepends to
 * every version 0 transaction it builds.
 */
function computeBudgetIxs(): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
  ];
}

/** Length of a compact-u16 count, as the message encoder writes it. */
function compactU16Len(value: number): number {
  if (value < 0x80) return 1;
  if (value < 0x4000) return 2;
  return 3;
}

/**
 * The wire size of the transaction the SDK would send. Both
 * MessageV0.serialize() and VersionedTransaction.serialize() write into a
 * packet-sized buffer and throw once the message outgrows it, so the bytes are
 * summed from the compiled message's parts — which the encoder never refuses —
 * and checked against the encoder wherever it does fit.
 */
function serializedSize(
  ixs: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[] = [],
): number {
  const message = new TransactionMessage({
    payerKey: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [...computeBudgetIxs(), ...ixs],
  }).compileToV0Message(lookupTables);

  const messageSize =
    1 + // version prefix
    3 + // header
    compactU16Len(message.staticAccountKeys.length) +
    32 * message.staticAccountKeys.length +
    32 + // recent blockhash
    compactU16Len(message.compiledInstructions.length) +
    message.compiledInstructions.reduce(
      (sum, ix) =>
        sum +
        1 +
        compactU16Len(ix.accountKeyIndexes.length) +
        ix.accountKeyIndexes.length +
        compactU16Len(ix.data.length) +
        ix.data.length,
      0,
    ) +
    compactU16Len(message.addressTableLookups.length) +
    message.addressTableLookups.reduce(
      (sum, lookup) =>
        sum +
        32 +
        compactU16Len(lookup.writableIndexes.length) +
        lookup.writableIndexes.length +
        compactU16Len(lookup.readonlyIndexes.length) +
        lookup.readonlyIndexes.length,
      0,
    );
  const size =
    compactU16Len(message.header.numRequiredSignatures) +
    64 * message.header.numRequiredSignatures +
    messageSize;

  if (size <= TRANSACTION_SIZE_LIMIT) {
    // The same number the wire encoder produces, wherever it can produce one.
    expect(new VersionedTransaction(message).serialize().length).toBe(size);
  }
  return size;
}

/**
 * The lookup table the SDK passes with this transaction today: the accounts it
 * already used before this lane added the refresh. A vault's ALT and a route's
 * ALT both predate the fix, so neither holds the klend reserves, their markets
 * or their Scope feeds.
 */
function lookupTableOver(ixs: TransactionInstruction[]) {
  const addresses = new PkSet();
  ixs.forEach((ix) => {
    ix.keys.forEach(({ pubkey, isSigner }) => {
      // A signer and the fee payer are always in the message itself.
      if (!isSigner && !pubkey.equals(PAYER)) {
        addresses.add(pubkey);
      }
    });
  });
  return new AddressLookupTableAccount({
    key: PublicKey.unique(),
    state: {
      deactivationSlot: BigInt("18446744073709551615"),
      lastExtendedSlot: 0,
      lastExtendedSlotStartIndex: 0,
      addresses: Array.from(addresses),
    },
  });
}

type V1Cost = { bytes: number; accounts: number };

/**
 * The version 1 message the SDK would compile from these instructions, built as
 * intoVersionedTransaction builds it: no lookup tables, and the budget stated
 * in the message's own fields as the numbers resolveComputeBudget returns, with
 * no Compute Budget instruction built for the fold to remove.
 */
function v1Message(ixs: TransactionInstruction[]) {
  return compileToV1Message({
    payerKey: PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: ixs,
    config: {
      computeUnitLimit: COMPUTE_UNIT_LIMIT,
      priorityFee: priorityFeeLamports(
        COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
        COMPUTE_UNIT_LIMIT,
      ),
    },
  });
}

/**
 * What that message costs against the two limits that bind it — 4,096 wire
 * bytes and 64 account keys. Without lookup tables the account count is usually
 * the binding one, so both are measured.
 */
function v1Cost(ixs: TransactionInstruction[]): V1Cost {
  const message = v1Message(ixs);
  return {
    bytes: serializeV1Transaction(new V1Transaction(message)).length,
    accounts: message.staticAccountKeys.length,
  };
}

/** The transaction intoVersionedTransaction would hand over to be signed. */
function v1Transaction(ixs: TransactionInstruction[]): V1Transaction {
  return new V1Transaction(v1Message(ixs));
}

type SizeRow = {
  path: string;
  reserves: number;
  before: number;
  after: number;
  beforeWithAlt: number;
  afterWithAlt: number;
  v1Before: V1Cost;
  v1After: V1Cost;
  note?: string;
  ixs: TransactionInstruction[];
  withoutRefresh: TransactionInstruction[];
};

const rows: SizeRow[] = [];

/**
 * Measures one path from the instruction list its builder returned: "after" is
 * that list, "before" is the same list without the batch refresh this lane
 * added.
 */
function measure(
  path: string,
  ixs: TransactionInstruction[],
  note?: string,
): SizeRow {
  const refreshes = ixs.filter(isReserveRefresh);
  expect(refreshes).toHaveLength(1);
  const withoutRefresh = ixs.filter((ix) => !isReserveRefresh(ix));
  const alt = lookupTableOver(withoutRefresh);
  const row = {
    path,
    // Six account keys per reserve, in the order klend reads them.
    reserves: refreshes[0].keys.length / 6,
    before: serializedSize(withoutRefresh),
    after: serializedSize(ixs),
    beforeWithAlt: serializedSize(withoutRefresh, [alt]),
    afterWithAlt: serializedSize(ixs, [alt]),
    v1Before: v1Cost(withoutRefresh),
    v1After: v1Cost(ixs),
    note,
    ixs,
    withoutRefresh,
  };
  rows.push(row);
  return row;
}

afterAll(() => {
  const table = rows
    .map(
      (row) =>
        `${row.path.padEnd(30)} reserves=${row.reserves} before=${row.before} after=${row.after} (+${row.after - row.before}) beforeALT=${row.beforeWithAlt} afterALT=${row.afterWithAlt} (+${row.afterWithAlt - row.beforeWithAlt})${row.note ? `  [${row.note}]` : ""}`,
    )
    .join("\n");
  console.log(
    `\nTransaction sizes (bytes, limit ${TRANSACTION_SIZE_LIMIT}), measured from the SDK's builders:\n${table}`,
  );

  const v1Table = rows
    .map((row) => {
      const cell = (cost: V1Cost) =>
        `${String(cost.bytes).padStart(4)}B/${String(cost.accounts).padStart(2)}acc`;
      const fits =
        row.v1After.bytes <= V1_TRANSACTION_SIZE_LIMIT &&
        row.v1After.accounts <= V1_MAX_ACCOUNT_KEYS;
      return `${row.path.padEnd(30)} before=${cell(row.v1Before)} after=${cell(row.v1After)} ${fits ? "fits" : "DOES NOT FIT"}`;
    })
    .join("\n");
  console.log(
    `\nVersion 1 (no lookup tables, limits ${V1_TRANSACTION_SIZE_LIMIT} bytes and ${V1_MAX_ACCOUNT_KEYS} accounts):\n${v1Table}`,
  );
});

// --------------------------------------------------------------- the fakes

/**
 * Serves the account reads every builder below makes: the klend reserve
 * fixtures, mint accounts, and whatever a row registers for its own external
 * positions.
 */
function makeConnection(extra: Array<[PublicKey, any]> = []) {
  const accounts = new PkMap<any>([
    ...RESERVES.map(
      ({ pubkey, accountInfo: info }) => [pubkey, info] as [PublicKey, any],
    ),
    ...extra,
  ]);
  return {
    getAccountInfo: jest.fn(
      async (pubkey: PublicKey) =>
        accounts.get(pubkey) ??
        (pubkey.equals(PHOENIX_GLOBAL_CONFIG) ? null : mintAccountInfo()),
    ),
    getMultipleAccountsInfo: jest.fn(async (keys: PublicKey[]) =>
      keys.map((key) => accounts.get(key) ?? null),
    ),
    getParsedProgramAccounts: jest.fn(async () => []),
    getProgramAccounts: jest.fn(async () => []),
  };
}

function assetMetaLookups(oracles: Map<string, OracleSpec>) {
  const assetMetas = new PkMap<any>();
  oracles.forEach((spec, mint) => {
    const pubkey = new PublicKey(mint);
    assetMetas.set(pubkey, assetMetaOf(pubkey, spec));
  });
  return {
    fetchAssetMetas: jest.fn(async () => assetMetas),
    getAssetMeta: jest.fn(async (mint: PublicKey) => {
      const spec = oracles.get(mint.toBase58());
      if (!spec) {
        throw new Error(`Asset not supported: ${mint.toBase58()}`);
      }
      return assetMetaOf(mint, spec);
    }),
    getSolOracle: jest.fn(async () => {
      const spec = oracles.get(WSOL.toBase58());
      if (!spec) {
        throw new Error("Asset not supported: WSOL");
      }
      return spec.oracle;
    }),
  };
}

/** The real Kamino Lending client, reading its reserves from the fixtures. */
function realKlend(base: any) {
  return new KaminoLendingClient(base as any, {} as any);
}

// ---------------------------------------------------------------- swap v2

const SWAP_ORACLES = oracleMap([
  [INPUT_MINT, KAMINO_ORACLE(RESERVE_KEYS[0])],
  [OUTPUT_MINT, KAMINO_ORACLE(RESERVE_KEYS[1])],
  [WSOL, KAMINO_ORACLE(RESERVE_KEYS[2])],
]);

function makeSwapClient() {
  const { getAssetMeta, getSolOracle } = assetMetaLookups(SWAP_ORACLES);
  const base = {
    statePda: STATE,
    vaultPda: VAULT,
    signer: PAYER,
    protocolProgram: programs.protocolProgram,
    connection: makeConnection(),
    getVaultAta: (mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
      getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgram),
    getAssetMeta,
    getSolOracle,
    jupiterApiClient: {},
  };
  return new JupiterSwapClient(
    base as any,
    { maybeWrapSol: jest.fn(async () => []) } as any,
    realKlend(base) as any,
  );
}

function swapV2Options(swapInstructions: any) {
  return {
    quoteParams: {
      inputMint: INPUT_MINT.toBase58(),
      outputMint: OUTPUT_MINT.toBase58(),
      amount: 1_000_000,
      slippageBps: 50,
    },
    swapInstructions,
  } as any;
}

const THREE_HOP_PATH = "swap v2 (three-hop route)";
const QUOTE_CAPPED_PATH = `swap v2 (${JUPITER_V1_MAX_QUOTE_ACCOUNTS}-account route)`;

/**
 * A swap v2 over a synthetic route that forwards `routeAccounts` accounts and
 * 320 bytes of route data, which is more route data than any fixture in the
 * repository carries. Only the account count separates the two rows below.
 */
async function measureSyntheticRoute(path: string, routeAccounts: number) {
  const client = makeSwapClient();

  const [ixs] = await client.txBuilder.swapV2Ixs(
    swapV2Options({
      swapInstruction: {
        programId: PublicKey.unique().toBase58(),
        accounts: Array.from({ length: routeAccounts }, () => ({
          pubkey: PublicKey.unique().toBase58(),
          isSigner: false,
          isWritable: false,
        })),
        data: Buffer.alloc(320, 7).toString("base64"),
      },
      addressLookupTableAddresses: [],
    }),
    PAYER,
  );

  return measure(path, ixs);
}

// ---------------------------------------------------------------- pricing

const OBSERVATION_STATE = PublicKey.findProgramAddressSync(
  [Buffer.from(SEED_OBSERVATION_STATE), STATE.toBuffer()],
  programs.extRpiProgram.programId,
)[0];

const PHOENIX_TRADER = PublicKey.unique();
const PHOENIX_PERP_ASSET_MAP = PublicKey.unique();
const MARGINFI_ACCOUNT = PublicKey.unique();
const ORCA_POSITION = PublicKey.unique();
const LOANS = [PublicKey.unique(), PublicKey.unique()];

function phoenixTraderAccountInfo() {
  return accountInfo(
    PHOENIX_PROGRAM_ID,
    Buffer.from([41, 97, 73, 105, 110, 214, 112, 9]),
  );
}

function phoenixGlobalConfigAccountInfo() {
  const data = Buffer.alloc(392);
  PHOENIX_PERP_ASSET_MAP.toBuffer().copy(data, 360);
  return accountInfo(PHOENIX_PROGRAM_ID, data);
}

function orcaPositionAccountInfo() {
  const data = Buffer.alloc(216);
  ORCA_POSITION_DISCRIMINATOR.forEach((byte, i) => {
    data[i] = byte;
  });
  return accountInfo(ORCA_WHIRLPOOLS_PROGRAM_ID, data);
}

type PricingSetup = {
  oracles: Map<string, OracleSpec>;
  externalPositions?: PublicKey[];
  protocols: {
    kaminoLending?: boolean;
    loopscale?: boolean;
    stake?: boolean;
    rpi?: boolean;
    phoenix?: boolean;
    orca?: boolean;
    marginfi?: boolean;
    bridge?: boolean;
    neutral?: boolean;
  };
  neutralBundle?: PublicKey;
  extraAccounts?: Array<[PublicKey, any]>;
  assetsForPricing?: PublicKey[];
  baseAssetMint?: PublicKey;
};

/**
 * A PriceClient over the real glam_mint program and the real klend client,
 * with the account discovery each chunk does — obligations, Loopscale
 * positions, Phoenix traders, Orca positions, stake accounts — faked at the
 * I/O boundary, so every instruction measured is the one the SDK sends.
 */
function makePriceClient(setup: PricingSetup) {
  const { protocols } = setup;
  const { fetchAssetMetas, getAssetMeta, getSolOracle } = assetMetaLookups(
    setup.oracles,
  );

  const extKaminoProgram = { programId: PublicKey.unique() };
  const extLoopscaleProgram = programs.extLoopscaleProgram;
  const extPhoenixProgram = programs.extPhoenixProgram;
  const extOrcaProgram = programs.extOrcaProgram;
  const extMarginfiProgram = programs.extMarginfiProgram;
  const extNeutralProgram = programs.extNeutralProgram;

  const integrationAcls: Array<{
    integrationProgram: PublicKey;
    protocolsBitmask: number;
  }> = [];
  if (protocols.kaminoLending) {
    integrationAcls.push({
      integrationProgram: extKaminoProgram.programId,
      protocolsBitmask: KAMINO_LENDING_PROTOCOL,
    });
  }
  if (protocols.loopscale) {
    integrationAcls.push({
      integrationProgram: extLoopscaleProgram.programId,
      protocolsBitmask:
        LOOPSCALE_BORROW_PROTOCOL |
        LOOPSCALE_LENDING_PROTOCOL |
        LOOPSCALE_VAULT_PROTOCOL,
    });
  }
  if (protocols.stake) {
    integrationAcls.push({
      integrationProgram: programs.protocolProgram.programId,
      protocolsBitmask: STAKE_PROTOCOL,
    });
  }
  if (protocols.rpi) {
    integrationAcls.push({
      integrationProgram: programs.extRpiProgram.programId,
      protocolsBitmask: RPI_PROTOCOL,
    });
  }
  if (protocols.phoenix) {
    integrationAcls.push({
      integrationProgram: extPhoenixProgram.programId,
      protocolsBitmask: PHOENIX_PROTOCOL,
    });
  }
  if (protocols.orca) {
    integrationAcls.push({
      integrationProgram: extOrcaProgram.programId,
      protocolsBitmask: ORCA_WHIRLPOOLS_PROTOCOL,
    });
  }
  if (protocols.marginfi) {
    integrationAcls.push({
      integrationProgram: extMarginfiProgram.programId,
      protocolsBitmask: MARGINFI_PROTOCOL,
    });
  }
  if (protocols.bridge) {
    integrationAcls.push({
      integrationProgram: programs.extBridgeProgram.programId,
      protocolsBitmask: LAYERZERO_OFT_PROTOCOL,
    });
  }
  if (protocols.neutral) {
    integrationAcls.push({
      integrationProgram: extNeutralProgram.programId,
      protocolsBitmask: NT_BUNDLE_PROTOCOL,
    });
  }

  const externalPositions = setup.externalPositions ?? [];
  const connection = makeConnection([
    ...(setup.extraAccounts ?? []),
    [PHOENIX_GLOBAL_CONFIG, phoenixGlobalConfigAccountInfo()],
  ]);
  if (protocols.stake) {
    connection.getParsedProgramAccounts = jest.fn(async () => [
      { pubkey: PublicKey.unique(), account: { lamports: 2 } },
      { pubkey: PublicKey.unique(), account: { lamports: 1 } },
    ]) as any;
  }
  if (protocols.neutral) {
    // Bundle discovery reads the Neutral program's accounts; the user bundle
    // PDA derived from each is what the chunk intersects with the vault's
    // tracked positions.
    connection.getProgramAccounts = jest.fn(async () => [
      {
        pubkey: setup.neutralBundle!,
        account: accountInfo(NTBUNDLE_PROGRAM_ID),
      },
    ]) as any;
  }

  const base = {
    statePda: STATE,
    vaultPda: VAULT,
    signer: PAYER,
    protocolProgram: programs.protocolProgram,
    mintProgram: programs.mintProgram,
    extKaminoProgram,
    extLoopscaleProgram,
    extPhoenixProgram,
    extOrcaProgram,
    extMarginfiProgram,
    extRpiProgram: programs.extRpiProgram,
    extBridgeProgram: programs.extBridgeProgram,
    extNeutralProgram,
    connection,
    fetchStateAccount: jest.fn(async () => ({
      baseAssetMint: setup.baseAssetMint ?? BASE_MINT,
    })),
    fetchStateModel: jest.fn(async () => ({
      accountType: StateAccountType.VAULT,
      baseAssetMint: setup.baseAssetMint ?? BASE_MINT,
      baseAssetTokenProgramId: TOKEN_PROGRAM_ID,
      assetsForPricing: setup.assetsForPricing ?? [PRICED_MINT],
      externalPositions,
      integrationAcls,
    })),
    fetchAssetMetas,
    getAssetMeta,
    getSolOracle,
    getVaultAta: (mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
      getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgram),
  };

  const klend = realKlend(base);
  // Obligation discovery reads the whole klend program's accounts; the shapes
  // it returns are what the pricing chunk consumes.
  jest.spyOn(klend, "findAndParseObligations").mockResolvedValue([
    {
      activeDeposits: [{ depositReserve: RESERVE_KEYS[0] }],
      activeBorrows: [{ borrowReserve: RESERVE_KEYS[3] }],
      getAddress: () => PublicKey.unique(),
      lendingMarket: PublicKey.unique(),
    },
  ] as any);

  const loopscaleBorrow = {
    getPriceLoansAccounts: jest.fn(async () =>
      protocols.loopscale
        ? {
            loanAccounts: LOANS,
            oracleAccounts: [RESERVE_KEYS[0], RESERVE_KEYS[1]],
            kaminoReserves: [RESERVE_KEYS[0], RESERVE_KEYS[1]],
          }
        : null,
    ),
  };
  const loopscaleLend = {
    getPriceStrategiesAccounts: jest.fn(async () => null),
  };
  const loopscaleVault = { getPriceVaultsAccounts: jest.fn(async () => null) };
  const marginfi = {
    // A marginfi pulse-health instruction, whose encoding belongs to the
    // marginfi program rather than to the SDK.
    pulseHealthIx: jest.fn(async (marginfiAccount: PublicKey) => ({
      ixs: [
        new TransactionInstruction({
          programId: MARGINFI_PROGRAM_ID,
          keys: [
            { pubkey: marginfiAccount, isSigner: false, isWritable: true },
          ],
          data: Buffer.alloc(8, 3),
        }),
      ],
    })),
  };
  const rpi = { getObservationStatePda: () => OBSERVATION_STATE };
  const bridge = {
    getRegistryPda: () => PublicKey.unique(),
    fetchRegistry: jest.fn(async () =>
      protocols.bridge
        ? { managedTransferCount: 1, transfers: [{ sourceMint: PRICED_MINT }] }
        : null,
    ),
  };

  const client = new PriceClient(
    base as any,
    klend as any,
    {} as any,
    bridge as any,
    rpi as any,
    loopscaleBorrow as any,
    loopscaleLend as any,
    loopscaleVault as any,
    marginfi as any,
    (() => undefined) as any,
  );

  return { client };
}

// -------------------------------------------------------------------- rows

describe("Kamino reserve refresh transaction sizes", () => {
  it("swap v2 with three reserves in three markets on the route fixture", async () => {
    const client = makeSwapClient();

    const [ixs] = await client.txBuilder.swapV2Ixs(
      swapV2Options(
        solToMsolSwapInstructionsForTest(
          VAULT,
          PublicKey.unique(),
          PublicKey.unique(),
        ),
      ),
      PAYER,
    );

    const row = measure("swap v2 (route fixture)", ixs);

    // The SDK passes the route's own lookup tables into every swap it builds,
    // so afterALT is the size that is sent.
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("swap v2 with three reserves on a three-hop route", async () => {
    // 48 forwarded accounts: more than a version 1 quote is ever asked for.
    const row = await measureSyntheticRoute(THREE_HOP_PATH, 48);

    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    // Documented limit: a route this long never fits without lookup tables,
    // before the refresh or after it.
    expect(row.before).toBeGreaterThan(TRANSACTION_SIZE_LIMIT);
    expect(row.after).toBeGreaterThan(TRANSACTION_SIZE_LIMIT);
  });

  it("swap v2 over the longest route the version 1 path asks a quote for", async () => {
    const row = await measureSyntheticRoute(
      QUOTE_CAPPED_PATH,
      JUPITER_V1_MAX_QUOTE_ACCOUNTS,
    );

    // 40 route accounts plus the 20 a swap v2 costs beside them.
    expect(row.v1After.accounts).toBe(60);
    expect(row.v1After.accounts).toBeLessThanOrEqual(V1_MAX_ACCOUNT_KEYS);
    expect(row.v1After.bytes).toBeLessThanOrEqual(V1_TRANSACTION_SIZE_LIMIT);
    expect(() =>
      assertV1TransactionLimits(v1Transaction(row.ixs)),
    ).not.toThrow();
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("Loopscale loans pricing with one reserve per priced asset", async () => {
    // Two loans, two priced assets, plus the SOL/USD and base asset oracles:
    // four distinct reserves, the largest count an SDK suite builds.
    const { client } = makePriceClient({
      oracles: oracleMap([
        [PRICED_MINT, PYTH],
        [COLLATERAL_MINT, KAMINO_ORACLE(RESERVE_KEYS[0])],
        [PRINCIPAL_MINT, KAMINO_ORACLE(RESERVE_KEYS[1])],
        [WSOL, KAMINO_ORACLE(RESERVE_KEYS[2])],
        [BASE_MINT, KAMINO_ORACLE(RESERVE_KEYS[3])],
      ]),
      externalPositions: LOANS,
      protocols: { loopscale: true },
    });

    const ixs = await client.priceVaultIxs();

    const row = measure("loopscale loans pricing", ixs);

    expect(row.reserves).toBe(4);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("Phoenix trader pricing with the USDC quote oracle on top", async () => {
    // SOL/USD and base asset oracles plus the USDC quote oracle a non-USDC
    // vault reads: one reserve more than before the fix.
    const { client } = makePriceClient({
      oracles: oracleMap([
        [PRICED_MINT, PYTH],
        [USDC, KAMINO_ORACLE(RESERVE_KEYS[0])],
        [WSOL, KAMINO_ORACLE(RESERVE_KEYS[1])],
        [BASE_MINT, KAMINO_ORACLE(RESERVE_KEYS[2])],
      ]),
      externalPositions: [PHOENIX_TRADER],
      extraAccounts: [[PHOENIX_TRADER, phoenixTraderAccountInfo()]],
      protocols: { phoenix: true },
    });

    const ixs = await client.priceVaultIxs();

    const row = measure("phoenix trader pricing", ixs);

    expect(row.reserves).toBe(3);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("marginfi account pricing with both named oracles", async () => {
    const { client } = makePriceClient({
      oracles: oracleMap([
        [PRICED_MINT, PYTH],
        [WSOL, KAMINO_ORACLE(RESERVE_KEYS[0])],
        [BASE_MINT, KAMINO_ORACLE(RESERVE_KEYS[1])],
      ]),
      externalPositions: [MARGINFI_ACCOUNT],
      extraAccounts: [[MARGINFI_ACCOUNT, accountInfo(MARGINFI_PROGRAM_ID)]],
      protocols: { marginfi: true },
    });

    const ixs = await client.priceVaultIxs();

    const row = measure(
      "marginfi account pricing",
      ixs,
      "marginfi pulse-health ix modelled",
    );

    expect(row.reserves).toBe(2);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("RPI observation validation with two reserves on top of the base asset's", async () => {
    const oracles = oracleMap([
      [BASE_MINT, KAMINO_ORACLE(RESERVE_KEYS[0])],
      [OBSERVED_MINT, KAMINO_ORACLE(RESERVE_KEYS[1])],
      [WSOL, KAMINO_ORACLE(RESERVE_KEYS[2])],
    ]);
    const { getAssetMeta, getSolOracle, fetchAssetMetas } =
      assetMetaLookups(oracles);
    const base: any = {
      statePda: STATE,
      vaultPda: VAULT,
      signer: PAYER,
      extRpiProgram: programs.extRpiProgram,
      connection: makeConnection(),
      fetchStateAccount: jest.fn(async () => ({
        baseAssetMint: BASE_MINT,
        baseAssetDecimals: 6,
      })),
      getAssetMeta,
      getSolOracle,
      fetchAssetMetas,
    };
    base.kaminoLending = realKlend(base);
    const client = new RpiClient(base);
    const positionId = Buffer.alloc(32, 5);
    jest.spyOn(client, "fetchObservationState").mockResolvedValue({
      positionsLen: 1,
      positions: [
        {
          positionId: Array.from(positionId),
          hasPending: true,
          pendingObservation: {
            denomination: { denom: { mint: {} }, mint: OBSERVED_MINT },
          },
        },
      ],
    } as any);

    const { ixs } = await client.txBuilder.validateObservationIxs({
      positionId,
    });

    const row = measure("rpi validate observation", ixs);

    expect(row.reserves).toBe(3);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("Orca liquidity with both pool oracles and the SOL oracle", async () => {
    // increase_liquidity_v2 with the price-deviation accounts: the largest set
    // the builder passes is glam config, both token oracles and SOL/USD, so at
    // most three reserves.
    const tokenMintA = PublicKey.unique();
    const tokenMintB = PublicKey.unique();
    const oracles = oracleMap([
      [tokenMintA, KAMINO_ORACLE(RESERVE_KEYS[0])],
      [tokenMintB, KAMINO_ORACLE(RESERVE_KEYS[1])],
      [WSOL, KAMINO_ORACLE(RESERVE_KEYS[2])],
    ]);
    const { getAssetMeta, fetchAssetMetas } = assetMetaLookups(oracles);
    const base = {
      statePda: STATE,
      vaultPda: VAULT,
      signer: PAYER,
      protocolProgram: programs.protocolProgram,
      extOrcaProgram: programs.extOrcaProgram,
      connection: makeConnection(),
      getVaultAta: (mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
        getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgram),
      fetchAssetMetas,
      getAssetMeta,
    };
    const client = new OrcaWhirlpoolsClient(base as any);
    const buildVersionedTx = jest
      .spyOn(client.txBuilder as any, "buildVersionedTx")
      .mockResolvedValue({} as any);

    await client.txBuilder.increaseLiquidityV2Tx(
      { liquidityAmount: 1, tokenMaxA: 2, tokenMaxB: 3 },
      {
        whirlpool: PublicKey.unique(),
        position: PublicKey.unique(),
        positionMint: PublicKey.unique(),
        tokenMintA,
        tokenMintB,
        tokenVaultA: PublicKey.unique(),
        tokenVaultB: PublicKey.unique(),
        tickArrayLower: PublicKey.unique(),
        tickArrayUpper: PublicKey.unique(),
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_PROGRAM_ID,
        priceDeviationAccounts: {
          tokenMintAOracle: RESERVE_KEYS[0],
          tokenMintBOracle: RESERVE_KEYS[1],
          solUsdOracle: RESERVE_KEYS[2],
        },
      } as any,
    );

    const [ixs, txOptions] = buildVersionedTx.mock.calls[0] as [
      TransactionInstruction[],
      { preInstructions?: TransactionInstruction[] },
    ];
    const row = measure("orca increase liquidity v2", [
      ...(txOptions.preInstructions ?? []),
      ...ixs,
    ]);

    expect(row.reserves).toBe(3);
    expect(row.after).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
  });

  it("vault pricing with every integration chunk in one transaction", async () => {
    // priceVaultIxs coalesces the chunks into one transaction. Every chunk
    // below is built by the real glam_mint or ext_bridge builder: vault
    // tokens, Kamino obligations, Loopscale loans, stake accounts, RPI
    // registered positions, Phoenix traders, Orca positions, bridge managed
    // transfers, Neutral bundle depositors and marginfi accounts, with five
    // distinct reserves among their oracles.
    const bundle = PublicKey.unique();
    const decodeSpy = jest
      .spyOn(NeutralBundleAccount, "decode")
      .mockReturnValue({ assetAddress: PRICED_MINT } as NeutralBundleAccount);
    const remainingAccountsSpy = jest
      .spyOn(
        OrcaWhirlpoolsClient.prototype,
        "remainingAccountsForPricingWhirlpoolPositions",
      )
      .mockResolvedValue({
        numPositions: 1,
        remainingAccounts: [ORCA_POSITION, PublicKey.unique()].map(
          (pubkey) => ({ pubkey, isSigner: false, isWritable: false }),
        ),
        kaminoReserves: [RESERVE_KEYS[4]],
      } as any);
    const { client } = makePriceClient({
      oracles: oracleMap([
        [PRICED_MINT, PYTH],
        [COLLATERAL_MINT, KAMINO_ORACLE(RESERVE_KEYS[0])],
        [PRINCIPAL_MINT, KAMINO_ORACLE(RESERVE_KEYS[1])],
        [USDC, KAMINO_ORACLE(RESERVE_KEYS[2])],
        [WSOL, KAMINO_ORACLE(RESERVE_KEYS[3])],
        [BASE_MINT, KAMINO_ORACLE(RESERVE_KEYS[4])],
      ]),
      externalPositions: [
        ...LOANS,
        OBSERVATION_STATE,
        PHOENIX_TRADER,
        MARGINFI_ACCOUNT,
        ORCA_POSITION,
        getNeutralUserBundlePda(VAULT, bundle),
      ],
      neutralBundle: bundle,
      extraAccounts: [
        [PHOENIX_TRADER, phoenixTraderAccountInfo()],
        [MARGINFI_ACCOUNT, accountInfo(MARGINFI_PROGRAM_ID)],
        [ORCA_POSITION, orcaPositionAccountInfo()],
      ],
      protocols: {
        kaminoLending: true,
        loopscale: true,
        stake: true,
        rpi: true,
        phoenix: true,
        orca: true,
        marginfi: true,
        bridge: true,
        neutral: true,
      },
    });

    const ixs = await client.priceVaultIxs();

    const row = measure(
      "vault pricing, all chunks",
      ixs,
      "floor: Jupiter Earn, Jupiter Borrow and Kamino vault shares are absent, their discovery decodes Jupiter Lending and Kamino vault accounts that only the network has",
    );

    expect(row.reserves).toBe(5);
    // The refresh, vault tokens, refresh_obligation and Kamino obligations,
    // Loopscale loans, stake accounts, RPI, the Phoenix heap frame and its
    // pricing, Orca, bridge, Neutral, the marginfi pulse and its pricing.
    expect(ixs).toHaveLength(14);
    // Each integration is priced by its own program under its own
    // integration authority (anchor_v1/PRICING.md); glam_mint prices the
    // vault tokens, the Kamino obligations and the stake accounts.
    for (const program of [
      programs.extLoopscaleProgram,
      programs.extRpiProgram,
      programs.extPhoenixProgram,
      programs.extOrcaProgram,
      programs.extBridgeProgram,
      programs.extNeutralProgram,
      programs.extMarginfiProgram,
    ]) {
      const own = ixs.filter((ix) => ix.programId.equals(program.programId));
      expect(own).toHaveLength(1);
      const integrationAuthority = getIntegrationAuthorityPda(
        program.programId,
      );
      expect(
        own[0].keys.some(({ pubkey }) => pubkey.equals(integrationAuthority)),
      ).toBe(true);
    }
    expect(
      ixs.filter((ix) => ix.programId.equals(programs.mintProgram.programId)),
    ).toHaveLength(3);
    // Documented limit: a vault with this many integrations priced in one
    // transaction needs its lookup tables, before the refresh and after it.
    expect(row.before).toBeGreaterThan(TRANSACTION_SIZE_LIMIT);
    expect(row.after).toBeGreaterThan(TRANSACTION_SIZE_LIMIT);
    expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);

    remainingAccountsSpy.mockRestore();
    decodeSpy.mockRestore();
  });

  it("costs every measured path under the packet as the SDK sends it", () => {
    // Every path above, with the lookup table the SDK passes, stays under the
    // packet after the refresh, and every one of them grew by it.
    expect(rows).toHaveLength(9);
    rows.forEach((row) => {
      expect(row.after).toBeGreaterThan(row.before);
      expect(row.afterWithAlt).toBeLessThanOrEqual(TRANSACTION_SIZE_LIMIT);
    });
  });

  it("fits every measured path under version 1 but the synthetic three-hop route", () => {
    // Version 1 carries no lookup tables, so what a path costs is what it
    // names. Every path the SDK builds today fits, with the account count
    // rather than the byte count as the binding limit.
    const tooBig = rows.filter(
      (row) =>
        row.v1After.bytes > V1_TRANSACTION_SIZE_LIMIT ||
        row.v1After.accounts > V1_MAX_ACCOUNT_KEYS,
    );
    expect(tooBig.map((row) => row.path)).toEqual([THREE_HOP_PATH]);
    rows
      .filter((row) => row.path !== THREE_HOP_PATH)
      .forEach((row) => {
        [row.v1Before, row.v1After].forEach((cost) => {
          expect(cost.bytes).toBeLessThanOrEqual(V1_TRANSACTION_SIZE_LIMIT);
          expect(cost.accounts).toBeLessThanOrEqual(V1_MAX_ACCOUNT_KEYS);
        });
        // Every one of them grew by the refresh, on both measures.
        expect(row.v1After.accounts).toBeGreaterThan(row.v1Before.accounts);
        expect(row.v1After.bytes).toBeGreaterThan(row.v1Before.bytes);
        // And the check the SDK runs before signing accepts each one.
        expect(() =>
          assertV1TransactionLimits(v1Transaction(row.ixs)),
        ).not.toThrow();
      });
  });

  it("refuses the synthetic three-hop route at the production check", () => {
    // The one row that does not fit, checked the way intoVersionedTransaction
    // checks the transaction it is about to hand over to be signed.
    const row = rows.find((candidate) => candidate.path === THREE_HOP_PATH)!;
    expect(row.v1After.accounts).toBe(68);
    expect(() => assertV1TransactionLimits(v1Transaction(row.ixs))).toThrow(
      "The transaction names 68 accounts and a version 1 transaction allows at most 64. Nothing was sent. Use fewer accounts in this transaction, or split the operation into smaller ones.",
    );
  });

  it("states the budget in the header for the same bytes as the folded form", () => {
    // The version 1 path states the budget as numbers and builds no Compute
    // Budget instruction, where the fold removes the two the version 0 path
    // builds. Both write the same message, so measuring the first is neutral.
    rows.forEach((row) => {
      const folded = compileToV1Message({
        payerKey: PAYER,
        recentBlockhash: BLOCKHASH,
        instructions: [...computeBudgetIxs(), ...row.ixs],
      });
      expect(serializeV1Transaction(new V1Transaction(folded)).length).toBe(
        row.v1After.bytes,
      );
      expect(folded.staticAccountKeys).toHaveLength(row.v1After.accounts);
    });
  });

  it("costs 20 accounts beside the route, which is what caps the quote", () => {
    // Neither synthetic route names an account GLAM also names, so what is
    // left over the route is what a swap v2 costs by itself, at both lengths.
    const besideTheRoute = (path: string, routeAccounts: number) => {
      const row = rows.find((candidate) => candidate.path === path)!;
      return {
        before: row.v1Before.accounts - routeAccounts,
        after: row.v1After.accounts - routeAccounts,
      };
    };
    expect(besideTheRoute(THREE_HOP_PATH, 48)).toEqual({
      before: 15,
      after: 20,
    });
    expect(
      besideTheRoute(QUOTE_CAPPED_PATH, JUPITER_V1_MAX_QUOTE_ACCOUNTS),
    ).toEqual({ before: 15, after: 20 });
    // The quote is asked for at most this many route accounts, which leaves
    // four under the limit at that cost.
    expect(JUPITER_V1_MAX_QUOTE_ACCOUNTS + 20).toBe(V1_MAX_ACCOUNT_KEYS - 4);
  });

  it("would cost a third as much with the reserves in the vault's lookup table", () => {
    // What extending the vault's lookup table with the reserves, their markets
    // and their Scope feeds would save on the largest measured path.
    const row = rows.find((candidate) =>
      candidate.path.startsWith("vault pricing"),
    )!;
    const altWithoutReserves = lookupTableOver(row.withoutRefresh);
    const altWithReserves = lookupTableOver(row.ixs);

    const added = row.after - row.before;
    const addedWithReservesInAlt =
      serializedSize(row.ixs, [altWithReserves]) -
      serializedSize(row.withoutRefresh, [altWithoutReserves]);

    expect(added).toBe(202);
    expect(addedWithReservesInAlt).toBeLessThan(added / 3);
  });
});
