import {
  AccountInfo,
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import * as borsh from "@coral-xyz/borsh";

import { KAMINO_LENDING_PROGRAM } from "../../constants";
import { Reserve } from "../../deser";
import { PkSet } from "../../utils";

/**
 * glam_config's oracle source name for a Kamino Lending reserve used as a
 * price oracle. klend marks such a reserve stale on every deposit, borrow,
 * withdraw, repay and liquidation, and GLAM's programs reject a stale reserve
 * (ReserveStale), so every transaction that reads one as an oracle needs a
 * klend refresh_reserves_batch in front of it.
 */
export const KAMINO_RESERVE_ORACLE_SOURCE = "KaminoReserve";

/** The part of an asset meta that decides whether its oracle is a klend reserve. */
export type OracleSourcedAssetMeta = {
  oracle?: PublicKey;
  oracleSource?: string;
};

export function isKaminoReserveOracle(
  assetMeta?: OracleSourcedAssetMeta | null,
): boolean {
  return (
    !!assetMeta &&
    assetMeta.oracleSource === KAMINO_RESERVE_ORACLE_SOURCE &&
    !!assetMeta.oracle
  );
}

/**
 * Adds the Kamino reserve oracle of every given asset meta to `into`.
 * Asset metas priced by another source are skipped.
 */
export function collectKaminoReserveOracles(
  assetMetas: Array<OracleSourcedAssetMeta | null | undefined>,
  into: PkSet = new PkSet(),
): PkSet {
  assetMetas.forEach((assetMeta) => {
    if (isKaminoReserveOracle(assetMeta)) {
      into.add(assetMeta!.oracle!);
    }
  });
  return into;
}

/**
 * Adds the Kamino reserves behind caller-supplied oracle overrides to `into`.
 * An override arrives as a bare address, with no source attached: it is a
 * reserve when one of the given registrations prices its own mint through that
 * same address as a Kamino reserve, whichever mint that is. Pass every
 * registration (`BaseClient.fetchRegisteredOracles`), deprecated ones included.
 */
export function collectKaminoReserveOracleOverrides(
  overrides: Array<PublicKey | null | undefined>,
  registrations: Iterable<OracleSourcedAssetMeta | null | undefined>,
  into: PkSet = new PkSet(),
): PkSet {
  if (overrides.every((oracle) => !oracle)) {
    return into;
  }
  const reserveOracles = collectKaminoReserveOracles(Array.from(registrations));
  overrides.forEach((oracle) => {
    if (oracle && reserveOracles.has(oracle)) {
      into.add(oracle);
    }
  });
  return into;
}

/**
 * Encodes klend's refresh_reserves_batch. Each reserve contributes six account
 * keys: the reserve, its lending market, three klend program id placeholders
 * (pyth, switchboard price, switchboard twap) and the reserve's Scope feed.
 * A reserve without a Scope feed is passed with whatever `scopePriceFeed`
 * holds; this builder does not special-case it.
 */
export function buildRefreshReservesBatchIx(
  reserves: Reserve[],
  skipPriceUpdates: boolean,
): TransactionInstruction {
  const keys: Array<AccountMeta> = [];
  for (const reserve of reserves) {
    const { lendingMarket, scopePriceFeed } = reserve;
    keys.push({
      pubkey: reserve.getAddress(),
      isSigner: false,
      isWritable: true,
    });
    keys.push({
      pubkey: lendingMarket,
      isSigner: false,
      isWritable: true,
    });
    if (!skipPriceUpdates) {
      [
        KAMINO_LENDING_PROGRAM, // pyth oracle, null
        KAMINO_LENDING_PROGRAM, // switchboard price oracle, null
        KAMINO_LENDING_PROGRAM, // switchboard twap oracle, null
        scopePriceFeed,
      ].forEach((p) =>
        keys.push({ pubkey: p, isSigner: false, isWritable: false }),
      );
    }
  }
  const identifier = Buffer.from([144, 110, 26, 103, 162, 204, 252, 147]);
  const buffer = Buffer.alloc(1000);
  const layout = borsh.struct([borsh.bool("skipPriceUpdates")]);
  const len = layout.encode({ skipPriceUpdates }, buffer);
  const data = Buffer.concat([identifier, buffer]).subarray(0, 8 + len);
  return new TransactionInstruction({
    keys,
    programId: KAMINO_LENDING_PROGRAM,
    data,
  });
}

type ReserveAccountReader = {
  getMultipleAccountsInfo(
    publicKeys: PublicKey[],
  ): Promise<(AccountInfo<Buffer> | null)[]>;
};

export async function fetchAndParseKaminoReserves(
  connection: ReserveAccountReader,
  reserveKeys: PublicKey[],
): Promise<Reserve[]> {
  const reserveAccounts = await connection.getMultipleAccountsInfo(reserveKeys);
  if (reserveAccounts.some((account) => !account)) {
    throw new Error("Not all Kamino reserves can be found");
  }
  return reserveAccounts.map((account, i) =>
    Reserve.decode(reserveKeys[i], account!.data),
  );
}

/** What `kaminoReserveRefreshIx` needs: the Kamino Lending client's shape. */
export interface KaminoReserveRefresher {
  fetchAndParseReserves(reserves: PublicKey[]): Promise<Reserve[]>;
  txBuilder: {
    refreshReservesBatchIx(
      reserves: Reserve[],
      skipPriceUpdates: boolean,
    ): TransactionInstruction;
  };
}

/** A refresher for callers that hold a connection but no Kamino Lending client. */
export function connectionKaminoReserveRefresher(
  connection: ReserveAccountReader,
): KaminoReserveRefresher {
  return {
    fetchAndParseReserves: (reserveKeys) =>
      fetchAndParseKaminoReserves(connection, reserveKeys),
    txBuilder: { refreshReservesBatchIx: buildRefreshReservesBatchIx },
  };
}

/**
 * Fetches the given reserves once and returns the single batch refresh
 * instruction that unstales them, or null when there is nothing to refresh.
 * Callers place it before the first instruction that reads a reserve oracle.
 */
export async function kaminoReserveRefreshIx(
  refresher: KaminoReserveRefresher,
  reserves: Iterable<PublicKey>,
): Promise<TransactionInstruction | null> {
  const reserveKeys = Array.from(reserves);
  if (reserveKeys.length === 0) {
    return null;
  }
  const parsedReserves = await refresher.fetchAndParseReserves(reserveKeys);
  return refresher.txBuilder.refreshReservesBatchIx(parsedReserves, false);
}
