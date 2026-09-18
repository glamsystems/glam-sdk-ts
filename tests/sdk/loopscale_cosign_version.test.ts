import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { LoopscaleCoreClient } from "../../src/client/loopscale/core";
import { compileToV1Message, V1Transaction } from "../../src/utils/messageV1";

/**
 * The Loopscale MPC co-signs the bytes this SDK hands it, and its signer is not
 * verified to sign — or even to parse — a version 1 message. The transaction it
 * returns comes back through `VersionedTransaction.deserialize`, which is the
 * library's plain class and cannot write a version 1 message at all. So this
 * path builds version 0, whatever the client or the caller would otherwise ask
 * for.
 */

// The wallet the Loopscale MPC path requires, as core.ts states it.
const GLAM_SIGNER = new PublicKey(
  "GLJLYvowLHgssoKNNr9pEcBHgACCiby73Q8aF1W9ksTG",
);
const LOOPSCALE_BS_AUTH = "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs";

const blockhash = new PublicKey("11111111111111111111111111111112").toBase58();

function transferIx(): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: GLAM_SIGNER,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  });
}

/**
 * A stand-in for `BaseClient` whose `intoVersionedTransaction` resolves the
 * version the way the real one does: the option this transaction states wins,
 * and version 1 is the default otherwise.
 */
function createBase() {
  const built: Array<VersionedTransaction> = [];
  const base = {
    signer: GLAM_SIGNER,
    wallet: {
      // The MPC path signs with the wallet before posting; the bytes are what
      // this case is about, so the stand-in returns the transaction unchanged.
      signTransaction: jest.fn(async (tx: VersionedTransaction) => tx),
    },
    sendAndConfirm: jest.fn(async () => "cosigned-signature"),
    intoVersionedTransaction: jest.fn(
      async (tx: any, txOptions: any = {}): Promise<VersionedTransaction> => {
        const version = txOptions.transactionVersion ?? 1;
        const instructions: TransactionInstruction[] = tx.instructions;
        const vTx =
          version === 1
            ? new V1Transaction(
                compileToV1Message({
                  payerKey: GLAM_SIGNER,
                  recentBlockhash: blockhash,
                  instructions,
                }),
              )
            : new VersionedTransaction(
                new TransactionMessage({
                  payerKey: GLAM_SIGNER,
                  recentBlockhash: blockhash,
                  instructions,
                }).compileToV0Message(),
              );
        built.push(vTx);
        return vTx;
      },
    ),
  } as any;
  return { base, built };
}

function mpcResponse(transactionBase64: string) {
  return {
    ok: true,
    json: async () => ({
      batches: [
        {
          transactions: [
            {
              identifier: "any",
              transaction: transactionBase64,
              signers: [GLAM_SIGNER.toBase58(), LOOPSCALE_BS_AUTH],
            },
          ],
        },
      ],
    }),
  };
}

describe("Loopscale MPC co-signing builds version 0", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("posts version 0 bytes to the MPC even when the caller asks for version 1", async () => {
    const { base, built } = createBase();
    const core = new LoopscaleCoreClient(base);

    let posted: string | undefined;
    global.fetch = jest.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      posted = body.batches[0].transactions[0].transaction;
      // The MPC returns the same transaction, co-signed.
      return mpcResponse(posted!);
    }) as any;

    await expect(
      core.coSignAndSend([transferIx()], { transactionVersion: 1 }),
    ).resolves.toBe("cosigned-signature");

    expect(base.intoVersionedTransaction).toHaveBeenCalledTimes(1);
    expect(base.intoVersionedTransaction.mock.calls[0][1]).toMatchObject({
      transactionVersion: 0,
    });
    expect(built[0].message.version).toBe(0);
    expect(
      VersionedTransaction.deserialize(Buffer.from(posted!, "base64")).message
        .version,
    ).toBe(0);
  });

  it("posts version 0 bytes to the MPC when no version is stated", async () => {
    const { base, built } = createBase();
    const core = new LoopscaleCoreClient(base);

    global.fetch = jest.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      return mpcResponse(body.batches[0].transactions[0].transaction);
    }) as any;

    await expect(core.coSignAndSend([transferIx()])).resolves.toBe(
      "cosigned-signature",
    );

    expect(base.intoVersionedTransaction.mock.calls[0][1]).toMatchObject({
      transactionVersion: 0,
    });
    expect(built[0].message.version).toBe(0);
  });

  it("refuses to hand a version 1 transaction to the MPC", async () => {
    const { base } = createBase();
    const core = new LoopscaleCoreClient(base);

    global.fetch = jest.fn(async () => {
      throw new Error("the MPC must not be called");
    }) as any;

    const tx = new V1Transaction(
      compileToV1Message({
        payerKey: GLAM_SIGNER,
        recentBlockhash: blockhash,
        instructions: [transferIx()],
      }),
    );

    await expect(
      core.cosignTransaction({ tx, identifier: "glam-loopscale-test" }),
    ).rejects.toThrow(/version 1/);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(base.wallet.signTransaction).not.toHaveBeenCalled();
  });
});
