import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  JupiterBorrowPolicy,
  JupiterEarnPolicy,
  JupiterSwapPolicy,
  LoopscaleBorrowMarketPolicy,
  LoopscaleBorrowPolicy,
  LoopscaleLendingMarketPolicy,
  LoopscaleLendingPolicy,
  LoopscaleSellLedgerPolicy,
  NtBundlePolicy,
  PhoenixPolicy,
  WhirlpoolsPolicy,
} from "../../src/deser/integrationPolicies";

describe("JupiterSwapPolicy", () => {
  const mint1 = new PublicKey("11111111111111111111111111111112");
  const mint2 = new PublicKey("11111111111111111111111111111113");

  it("round-trips with allowlist and positive deviation", () => {
    const policy = new JupiterSwapPolicy(150, [mint1, mint2], 500);
    const recovered = JupiterSwapPolicy.decode(policy.encode());
    expect(recovered.maxSlippageBps).toBe(150);
    expect(recovered.swapAllowlist).toHaveLength(2);
    expect(recovered.swapAllowlist?.[0].toBase58()).toBe(mint1.toBase58());
    expect(recovered.swapAllowlist?.[1].toBase58()).toBe(mint2.toBase58());
    expect(recovered.maxDeviationBps).toBe(500);
  });

  it("round-trips with null allowlist and negative deviation", () => {
    const policy = new JupiterSwapPolicy(50, null, -200);
    const recovered = JupiterSwapPolicy.decode(policy.encode());
    expect(recovered.maxSlippageBps).toBe(50);
    expect(recovered.swapAllowlist).toBeNull();
    expect(recovered.maxDeviationBps).toBe(-200);
  });

  it("round-trips with empty allowlist", () => {
    const policy = new JupiterSwapPolicy(25, [], 0);
    const recovered = JupiterSwapPolicy.decode(policy.encode());
    expect(recovered.maxSlippageBps).toBe(25);
    expect(recovered.swapAllowlist).toEqual([]);
    expect(recovered.maxDeviationBps).toBe(0);
  });

  it("decodes legacy buffer without maxDeviationBps (defaults to 0)", () => {
    // Legacy layout: u16 slippage + Option::None (1 byte). 5 bytes total.
    const legacy = Buffer.from([0x32, 0x00, 0x00]);
    const recovered = JupiterSwapPolicy.decode(legacy);
    expect(recovered.maxSlippageBps).toBe(50);
    expect(recovered.swapAllowlist).toBeNull();
    expect(recovered.maxDeviationBps).toBe(0);
  });

  it("decodes legacy buffer with allowlist but no maxDeviationBps", () => {
    // Legacy layout: u16(100) + Option::Some + u32(1) + 32 bytes for mint1
    const buf = Buffer.concat([
      Buffer.from([0x64, 0x00]), // maxSlippageBps = 100
      Buffer.from([0x01]), // Some
      Buffer.from([0x01, 0x00, 0x00, 0x00]), // len = 1
      mint1.toBuffer(),
    ]);
    const recovered = JupiterSwapPolicy.decode(buf);
    expect(recovered.maxSlippageBps).toBe(100);
    expect(recovered.swapAllowlist).toHaveLength(1);
    expect(recovered.swapAllowlist?.[0].toBase58()).toBe(mint1.toBase58());
    expect(recovered.maxDeviationBps).toBe(0);
  });

  it("rejects truncated buffers", () => {
    expect(() => JupiterSwapPolicy.decode(Buffer.from([0x00, 0x00]))).toThrow();
    // Option::Some with truncated length
    expect(() =>
      JupiterSwapPolicy.decode(Buffer.from([0x32, 0x00, 0x01, 0x00])),
    ).toThrow();
    // Option::Some with len = 1 but no pubkey bytes
    expect(() =>
      JupiterSwapPolicy.decode(
        Buffer.from([0x32, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00]),
      ),
    ).toThrow();
  });

  it("matches the Rust borsh layout byte-for-byte for a known case", () => {
    // Matches the Rust test in policy.rs::test_jupiter_swap_policy_roundtrip
    const policy = new JupiterSwapPolicy(150, [mint1, mint2], -50);
    const encoded = policy.encode();
    // 2 (slippage) + 1 (Some) + 4 (len) + 32*2 (mints) + 2 (deviation) = 73
    expect(encoded.length).toBe(73);
    expect(encoded.readUInt16LE(0)).toBe(150);
    expect(encoded.readUInt8(2)).toBe(1);
    expect(encoded.readUInt32LE(3)).toBe(2);
    expect(encoded.readInt16LE(71)).toBe(-50);
  });
});

describe("LoopscaleBorrowPolicy", () => {
  const collateral1 = new PublicKey("11111111111111111111111111111112");
  const collateral2 = new PublicKey("11111111111111111111111111111113");
  const principal1 = new PublicKey("11111111111111111111111111111114");
  const market1 = new PublicKey("11111111111111111111111111111115");

  it("round-trips the deployed borrow policy format", () => {
    const marketPolicy = new LoopscaleBorrowMarketPolicy(
      market1,
      new BN(100),
      new BN(1_000),
      7_500,
      [0, 2, 4],
    );
    const policy = new LoopscaleBorrowPolicy(
      [collateral1, collateral2],
      [principal1],
      [marketPolicy],
    );
    const recovered = LoopscaleBorrowPolicy.decode(policy.encode());

    expect(recovered.collateralAllowlist.map((m) => m.toBase58())).toEqual([
      collateral1.toBase58(),
      collateral2.toBase58(),
    ]);
    expect(recovered.principalAllowlist.map((m) => m.toBase58())).toEqual([
      principal1.toBase58(),
    ]);
    expect(recovered.marketPolicies.map((p) => p.market.toBase58())).toEqual([
      market1.toBase58(),
    ]);
    expect(recovered.marketPolicies[0].maxBorrowAmount.toString()).toBe("100");
    expect(recovered.marketPolicies[0].maxTotalBorrowAmount.toString()).toBe(
      "1000",
    );
    expect(recovered.marketPolicies[0].maxLtvBps).toBe(7_500);
    expect(recovered.marketPolicies[0].durationIndexesAllowlist).toEqual([
      0, 2, 4,
    ]);
  });

  it("matches the deployed borrow policy byte layout", () => {
    const policy = new LoopscaleBorrowPolicy(
      [collateral1],
      [principal1],
      [
        new LoopscaleBorrowMarketPolicy(
          market1,
          new BN(100),
          new BN(1_000),
          7_500,
          [0, 2, 4],
        ),
      ],
    );
    const encoded = policy.encode();

    expect(encoded.length).toBe(4 + 32 + 4 + 32 + 4 + 32 + 8 + 8 + 2 + 4 + 3);
    expect(encoded.readUInt32LE(0)).toBe(1);
    expect(new PublicKey(encoded.subarray(4, 36)).toBase58()).toBe(
      collateral1.toBase58(),
    );
    expect(encoded.readUInt32LE(36)).toBe(1);
    expect(new PublicKey(encoded.subarray(40, 72)).toBase58()).toBe(
      principal1.toBase58(),
    );
    expect(encoded.readUInt32LE(72)).toBe(1);
    expect(new PublicKey(encoded.subarray(76, 108)).toBase58()).toBe(
      market1.toBase58(),
    );
    expect(encoded.readBigUInt64LE(108)).toBe(100n);
    expect(encoded.readBigUInt64LE(116)).toBe(1_000n);
    expect(encoded.readUInt16LE(124)).toBe(7_500);
    expect(encoded.readUInt32LE(126)).toBe(3);
    expect([...encoded.subarray(130)]).toEqual([0, 2, 4]);
  });

  it("round-trips empty allowlists", () => {
    const policy = new LoopscaleBorrowPolicy();
    const recovered = LoopscaleBorrowPolicy.decode(policy.encode());

    expect(recovered.collateralAllowlist).toEqual([]);
    expect(recovered.principalAllowlist).toEqual([]);
    expect(recovered.marketPolicies).toEqual([]);
  });
});

describe("LoopscaleLendingPolicy", () => {
  const principal1 = new PublicKey("11111111111111111111111111111114");
  const market1 = new PublicKey("11111111111111111111111111111115");
  const collateralAsset = new PublicKey("11111111111111111111111111111116");

  it("round-trips the deployed lending policy format", () => {
    const marketPolicy = new LoopscaleLendingMarketPolicy(
      market1,
      new BN(200),
      new BN(2_000),
      125_000,
      6_500,
      [1, 3],
      [collateralAsset],
    );
    const policy = new LoopscaleLendingPolicy(
      [principal1],
      [collateralAsset],
      [marketPolicy],
      new LoopscaleSellLedgerPolicy(250, 75),
    );
    const recovered = LoopscaleLendingPolicy.decode(policy.encode());

    expect(recovered.principalAllowlist.map((m) => m.toBase58())).toEqual([
      principal1.toBase58(),
    ]);
    expect(recovered.collateralAllowlist.map((m) => m.toBase58())).toEqual([
      collateralAsset.toBase58(),
    ]);
    expect(recovered.marketPolicies[0].market.toBase58()).toBe(
      market1.toBase58(),
    );
    expect(recovered.marketPolicies[0].maxDepositAmount.toString()).toBe("200");
    expect(recovered.marketPolicies[0].maxTotalDepositAmount.toString()).toBe(
      "2000",
    );
    expect(recovered.marketPolicies[0].minLoanApyCbps).toBe(125_000);
    expect(recovered.marketPolicies[0].maxLtvBps).toBe(6_500);
    expect(recovered.marketPolicies[0].durationIndexesAllowlist).toEqual([
      1, 3,
    ]);
    expect(
      recovered.marketPolicies[0].collateralAssetAllowlist[0].toBase58(),
    ).toBe(collateralAsset.toBase58());
    expect(recovered.sellLedgerPolicy.maxDiscountBps).toBe(250);
    expect(recovered.sellLedgerPolicy.maxSlippageBps).toBe(75);
  });

  it("matches the deployed lending policy byte layout", () => {
    const policy = new LoopscaleLendingPolicy(
      [principal1],
      [collateralAsset],
      [
        new LoopscaleLendingMarketPolicy(
          market1,
          new BN(200),
          new BN(2_000),
          125_000,
          6_500,
          [1, 3],
          [collateralAsset],
        ),
      ],
      new LoopscaleSellLedgerPolicy(250, 75),
    );
    const encoded = policy.encode();

    expect(encoded.length).toBe(
      4 + 32 + 4 + 32 + 4 + 32 + 8 + 8 + 4 + 2 + 4 + 2 + 4 + 32 + 4,
    );
    expect(encoded.readUInt32LE(0)).toBe(1);
    expect(new PublicKey(encoded.subarray(4, 36)).toBase58()).toBe(
      principal1.toBase58(),
    );
    expect(encoded.readUInt32LE(36)).toBe(1);
    expect(new PublicKey(encoded.subarray(40, 72)).toBase58()).toBe(
      collateralAsset.toBase58(),
    );
    expect(encoded.readUInt32LE(72)).toBe(1);
    expect(new PublicKey(encoded.subarray(76, 108)).toBase58()).toBe(
      market1.toBase58(),
    );
    expect(encoded.readBigUInt64LE(108)).toBe(200n);
    expect(encoded.readBigUInt64LE(116)).toBe(2_000n);
    expect(encoded.readUInt32LE(124)).toBe(125_000);
    expect(encoded.readUInt16LE(128)).toBe(6_500);
    expect(encoded.readUInt32LE(130)).toBe(2);
    expect([...encoded.subarray(134, 136)]).toEqual([1, 3]);
    expect(encoded.readUInt32LE(136)).toBe(1);
    expect(new PublicKey(encoded.subarray(140, 172)).toBase58()).toBe(
      collateralAsset.toBase58(),
    );
    expect(encoded.readUInt16LE(172)).toBe(250);
    expect(encoded.readUInt16LE(174)).toBe(75);
  });

  it("round-trips empty allowlists", () => {
    const policy = new LoopscaleLendingPolicy();
    const recovered = LoopscaleLendingPolicy.decode(policy.encode());

    expect(recovered.principalAllowlist).toEqual([]);
    expect(recovered.collateralAllowlist).toEqual([]);
    expect(recovered.marketPolicies).toEqual([]);
    expect(recovered.sellLedgerPolicy.maxDiscountBps).toBe(0);
    expect(recovered.sellLedgerPolicy.maxSlippageBps).toBe(0);
  });
});

describe("PhoenixPolicy", () => {
  const market1 = new PublicKey("11111111111111111111111111111112");
  const market2 = new PublicKey("11111111111111111111111111111113");

  it("round-trips all Phoenix policy fields", () => {
    const policy = new PhoenixPolicy(
      [market1, market2],
      [0, 1, 2],
      true,
      250,
      60,
    );

    const recovered = PhoenixPolicy.decode(policy.encode());

    expect(recovered.marketsAllowlist.map((m) => m.toBase58())).toEqual([
      market1.toBase58(),
      market2.toBase58(),
    ]);
    expect(recovered.allowedOrderTypes).toEqual([0, 1, 2]);
    expect(recovered.maxPriceDeviationBps).toBe(250);
    expect(recovered.requireReduceOnlyOrders).toBe(true);
    expect(recovered.maxReferencePriceAgeSecs).toBe(60);
  });

  it("round-trips default Phoenix policy values", () => {
    const policy = new PhoenixPolicy([], [], false, 0);

    const recovered = PhoenixPolicy.decode(policy.encode());

    expect(recovered.marketsAllowlist).toEqual([]);
    expect(recovered.allowedOrderTypes).toEqual([]);
    expect(recovered.maxPriceDeviationBps).toBe(0);
    expect(recovered.requireReduceOnlyOrders).toBe(false);
    expect(recovered.maxReferencePriceAgeSecs).toBe(0);
  });
});

describe("JupiterEarnPolicy", () => {
  const mint1 = new PublicKey("11111111111111111111111111111112");
  const mint2 = new PublicKey("11111111111111111111111111111113");

  it("round-trips the mint allowlist", () => {
    const policy = new JupiterEarnPolicy([mint1, mint2]);
    const recovered = JupiterEarnPolicy.decode(policy.encode());

    expect(recovered.mintsAllowlist).toHaveLength(2);
    expect(recovered.mintsAllowlist[0].toBase58()).toBe(mint1.toBase58());
    expect(recovered.mintsAllowlist[1].toBase58()).toBe(mint2.toBase58());
  });

  it("round-trips an empty allowlist", () => {
    const policy = new JupiterEarnPolicy([]);
    const recovered = JupiterEarnPolicy.decode(policy.encode());

    expect(recovered.mintsAllowlist).toEqual([]);
  });
});

describe("JupiterBorrowPolicy", () => {
  const vault = new PublicKey("11111111111111111111111111111112");
  const collateralMint = new PublicKey("11111111111111111111111111111113");
  const borrowMint = new PublicKey("11111111111111111111111111111114");

  it("round-trips vault, collateral mint, and borrow mint allowlists", () => {
    const policy = new JupiterBorrowPolicy(
      [vault],
      [collateralMint],
      [borrowMint],
    );
    const recovered = JupiterBorrowPolicy.decode(policy.encode());

    expect(recovered.vaultsAllowlist[0].toBase58()).toBe(vault.toBase58());
    expect(recovered.collateralMintsAllowlist[0].toBase58()).toBe(
      collateralMint.toBase58(),
    );
    expect(recovered.borrowMintsAllowlist[0].toBase58()).toBe(
      borrowMint.toBase58(),
    );
  });

  it("round-trips empty allowlists", () => {
    const policy = new JupiterBorrowPolicy([], [], []);
    const recovered = JupiterBorrowPolicy.decode(policy.encode());

    expect(recovered.vaultsAllowlist).toEqual([]);
    expect(recovered.collateralMintsAllowlist).toEqual([]);
    expect(recovered.borrowMintsAllowlist).toEqual([]);
  });
});

describe("WhirlpoolsPolicy", () => {
  const whirlpool1 = new PublicKey("11111111111111111111111111111112");
  const whirlpool2 = new PublicKey("11111111111111111111111111111113");
  const mint1 = new PublicKey("11111111111111111111111111111114");
  const mint2 = new PublicKey("11111111111111111111111111111115");

  it("round-trips the whirlpool and token mint allowlists", () => {
    const policy = new WhirlpoolsPolicy(
      [whirlpool1, whirlpool2],
      [mint1, mint2],
      -25,
    );
    const recovered = WhirlpoolsPolicy.decode(policy.encode());

    expect(recovered.whirlpoolsAllowlist.map((p) => p.toBase58())).toEqual([
      whirlpool1.toBase58(),
      whirlpool2.toBase58(),
    ]);
    expect(recovered.tokenMintsAllowlist.map((p) => p.toBase58())).toEqual([
      mint1.toBase58(),
      mint2.toBase58(),
    ]);
    expect(recovered.maxDeviationBps).toBe(-25);
  });

  it("round-trips empty allowlists", () => {
    const policy = new WhirlpoolsPolicy([], []);
    const recovered = WhirlpoolsPolicy.decode(policy.encode());

    expect(recovered.whirlpoolsAllowlist).toEqual([]);
    expect(recovered.tokenMintsAllowlist).toEqual([]);
    expect(recovered.maxDeviationBps).toBe(0);
  });

  it("rejects policies without deviation bounds", () => {
    const policy = new WhirlpoolsPolicy([whirlpool1], [mint1]);
    const missingDeviation = policy
      .encode()
      .subarray(0, policy.encode().length - 2);

    expect(() => WhirlpoolsPolicy.decode(missingDeviation)).toThrow(
      "Invalid Whirlpools policy bounds",
    );
  });
});

describe("NtBundlePolicy", () => {
  const bundle1 = new PublicKey("11111111111111111111111111111112");
  const bundle2 = new PublicKey("11111111111111111111111111111113");

  it("round-trips the bundle allowlist", () => {
    const policy = new NtBundlePolicy([bundle1, bundle2]);
    const recovered = NtBundlePolicy.decode(policy.encode());

    expect(recovered.bundlesAllowlist).toHaveLength(2);
    expect(recovered.bundlesAllowlist[0].toBase58()).toBe(bundle1.toBase58());
    expect(recovered.bundlesAllowlist[1].toBase58()).toBe(bundle2.toBase58());
  });

  it("round-trips an empty deny-all allowlist", () => {
    const policy = new NtBundlePolicy([]);
    const recovered = NtBundlePolicy.decode(policy.encode());

    expect(recovered.bundlesAllowlist).toEqual([]);
  });
});
