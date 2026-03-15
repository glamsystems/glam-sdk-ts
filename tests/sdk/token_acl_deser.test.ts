import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  TokenAclListConfig,
  TokenAclWalletEntry,
  TokenAclMintConfig,
} from "../../src/deser/tokenAclLayouts";

/**
 * Real mainnet account data for Token ACL deserialization tests.
 *
 * ListConfig: BpHQSywb4nnMcA57wNZcmbHLNtTHqAqfTgdG4bD5YZBp
 *   Authority: u6ckpYSMLF57AZupbc7jq1cz4ZqvaFDj2TGxGadQ2QY
 *   Seed: "allow" (padded to 32 bytes)
 *   Mode: 0 (allow)
 *   WalletsCount: 2
 *
 * WalletEntry 1: EeyL1DXJZPu6BZC3TcrrYNopewVAcmh7wotKGKEtvxDN
 *   Wallet: gLJHKPrZLGBiBZ33hFgZh6YnsEhTVxuRT17UCqNp6ff
 *
 * WalletEntry 2: 39rpYg2NEBeqd8nCLn9CRzz5AoHcNxSpTk5rhHWLgkPd
 *   Wallet: yuru1ARL4bcmSFpufUCdCrF4joamZRui9CawdgE4ZCW
 */

const LIST_CONFIG_PUBKEY = new PublicKey(
  "BpHQSywb4nnMcA57wNZcmbHLNtTHqAqfTgdG4bD5YZBp",
);
const LIST_CONFIG_DATA = Buffer.from(
  "010d588d79cb69543bf121638cff5d46b7d1c166ce00a18b35626e33c8d545f231616c6c6f77000000000000000000000000000000000000000000000000000000000200000000000000",
  "hex",
);

const WALLET_ENTRY_1_PUBKEY = new PublicKey(
  "EeyL1DXJZPu6BZC3TcrrYNopewVAcmh7wotKGKEtvxDN",
);
const WALLET_ENTRY_1_DATA = Buffer.from(
  "020a1378c932b58b84ecef07f0b94585ff6d87801c5fbc7cb8c09928ba03bae65ea0b1b735b3219c5f01bc85d2d7892742309e208687635ecff0a00995b135808b",
  "hex",
);

const WALLET_ENTRY_2_PUBKEY = new PublicKey(
  "39rpYg2NEBeqd8nCLn9CRzz5AoHcNxSpTk5rhHWLgkPd",
);
const WALLET_ENTRY_2_DATA = Buffer.from(
  "020e944b6c8098a7e01fabf0b99e8df95a2e5f08710df96d134cb38ae2e849a9c3a0b1b735b3219c5f01bc85d2d7892742309e208687635ecff0a00995b135808b",
  "hex",
);

describe("token_acl_deser", () => {
  describe("TokenAclListConfig", () => {
    it("should decode a mainnet list config account", () => {
      const config = TokenAclListConfig.decode(
        LIST_CONFIG_PUBKEY,
        LIST_CONFIG_DATA,
      );

      expect(config.discriminator).toEqual(1);
      expect(config.authority.toBase58()).toEqual(
        "u6ckpYSMLF57AZupbc7jq1cz4ZqvaFDj2TGxGadQ2QY",
      );
      expect(config.mode).toEqual(0);
      expect(config.modeName).toEqual("allow");
      expect(config.walletsCount.eq(new BN(2))).toBe(true);
    });

    it("should decode seed as 'allow' padded to 32 bytes", () => {
      const config = TokenAclListConfig.decode(
        LIST_CONFIG_PUBKEY,
        LIST_CONFIG_DATA,
      );

      const seedStr = Buffer.from(config.seed.toBytes())
        .toString()
        .replace(/\0+$/, "");
      expect(seedStr).toEqual("allow");
    });

    it("should return correct modeName for all modes", () => {
      // Construct synthetic buffers for each mode
      const baseData = Buffer.from(LIST_CONFIG_DATA);

      // mode = 0 (allow)
      baseData[65] = 0;
      const allow = TokenAclListConfig.decode(LIST_CONFIG_PUBKEY, baseData);
      expect(allow.modeName).toEqual("allow");

      // mode = 1 (allow-all-eoas)
      baseData[65] = 1;
      const allowAllEoas = TokenAclListConfig.decode(
        LIST_CONFIG_PUBKEY,
        baseData,
      );
      expect(allowAllEoas.modeName).toEqual("allow-all-eoas");

      // mode = 2 (block)
      baseData[65] = 2;
      const block = TokenAclListConfig.decode(LIST_CONFIG_PUBKEY, baseData);
      expect(block.modeName).toEqual("block");

      // mode = 255 (unknown)
      baseData[65] = 255;
      const unknown = TokenAclListConfig.decode(LIST_CONFIG_PUBKEY, baseData);
      expect(unknown.modeName).toEqual("unknown(255)");
    });

    it("walletsCount should be a BN", () => {
      const config = TokenAclListConfig.decode(
        LIST_CONFIG_PUBKEY,
        LIST_CONFIG_DATA,
      );

      expect(BN.isBN(config.walletsCount)).toBe(true);
      expect(config.walletsCount.toNumber()).toEqual(2);
    });
  });

  describe("TokenAclWalletEntry", () => {
    it("should decode wallet entry 1", () => {
      const entry = TokenAclWalletEntry.decode(
        WALLET_ENTRY_1_PUBKEY,
        WALLET_ENTRY_1_DATA,
      );

      expect(entry.discriminator).toEqual(2);
      expect(entry.wallet.toBase58()).toEqual(
        "gLJHKPrZLGBiBZ33hFgZh6YnsEhTVxuRT17UCqNp6ff",
      );
      expect(entry.listConfig.toBase58()).toEqual(
        LIST_CONFIG_PUBKEY.toBase58(),
      );
    });

    it("should decode wallet entry 2", () => {
      const entry = TokenAclWalletEntry.decode(
        WALLET_ENTRY_2_PUBKEY,
        WALLET_ENTRY_2_DATA,
      );

      expect(entry.discriminator).toEqual(2);
      expect(entry.wallet.toBase58()).toEqual(
        "yuru1ARL4bcmSFpufUCdCrF4joamZRui9CawdgE4ZCW",
      );
      expect(entry.listConfig.toBase58()).toEqual(
        LIST_CONFIG_PUBKEY.toBase58(),
      );
    });

    it("both entries should reference the same list config", () => {
      const entry1 = TokenAclWalletEntry.decode(
        WALLET_ENTRY_1_PUBKEY,
        WALLET_ENTRY_1_DATA,
      );
      const entry2 = TokenAclWalletEntry.decode(
        WALLET_ENTRY_2_PUBKEY,
        WALLET_ENTRY_2_DATA,
      );

      expect(entry1.listConfig.equals(entry2.listConfig)).toBe(true);
    });
  });

  describe("TokenAclMintConfig", () => {
    it("should decode a synthetic mint config", () => {
      // Construct a synthetic MintConfig buffer:
      // discriminator(1) + bump(1) + enablePermissionlessThaw(1) + enablePermissionlessFreeze(1)
      // + mint(32) + freezeAuthority(32) + gatingProgram(32) = 100 bytes
      const buf = Buffer.alloc(100);
      buf[0] = 3; // discriminator
      buf[1] = 254; // bump
      buf[2] = 1; // enablePermissionlessThaw
      buf[3] = 0; // enablePermissionlessFreeze

      const mint = new PublicKey(
        "So11111111111111111111111111111111111111112",
      );
      const freezeAuth = new PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      const gatingProgram = new PublicKey(
        "GATEzzqxhJnsWF6vHRsgtixxSB8PaQdcqGEVTEHWiULz",
      );

      mint.toBuffer().copy(buf, 4);
      freezeAuth.toBuffer().copy(buf, 36);
      gatingProgram.toBuffer().copy(buf, 68);

      const config = TokenAclMintConfig.decode(PublicKey.default, buf);

      expect(config.discriminator).toEqual(3);
      expect(config.bump).toEqual(254);
      expect(config.enablePermissionlessThaw).toEqual(1);
      expect(config.enablePermissionlessFreeze).toEqual(0);
      expect(config.mint.toBase58()).toEqual(mint.toBase58());
      expect(config.freezeAuthority.toBase58()).toEqual(
        freezeAuth.toBase58(),
      );
      expect(config.gatingProgram.toBase58()).toEqual(
        gatingProgram.toBase58(),
      );
    });
  });

  describe("Account data sizes", () => {
    it("ListConfig should be 74 bytes", () => {
      expect(LIST_CONFIG_DATA.length).toEqual(74);
    });

    it("WalletEntry should be 65 bytes", () => {
      expect(WALLET_ENTRY_1_DATA.length).toEqual(65);
      expect(WALLET_ENTRY_2_DATA.length).toEqual(65);
    });
  });
});
