import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  LayerzeroOftPolicy,
  MintPolicy,
  RouteManagementMode,
  TransferPolicy,
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

  describe("LayerzeroOftPolicy", () => {
    it("should encode and decode OFT routes", () => {
      const route = {
        sourceMint: new PublicKey(
          "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        ),
        destinationChain: 30168,
        destinationRecipient: Keypair.generate().publicKey,
        providerProgram: Keypair.generate().publicKey,
        managementMode: RouteManagementMode.Either,
        minAmount: new BN(1_000_000),
        maxAmount: new BN(50_000_000),
      };

      const policy = new LayerzeroOftPolicy([route]);
      const encoded = policy.encode();
      const decoded = LayerzeroOftPolicy.decode(encoded);

      expect(decoded.routes).toHaveLength(1);
      expect(decoded.routes[0].sourceMint.equals(route.sourceMint)).toBe(true);
      expect(decoded.routes[0].destinationChain).toBe(route.destinationChain);
      expect(
        decoded.routes[0].destinationRecipient.equals(
          route.destinationRecipient,
        ),
      ).toBe(true);
      expect(
        decoded.routes[0].providerProgram.equals(route.providerProgram),
      ).toBe(true);
      expect(decoded.routes[0].managementMode).toBe(route.managementMode);
      expect(decoded.routes[0].minAmount.toString()).toBe(
        route.minAmount.toString(),
      );
      expect(decoded.routes[0].maxAmount.toString()).toBe(
        route.maxAmount.toString(),
      );
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
