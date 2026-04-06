import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { LstList } from "@glamsystems/sanctum-lst-list";
import { ClusterNetwork } from "./clientConfig";

export const STAKE_POOLS = LstList.filter(
  (lst) =>
    lst.pool.program === "Spl" ||
    lst.pool.program === "Marinade" ||
    lst.pool.program === "SanctumSpl" ||
    lst.pool.program === "SanctumSplMulti",
)
  .map((lst) => {
    const { pool, program } = lst.pool as any;
    const poolState =
      program === "Marinade"
        ? "8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC"
        : pool;
    if (!poolState) {
      throw new Error("Invalid pool state for LST: " + lst.name);
    }

    return {
      name: lst.name,
      symbol: lst.symbol,
      mint: lst.mint,
      decimals: lst.decimals,
      logoURI: lst.logoUri,
      tokenProgram: new PublicKey(lst.tokenProgram),
      poolState: new PublicKey(poolState),
      isMarinade: program === "Marinade",
    };
  })
  .sort((a, b) => {
    if (a.isMarinade !== b.isMarinade) return a.isMarinade ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });

export const STAKE_POOLS_MAP = new Map(STAKE_POOLS.map((p) => [p.mint, p]));

/**
 * Metadata for an asset for pricing
 */
export interface AssetMeta {
  decimals: number;
  oracle: PublicKey;
  programId?: PublicKey;
  aggIndex?: number;
  oracleSource?: string;
}

/**
 * Asset-Oracle mapping supported by the protocol. This map is a mirror of onchain mapping stored in `global_config` https://solscan.io/account/6avract7PxKqoq6hdmpAgGKgJWoJWdiXPPzzFZ62Hck6
 *
 * Note that we use functional prices for LSTs, and the oracle pubkey of a LST asset is the pool state.
 */
export const ASSETS_MAINNET: Map<string, AssetMeta> = new Map([
  [
    // SOL
    "So11111111111111111111111111111111111111112",
    {
      decimals: 9,
      oracle: new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"),
      oracleSource: "PythPull",
    },
  ],
  [
    // USD Coin - USDC
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    {
      decimals: 6,
      oracle: new PublicKey("Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX"),
      oracleSource: "PythPull",
    },
  ],
  [
    // USDG
    "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    {
      decimals: 6,
      oracle: new PublicKey("6JkZmXGgWnzsyTQaqRARzP64iFYnpMNT4siiuUDUaB8s"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "PythPull",
    },
  ],
  [
    "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",
    {
      decimals: 6,
      oracle: new PublicKey("ArjngUHXrQPr1wH9Bqrji9hdDQirM6ijbzc1Jj1fXUk7"),
      oracleSource: "PythPull",
    },
  ],
  [
    "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",
    {
      decimals: 9,
      oracle: new PublicKey("GHKcxocPyzSjy7tWApQjKRkDNuVXd4Kk624zhuaR7xhC"),
      oracleSource: "PythPull",
    },
  ],
  [
    "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    {
      decimals: 8,
      oracle: new PublicKey("BXunfRSyiQWJHv88qMvE42mpMpksWEC8Bf13p2msnRms"),
      oracleSource: "PythPull",
    },
  ],
  [
    "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn",
    {
      decimals: 8,
      oracle: new PublicKey("4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo"),
      oracleSource: "PythPull",
    },
  ],
  [
    "zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg",
    {
      decimals: 8,
      oracle: new PublicKey("4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo"),
      oracleSource: "PythPull",
    },
  ],
  [
    "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    {
      decimals: 8,
      oracle: new PublicKey("4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo"),
      oracleSource: "PythPull",
    },
  ],
  [
    "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    {
      decimals: 8,
      oracle: new PublicKey("4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo"),
      oracleSource: "PythPull",
    },
  ],
]);

const RWA_ASSETS: [string, AssetMeta][] = [
  [
    // GOOGLx
    "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    {
      decimals: 8,
      oracle: new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"), // scope prices
      programId: TOKEN_2022_PROGRAM_ID,
      aggIndex: 342,
      oracleSource: "ChainlinkRWA",
    },
  ],
  [
    // AAPLx
    "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    {
      decimals: 8,
      oracle: new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"), // scope prices
      programId: TOKEN_2022_PROGRAM_ID,
      aggIndex: 343,
      oracleSource: "ChainlinkRWA",
    },
  ],
  [
    // TSLAx
    "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    {
      decimals: 8,
      oracle: new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"), // scope prices
      programId: TOKEN_2022_PROGRAM_ID,
      aggIndex: 335,
      oracleSource: "ChainlinkRWA",
    },
  ],
  [
    // NVDAx
    "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    {
      decimals: 8,
      oracle: new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"), // scope prices
      programId: TOKEN_2022_PROGRAM_ID,
      aggIndex: 341,
      oracleSource: "ChainlinkRWA",
    },
  ],
];
RWA_ASSETS.forEach(([mint, meta]) => {
  ASSETS_MAINNET.set(mint, meta);
});
STAKE_POOLS.forEach((p) => {
  ASSETS_MAINNET.set(p.mint, {
    decimals: p.decimals,
    oracle: new PublicKey(p.poolState),
    oracleSource: p.isMarinade ? "MarinadeState" : "LstPoolState",
  });
});

export const ASSETS_TESTS: Map<string, AssetMeta> = new Map([]);

export const SOL_ORACLE = ASSETS_MAINNET.get(
  "So11111111111111111111111111111111111111112",
)!.oracle;
export const USDC_ORACLE = ASSETS_MAINNET.get(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
)!.oracle;

/**
 * Get metadata of an asset for pricing
 *
 * @param assetMint Token mint of the asset
 * @param cluster The cluster network (defaults to mainnet)
 * @returns Metadata of the asset
 */
export function getAssetMeta(
  assetMint: string | PublicKey,
  cluster: ClusterNetwork = ClusterNetwork.Mainnet,
): AssetMeta {
  const mint =
    assetMint instanceof PublicKey ? assetMint.toBase58() : assetMint;

  let assetMeta = ASSETS_MAINNET.get(mint);
  if (!assetMeta && cluster !== ClusterNetwork.Mainnet) {
    assetMeta = ASSETS_TESTS.get(mint);
  }
  if (!assetMeta) {
    throw new Error("Asset not supported: " + assetMint);
  }
  return assetMeta;
}
