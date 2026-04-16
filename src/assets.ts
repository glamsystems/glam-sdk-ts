import { PublicKey } from "@solana/web3.js";
import { LstList } from "@glamsystems/sanctum-lst-list";
import { PkMap } from "./utils/pkmap";

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
  asset: PublicKey;
  decimals: number;
  oracle: PublicKey;
  programId: PublicKey;
  oracleSource: string;
}

/**
 * Transforms the LST list into a map of asset metas.
 *
 * We use functional prices for LSTs, and the oracle pubkey of a LST
 * asset is the pool state.
 */
export const ASSETS_MAINNET: PkMap<AssetMeta> = new PkMap(
  STAKE_POOLS.map((p): [string, AssetMeta] => [
    p.mint,
    {
      asset: new PublicKey(p.mint),
      decimals: p.decimals,
      oracle: p.poolState,
      programId: p.tokenProgram,
      oracleSource: p.isMarinade ? "MarinadeState" : "LstPoolState",
    },
  ]),
);
