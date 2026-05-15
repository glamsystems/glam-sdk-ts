import { PublicKey } from "@solana/web3.js";
import {
  JupiterSwapPolicy,
  LoopscalePolicy,
  PhoenixPolicy,
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

describe("LoopscalePolicy", () => {
  const strategy1 = new PublicKey("11111111111111111111111111111112");
  const strategy2 = new PublicKey("11111111111111111111111111111113");

  it("round-trips the strategy allowlist", () => {
    const policy = new LoopscalePolicy([strategy1, strategy2]);
    const recovered = LoopscalePolicy.decode(policy.encode());

    expect(recovered.strategiesAllowlist).toHaveLength(2);
    expect(recovered.strategiesAllowlist[0].toBase58()).toBe(
      strategy1.toBase58(),
    );
    expect(recovered.strategiesAllowlist[1].toBase58()).toBe(
      strategy2.toBase58(),
    );
  });

  it("round-trips an empty allowlist", () => {
    const policy = new LoopscalePolicy([]);
    const recovered = LoopscalePolicy.decode(policy.encode());

    expect(recovered.strategiesAllowlist).toEqual([]);
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
