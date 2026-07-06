import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { EXPONENT_GENERIC_STANDARD_PROGRAM_ID } from "../../src/constants";
import {
  EXPONENT_MARKET_TWO_DISCRIMINATOR,
  ExponentGenericSyState,
  ExponentMarketTwo,
  ExponentVault,
} from "../../src/deser/exponentLayouts";

function pubkey(fill: number): PublicKey {
  return new PublicKey(Buffer.alloc(32, fill));
}

describe("Exponent account layouts", () => {
  it("exports the Exponent Generic Standard program id", () => {
    expect(EXPONENT_GENERIC_STANDARD_PROGRAM_ID.toBase58()).toBe(
      "XP1BRLn8eCYSygrd8er5P4GKdzqKbC3DLoSsS5UYVZy",
    );
  });

  it("derives fixed account offsets from layouts", () => {
    expect(ExponentMarketTwo.fixedDataLength).toBe(412);
    expect(ExponentMarketTwo.offsetOf("mintPt")).toBe(40);
    expect(ExponentMarketTwo.offsetOf("mintSy")).toBe(72);
    expect(ExponentMarketTwo.offsetOf("vault")).toBe(104);
    expect(ExponentMarketTwo.offsetOf("syProgram")).toBe(332);

    expect(ExponentVault.fixedDataLength).toBe(524);
    expect(ExponentVault.offsetOf("syProgram")).toBe(8);
    expect(ExponentVault.offsetOf("mintPt")).toBe(104);
    expect(ExponentVault.offsetOf("authority")).toBe(304);
    expect(ExponentVault.offsetOf("status")).toBe(523);

    expect(ExponentGenericSyState.fixedDataLength).toBe(372);
    expect(ExponentGenericSyState.offsetOf("yieldBearingMint")).toBe(129);
    expect(ExponentGenericSyState.offsetOf("oracle")).toBe(340);
  });

  it("decodes fixed MarketTwo account slices", () => {
    const data = Buffer.alloc(ExponentMarketTwo.fixedDataLength);
    EXPONENT_MARKET_TWO_DISCRIMINATOR.copy(data, 0);
    pubkey(1).toBuffer().copy(data, ExponentMarketTwo.offsetOf("mintPt"));
    pubkey(2).toBuffer().copy(data, ExponentMarketTwo.offsetOf("mintSy"));
    data.writeBigUInt64LE(123n, ExponentMarketTwo.offsetOf("financials"));

    const market = ExponentMarketTwo.decode(pubkey(9), data);

    expect(market.pubkey.equals(pubkey(9))).toBe(true);
    expect(market.mintPt.equals(pubkey(1))).toBe(true);
    expect(market.mintSy.equals(pubkey(2))).toBe(true);
    expect(market.expirationTs).toBe("123");
    expect(market.cpiAccounts).toBeUndefined();
  });

  it("decodes dynamic MarketTwo CPI account metadata", () => {
    const data = Buffer.alloc(2048);
    const bytesWritten = ExponentMarketTwo._layout.encode(
      {
        discriminator: Array.from(EXPONENT_MARKET_TWO_DISCRIMINATOR),
        addressLookupTable: pubkey(1),
        mintPt: pubkey(2),
        mintSy: pubkey(3),
        vault: pubkey(4),
        mintLp: pubkey(5),
        tokenLpEscrow: pubkey(6),
        tokenPtEscrow: pubkey(7),
        tokenSyEscrow: pubkey(8),
        tokenFeeTreasurySy: pubkey(9),
        feeTreasurySyBps: 25,
        selfAddress: pubkey(10),
        signerBump: 255,
        statusFlags: 12,
        syProgram: pubkey(11),
        financials: {
          expirationTs: new BN(456),
          ptBalance: new BN(789),
          syBalance: new BN(987),
          lnFeeRateRoot: 1.25,
          lastLnImpliedRate: 2.5,
          rateScalarRoot: 3.75,
        },
        emissions: { trackers: [] },
        lpFarm: { lastSeenTimestamp: 0, farmEmissions: [] },
        maxLpSupply: new BN(0),
        lpEscrowAmount: new BN(0),
        cpiAccounts: {
          getSyState: [{ altIndex: 7, isSigner: true, isWritable: false }],
          depositSy: [{ altIndex: 8, isSigner: false, isWritable: true }],
          withdrawSy: [{ altIndex: 9, isSigner: false, isWritable: true }],
          claimEmission: [
            [{ altIndex: 10, isSigner: false, isWritable: false }],
          ],
          getPositionState: [],
        },
        isCurrentFlashSwap: false,
        liquidityNetBalanceLimits: {
          windowStartTimestamp: 0,
          windowStartNetBalance: new BN(0),
          maxNetBalanceChangeNegativePercentage: 0,
          maxNetBalanceChangePositivePercentage: 0,
          windowDurationSeconds: 0,
        },
        seedId: 1,
      },
      data,
    );

    const market = ExponentMarketTwo.decode(
      pubkey(12),
      data.subarray(0, bytesWritten),
    );

    expect(market.expirationTs).toBe("456");
    expect(market.ptBalance).toBe("789");
    expect(market.cpiAccounts.getSyState).toEqual([
      { altIndex: 7, isSigner: true, isWritable: false },
    ]);
    expect(market.cpiAccounts.depositSy).toEqual([
      { altIndex: 8, isSigner: false, isWritable: true },
    ]);
    expect(market.cpiAccounts.withdrawSy).toEqual([
      { altIndex: 9, isSigner: false, isWritable: true },
    ]);
    expect(market.cpiAccounts.claimEmission).toEqual([
      [{ altIndex: 10, isSigner: false, isWritable: false }],
    ]);
  });
});
