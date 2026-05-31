import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import type { GlamProtocol } from "../target/types/glam_protocol";
import type { GlamConfig } from "../target/types/glam_config";
import type { GlamMint } from "../target/types/glam_mint";
import type { ExtSpl } from "../target/types/ext_spl";
import type { ExtKamino } from "../target/types/ext_kamino";
import type { ExtMarinade } from "../target/types/ext_marinade";
import type { ExtStakePool } from "../target/types/ext_stake_pool";
import type { ExtCctp } from "../target/types/ext_cctp";
import type { ExtBridge } from "../target/types/ext_bridge";
import type { ExtEpi } from "../target/types/ext_epi";
import type { ExtPhoenix } from "../target/types/ext_phoenix";
import type { ExtJupiter } from "../target/types/ext_jupiter";
import type { ExtOrca } from "../target/types/ext_orca";

import GlamProtocolIdlJson from "../target/idl/glam_protocol.json";
import GlamConfigIdlJson from "../target/idl/glam_config.json";
import GlamMintIdlJson from "../target/idl/glam_mint.json";
import ExtSplIdlJson from "../target/idl/ext_spl.json";
import ExtDriftIdlJson from "../target/idl/ext_drift.json";
import ExtKaminoIdlJson from "../target/idl/ext_kamino.json";
import ExtMarinadeIdlJson from "../target/idl/ext_marinade.json";
import ExtStakePoolIdlJson from "../target/idl/ext_stake_pool.json";
import ExtCctpIdlJson from "../target/idl/ext_cctp.json";
import ExtBridgeIdlJson from "../target/idl/ext_bridge.json";
import ExtEpiIdlJson from "../target/idl/ext_epi.json";
import ExtPhoenixIdlJson from "../target/idl/ext_phoenix.json";
import ExtJupiterIdlJson from "../target/idl/ext_jupiter.json";
import ExtOrcaIdlJson from "../target/idl/ext_orca.json";

import GlamProtocolIdlJsonStaging from "../target/idl/glam_protocol-staging.json";
import GlamMintIdlJsonStaging from "../target/idl/glam_mint-staging.json";
import ExtSplIdlJsonStaging from "../target/idl/ext_spl-staging.json";
import ExtKaminoIdlJsonStaging from "../target/idl/ext_kamino-staging.json";
import ExtStakePoolIdlJsonStaging from "../target/idl/ext_stake_pool-staging.json";
import ExtCctpIdlJsonStaging from "../target/idl/ext_cctp-staging.json";
import ExtMarinadeIdlJsonStaging from "../target/idl/ext_marinade-staging.json";
import ExtBridgeIdlJsonStaging from "../target/idl/ext_bridge-staging.json";
import ExtEpiIdlJsonStaging from "../target/idl/ext_epi-staging.json";
import ExtPhoenixIdlJsonStaging from "../target/idl/ext_phoenix-staging.json";
import ExtJupiterIdlJsonStaging from "../target/idl/ext_jupiter-staging.json";
import ExtOrcaIdlJsonStaging from "../target/idl/ext_orca-staging.json";

export { GlamProtocol, GlamMint, GlamConfig, ExtPhoenix, ExtJupiter, ExtOrca };

const EXT_DRIFT_STAGING_PROGRAM_ID =
  "gstgdpMFXKobURsFtStdaMLRSuwdmDUsrndov7kyu9h";

export type GlamProtocolProgram = Program<GlamProtocol>;
export type GlamConfigProgram = Program<GlamConfig>;
export type GlamMintProgram = Program<GlamMint>;
export type ExtSplProgram = Program<ExtSpl>;
export type ExtKaminoProgram = Program<ExtKamino>;
export type ExtMarinadeProgram = Program<ExtMarinade>;
export type ExtStakePoolProgram = Program<ExtStakePool>;
export type ExtCctpProgram = Program<ExtCctp>;
export type ExtBridgeProgram = Program<ExtBridge>;
export type ExtEpiProgram = Program<ExtEpi>;
export type ExtPhoenixProgram = Program<ExtPhoenix>;
export type ExtJupiterProgram = Program<ExtJupiter>;
export type ExtOrcaProgram = Program<ExtOrca>;

const isStaging = () => {
  const s = process.env.NEXT_PUBLIC_GLAM_STAGING || process.env.GLAM_STAGING;
  // Treat "0", "false", "", undefined, null as false
  // Treat "1", "true", or any other truthy string as true
  return !!(s && s !== "0" && s !== "false");
};

/** Resolve staging flag: explicit param overrides env-var default */
export function resolveStaging(useStaging?: boolean): boolean {
  return useStaging !== undefined ? useStaging : isStaging();
}

export function getGlamProtocolIdl(staging: boolean) {
  return staging ? GlamProtocolIdlJsonStaging : GlamProtocolIdlJson;
}

export function getGlamMintIdl(staging: boolean) {
  return staging ? GlamMintIdlJsonStaging : GlamMintIdlJson;
}

export function getExtSplIdl(staging: boolean) {
  return staging ? ExtSplIdlJsonStaging : ExtSplIdlJson;
}

export function getExtKaminoIdl(staging: boolean) {
  return staging ? ExtKaminoIdlJsonStaging : ExtKaminoIdlJson;
}

export function getExtStakePoolIdl(staging: boolean) {
  return staging ? ExtStakePoolIdlJsonStaging : ExtStakePoolIdlJson;
}

export function getExtCctpIdl(staging: boolean) {
  return staging ? ExtCctpIdlJsonStaging : ExtCctpIdlJson;
}

export function getExtBridgeIdl(staging: boolean) {
  if (!staging) {
    return ExtBridgeIdlJson;
  }

  return {
    ...ExtBridgeIdlJson,
    address: ExtBridgeIdlJsonStaging.address,
  };
}

export function getExtEpiIdl(staging: boolean) {
  return staging ? ExtEpiIdlJsonStaging : ExtEpiIdlJson;
}

export function getExtPhoenixIdl(staging: boolean) {
  return staging ? ExtPhoenixIdlJsonStaging : ExtPhoenixIdlJson;
}

export function getExtJupiterIdl(staging: boolean) {
  return staging ? ExtJupiterIdlJsonStaging : ExtJupiterIdlJson;
}

export function getExtOrcaIdl(staging: boolean) {
  return staging ? ExtOrcaIdlJsonStaging : ExtOrcaIdlJson;
}

export function getExtMarinadeIdl(staging: boolean) {
  return staging ? ExtMarinadeIdlJsonStaging : ExtMarinadeIdlJson;
}

export function getGlamProtocolProgramId(staging: boolean) {
  return new PublicKey(getGlamProtocolIdl(staging).address);
}

export function getGlamMintProgramId(staging: boolean) {
  return new PublicKey(getGlamMintIdl(staging).address);
}

export function getExtSplProgramId(staging: boolean) {
  return new PublicKey(getExtSplIdl(staging).address);
}

export function getExtDriftProgramId(staging: boolean) {
  return new PublicKey(
    staging ? EXT_DRIFT_STAGING_PROGRAM_ID : ExtDriftIdlJson.address,
  );
}

export function getExtKaminoProgramId(staging: boolean) {
  return new PublicKey(getExtKaminoIdl(staging).address);
}

export function getExtStakePoolProgramId(staging: boolean) {
  return new PublicKey(getExtStakePoolIdl(staging).address);
}

export function getExtCctpProgramId(staging: boolean) {
  return new PublicKey(getExtCctpIdl(staging).address);
}

export function getExtBridgeProgramId(staging: boolean) {
  return new PublicKey(getExtBridgeIdl(staging).address);
}

export function getExtEpiProgramId(staging: boolean) {
  return new PublicKey(getExtEpiIdl(staging).address);
}

export function getExtPhoenixProgramId(staging: boolean) {
  return new PublicKey(getExtPhoenixIdl(staging).address);
}

export function getExtJupiterProgramId(staging: boolean) {
  return new PublicKey(getExtJupiterIdl(staging).address);
}

export function getExtOrcaProgramId(staging: boolean) {
  return new PublicKey(getExtOrcaIdl(staging).address);
}

export function getExtMarinadeProgramId(staging: boolean) {
  return new PublicKey(getExtMarinadeIdl(staging).address);
}

export function getGlamProtocolProgram(
  provider: Provider,
  staging: boolean,
): GlamProtocolProgram {
  return new Program<GlamProtocol>(getGlamProtocolIdl(staging), provider);
}

export function getGlamMintProgram(
  provider: Provider,
  staging: boolean,
): GlamMintProgram {
  return new Program<GlamMint>(getGlamMintIdl(staging), provider);
}

export function getGlamConfigProgram(provider: Provider): GlamConfigProgram {
  return new Program<GlamConfig>(GlamConfigIdlJson, provider);
}

export function getExtSplProgram(
  provider: Provider,
  staging: boolean,
): ExtSplProgram {
  return new Program<ExtSpl>(getExtSplIdl(staging), provider);
}

export function getExtKaminoProgram(
  provider: Provider,
  staging: boolean,
): ExtKaminoProgram {
  return new Program<ExtKamino>(getExtKaminoIdl(staging), provider);
}

export function getExtMarinadeProgram(
  provider: Provider,
  staging: boolean,
): ExtMarinadeProgram {
  return new Program<ExtMarinade>(getExtMarinadeIdl(staging), provider);
}

export function getExtStakePoolProgram(
  provider: Provider,
  staging: boolean,
): ExtStakePoolProgram {
  return new Program<ExtStakePool>(getExtStakePoolIdl(staging), provider);
}

export function getExtCctpProgram(
  provider: Provider,
  staging: boolean,
): ExtCctpProgram {
  return new Program<ExtCctp>(getExtCctpIdl(staging), provider);
}

export function getExtBridgeProgram(
  provider: Provider,
  staging: boolean,
): ExtBridgeProgram {
  return new Program<ExtBridge>(getExtBridgeIdl(staging), provider);
}

export function getExtEpiProgram(
  provider: Provider,
  staging: boolean,
): ExtEpiProgram {
  return new Program<ExtEpi>(getExtEpiIdl(staging), provider);
}

export function getExtPhoenixProgram(
  provider: Provider,
  staging: boolean,
): ExtPhoenixProgram {
  return new Program<ExtPhoenix>(getExtPhoenixIdl(staging), provider);
}

export function getExtJupiterProgram(
  provider: Provider,
  staging: boolean,
): ExtJupiterProgram {
  return new Program<ExtJupiter>(getExtJupiterIdl(staging), provider);
}

export function getExtOrcaProgram(
  provider: Provider,
  staging: boolean,
): ExtOrcaProgram {
  return new Program<ExtOrca>(getExtOrcaIdl(staging), provider);
}
