import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ASSETS_MAINNET } from "../../src/assets";
import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import { MSOL, WSOL } from "../../src/constants";
import { fetchGlobalConfig, GlobalConfig } from "../../src/globalConfig";
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

const GLOBAL_CONFIG_DISCRIMINATOR = [149, 8, 156, 202, 160, 252, 176, 217];

describe("global config helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("decodes and normalizes onchain global config account data", () => {
    const admin = new PublicKey("6a1vKpfJ7JtjDvRzMx2WkoqgJ29E7w28ykV59wHqzP6N");
    const feeAuthority = new PublicKey(
      "9oWi2MjrAujYNTUXXNBLk1ugioaF1mJHc7EoamX4eQLZ",
    );
    const referrer = new PublicKey(
      "GLAMrG37ZqioqvzBNQGCfCUueDz3tsr7MwMFyRk9PS89",
    );
    const asset = new PublicKey("XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN");
    const oracle = new PublicKey(
      "3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C",
    );
    const data = GlobalConfig.encode({
      discriminator: GLOBAL_CONFIG_DISCRIMINATOR,
      admin,
      feeAuthority,
      referrer,
      baseFeeBps: 20,
      flowFeeBps: 150,
      assetMetas: [
        {
          asset,
          decimals: 8,
          oracle,
          oracleSourceOrdinal: 20,
          maxAgeSeconds: 30,
          priority: 2,
          padding: [0, 0, 0],
        },
      ],
    });

    const globalConfig = GlobalConfig.decode(PublicKey.default, data);

    expect(globalConfig.admin.toBase58()).toBe(admin.toBase58());
    expect(globalConfig.feeAuthority.toBase58()).toBe(feeAuthority.toBase58());
    expect(globalConfig.referrer.toBase58()).toBe(referrer.toBase58());
    expect(globalConfig.baseFeeBps).toBe(20);
    expect(globalConfig.flowFeeBps).toBe(150);
    expect(globalConfig.assetMetas).toHaveLength(1);
    expect(globalConfig.assetMetas[0]).toMatchObject({
      decimals: 8,
      oracleSourceOrdinal: 20,
      maxAgeSeconds: 30,
      priority: 2,
    });
    expect(globalConfig.assetMetas[0].asset.toBase58()).toBe(asset.toBase58());
    expect(globalConfig.assetMetas[0].oracle.toBase58()).toBe(
      oracle.toBase58(),
    );
  });
});

describe("BaseClient asset meta cache", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reuses cached asset metas and refreshes them on demand", async () => {
    const asset = new PublicKey("2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH");
    const firstOracle = new PublicKey(
      "6JkZmXGgWnzsyTQaqRARzP64iFYnpMNT4siiuUDUaB8s",
    );
    const secondOracle = new PublicKey(
      "5QZMnsyndmphvZF4BNgoMHwVZaREXeE2rpBoCPMxgCCd",
    );
    const fetchGlobalConfigMock = jest.mocked(fetchGlobalConfig);
    const fetchMintsAndTokenProgramsMock = jest.mocked(
      fetchMintsAndTokenPrograms,
    );

    fetchGlobalConfigMock
      .mockResolvedValueOnce({
        admin: PublicKey.default,
        feeAuthority: PublicKey.default,
        referrer: PublicKey.default,
        baseFeeBps: 0,
        flowFeeBps: 0,
        assetMetas: [
          {
            asset,
            decimals: 6,
            oracle: firstOracle,
            oracleSourceOrdinal: 1,
            maxAgeSeconds: 30,
            priority: 0,
            padding: [0, 0, 0],
          },
        ],
      } as unknown as GlobalConfig)
      .mockResolvedValueOnce({
        admin: PublicKey.default,
        feeAuthority: PublicKey.default,
        referrer: PublicKey.default,
        baseFeeBps: 0,
        flowFeeBps: 0,
        assetMetas: [
          {
            asset,
            decimals: 6,
            oracle: secondOracle,
            oracleSourceOrdinal: 2,
            maxAgeSeconds: 30,
            priority: 0,
            padding: [0, 0, 0],
          },
        ],
      } as unknown as GlobalConfig);
    fetchMintsAndTokenProgramsMock.mockResolvedValue([
      {
        mint: {} as any,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      },
    ]);

    const client = Object.assign(Object.create(BaseClient.prototype), {
      cluster: ClusterNetwork.Mainnet,
      provider: { connection: {} },
    }) as BaseClient;

    const first = await client.fetchAssetMetas();
    const cached = await client.fetchAssetMetas();
    const refreshed = await client.refreshAssetMetaCache();

    expect(fetchGlobalConfigMock).toHaveBeenCalledTimes(2);
    expect(cached).toBe(first);
    expect(first.get(asset.toBase58())?.oracle.toBase58()).toBe(
      firstOracle.toBase58(),
    );
    expect(first.get(asset.toBase58())?.programId?.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
    expect(refreshed.get(asset.toBase58())?.oracle.toBase58()).toBe(
      secondOracle.toBase58(),
    );
    expect(refreshed.get(asset.toBase58())?.programId?.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
    expect(fetchMintsAndTokenProgramsMock).toHaveBeenCalledTimes(2);
  });
});

describe("BaseClient asset metas with deprecated registrations", () => {
  const asset = new PublicKey("2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH");
  const activeOracle = new PublicKey(
    "6JkZmXGgWnzsyTQaqRARzP64iFYnpMNT4siiuUDUaB8s",
  );
  const otherOracle = new PublicKey(
    "5QZMnsyndmphvZF4BNgoMHwVZaREXeE2rpBoCPMxgCCd",
  );
  // glam_config `deprecate_asset_meta` sets the priority to -1.
  const DEPRECATED = -1;

  const registration = (
    mint: PublicKey,
    oracle: PublicKey,
    priority: number,
  ) => ({
    asset: mint,
    decimals: 6,
    oracle,
    oracleSourceOrdinal: 1,
    maxAgeSeconds: 30,
    priority,
    padding: [0, 0, 0],
  });

  const clientWith = (
    registrations: ReturnType<typeof registration>[],
  ): BaseClient => {
    jest.mocked(fetchGlobalConfig).mockResolvedValue({
      admin: PublicKey.default,
      feeAuthority: PublicKey.default,
      referrer: PublicKey.default,
      baseFeeBps: 0,
      flowFeeBps: 0,
      assetMetas: registrations,
    } as unknown as GlobalConfig);
    // One result per requested mint, whatever the client asks for.
    jest
      .mocked(fetchMintsAndTokenPrograms)
      .mockImplementation(async (_connection, mints) =>
        mints.map(() => ({
          mint: {} as any,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })),
      );

    return Object.assign(Object.create(BaseClient.prototype), {
      cluster: ClusterNetwork.Mainnet,
      provider: { connection: {} },
    }) as BaseClient;
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("keeps the active registration when a deprecated one follows it", async () => {
    const client = clientWith([
      registration(asset, activeOracle, 0),
      registration(asset, otherOracle, DEPRECATED),
    ]);

    const assetMeta = await client.getAssetMeta(asset);

    expect(assetMeta.oracle.toBase58()).toBe(activeOracle.toBase58());
  });

  it("keeps the active registration when a deprecated one precedes it", async () => {
    const client = clientWith([
      registration(asset, otherOracle, DEPRECATED),
      registration(asset, activeOracle, 0),
    ]);

    const assetMeta = await client.getAssetMeta(asset);

    expect(assetMeta.oracle.toBase58()).toBe(activeOracle.toBase58());
  });

  it("resolves the SOL oracle from the active registration", async () => {
    const client = clientWith([
      registration(WSOL, activeOracle, 0),
      registration(WSOL, otherOracle, DEPRECATED),
    ]);

    expect((await client.getSolOracle()).toBase58()).toBe(
      activeOracle.toBase58(),
    );
  });

  it("refuses a mint whose registrations are all deprecated", async () => {
    const client = clientWith([
      registration(asset, activeOracle, DEPRECATED),
      registration(asset, otherOracle, DEPRECATED),
    ]);

    expect((await client.fetchAssetMetas()).get(asset)).toBeUndefined();
    await expect(client.getAssetMeta(asset)).rejects.toThrow(
      `Asset not supported: ${asset.toBase58()}`,
    );
  });

  it("falls back to the built in asset list when every registration is deprecated", async () => {
    const client = clientWith([registration(MSOL, otherOracle, DEPRECATED)]);

    const assetMeta = await client.getAssetMeta(MSOL);

    expect(assetMeta).toBe(ASSETS_MAINNET.get(MSOL));
    expect(assetMeta.oracle.toBase58()).not.toBe(otherOracle.toBase58());
  });

  // Records today's behaviour, not a ruling: how the priority number ranks
  // several active registrations of one mint is an open owner decision.
  it("leaves several active registrations in array order, the last one read", async () => {
    const lowLast = await clientWith([
      registration(asset, otherOracle, 5),
      registration(asset, activeOracle, 0),
    ]).getAssetMeta(asset);
    const highLast = await clientWith([
      registration(asset, activeOracle, 0),
      registration(asset, otherOracle, 5),
    ]).getAssetMeta(asset);

    expect(lowLast.oracle.toBase58()).toBe(activeOracle.toBase58());
    expect(highLast.oracle.toBase58()).toBe(otherOracle.toBase58());
  });
});
