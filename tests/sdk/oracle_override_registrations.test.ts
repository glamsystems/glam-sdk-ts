import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { PriceClient } from "../../src/client/price";
import { RpiClient } from "../../src/client/rpi";
import { ClusterNetwork } from "../../src/clientConfig";
import { WSOL } from "../../src/constants";
import {
  fetchGlobalConfig,
  getOracleName,
  GlobalConfig,
} from "../../src/globalConfig";
import { fetchMintsAndTokenPrograms } from "../../src/utils/accounts";

jest.mock("../../src/globalConfig", () => {
  const actual = jest.requireActual("../../src/globalConfig");
  return {
    ...actual,
    fetchGlobalConfig: jest.fn(),
  };
});

jest.mock("../../src/utils/accounts", () => {
  const actual = jest.requireActual("../../src/utils/accounts");
  return {
    ...actual,
    fetchMintsAndTokenPrograms: jest.fn(),
  };
});

const BASE_MINT = PublicKey.unique();
const OBSERVED_MINT = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const ACTIVE_RESERVE = PublicKey.unique();
const DEPRECATED_RESERVE = PublicKey.unique();
// glam_config `deprecate_asset_meta` sets the priority to -1.
const DEPRECATED = -1;

function ordinalOf(oracleSource: string): number {
  for (let ordinal = 0; ordinal < 256; ordinal++) {
    if (getOracleName(ordinal) === oracleSource) {
      return ordinal;
    }
  }
  throw new Error(`Oracle source not in the glam_config IDL: ${oracleSource}`);
}

const registration = (
  asset: PublicKey,
  oracle: PublicKey,
  oracleSource: string,
  priority: number,
) => ({
  asset,
  decimals: 6,
  oracle,
  oracleSourceOrdinal: ordinalOf(oracleSource),
  maxAgeSeconds: 30,
  priority,
  padding: [0, 0, 0],
});

/**
 * The real BaseClient registration lookups over a decoded GlobalConfig; only
 * the account fetches are replaced.
 */
function baseClientWith(
  registrations: ReturnType<typeof registration>[],
  extras: Record<string, unknown> = {},
): BaseClient {
  jest.mocked(fetchGlobalConfig).mockResolvedValue({
    admin: PublicKey.default,
    feeAuthority: PublicKey.default,
    referrer: PublicKey.default,
    baseFeeBps: 0,
    flowFeeBps: 0,
    assetMetas: registrations,
  } as unknown as GlobalConfig);
  jest
    .mocked(fetchMintsAndTokenPrograms)
    .mockImplementation(async (_connection, mints) =>
      mints.map(() => ({ mint: {} as any, tokenProgram: TOKEN_PROGRAM_ID })),
    );

  const base = Object.assign(Object.create(BaseClient.prototype), {
    cluster: ClusterNetwork.Mainnet,
    provider: { connection: {} },
  });
  // Own properties, because BaseClient declares some of these as accessors.
  Object.entries(extras).forEach(([name, value]) => {
    Object.defineProperty(base, name, { value });
  });
  return base as BaseClient;
}

function pubkeys(actual: Iterable<PublicKey>): string[] {
  return Array.from(actual, (pubkey) => pubkey.toBase58()).sort();
}

// The programs accept a registered (mint, oracle) pair whatever its priority,
// and klend stales a reserve whoever passes it. So a caller that names a
// deprecated Kamino reserve as its oracle still needs the refresh in front.
describe("caller-supplied oracle that is a deprecated Kamino reserve", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("is refreshed by RPI observation validation", async () => {
    const positionId = Buffer.alloc(32, 5);
    const base = baseClientWith(
      [
        registration(BASE_MINT, PYTH_ORACLE, "PythPull", 0),
        registration(WSOL, PYTH_ORACLE, "PythPull", 0),
        registration(
          OBSERVED_MINT,
          DEPRECATED_RESERVE,
          "KaminoReserve",
          DEPRECATED,
        ),
      ],
      {
        statePda: PublicKey.unique(),
        extRpiProgram: {
          programId: PublicKey.unique(),
          account: {
            observationState: {
              fetchNullable: async () => ({
                positionsLen: 1,
                positions: [
                  {
                    positionId: Array.from(positionId),
                    hasPending: true,
                    pendingObservation: {
                      denomination: {
                        denom: { mint: {} },
                        mint: OBSERVED_MINT,
                      },
                    },
                  },
                ],
              }),
            },
          },
        },
        fetchStateAccount: async () => ({
          baseAssetMint: BASE_MINT,
          baseAssetDecimals: 6,
        }),
      },
    );

    const accounts = await new RpiClient(
      base,
    ).resolveValidateObservationAccounts({
      positionId,
      observedMintOracle: DEPRECATED_RESERVE,
    } as any);

    expect(pubkeys(accounts.remainingAccounts.map((a) => a.pubkey))).toEqual([
      DEPRECATED_RESERVE.toBase58(),
    ]);
    expect(pubkeys(accounts.kaminoReservesToRefresh)).toEqual([
      DEPRECATED_RESERVE.toBase58(),
    ]);
  });

  it("is refreshed by the pricing oracle accounts", async () => {
    const base = baseClientWith([
      registration(BASE_MINT, ACTIVE_RESERVE, "KaminoReserve", 0),
      registration(WSOL, PYTH_ORACLE, "PythPull", 0),
      registration(WSOL, DEPRECATED_RESERVE, "KaminoReserve", DEPRECATED),
    ]);
    const price = new PriceClient(
      base,
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

    const accounts = await (price as any).pricingOracleAccounts({
      solUsdOracle: DEPRECATED_RESERVE,
      baseAssetMint: BASE_MINT,
    });

    expect(accounts.solUsdOracle.toBase58()).toBe(
      DEPRECATED_RESERVE.toBase58(),
    );
    expect(pubkeys(accounts.kaminoReserves)).toEqual(
      [ACTIVE_RESERVE, DEPRECATED_RESERVE].map((p) => p.toBase58()).sort(),
    );
  });

  it("still leaves the deprecated reserve out of the asset meta map", async () => {
    const base = baseClientWith([
      registration(WSOL, PYTH_ORACLE, "PythPull", 0),
      registration(WSOL, DEPRECATED_RESERVE, "KaminoReserve", DEPRECATED),
    ]);

    expect((await base.getSolOracle()).toBase58()).toBe(PYTH_ORACLE.toBase58());
  });
});
