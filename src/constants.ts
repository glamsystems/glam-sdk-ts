import { PublicKey } from "@solana/web3.js";
import {
  getExtBridgeProgramId,
  getExtCctpProgramId,
  getExtEpiProgramId,
  getExtKaminoProgramId,
  getExtLoopscaleProgramId,
  getExtMarinadeProgramId,
  getExtPhoenixProgramId,
  getExtSplProgramId,
  getExtStakePoolProgramId,
  getGlamMintProgramId,
  getGlamProtocolProgramId,
} from "./glamExports";

export const SEED_STATE = "state"; // protocol program
export const SEED_VAULT = "vault"; // protocol program
export const SEED_METADATA = "metadata"; // protocol program
export const SEED_MINT = "mint"; // mint program
export const SEED_ESCROW = "escrow"; // mint program
export const SEED_REQUEST_QUEUE = "request-queue"; // mint program
export const SEED_ACCOUNT_POLICY = "account-policy"; // policies program
export const SEED_EXTRA_ACCOUNT_METAS = "extra-account-metas"; // policies program
export const SEED_GLOBAL_CONFIG = "global-config";
export const SEED_INTEGRATION_AUTHORITY = "integration-authority";
export const SEED_OBSERVATION_STATE = "observation-state";
export const SEED_BRIDGE_REGISTRY = "bridge-registry";
export const SEED_BRIDGE_SESSION = "bridge-session";
export const SEED_BRIDGE_TRANSFER_RECORD = "bridge-transfer-record";

export const STAKE_ACCOUNT_SIZE = 200;
export const METEORA_POSITION_SIZE = 8120;
export const KAMINO_OBTRIGATION_SIZE = 3344;
export const KAMINO_RESERVE_SIZE = 8624;
export const KAMINO_VAULT_STATE_SIZE = 62552;

export const JITO_TIP_DEFAULT = new PublicKey(
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
);

export const MARINADE_NATIVE_STAKE_AUTHORITY = new PublicKey(
  "stWirqFCf2Uts1JBL1Jsd3r6VBWhgnpdPxCTe1MFjrq",
);
/**
 * Token mints. If no devnet version is defined, assume mainnet and devnet addresses are the same.
 *
 * Unless otherwise noted, all mints have 9 decimals.
 */
export const WSOL = new PublicKey(
  "So11111111111111111111111111111111111111112",
);
export const MSOL = new PublicKey(
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
);
// USDC, 6 decimals
export const USDC = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const USDC_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
// USDT, 6 decimals
export const USDT = new PublicKey(
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
);
// JUP, 6 decimals
export const JUP = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");

/**
 * Program IDs
 */
export const MARINADE_PROGRAM_ID = new PublicKey(
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
);
export const JUPITER_PROGRAM_ID = new PublicKey(
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);
export const SANCTUM_STAKE_POOL_PROGRAM_ID = new PublicKey(
  "SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY",
);
export const KAMINO_LENDING_PROGRAM = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
);
export const KAMINO_VAULTS_PROGRAM = new PublicKey(
  "KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd",
);
export const KAMINO_FARM_PROGRAM = new PublicKey(
  "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr",
);
export const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
export const ALT_PROGRAM_ID = new PublicKey(
  "AddressLookupTab1e1111111111111111111111111",
);
export const TOKEN_MESSENGER_MINTER_V2 = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
export const MESSAGE_TRANSMITTER_V2 = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
export const LOOPSCALE_PROGRAM_ID = new PublicKey(
  "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78",
);
export const PHOENIX_PROGRAM_ID = new PublicKey(
  "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih",
);
export const EMBER_PROGRAM_ID = new PublicKey(
  "EMBERpYNE6ehWmXymZZS2skiFmCa9V5dp14e1iduM5qy",
);

/**
 * Protocol bitmask values for ext_phoenix integration.
 * Mirror `SupportedProtocols` in anchor/programs/ext_phoenix/src/state/access.rs.
 */
export const PHOENIX_PROTOCOL = 1 << 0;

/**
 * Phoenix OrderPacketKind discriminants.
 * Mirror `OrderPacketKind` variant order in anchor/deps/phoenix/phoenix.json.
 */
export const PHOENIX_ORDER_PACKET_KIND_POST_ONLY = 0;
export const PHOENIX_ORDER_PACKET_KIND_LIMIT = 1;
export const PHOENIX_ORDER_PACKET_KIND_IMMEDIATE_OR_CANCEL = 2;

/**
 * Token ACL (sRFC-37)
 */
export const TOKEN_ACL_PROGRAM = new PublicKey(
  "TACLkU6CiCdkQN2MjoyDkVg2yAH9zkxiHDsiztQ52TP",
);
export const TOKEN_ACL_GATE_PROGRAM = new PublicKey(
  "GATEzzqxhJnsWF6vHRsgtixxSB8PaQdcqGEVTEHWiULz",
);

/**
 * GLAM programs
 */
export const TRANSFER_HOOK_PROGRAM = new PublicKey(
  "po1iCYakK3gHCLbuju4wGzFowTMpAJxkqK1iwUqMonY",
);
export const GLAM_CONFIG_PROGRAM = new PublicKey(
  "gConFzxKL9USmwTdJoeQJvfKmqhJ2CyUaXTyQ8v9TGX",
);

/**
 * Referrers
 */
export const GLAM_REFERRER = new PublicKey(
  "GLAMrG37ZqioqvzBNQGCfCUueDz3tsr7MwMFyRk9PS89",
);

/**
 * CCTP domain to chain name mapping
 */
export const CCTP_DOMAIN_MAPPING: Record<number, string> = {
  0: "Ethereum",
  1: "Avalanche",
  2: "OP",
  3: "Arbitrum",
  5: "Solana",
  6: "Base",
  7: "Polygon PoS",
  10: "Unichain",
  11: "Linea",
  12: "Codex",
  13: "Sonic",
  14: "World Chain",
  16: "Sei",
  17: "BNB Smart Chain",
  18: "XDC",
  19: "HyperEVM",
  21: "Ink",
  22: "Plume",
};

/**
 * Get protocol and permission mappings at runtime to ensure correct program IDs based on environment.
 *
 * This method provides the source of truth for protocol and permission mappings and staging status in SDK.
 */
export const getProtocolsAndPermissions = (
  staging: boolean,
): Record<
  string,
  Record<
    string,
    { name: string; staging: boolean; permissions: Record<number, string> }
  >
> => ({
  // Supported protocols and permissions are defined in:
  // @anchor/programs/glam_protocol/src/state/acl.rs
  [getGlamProtocolProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "SystemProgram",
      staging: false,
      permissions: {
        [1 << 0]: "WSOL",
        [1 << 1]: "Transfer",
      },
    },
    "0000000000000010": {
      name: "StakeProgram",
      staging: true,
      permissions: {
        [1 << 0]: "Stake",
        [1 << 1]: "Unstake",
      },
    },
    "0000000000000100": {
      name: "JupiterSwap",
      staging: false,
      permissions: {
        [1 << 0]: "SwapToAny",
        [1 << 1]: "SwapLST",
        [1 << 2]: "SwapAllowlisted",
        [1 << 3]: "SwapFromAny",
        [1 << 4]: "SkipQuotePriceCheckLimited", // Skip oracle check when dest token has no oracle
        [1 << 5]: "SkipQuotePriceCheck", // Skip oracle check unconditionally
      },
    },
  },
  // GLAM mint protocols and permissions are defined in:
  // @anchor/programs/glam_mint/src/state/acl.rs
  [getGlamMintProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "GlamMint",
      staging: false,
      permissions: {
        [1 << 0]: "MintTokens",
        [1 << 1]: "BurnTokens",
        [1 << 2]: "ForceTransfer",
        [1 << 3]: "SetTokenAccountState",
        [1 << 4]: "ClaimFees",
        [1 << 5]: "Fulfill",
        [1 << 6]: "EmergencyUpdate",
        [1 << 7]: "CancelRequest",
        [1 << 8]: "ClaimRequest",
      },
    },
  },
  // Kamino integration program protocols and permissions are defined in:
  // @anchor/programs/ext_kamino/src/state/access.rs
  [getExtKaminoProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "KaminoLend",
      staging: false,
      permissions: {
        [1 << 0]: "Init",
        [1 << 1]: "Deposit",
        [1 << 2]: "Withdraw",
        [1 << 3]: "Borrow",
        [1 << 4]: "Repay",
        [1 << 5]: "Liquidate",
      },
    },
    "0000000000000010": {
      name: "KaminoVaults",
      staging: false,
      permissions: {
        [1 << 0]: "Deposit",
        [1 << 1]: "Withdraw",
      },
    },
    "0000000000000100": {
      name: "KaminoFarms",
      staging: false,
      permissions: {
        [1 << 0]: "Stake",
        [1 << 1]: "Unstake",
        [1 << 2]: "HarvestReward",
      },
    },
  },
  // Token integration program protocols and permissions are defined in:
  // @anchor/programs/ext_spl/src/state/acl.rs
  [getExtSplProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "SplToken",
      staging: false,
      permissions: {
        [1 << 0]: "Transfer",
      },
    },
  },
  // CCTP integration program protocols and permissions are defined in:
  // @anchor/programs/ext_cctp/src/state/acl.rs
  [getExtCctpProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "CCTP",
      staging: false,
      permissions: {
        [1 << 0]: "Transfer",
      },
    },
  },
  // Loopscale integration program protocols and permissions are defined in:
  // @anchor/programs/ext_loopscale/src/state/access.rs
  [getExtLoopscaleProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "Loopscale",
      staging: true,
      permissions: {
        [1 << 0]: "ManageLoan",
        [1 << 1]: "DepositCollateral",
        [1 << 2]: "WithdrawCollateral",
        [1 << 3]: "BorrowPrincipal",
        [1 << 4]: "RepayPrincipal",
        [1 << 5]: "RefinanceLedger",
        [1 << 6]: "DepositUserVault",
        [1 << 7]: "WithdrawUserVault",
        [1 << 8]: "StakeUserVaultLp",
        [1 << 9]: "UnstakeUserVaultLp",
        [1 << 10]: "ClaimVaultRewards",
      },
    },
  },
  // Bridge integration program protocols and permissions are defined in:
  // @anchor/programs/ext_bridge/src/state/access.rs
  [getExtBridgeProgramId(staging).toBase58()]: {
    "0000000000000100": {
      name: "LayerZeroOft",
      staging: true,
      permissions: {
        [1 << 0]: "Send",
        [1 << 1]: "Validate",
        [1 << 2]: "Settle",
      },
    },
  },
  // EPI integration program protocols and permissions are defined in:
  // @anchor/programs/ext_epi/src/state/access.rs
  [getExtEpiProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "Epi",
      staging: true,
      permissions: {
        [1 << 0]: "Configure",
        [1 << 1]: "SubmitObservation",
        [1 << 2]: "ValidateObservation",
      },
    },
  },
  // Marinade integration program protocols and permissions are defined in:
  // @anchor/programs/ext_marinade/src/state/access.rs
  [getExtMarinadeProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "Marinade",
      staging: true,
      permissions: {
        [1 << 0]: "Stake",
        [1 << 1]: "Unstake",
      },
    },
  },
  // Stake pool integration program protocols and permissions are defined in:
  // @anchor/programs/ext_stake_pool/src/state/access.rs
  [getExtStakePoolProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "StakePool",
      staging: true,
      permissions: {
        [1 << 0]: "DepositSol",
        [1 << 1]: "DepositStake",
        [1 << 2]: "DepositSolAny",
        [1 << 3]: "DepositStakeAny",
        [1 << 4]: "WithdrawSol",
        [1 << 5]: "WithdrawStake",
      },
    },
    "0000000000000010": {
      name: "SanctumSingle",
      staging: true,
      permissions: {
        [1 << 0]: "DepositSol",
        [1 << 1]: "DepositStake",
        [1 << 2]: "DepositSolAny",
        [1 << 3]: "DepositStakeAny",
        [1 << 4]: "WithdrawSol",
        [1 << 5]: "WithdrawStake",
      },
    },
    "0000000000000100": {
      name: "SanctumMulti",
      staging: true,
      permissions: {
        [1 << 0]: "DepositSol",
        [1 << 1]: "DepositStake",
        [1 << 2]: "DepositSolAny",
        [1 << 3]: "DepositStakeAny",
        [1 << 4]: "WithdrawSol",
        [1 << 5]: "WithdrawStake",
      },
    },
  },
  // Phoenix integration program protocols and permissions are defined in:
  // @anchor/programs/ext_phoenix/src/state/access.rs
  [getExtPhoenixProgramId(staging).toBase58()]: {
    "0000000000000001": {
      name: "Phoenix",
      staging: true,
      permissions: {
        [1 << 0]: "InitTrader",
        [1 << 1]: "Deposit",
        [1 << 2]: "Withdraw",
        [1 << 3]: "CreateModifyOrders",
        [1 << 4]: "CancelOrders",
        [1 << 5]: "TransferCollateral",
        [1 << 6]: "UpdateTraderState",
      },
    },
  },
});

/**
 * (Program ID, Bitflag) -> Protocol Name
 */
export const getProtocolNameByProgramAndBitflag = (staging: boolean) => {
  const mapping: Record<string, Record<string, string>> = {};

  Object.entries(getProtocolsAndPermissions(staging)).forEach(
    ([programId, protocols]) => {
      mapping[programId] = {};
      Object.entries(protocols).forEach(([bitflag, protocol]) => {
        mapping[programId][bitflag] = protocol.name;
      });
    },
  );

  return mapping;
};

/**
 * Protocol Name -> (Program ID, Bitflag)
 */
export const getProgramAndBitflagByProtocolName = (staging: boolean) => {
  const mapping: Record<string, [string, string]> = {};

  Object.entries(getProtocolsAndPermissions(staging)).forEach(
    ([programId, protocols]) => {
      Object.entries(protocols).forEach(([bitflag, protocol]) => {
        const name = protocol.name;
        mapping[name] = [programId, bitflag];
      });
    },
  );

  return mapping;
};
