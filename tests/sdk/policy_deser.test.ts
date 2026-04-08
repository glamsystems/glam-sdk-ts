import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  MintPolicy,
  TransferPolicy,
  DriftVaultsPolicy,
  DriftProtocolPolicy,
} from "../../src/deser/integrationPolicies";

describe("policy_deser", () => {
  describe("MintPolicy", () => {
    it("should encode and decode a basic MintPolicy", () => {
      const policy = new MintPolicy(
        30, // lockupPeriod
        new BN(1000000), // maxCap
        new BN(100), // minSubscription
        new BN(50), // minRedemption
        new BN(0), // reserved
        null, // allowlist
        null, // blocklist
      );

      const encoded = policy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.lockupPeriod).toEqual(30);
      expect(decoded.maxCap.toString()).toEqual("1000000");
      expect(decoded.minSubscription.toString()).toEqual("100");
      expect(decoded.minRedemption.toString()).toEqual("50");
      expect(decoded.reserved.toString()).toEqual("0");
      expect(decoded.allowlist).toBeNull();
      expect(decoded.blocklist).toBeNull();
    });

    it("should encode and decode MintPolicy with allowlist", () => {
      const allowlist = [
        new PublicKey("11111111111111111111111111111112"),
        new PublicKey("11111111111111111111111111111113"),
      ];

      const policy = new MintPolicy(
        60, // lockupPeriod
        new BN(2000000), // maxCap
        new BN(200), // minSubscription
        new BN(100), // minRedemption
        new BN(42), // reserved
        allowlist, // allowlist
        null, // blocklist
      );

      const encoded = policy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.lockupPeriod).toEqual(60);
      expect(decoded.maxCap.toString()).toEqual("2000000");
      expect(decoded.minSubscription.toString()).toEqual("200");
      expect(decoded.minRedemption.toString()).toEqual("100");
      expect(decoded.reserved.toString()).toEqual("42");
      expect(decoded.allowlist).toEqual(allowlist);
      expect(decoded.blocklist).toBeNull();
    });

    it("should encode and decode MintPolicy with blocklist", () => {
      const blocklist = [
        new PublicKey("11111111111111111111111111111114"),
        new PublicKey("11111111111111111111111111111115"),
        new PublicKey("11111111111111111111111111111116"),
      ];

      const policy = new MintPolicy(
        90, // lockupPeriod
        new BN(5000000), // maxCap
        new BN(500), // minSubscription
        new BN(250), // minRedemption
        new BN(123), // reserved
        null, // allowlist
        blocklist, // blocklist
      );

      const encoded = policy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.lockupPeriod).toEqual(90);
      expect(decoded.maxCap.toString()).toEqual("5000000");
      expect(decoded.minSubscription.toString()).toEqual("500");
      expect(decoded.minRedemption.toString()).toEqual("250");
      expect(decoded.reserved.toString()).toEqual("123");
      expect(decoded.allowlist).toBeNull();
      expect(decoded.blocklist).toEqual(blocklist);
    });

    it("should encode and decode MintPolicy with both allowlist and blocklist", () => {
      const allowlist = [
        new PublicKey("11111111111111111111111111111117"),
        new PublicKey("11111111111111111111111111111118"),
      ];
      const blocklist = [new PublicKey("11111111111111111111111111111119")];

      const policy = new MintPolicy(
        120, // lockupPeriod
        new BN(10000000), // maxCap
        new BN(1000), // minSubscription
        new BN(500), // minRedemption
        new BN(999), // reserved
        allowlist, // allowlist
        blocklist, // blocklist
      );

      const encoded = policy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.lockupPeriod).toEqual(120);
      expect(decoded.maxCap.toString()).toEqual("10000000");
      expect(decoded.minSubscription.toString()).toEqual("1000");
      expect(decoded.minRedemption.toString()).toEqual("500");
      expect(decoded.reserved.toString()).toEqual("999");
      expect(decoded.allowlist).toEqual(allowlist);
      expect(decoded.blocklist).toEqual(blocklist);
    });

    it("should handle empty allowlist and blocklist arrays", () => {
      const policy = new MintPolicy(
        0, // lockupPeriod
        new BN(0), // maxCap
        new BN(0), // minSubscription
        new BN(0), // minRedemption
        new BN(0), // reserved
        [], // empty allowlist
        [], // empty blocklist
      );

      const encoded = policy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.lockupPeriod).toEqual(0);
      expect(decoded.allowlist).toEqual([]);
      expect(decoded.blocklist).toEqual([]);
    });
  });

  describe("TransferPolicy", () => {
    it("should encode and decode TransferPolicy with single address", () => {
      const allowlist = [new PublicKey("11111111111111111111111111111112")];
      const policy = new TransferPolicy(allowlist);

      const encoded = policy.encode();
      const decoded = TransferPolicy.decode(encoded);

      expect(decoded.allowlist).toEqual(allowlist);
      expect(decoded.allowlist.length).toEqual(1);
    });

    it("should encode and decode TransferPolicy with multiple addresses", () => {
      const allowlist = [
        new PublicKey("11111111111111111111111111111112"),
        new PublicKey("11111111111111111111111111111113"),
        new PublicKey("11111111111111111111111111111114"),
        new PublicKey("11111111111111111111111111111115"),
      ];
      const policy = new TransferPolicy(allowlist);

      const encoded = policy.encode();
      const decoded = TransferPolicy.decode(encoded);

      expect(decoded.allowlist).toEqual(allowlist);
      expect(decoded.allowlist.length).toEqual(4);
    });

    it("should encode and decode TransferPolicy with empty allowlist", () => {
      const allowlist: PublicKey[] = [];
      const policy = new TransferPolicy(allowlist);

      const encoded = policy.encode();
      const decoded = TransferPolicy.decode(encoded);

      expect(decoded.allowlist).toEqual([]);
      expect(decoded.allowlist.length).toEqual(0);
    });

    it("should maintain PublicKey integrity through encode/decode cycle", () => {
      const originalKeys = [
        new PublicKey("So11111111111111111111111111111111111111112"), // WSOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // USDT
      ];
      const policy = new TransferPolicy(originalKeys);

      const encoded = policy.encode();
      const decoded = TransferPolicy.decode(encoded);

      expect(decoded.allowlist.length).toEqual(3);
      decoded.allowlist.forEach((key, index) => {
        expect(key.equals(originalKeys[index])).toBeTruthy();
        expect(key.toBase58()).toEqual(originalKeys[index].toBase58());
      });
    });
  });

  describe("DriftVaultsPolicy", () => {
    it("should encode and decode DriftVaultsPolicy with single vault", () => {
      const vaultsAllowlist = [
        new PublicKey("11111111111111111111111111111112"),
      ];
      const policy = new DriftVaultsPolicy(vaultsAllowlist);

      const encoded = policy.encode();
      const decoded = DriftVaultsPolicy.decode(encoded);

      expect(decoded.vaultsAllowlist).toEqual(vaultsAllowlist);
      expect(decoded.vaultsAllowlist.length).toEqual(1);
    });

    it("should encode and decode DriftVaultsPolicy with multiple vaults", () => {
      const vaultsAllowlist = [
        new PublicKey("11111111111111111111111111111112"),
        new PublicKey("11111111111111111111111111111113"),
        new PublicKey("11111111111111111111111111111114"),
        new PublicKey("11111111111111111111111111111115"),
        new PublicKey("11111111111111111111111111111116"),
      ];
      const policy = new DriftVaultsPolicy(vaultsAllowlist);

      const encoded = policy.encode();
      const decoded = DriftVaultsPolicy.decode(encoded);

      expect(decoded.vaultsAllowlist).toEqual(vaultsAllowlist);
      expect(decoded.vaultsAllowlist.length).toEqual(5);
    });

    it("should encode and decode DriftVaultsPolicy with empty allowlist", () => {
      const vaultsAllowlist: PublicKey[] = [];
      const policy = new DriftVaultsPolicy(vaultsAllowlist);

      const encoded = policy.encode();
      const decoded = DriftVaultsPolicy.decode(encoded);

      expect(decoded.vaultsAllowlist).toEqual([]);
      expect(decoded.vaultsAllowlist.length).toEqual(0);
    });

    it("should maintain vault PublicKey integrity through encode/decode cycle", () => {
      const vaultKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];
      const policy = new DriftVaultsPolicy(vaultKeys);

      const encoded = policy.encode();
      const decoded = DriftVaultsPolicy.decode(encoded);

      expect(decoded.vaultsAllowlist.length).toEqual(3);
      decoded.vaultsAllowlist.forEach((key, index) => {
        expect(key.equals(vaultKeys[index])).toBeTruthy();
        expect(key.toBase58()).toEqual(vaultKeys[index].toBase58());
      });
    });

    it("should handle large vault allowlists", () => {
      // Create 50 vault keys for stress testing
      const largeVaultList = Array.from(
        { length: 50 },
        () => Keypair.generate().publicKey,
      );
      const policy = new DriftVaultsPolicy(largeVaultList);

      const encoded = policy.encode();
      const decoded = DriftVaultsPolicy.decode(encoded);

      expect(decoded.vaultsAllowlist.length).toEqual(50);
      decoded.vaultsAllowlist.forEach((key, index) => {
        expect(key.equals(largeVaultList[index])).toBeTruthy();
      });
    });
  });

  describe("DriftProtocolPolicy", () => {
    it("should encode and decode DriftProtocolPolicy with all fields populated", () => {
      const spotMarketsAllowlist = [0, 1, 2];
      const perpMarketsAllowlist = [10, 11, 12, 13];
      const borrowAllowlist = [
        new PublicKey("11111111111111111111111111111112"),
        new PublicKey("11111111111111111111111111111113"),
      ];

      const policy = new DriftProtocolPolicy(
        spotMarketsAllowlist,
        perpMarketsAllowlist,
        borrowAllowlist,
      );

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual(spotMarketsAllowlist);
      expect(decoded.perpMarketsAllowlist).toEqual(perpMarketsAllowlist);
      expect(decoded.borrowAllowlist).toEqual(borrowAllowlist);
    });

    it("should encode and decode DriftProtocolPolicy with empty arrays", () => {
      const policy = new DriftProtocolPolicy([], [], []);

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual([]);
      expect(decoded.perpMarketsAllowlist).toEqual([]);
      expect(decoded.borrowAllowlist).toEqual([]);
    });

    it("should encode and decode DriftProtocolPolicy with only spot markets", () => {
      const spotMarketsAllowlist = [0, 5, 10, 15, 20];
      const policy = new DriftProtocolPolicy(spotMarketsAllowlist, [], []);

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual(spotMarketsAllowlist);
      expect(decoded.perpMarketsAllowlist).toEqual([]);
      expect(decoded.borrowAllowlist).toEqual([]);
    });

    it("should encode and decode DriftProtocolPolicy with only perp markets", () => {
      const perpMarketsAllowlist = [100, 101, 102];
      const policy = new DriftProtocolPolicy([], perpMarketsAllowlist, []);

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual([]);
      expect(decoded.perpMarketsAllowlist).toEqual(perpMarketsAllowlist);
      expect(decoded.borrowAllowlist).toEqual([]);
    });

    it("should encode and decode DriftProtocolPolicy with only borrow allowlist", () => {
      const borrowAllowlist = [
        new PublicKey("So11111111111111111111111111111111111111112"), // WSOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // USDT
      ];
      const policy = new DriftProtocolPolicy([], [], borrowAllowlist);

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual([]);
      expect(decoded.perpMarketsAllowlist).toEqual([]);
      expect(decoded.borrowAllowlist).toEqual(borrowAllowlist);
    });

    it("should handle large market indices", () => {
      const spotMarketsAllowlist = [0, 65535]; // Max u16 value
      const perpMarketsAllowlist = [32767, 65534];
      const policy = new DriftProtocolPolicy(
        spotMarketsAllowlist,
        perpMarketsAllowlist,
        [],
      );

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual(spotMarketsAllowlist);
      expect(decoded.perpMarketsAllowlist).toEqual(perpMarketsAllowlist);
    });

    it("should maintain PublicKey integrity in borrow allowlist", () => {
      const originalKeys = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
      ];
      const policy = new DriftProtocolPolicy([], [], originalKeys);

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.borrowAllowlist.length).toEqual(3);
      decoded.borrowAllowlist.forEach((key, index) => {
        expect(key.equals(originalKeys[index])).toBeTruthy();
        expect(key.toBase58()).toEqual(originalKeys[index].toBase58());
      });
    });

    it("should handle realistic Drift market configuration", () => {
      // Realistic Drift configuration
      const spotMarketsAllowlist = [0, 1, 2, 3, 4]; // SOL, USDC, USDT, BTC, ETH
      const perpMarketsAllowlist = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Common perp markets
      const borrowAllowlist = [
        new PublicKey("So11111111111111111111111111111111111111112"), // WSOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // USDT
      ];

      const policy = new DriftProtocolPolicy(
        spotMarketsAllowlist,
        perpMarketsAllowlist,
        borrowAllowlist,
      );

      const encoded = policy.encode();
      const decoded = DriftProtocolPolicy.decode(encoded);

      expect(decoded.spotMarketsAllowlist).toEqual(spotMarketsAllowlist);
      expect(decoded.perpMarketsAllowlist).toEqual(perpMarketsAllowlist);
      expect(decoded.borrowAllowlist).toEqual(borrowAllowlist);

      // Verify all fields have expected lengths
      expect(decoded.spotMarketsAllowlist.length).toEqual(5);
      expect(decoded.perpMarketsAllowlist.length).toEqual(10);
      expect(decoded.borrowAllowlist.length).toEqual(3);
    });

    it("should produce consistent encoding results", () => {
      const policy = new DriftProtocolPolicy(
        [0, 1, 2],
        [10, 11],
        [new PublicKey("11111111111111111111111111111112")],
      );

      const encoded1 = policy.encode();
      const encoded2 = policy.encode();

      expect(encoded1.equals(encoded2)).toBeTruthy();
    });
  });

  describe("Cross-compatibility", () => {
    it("should handle large datasets without corruption", () => {
      // Create a large allowlist for stress testing using valid keypairs
      const largeAllowlist = Array.from(
        { length: 100 },
        () => Keypair.generate().publicKey,
      );

      const mintPolicy = new MintPolicy(
        365, // lockupPeriod
        new BN("999999999999999999"), // maxCap (large number)
        new BN("1000000000000"), // minSubscription
        new BN("500000000000"), // minRedemption
        new BN("42424242424242"), // reserved
        largeAllowlist.slice(0, 50), // first 50 for allowlist
        largeAllowlist.slice(50, 100), // last 50 for blocklist
      );

      const encoded = mintPolicy.encode();
      const decoded = MintPolicy.decode(encoded);

      expect(decoded.allowlist?.length).toEqual(50);
      expect(decoded.blocklist?.length).toEqual(50);
      expect(decoded.maxCap.toString()).toEqual("999999999999999999");
    });

    it("should produce consistent encoding results", () => {
      const policy = new MintPolicy(
        30,
        new BN(1000000),
        new BN(100),
        new BN(50),
        new BN(0),
        [new PublicKey("11111111111111111111111111111112")],
        null,
      );

      const encoded1 = policy.encode();
      const encoded2 = policy.encode();

      expect(encoded1.equals(encoded2)).toBeTruthy();
    });
  });
});
