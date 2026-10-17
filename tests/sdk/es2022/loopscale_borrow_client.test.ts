import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import type { BaseClient } from "../../../src/client/base";
import { LoopscaleBorrowClient } from "../../../src/client/loopscale/borrow";
import {
  getLoopscaleLoanPda,
  LoopscaleCoreClient,
} from "../../../src/client/loopscale/core";

/**
 * Runs under native ES2022 class fields (see the `anchor-es2022` project in
 * jest.config.ts). The real borrow client wraps the real core client over a
 * stub base.
 */
describe("LoopscaleBorrowClient under native class fields", () => {
  const nonce = new BN(11);

  function build() {
    const base = { vaultPda: Keypair.generate().publicKey };
    const core = new LoopscaleCoreClient(base as unknown as BaseClient);
    return { base, borrow: new LoopscaleBorrowClient(core) };
  }

  it("proves the environment applies define semantics", () => {
    class Old {
      getValue = this.source.read;
      constructor(private readonly source: { read: () => number }) {}
    }
    expect(() => new Old({ read: () => 1 })).toThrow(TypeError);
  });

  it("defaults the borrower when it is omitted", () => {
    const { base, borrow } = build();
    expect(borrow.getLoanPda(nonce).toBase58()).toBe(
      getLoopscaleLoanPda(base.vaultPda, nonce).toBase58(),
    );
  });

  it("defaults the borrower when it is explicitly undefined", () => {
    const { base, borrow } = build();
    expect(borrow.getLoanPda(nonce, undefined).toBase58()).toBe(
      getLoopscaleLoanPda(base.vaultPda, nonce).toBase58(),
    );
  });

  it("uses an explicit borrower", () => {
    const { base, borrow } = build();
    const borrower = Keypair.generate().publicKey;
    expect(borrow.getLoanPda(nonce, borrower).toBase58()).toBe(
      getLoopscaleLoanPda(borrower, nonce).toBase58(),
    );
    expect(borrower.equals(base.vaultPda)).toBe(false);
  });

  it("follows a vault change on the base between calls", () => {
    const { base, borrow } = build();
    const first = borrow.getLoanPda(nonce);
    const next: PublicKey = Keypair.generate().publicKey;
    base.vaultPda = next;
    const second = borrow.getLoanPda(nonce);
    expect(second.toBase58()).toBe(
      getLoopscaleLoanPda(next, nonce).toBase58(),
    );
    expect(second.equals(first)).toBe(false);
  });
});
