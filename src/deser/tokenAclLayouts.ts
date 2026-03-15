import { struct, u8, u64, publicKey } from "@coral-xyz/borsh";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decodable } from "./base";

/**
 * Token ACL Gate ListConfig account layout.
 *
 * Onchain repr(C):
 *   discriminator: u8
 *   authority: Pubkey
 *   seed: Pubkey
 *   mode: u8
 *   wallets_count: u64 (LE)
 *
 * PDA seeds: ["list_config", authority, seed]
 * Program: Token ACL Gate
 */
export class TokenAclListConfig extends Decodable {
  discriminator!: number;
  authority!: PublicKey;
  seed!: PublicKey;
  mode!: number;
  walletsCount!: BN;

  static _layout = struct([
    u8("discriminator"),
    publicKey("authority"),
    publicKey("seed"),
    u8("mode"),
    u64("walletsCount"),
  ]);

  get modeName(): string {
    switch (this.mode) {
      case 0:
        return "allow";
      case 1:
        return "allow-all-eoas";
      case 2:
        return "block";
      default:
        return `unknown(${this.mode})`;
    }
  }
}

/**
 * Token ACL Gate WalletEntry account layout.
 *
 * Onchain repr(C):
 *   discriminator: u8
 *   wallet_address: Pubkey
 *   list_config: Pubkey
 *
 * PDA seeds: ["wallet_entry", list_config, wallet]
 * Program: Token ACL Gate
 */
export class TokenAclWalletEntry extends Decodable {
  discriminator!: number;
  wallet!: PublicKey;
  listConfig!: PublicKey;

  static _layout = struct([
    u8("discriminator"),
    publicKey("wallet"),
    publicKey("listConfig"),
  ]);
}

/**
 * Token ACL MintConfig account layout.
 *
 * Onchain repr(C):
 *   discriminator: u8
 *   bump: u8
 *   enable_permissionless_thaw: PodBool (u8)
 *   enable_permissionless_freeze: PodBool (u8)
 *   mint: Pubkey
 *   freeze_authority: Pubkey
 *   gating_program: Pubkey
 *
 * PDA seeds: ["MINT_CONFIG", mint]
 * Program: Token ACL
 */
export class TokenAclMintConfig extends Decodable {
  discriminator!: number;
  bump!: number;
  enablePermissionlessThaw!: number;
  enablePermissionlessFreeze!: number;
  mint!: PublicKey;
  freezeAuthority!: PublicKey;
  gatingProgram!: PublicKey;

  static _layout = struct([
    u8("discriminator"),
    u8("bump"),
    u8("enablePermissionlessThaw"),
    u8("enablePermissionlessFreeze"),
    publicKey("mint"),
    publicKey("freezeAuthority"),
    publicKey("gatingProgram"),
  ]);
}
