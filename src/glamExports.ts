import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import type { GlamProtocol } from "../target/types/glam_protocol";
import type { GlamConfig } from "../target/types/glam_config";
import type { GlamMint } from "../target/types/glam_mint";
import type { ExtSpl } from "../target/types/ext_spl";
import type { ExtDrift } from "../target/types/ext_drift";
import type { ExtKamino } from "../target/types/ext_kamino";
import type { ExtMarinade } from "../target/types/ext_marinade";
import type { ExtStakePool } from "../target/types/ext_stake_pool";
import type { ExtCctp } from "../target/types/ext_cctp";
import type { ExtOffchain } from "../target/types/ext_offchain";

import GlamProtocolIdlJson from "../target/idl/glam_protocol.json";
import GlamConfigIdlJson from "../target/idl/glam_config.json";
import GlamMintIdlJson from "../target/idl/glam_mint.json";
import ExtSplIdlJson from "../target/idl/ext_spl.json";
import ExtDriftIdlJson from "../target/idl/ext_drift.json";
import ExtKaminoIdlJson from "../target/idl/ext_kamino.json";
import ExtMarinadeIdlJson from "../target/idl/ext_marinade.json";
import ExtStakePoolIdlJson from "../target/idl/ext_stake_pool.json";
import ExtCctpIdlJson from "../target/idl/ext_cctp.json";
import ExtOffchainIdlJson from "../target/idl/ext_offchain.json";

import GlamProtocolIdlJsonStaging from "../target/idl/glam_protocol-staging.json";
import GlamMintIdlJsonStaging from "../target/idl/glam_mint-staging.json";
import ExtSplIdlJsonStaging from "../target/idl/ext_spl-staging.json";
import ExtDriftIdlJsonStaging from "../target/idl/ext_drift-staging.json";
import ExtKaminoIdlJsonStaging from "../target/idl/ext_kamino-staging.json";
import ExtStakePoolIdlJsonStaging from "../target/idl/ext_stake_pool-staging.json";
import ExtMarinadeIdlJsonStaging from "../target/idl/ext_marinade-staging.json";
import ExtOffchainIdlJsonStaging from "../target/idl/ext_offchain-staging.json";

export { GlamProtocol, GlamMint, GlamConfig };

export type GlamProtocolProgram = Program<GlamProtocol>;
export type GlamConfigProgram = Program<GlamConfig>;
export type GlamMintProgram = Program<GlamMint>;
export type ExtSplProgram = Program<ExtSpl>;
export type ExtDriftProgram = Program<ExtDrift>;
export type ExtKaminoProgram = Program<ExtKamino>;
export type ExtMarinadeProgram = Program<ExtMarinade>;
export type ExtStakePoolProgram = Program<ExtStakePool>;
export type ExtCctpProgram = Program<ExtCctp>;
export type ExtOffchainProgram = Program<ExtOffchain>;

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

export function getExtDriftIdl(staging: boolean) {
  return staging ? ExtDriftIdlJsonStaging : ExtDriftIdlJson;
}

export function getExtKaminoIdl(staging: boolean) {
  return staging ? ExtKaminoIdlJsonStaging : ExtKaminoIdlJson;
}

export function getExtStakePoolIdl(staging: boolean) {
  return staging ? ExtStakePoolIdlJsonStaging : ExtStakePoolIdlJson;
}

export function getExtCctpIdl(staging: boolean) {
  // TODO: Update pubkey after ext_cctp staging program is deployed
  return staging ? ExtCctpIdlJson : ExtCctpIdlJson;
}

export function getExtMarinadeIdl(staging: boolean) {
  return staging ? ExtMarinadeIdlJsonStaging : ExtMarinadeIdlJson;
}

export function getExtOffchainIdl(staging: boolean) {
  return staging ? ExtOffchainIdlJsonStaging : ExtOffchainIdlJson;
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
  return new PublicKey(getExtDriftIdl(staging).address);
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

export function getExtMarinadeProgramId(staging: boolean) {
  return new PublicKey(getExtMarinadeIdl(staging).address);
}

export function getExtOffchainProgramId(staging: boolean) {
  return new PublicKey(getExtOffchainIdl(staging).address);
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

export function getExtDriftProgram(
  provider: Provider,
  staging: boolean,
): ExtDriftProgram {
  return new Program<ExtDrift>(getExtDriftIdl(staging), provider);
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

export function getExtOffchainProgram(
  provider: Provider,
  staging: boolean,
): ExtOffchainProgram {
  return new Program<ExtOffchain>(getExtOffchainIdl(staging), provider);
}
