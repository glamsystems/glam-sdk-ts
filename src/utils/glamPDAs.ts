import { PublicKey } from "@solana/web3.js";
import {
  GLAM_CONFIG_PROGRAM,
  SEED_ACCOUNT_POLICY,
  SEED_ESCROW,
  SEED_EXTRA_ACCOUNT_METAS,
  SEED_GLOBAL_CONFIG,
  SEED_MINT,
  SEED_REQUEST_QUEUE,
  SEED_STATE,
  SEED_VAULT,
  TOKEN_ACL_PROGRAM,
  TOKEN_ACL_GATE_PROGRAM,
  TRANSFER_HOOK_PROGRAM,
  SEED_INTEGRATION_AUTHORITY,
} from "../constants";

export function getStatePda(
  initKey: Uint8Array | number[],
  owner: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_STATE), owner.toBuffer(), Uint8Array.from(initKey)],
    programId,
  );
  return pda;
}

export function getVaultPda(
  statePda: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_VAULT), statePda.toBuffer()],
    programId,
  );
  return pda;
}

export function getMintPda(
  statePda: PublicKey,
  mintIdx: number,
  programId: PublicKey,
): PublicKey {
  const [pda, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEED_MINT),
      Uint8Array.from([mintIdx % 256]),
      statePda.toBuffer(),
    ],
    programId,
  );
  return pda;
}

export function getEscrowPda(
  mintPda: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ESCROW), mintPda.toBuffer()],
    programId,
  );
  return pda;
}

export function getRequestQueuePda(
  glamMint: PublicKey,
  programId: PublicKey,
): PublicKey {
  const [pda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_REQUEST_QUEUE), glamMint.toBuffer()],
    programId,
  );
  return pda;
}

export function getExtraMetasPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_EXTRA_ACCOUNT_METAS), mint.toBuffer()],
    TRANSFER_HOOK_PROGRAM,
  )[0];
}

export function getAccountPolicyPda(tokenAccount: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ACCOUNT_POLICY), tokenAccount.toBuffer()],
    TRANSFER_HOOK_PROGRAM,
  )[0];
}

export function getTokenAclMintConfigPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("MINT_CONFIG"), mint.toBuffer()],
    TOKEN_ACL_PROGRAM,
  )[0];
}

export function getTokenAclFlagAccountPda(tokenAccount: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("FLAG_ACCOUNT"), tokenAccount.toBuffer()],
    TOKEN_ACL_PROGRAM,
  )[0];
}

export function getTokenAclGateListConfigPda(
  authority: PublicKey,
  seed: Buffer,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("list_config"), authority.toBuffer(), seed],
    TOKEN_ACL_GATE_PROGRAM,
  )[0];
}

export function getTokenAclGateWalletEntryPda(
  listConfig: PublicKey,
  wallet: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_entry"), listConfig.toBuffer(), wallet.toBuffer()],
    TOKEN_ACL_GATE_PROGRAM,
  )[0];
}

export function getTokenAclGateExtraMetasPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("thaw_extra_account_metas"), mint.toBuffer()],
    TOKEN_ACL_GATE_PROGRAM,
  )[0];
}

export function getGlobalConfigPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_GLOBAL_CONFIG)],
    GLAM_CONFIG_PROGRAM,
  )[0];
}

export function getIntegrationAuthorityPda(integrationProgram: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_INTEGRATION_AUTHORITY)],
    integrationProgram,
  )[0];
}
