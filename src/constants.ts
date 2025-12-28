import { PublicKey } from "@solana/web3.js";
import {
  getExtCctpProgramId,
  getExtDriftProgramId,
  getExtKaminoProgramId,
  getExtMarinadeProgramId,
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

export const STAKE_ACCOUNT_SIZE = 200;
export const METEORA_POSITION_SIZE = 8120;
export const KAMINO_OBTRIGATION_SIZE = 3344;
export const KAMINO_RESERVE_SIZE = 8624;
export const KAMINO_VAULT_STATE_SIZE = 62552;
export const DRIFT_VAULT_DEPOSITOR_SIZE = 272;

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
// JUP, 6 decimals
export const JUP = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");

/**
 * Program IDs
 */
export const MARINADE_PROGRAM_ID = new PublicKey(
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
);
export const DRIFT_PROGRAM_ID = new PublicKey(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
);
export const DRIFT_VAULTS_PROGRAM_ID = new PublicKey(
  "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR",
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
 * Pool ID to lending pool name mapping for Drift Protocol policies
 */
export const DRIFT_POOL_MAPPING: Record<number, string> = {
  0: "Main Market",
  1: "JLP Market",
  2: "LST Market",
  3: "Exponent Market",
};

/**
 * Get protocol and permission mappings at runtime to ensure correct program IDs based on environment.
 *
 * This method provides the source of truth for protocol and permission mappings and staging status in SDK.
 */
export const getProtocolsAndPermissions = (): Record<
  string,
  Record<
    string,
    { name: string; staging: boolean; permissions: Record<number, string> }
  >
> => ({
  // Supported protocols and permissions are defined in:
  // @anchor/programs/glam_protocol/src/state/acl.rs
  [getGlamProtocolProgramId().toBase58()]: {
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
        [1 << 0]: "SwapAny",
        [1 << 1]: "SwapLST",
        [1 << 2]: "SwapAllowlisted",
      },
    },
  },
  // GLAM mint protocols and permissions are defined in:
  // @anchor/programs/glam_mint/src/state/acl.rs
  [getGlamMintProgramId().toBase58()]: {
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
  // @anchor/programs/ext_kamino/src/state/acl.rs
  [getExtKaminoProgramId().toBase58()]: {
    "0000000000000001": {
      name: "KaminoLend",
      staging: false,
      permissions: {
        [1 << 0]: "Init",
        [1 << 1]: "Deposit",
        [1 << 2]: "Withdraw",
        [1 << 3]: "Borrow",
        [1 << 4]: "Repay",
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
  // Drift integration program protocols and permissions are defined in:
  // @anchor/programs/ext_drift/src/state/acl.rs
  [getExtDriftProgramId().toBase58()]: {
    "0000000000000001": {
      name: "DriftProtocol",
      staging: false,
      permissions: {
        [1 << 0]: "InitUser",
        [1 << 1]: "UpdateUser",
        [1 << 2]: "DeleteUser",
        [1 << 3]: "Deposit",
        [1 << 4]: "Withdraw",
        [1 << 5]: "Borrow",
        [1 << 6]: "Repay",
        [1 << 7]: "CreateModifyOrders",
        [1 << 8]: "CancelOrders",
        [1 << 9]: "PerpMarkets",
        [1 << 10]: "SpotMarkets",
      },
    },
    "0000000000000010": {
      name: "DriftVaults",
      staging: false,
      permissions: {
        [1 << 0]: "Deposit",
        [1 << 1]: "Withdraw",
      },
    },
  },
  // Token integration program protocols and permissions are defined in:
  // @anchor/programs/ext_spl/src/state/acl.rs
  [getExtSplProgramId().toBase58()]: {
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
  [getExtCctpProgramId().toBase58()]: {
    "0000000000000001": {
      name: "CCTP",
      staging: false,
      permissions: {
        [1 << 0]: "Transfer",
      },
    },
  },
  // Marinade integration program protocols and permissions are defined in:
  // @anchor/programs/ext_marinade/src/state/acl.rs
  [getExtMarinadeProgramId().toBase58()]: {
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
  // @anchor/programs/ext_stake_pool/src/state/acl.rs
  [getExtStakePoolProgramId().toBase58()]: {
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
});

/**
 * (Program ID, Bitflag) -> Protocol Name
 */
export const getProtocolNameByProgramAndBitflag = () => {
  const mapping: Record<string, Record<string, string>> = {};

  Object.entries(getProtocolsAndPermissions()).forEach(
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
export const getProgramAndBitflagByProtocolName = () => {
  const mapping: Record<string, [string, string]> = {};

  Object.entries(getProtocolsAndPermissions()).forEach(
    ([programId, protocols]) => {
      Object.entries(protocols).forEach(([bitflag, protocol]) => {
        const name = protocol.name;
        mapping[name] = [programId, bitflag];
      });
    },
  );

  return mapping;
};
