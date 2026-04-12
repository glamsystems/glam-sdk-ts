import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import GlamConfigIdlJson from "../target/idl/glam_config.json";
import { getGlobalConfigPda } from "./utils/glamPDAs";

export type OracleSourceName = string;

export interface OnchainAssetMeta {
  asset: PublicKey;
  decimals: number;
  oracle: PublicKey;
  oracleSource: OracleSourceName;
  maxAgeSeconds: number;
  priority: number;
}

export interface GlobalConfigAccount {
  admin: PublicKey;
  feeAuthority: PublicKey;
  referrer: PublicKey;
  baseFeeBps: number;
  flowFeeBps: number;
  assetMetas: OnchainAssetMeta[];
}

type RawGlobalConfigAccount = {
  admin: PublicKey;
  fee_authority: PublicKey;
  referrer: PublicKey;
  base_fee_bps: number;
  flow_fee_bps: number;
  asset_metas: RawAssetMeta[];
};

type RawAssetMeta = {
  asset: PublicKey;
  decimals: number;
  oracle: PublicKey;
  oracle_source: unknown;
  max_age_seconds: number;
  priority: number;
};

const glamConfigAccountsCoder = new BorshAccountsCoder(
  GlamConfigIdlJson as Idl,
);

function sanitizeEnumVariantName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function getIdlEnumVariantNames(idl: Idl, enumName: string): string[] {
  const typeDef = (idl.types || []).find((type) => type.name === enumName);
  if (!typeDef || typeDef.type.kind !== "enum") {
    throw new Error(`Enum ${enumName} not found in glam_config IDL`);
  }

  return typeDef.type.variants.map((variant) => variant.name);
}

const ORACLE_SOURCE_NAMES = getIdlEnumVariantNames(
  GlamConfigIdlJson as Idl,
  "OracleSource",
);
const ORACLE_SOURCE_LOOKUP = new Map(
  ORACLE_SOURCE_NAMES.map((name) => [sanitizeEnumVariantName(name), name]),
);

function decodeRawGlobalConfigAccount(data: Buffer): RawGlobalConfigAccount {
  let lastError: unknown;

  try {
    return glamConfigAccountsCoder.decode(
      "GlobalConfig",
      data,
    ) as RawGlobalConfigAccount;
  } catch (error) {
    lastError = error;
  }

  throw lastError ?? new Error("Failed to decode GlobalConfig account");
}

function getOracleSourceVariantName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const [variantName] = Object.keys(value);
    if (variantName) {
      return variantName;
    }
  }

  return "NotSet";
}

export function normalizeOracleSource(oracleSource: unknown): OracleSourceName {
  const rawName = getOracleSourceVariantName(oracleSource);
  const normalizedName = ORACLE_SOURCE_LOOKUP.get(
    sanitizeEnumVariantName(rawName),
  );

  return normalizedName || rawName || "NotSet";
}

function normalizeAssetMeta(raw: RawAssetMeta): OnchainAssetMeta {
  return {
    asset: raw.asset,
    decimals: raw.decimals,
    oracle: raw.oracle,
    oracleSource: normalizeOracleSource(raw.oracle_source),
    maxAgeSeconds: raw.max_age_seconds,
    priority: raw.priority,
  };
}

export function decodeGlobalConfigAccount(data: Buffer): GlobalConfigAccount {
  const decoded = decodeRawGlobalConfigAccount(data);

  return {
    admin: decoded.admin,
    feeAuthority: decoded.fee_authority,
    referrer: decoded.referrer,
    baseFeeBps: decoded.base_fee_bps,
    flowFeeBps: decoded.flow_fee_bps,
    assetMetas: decoded.asset_metas.map(normalizeAssetMeta),
  };
}

export async function fetchGlobalConfig(
  connection: Connection,
  address: PublicKey = getGlobalConfigPda(),
): Promise<GlobalConfigAccount> {
  const accountInfo = await connection.getAccountInfo(address);
  if (!accountInfo?.data) {
    throw new Error(`Global config account not found: ${address.toBase58()}`);
  }

  return decodeGlobalConfigAccount(accountInfo.data as Buffer);
}

export async function fetchOnchainAssetMetas(
  connection: Connection,
  address?: PublicKey,
): Promise<Map<string, OnchainAssetMeta>> {
  const globalConfig = await fetchGlobalConfig(connection, address);

  return new Map(
    globalConfig.assetMetas.map((assetMeta) => [
      assetMeta.asset.toBase58(),
      assetMeta,
    ]),
  );
}
