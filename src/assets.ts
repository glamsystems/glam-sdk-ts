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
).map((lst) => {
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
}).sort((a, b) => {
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
      oracle: new PublicKey("3m6i4RFWEDw2Ft4tFHPJtYgmpPe21k56M3FHeWYrgGBz"),
      oracleSource: "Pyth",
    },
  ],
  [
    // wBTC
    "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    {
      decimals: 8,
      oracle: new PublicKey("fqPfDa6uQr9ndMvwaFp4mUBeUrHmLop8Jxfb1XJNmVm"),
      oracleSource: "Pyth",
    },
  ],
  [
    // cbBTC
    "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    {
      decimals: 8,
      oracle: new PublicKey("9jPy6EHpLkXaMdvfkoVnRnSdJoQysQDKKj3bW5Amz4Ci"),
      oracleSource: "Pyth",
    },
  ],
  [
    // wETH
    "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    {
      decimals: 8,
      oracle: new PublicKey("6bEp2MiyoiiiDxcVqE8rUHQWwHirXUXtKfAEATTVqNzT"),
      oracleSource: "Pyth",
    },
  ],
  [
    // JUP
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    {
      decimals: 6,
      oracle: new PublicKey("DXqKSHyhTBKEW4qgnL7ycbf3Jca5hCvUgWHFYWsh4KJa"),
      oracleSource: "Pyth",
    },
  ],
  [
    // JLP
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    {
      decimals: 6,
      oracle: new PublicKey("5Mb11e5rt1Sp6A286B145E4TmgMzsM2UX9nCF2vas5bs"),
      oracleSource: "Pyth",
    },
  ],
  [
    // USD Coin - USDC
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    {
      decimals: 6,
      oracle: new PublicKey("9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV"),
      oracleSource: "Pyth",
    },
  ],
  [
    // USDT - USDT
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    {
      decimals: 6,
      oracle: new PublicKey("JDKJSkxjasBGL3ce1pkrN6tqDzuVUZPWzzkGuyX8m9yN"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Ondo US Dollar Yield - USDY
    "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6",
    {
      decimals: 6,
      oracle: new PublicKey("9PgHM68FNGDK6nHb29ERDBcFrV6gNMD8LyUqwxbyyeb2"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Global Dollar - USDG
    "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    {
      decimals: 6,
      oracle: new PublicKey("6JkZmXGgWnzsyTQaqRARzP64iFYnpMNT4siiuUDUaB8s"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "Pyth",
    },
  ],
  [
    // PayPal USD - PYUSD
    "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    {
      decimals: 6,
      oracle: new PublicKey("5QZMnsyndmphvZF4BNgoMHwVZaREXeE2rpBoCPMxgCCd"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "Pyth",
    },
  ],
  [
    // USDe
    "DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT",
    {
      decimals: 6,
      oracle: new PublicKey("5uR6oza6teuMRpjsbMi9fDhCDid2hoYdRBiLW7WzcK54"),
      oracleSource: "Pyth",
    },
  ],
  [
    // sUSDe
    "Eh6XEPhSwoLv5wFApukmnaVSHQ6sAnoD9BmgmwQoN2sN",
    {
      decimals: 6,
      oracle: new PublicKey("BRuNuzLAPHHGSSVAJPKMcmJMdgDfrekvnSxkxPDGdeqp"),
      oracleSource: "Pyth",
    },
  ],
  [
    // USDS
    "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
    {
      decimals: 6,
      oracle: new PublicKey("7pT9mxKXyvfaZKeKy1oe2oV2K1RFtF7tPEJHUY3h2vVV"),
      oracleSource: "Pyth",
    },
  ],
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
  [
    // Bonk - Bonk
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    {
      decimals: 6,
      oracle: new PublicKey("BERaNi6cpEresbq6HC1EQGaB1H1UjvEo4NGnmYSSJof4"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Raydium - RAY
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    {
      decimals: 6,
      oracle: new PublicKey("6VXU2P9BJkuPkfA7FJVonBtAo1c2pGnHoV9rxsdZKZyb"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Helium Network Token - HNT
    "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
    {
      decimals: 8,
      oracle: new PublicKey("AEPgc6qUTCT8AwdckPcGbJXtcM9bj8mGYAyHE4BscJtm"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Kamino - KMNO
    "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",
    {
      decimals: 6,
      oracle: new PublicKey("6ua3DK1sHoYyNi15dsxy6RYwUcZPDDXfyChzaRMaheQF"),
      oracleSource: "Pyth",
    },
  ],

  [
    // Tensor - TNSR
    "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6",
    {
      decimals: 9,
      oracle: new PublicKey("EX6r1GdfsgcUsY6cQ6YsToV4RGsb4HKpjrkokK2DrmsS"),
      oracleSource: "Pyth",
    },
  ],
  [
    // JITO - JTO
    "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    {
      decimals: 9,
      oracle: new PublicKey("CGCz4mB8NsDddCq6BZToRUDUuktzsAfpKYh6ATgyyCGF"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Drift - DRIFT
    "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7",
    {
      decimals: 6,
      oracle: new PublicKey("5VJou4ufN2vE11zyZUaLsKLTXhyzCTgiq6QDsts2YnnD"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Render Token - RENDER
    "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    {
      decimals: 8,
      oracle: new PublicKey("97EqsAGbTnShB7oYWAFFCVVAx8PWXgDYDhcpm99izNQ4"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Wormhole Token - W
    "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
    {
      decimals: 6,
      oracle: new PublicKey("CsFUXiA5dM4eCKjVBBy8tXhXzDkDRNoYjU5rjpHyfNEZ"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Pyth Network - PYTH
    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    {
      decimals: 6,
      oracle: new PublicKey("6Sfx8ZAt6xaEgMXTahR6GrT7oYB6nFBMoVyCmMyHmeJV"),
      oracleSource: "Pyth",
    },
  ],
  [
    // dogwifhat - $WIF
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    {
      decimals: 6,
      oracle: new PublicKey("4QXWStoyEErTZFVsvKrvxuNa6QT8zpeA8jddZunSGvYE"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Infinity - INF
    "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    {
      decimals: 9,
      oracle: new PublicKey("B7RUYg2zF6UdUSHv2RmpnriPVJccYWojgFydNS1NY5F8"),
      oracleSource: "Switchboard",
    },
  ],
  [
    // BlazeStake Staked SOL (bSOL) - bSOL
    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    {
      decimals: 9,
      oracle: new PublicKey("BmDWPMsytWmYkh9n6o7m79eVshVYf2B5GVaqQ2EWKnGH"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Popcat - POPCAT
    "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    {
      decimals: 9,
      oracle: new PublicKey("C5fiAmQyjdfDR4EGepZqnEL3fJwMBav5yoAk6XyKMF6u"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Cloud - CLOUD
    "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu",
    {
      decimals: 9,
      oracle: new PublicKey("9Ennia27iT83kNAk3JtRKxSMzuCzsVtT4MzuxpE7anME"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Binance Staked SOL - BNSOL
    "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85",
    {
      decimals: 9,
      oracle: new PublicKey("8DmXTfhhtb9kTcpTVfb6Ygx8WhZ8wexGqcpxfn23zooe"),
      oracleSource: "Pyth",
    },
  ],
  [
    // MOTHER IGGY - MOTHER
    "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN",
    {
      decimals: 6,
      oracle: new PublicKey("469WQgfJ6AJ3eJ8FUcdhiZawf7yNChA3hseTSyhFatHZ"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Magic Eden - ME
    "MEFNBXixkEbait3xn9bkm8WsJzXtVsaJEn4c8Sam21u",
    {
      decimals: 6,
      oracle: new PublicKey("BboTg1yT114FQkqT6MM3P3G3CcCktuM2RePgU8Gr3K4A"),
      oracleSource: "Pyth",
    },
  ],
  [
    // META - META
    "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr",
    {
      decimals: 9,
      oracle: new PublicKey("DwYF1yveo8XTF1oqfsqykj332rjSxAd7bR6Gu6i4iUET"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Pudgy Penguins - PENGU
    "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
    {
      decimals: 6,
      oracle: new PublicKey("4A3KroGPjZxPAeBNF287V3NyRwV2q8iBi1vX7kHxTCh7"),
      oracleSource: "Pyth",
    },
  ],
  [
    // ai16z - ai16z
    "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC",
    {
      decimals: 9,
      oracle: new PublicKey("3BGheQVvYtBNpBKSUXSTjpyKQc3dh8iiwT91Aiq7KYCU"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "Pyth",
    },
  ],
  [
    // OFFICIAL TRUMP - TRUMP
    "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    {
      decimals: 6,
      oracle: new PublicKey("FPQjZYvHRGy51guJ77p7n9u9b8eo1ktKRc2D2g5Vysth"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Melania Meme - MELANIA
    "FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P",
    {
      decimals: 6,
      oracle: new PublicKey("3RgNWYYcZCKf5uZfriK8ASUbGQErhH6YbpdvZQ7ZKDCf"),
      oracleSource: "Pyth",
    },
  ],
  [
    // AUSD - AUSD
    "AUSD1jCcCyPLybk1YnvPWsHQSrZ46dxwoMniN4N2UEB9",
    {
      decimals: 6,
      oracle: new PublicKey("8FZhpiM8n3mpgvENWLcEvHsKB1bBhYBAyL4Ypr4gptLZ"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "Pyth",
    },
  ],
  [
    // zBTC - zBTC
    "zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg",
    {
      decimals: 8,
      oracle: new PublicKey("CN9QvvbGQzMnN8vJaSek2so4vFnTqgJDFrdJB8Y4tQfB"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Fartcoin - Fartcoin
    "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
    {
      decimals: 6,
      oracle: new PublicKey("2sZomfWMDuQLcFak3nuharXorHrZ3hK8iaML6ZGSHtso"),
      oracleSource: "Pyth",
    },
  ],
  [
    // ZEUS - ZEUS
    "ZEUS1aR7aX8DFFJf5QjWj2ftDDdNTroMNGo8YoQm3Gq",
    {
      decimals: 6,
      oracle: new PublicKey("8cH72H3vqYPArV9QvkYJkwzTdsdNPPgVPrusz9sMmgNN"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Pump - PUMP
    "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    {
      decimals: 6,
      oracle: new PublicKey("5r8RWTaRiMgr9Lph3FTUE3sGb1vymhpCrm83Bovjfcps"),
      programId: TOKEN_2022_PROGRAM_ID,
      oracleSource: "Pyth",
    },
  ],
  [
    // EURC - EURC
    "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    {
      decimals: 6,
      oracle: new PublicKey("BkdSPLmw4W6twrJjAePw2bJAwDTBtxJ9t6LvNHfcBKg1"),
      oracleSource: "Pyth",
    },
  ],
  [
    // DeFi Development Corp Staked SOL - dfdvSOL
    "sctmB7GPi5L2Q5G9tUSzXvhZ4YiDMEGcRov9KfArQpx",
    {
      decimals: 9,
      oracle: new PublicKey("EUQQD2fNN7h7su5TbWpUnf22zeGtF3RjEX2hgX2YPfLd"),
      oracleSource: "Pyth",
    },
  ],
  [
    // Syrup USDC - syrupUSDC
    "AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj",
    {
      decimals: 6,
      oracle: new PublicKey("GqqkoqHU5pqgTvL88xSCipH9txbPETyzvAvybQ3zRpzw"),
      oracleSource: "Pyth",
    },
  ],
]);
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
