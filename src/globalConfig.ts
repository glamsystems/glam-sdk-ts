import { struct, u8, u16, i8, vec, publicKey, array } from "@coral-xyz/borsh";
import { Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import GlamConfigIdlJson from "../target/idl/glam_config.json";
import { Decodable } from "./deser/base";
import { getGlobalConfigPda } from "./utils/glamPDAs";
import { PkMap } from "./utils";

function getIdlEnumVariantNames(
  idl: Idl,
  enumName: string,
): { name: string; index: number }[] {
  const typeDef = (idl.types || []).find((type) => type.name === enumName);
  if (!typeDef || typeDef.type.kind !== "enum") {
    throw new Error(`Enum ${enumName} not found in glam_config IDL`);
  }

  return typeDef.type.variants.map((variant, index) => ({
    name: variant.name,
    index,
  }));
}

const ORACLE_SOURCE_NAMES = getIdlEnumVariantNames(
  GlamConfigIdlJson as Idl,
  "OracleSource",
);

type RawAssetMeta = {
  asset: PublicKey;
  decimals: number;
  oracle: PublicKey;
  oracleSourceOrdinal: number;
  maxAgeSeconds: number;
  priority: number;
  padding: number[];
};

export async function fetchGlobalConfig(
  connection: Connection,
  address: PublicKey = getGlobalConfigPda(),
): Promise<GlobalConfig> {
  const accountInfo = await connection.getAccountInfo(address);
  if (!accountInfo?.data) {
    throw new Error(`Global config account not found: ${address.toBase58()}`);
  }

  return GlobalConfig.decode(address, accountInfo.data as Buffer);
}

export class GlobalConfig extends Decodable {
  discriminator!: number[];
  admin!: PublicKey;
  feeAuthority!: PublicKey;
  referrer!: PublicKey;
  baseFeeBps!: number;
  flowFeeBps!: number;
  assetMetas!: RawAssetMeta[];

  static _layout = struct([
    array(u8(), 8, "discriminator"),
    publicKey("admin"),
    publicKey("feeAuthority"),
    publicKey("referrer"),
    u16("baseFeeBps"),
    u16("flowFeeBps"),
    vec(
      struct([
        publicKey("asset"),
        u8("decimals"),
        publicKey("oracle"),
        u8("oracleSourceOrdinal"),
        u16("maxAgeSeconds"),
        i8("priority"),
        array(u8(), 3, "padding"),
      ]),
      "assetMetas",
    ),
  ]);

  static encode(data: any): Buffer {
    const buffer = Buffer.alloc(4096);
    const len = this._layout.encode(data, buffer);
    return buffer.subarray(0, len);
  }
}

export function getOracleName(ordinal: number): string {
  return ORACLE_SOURCE_NAMES[ordinal]?.name ?? `Unknown(${ordinal})`;
}

export async function fetchOnchainAssetMetas(
  connection: Connection,
  address?: PublicKey,
): Promise<PkMap<RawAssetMeta>> {
  const globalConfig = await fetchGlobalConfig(connection, address);

  return new PkMap(
    globalConfig.assetMetas.map((assetMeta) => [assetMeta.asset, assetMeta]),
  );
}
