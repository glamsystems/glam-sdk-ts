/**
 * Protocol bitmask values and priced protocol identifiers.
 *
 * Keep these separate from program-id constants so call sites are explicit
 * about whether they are selecting an integration program or a protocol bit.
 */

// Mirror `SupportedProtocols` in anchor/programs/glam_protocol/src/state/acl.rs.
export const SYSTEM_PROTOCOL = 1 << 0;
export const STAKE_PROTOCOL = 1 << 1;
export const JUPITER_SWAP_PROTOCOL = 1 << 2;

// Mirror `SupportedProtocols` in anchor/programs/glam_mint/src/state/acl.rs.
export const GLAM_MINT_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_spl/src/state/acl.rs.
export const SPL_TOKEN_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_cctp/src/state/acl.rs.
export const CCTP_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_phoenix/src/state/access.rs.
export const PHOENIX_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_kamino/src/state/access.rs.
export const KAMINO_LENDING_PROTOCOL = 1 << 0;
export const KAMINO_VAULTS_PROTOCOL = 1 << 1;
export const KAMINO_FARMS_PROTOCOL = 1 << 2;

// Mirror `SupportedProtocols` in anchor/programs/ext_jupiter/src/state/access.rs.
export const JUPITER_EARN_PROTOCOL = 1 << 0;
export const JUPITER_BORROW_PROTOCOL = 1 << 1;

// Mirror `SupportedProtocols` in anchor/programs/ext_orca/src/state/access.rs.
export const ORCA_WHIRLPOOLS_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_loopscale/src/state/access.rs.
export const LOOPSCALE_BORROW_PROTOCOL = 1 << 0;
export const LOOPSCALE_LENDING_PROTOCOL = 1 << 1;

// Mirror `SupportedProtocols` in anchor/programs/ext_bridge/src/state/access.rs.
export const LAYERZERO_OFT_PROTOCOL = 1 << 2;

// Synthetic priced-protocol key emitted by ext_bridge for aggregate managed transfers.
export const BRIDGE_MANAGED_TRANSFERS_PROTOCOL = 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_epi/src/state/access.rs.
export const EPI_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_marinade/src/state/access.rs.
export const MARINADE_PROTOCOL = 1 << 0;

// Mirror `SupportedProtocols` in anchor/programs/ext_stake_pool/src/state/access.rs.
export const STAKE_POOL_PROTOCOL = 1 << 0;
export const SANCTUM_SINGLE_VALIDATOR_STAKE_POOL_PROTOCOL = 1 << 1;
export const SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROTOCOL = 1 << 2;
