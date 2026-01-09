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

import GlamProtocolIdlJson from "../target/idl/glam_protocol.json";
import GlamConfigIdlJson from "../target/idl/glam_config.json";
import GlamMintIdlJson from "../target/idl/glam_mint.json";
import ExtSplIdlJson from "../target/idl/ext_spl.json";
import ExtDriftIdlJson from "../target/idl/ext_drift.json";
import ExtKaminoIdlJson from "../target/idl/ext_kamino.json";
import ExtMarinadeIdlJson from "../target/idl/ext_marinade.json";
import ExtStakePoolIdlJson from "../target/idl/ext_stake_pool.json";
import ExtCctpIdlJson from "../target/idl/ext_cctp.json";

import GlamProtocolIdlJsonStaging from "../target/idl/glam_protocol-staging.json";
import GlamMintIdlJsonStaging from "../target/idl/glam_mint-staging.json";
import ExtSplIdlJsonStaging from "../target/idl/ext_spl-staging.json";
import ExtDriftIdlJsonStaging from "../target/idl/ext_drift-staging.json";
import ExtKaminoIdlJsonStaging from "../target/idl/ext_kamino-staging.json";
import ExtStakePoolIdlJsonStaging from "../target/idl/ext_stake_pool-staging.json";

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

export const isStaging = () => {
  const s = process.env.NEXT_PUBLIC_GLAM_STAGING || process.env.GLAM_STAGING;
  // Treat "0", "false", "", undefined, null as false
  // Treat "1", "true", or any other truthy string as true
  return !!(s && s !== "0" && s !== "false");
};

export function getGlamProtocolIdl() {
  return isStaging() ? GlamProtocolIdlJsonStaging : GlamProtocolIdlJson;
}

export function getGlamMintIdl() {
  return isStaging() ? GlamMintIdlJsonStaging : GlamMintIdlJson;
}

export function getExtSplIdl() {
  return isStaging() ? ExtSplIdlJsonStaging : ExtSplIdlJson;
}

export function getExtDriftIdl() {
  return isStaging() ? ExtDriftIdlJsonStaging : ExtDriftIdlJson;
}

export function getExtKaminoIdl() {
  return isStaging() ? ExtKaminoIdlJsonStaging : ExtKaminoIdlJson;
}

export function getExtStakePoolIdl() {
  return isStaging() ? ExtStakePoolIdlJsonStaging : ExtStakePoolIdlJson;
}

export function getExtCctpIdl() {
  // TODO: Update pubkey after ext_cctp staging program is deployed
  return isStaging() ? ExtCctpIdlJson : ExtCctpIdlJson;
}

export function getExtMarinadeIdl() {
  // TODO: Update pubkey after ext_cctp staging program is deployed
  return isStaging() ? ExtMarinadeIdlJson : ExtMarinadeIdlJson;
}

export function getGlamProtocolProgramId() {
  const idl = isStaging() ? GlamProtocolIdlJsonStaging : GlamProtocolIdlJson;
  return new PublicKey(idl.address);
}

export function getGlamMintProgramId() {
  return new PublicKey(getGlamMintIdl().address);
}

export function getExtSplProgramId() {
  return new PublicKey(getExtSplIdl().address);
}

export function getExtDriftProgramId() {
  return new PublicKey(getExtDriftIdl().address);
}

export function getExtKaminoProgramId() {
  return new PublicKey(getExtKaminoIdl().address);
}

export function getExtStakePoolProgramId() {
  return new PublicKey(getExtStakePoolIdl().address);
}

export function getExtCctpProgramId() {
  return new PublicKey(getExtCctpIdl().address);
}

export function getExtMarinadeProgramId() {
  return new PublicKey(getExtMarinadeIdl().address);
}

export function getGlamProtocolProgram(
  provider: Provider,
): GlamProtocolProgram {
  return new Program<GlamProtocol>(getGlamProtocolIdl(), provider);
}

export function getGlamMintProgram(provider: Provider): GlamMintProgram {
  return new Program<GlamMint>(getGlamMintIdl(), provider);
}

export function getGlamConfigProgram(provider: Provider): GlamConfigProgram {
  return new Program<GlamConfig>(GlamConfigIdlJson, provider);
}

export function getExtSplProgram(provider: Provider): ExtSplProgram {
  return new Program<ExtSpl>(getExtSplIdl(), provider);
}

export function getExtDriftProgram(provider: Provider): ExtDriftProgram {
  return new Program<ExtDrift>(getExtDriftIdl(), provider);
}

export function getExtKaminoProgram(provider: Provider): ExtKaminoProgram {
  return new Program<ExtKamino>(getExtKaminoIdl(), provider);
}

export function getExtMarinadeProgram(provider: Provider): ExtMarinadeProgram {
  return new Program<ExtMarinade>(ExtMarinadeIdlJson, provider);
}

export function getExtStakePoolProgram(
  provider: Provider,
): ExtStakePoolProgram {
  return new Program<ExtStakePool>(getExtStakePoolIdl(), provider);
}

export function getExtCctpProgram(provider: Provider): ExtCctpProgram {
  return new Program<ExtCctp>(ExtCctpIdlJson, provider);
}
