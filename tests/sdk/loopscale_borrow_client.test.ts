import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { LoopscaleBorrowClient } from "../../src/client/loopscale/borrow";
import { LoopscaleCoreClient } from "../../src/client/loopscale/core";

/**
 * The borrow client forwards `getLoanPda` to the core client. It once copied
 * the core method into a class field, so a call ran with the borrow client as
 * its receiver instead of the core client.
 */
describe("LoopscaleBorrowClient.getLoanPda", () => {
  const corePda = Keypair.generate().publicKey;

  // A core whose method answers only when it is called on the core itself.
  function stubCore() {
    const calls: Array<[BN, PublicKey | undefined]> = [];
    const core = {
      borrowTxBuilder: {},
      getLoanPda(nonce: BN, borrower?: PublicKey): PublicKey {
        if (this !== core) {
          throw new Error("getLoanPda lost the core receiver");
        }
        calls.push([nonce, borrower]);
        return corePda;
      },
    };
    return { core, calls };
  }

  it("is callable right after construction and returns the core PDA", () => {
    const { core, calls } = stubCore();
    const borrow = new LoopscaleBorrowClient(
      core as unknown as LoopscaleCoreClient,
    );
    const nonce = new BN(7);
    expect(borrow.getLoanPda(nonce).toBase58()).toBe(corePda.toBase58());
    expect(calls).toEqual([[nonce, undefined]]);
  });

  it("forwards an explicit borrower", () => {
    const { core, calls } = stubCore();
    const borrow = new LoopscaleBorrowClient(
      core as unknown as LoopscaleCoreClient,
    );
    const nonce = new BN(9);
    const borrower = Keypair.generate().publicKey;
    borrow.getLoanPda(nonce, borrower);
    expect(calls).toEqual([[nonce, borrower]]);
  });
});
