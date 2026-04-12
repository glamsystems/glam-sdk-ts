import GlamConfigIdlJson from "../../target/idl/glam_config.json";
import { normalizeOracleSource } from "../../src/globalConfig";

import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  decodeGlobalConfigAccount,
  fetchGlobalConfig,
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

const GLOBAL_CONFIG_DISCRIMINATOR = Buffer.from([
  149, 8, 156, 202, 160, 252, 176, 217,
]);

function encodeAssetMeta(assetMeta: {
  asset: PublicKey;
  decimals: number;
  oracle: PublicKey;
  oracleSourceOrdinal: number;
  maxAgeSeconds: number;
  priority: number;
}): Buffer {
  const data = Buffer.alloc(72);

  assetMeta.asset.toBuffer().copy(data, 0);
  data.writeUInt8(assetMeta.decimals, 32);
  assetMeta.oracle.toBuffer().copy(data, 33);
  data.writeUInt8(assetMeta.oracleSourceOrdinal, 65);
  data.writeUInt16LE(assetMeta.maxAgeSeconds, 66);
  data.writeUInt8(assetMeta.priority, 68);

  return data;
}

function encodeGlobalConfigAccount(params: {
  admin: PublicKey;
  feeAuthority: PublicKey;
  referrer: PublicKey;
  baseFeeBps: number;
  flowFeeBps: number;
  assetMetas: {
    asset: PublicKey;
    decimals: number;
    oracle: PublicKey;
    oracleSourceOrdinal: number;
    maxAgeSeconds: number;
    priority: number;
  }[];
}): Buffer {
  const header = Buffer.alloc(112);

  GLOBAL_CONFIG_DISCRIMINATOR.copy(header, 0);
  params.admin.toBuffer().copy(header, 8);
  params.feeAuthority.toBuffer().copy(header, 40);
  params.referrer.toBuffer().copy(header, 72);
  header.writeUInt16LE(params.baseFeeBps, 104);
  header.writeUInt16LE(params.flowFeeBps, 106);
  header.writeUInt32LE(params.assetMetas.length, 108);

  return Buffer.concat([header, ...params.assetMetas.map(encodeAssetMeta)]);
}

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
    const data = encodeGlobalConfigAccount({
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
        },
      ],
    });

    const globalConfig = decodeGlobalConfigAccount(data);

    expect(globalConfig.admin.toBase58()).toBe(admin.toBase58());
    expect(globalConfig.feeAuthority.toBase58()).toBe(feeAuthority.toBase58());
    expect(globalConfig.referrer.toBase58()).toBe(referrer.toBase58());
    expect(globalConfig.baseFeeBps).toBe(20);
    expect(globalConfig.flowFeeBps).toBe(150);
    expect(globalConfig.assetMetas).toHaveLength(1);
    expect(globalConfig.assetMetas[0]).toMatchObject({
      decimals: 8,
      oracleSource: "ChainlinkRWA",
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
            oracleSource: "Pyth",
            maxAgeSeconds: 30,
            priority: 0,
          },
        ],
      })
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
            oracleSource: "Pyth",
            maxAgeSeconds: 30,
            priority: 0,
          },
        ],
      });
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

function toLowerCamelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

describe("normalizeOracleSource", () => {
  it("normalizes every OracleSource variant declared in the glam_config IDL", () => {
    const oracleSourceType = (
      GlamConfigIdlJson as {
        types?: Array<{
          name: string;
          type: { kind: string; variants?: Array<{ name: string }> };
        }>;
      }
    ).types?.find((type) => type.name === "OracleSource");

    expect(oracleSourceType?.type.kind).toBe("enum");

    for (const variant of oracleSourceType?.type.variants || []) {
      expect(normalizeOracleSource(variant.name)).toBe(variant.name);
      expect(normalizeOracleSource(toLowerCamelCase(variant.name))).toBe(
        variant.name,
      );
      expect(
        normalizeOracleSource({ [toLowerCamelCase(variant.name)]: {} }),
      ).toBe(variant.name);
    }
  });
});
