import type { Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import {
  assertV1Envelope,
  compileToV1Message,
  V1_MESSAGE_PREFIX,
  V1Transaction,
} from "../../src/utils/messageV1";

/**
 * The version 1 wire envelope — message bytes first, then one signature per
 * required signer — is written by `V1Transaction.serialize()` alone. The
 * library's own `VersionedTransaction.serialize()` wraps the same message in
 * the version 0 envelope and reports no error, so a transaction that lost the
 * subclass (a `VersionedTransaction.deserialize` round trip, a wallet adapter
 * that returns a rebuilt transaction) would put wrong bytes on the wire with
 * preflight disabled. These cases hold that shut on both sides of signing.
 */

function createClient(wallet: Wallet, blockhash: string) {
  const connection = {
    commitment: "confirmed",
    rpcEndpoint: "http://localhost:8899",
    sendRawTransaction: jest.fn(async () => "txsig"),
    getTransaction: jest.fn(),
  };

  const client = Object.create(BaseClient.prototype) as BaseClient;
  Object.assign(client, {
    cluster: ClusterNetwork.Devnet,
    provider: {
      connection,
      publicKey: wallet.publicKey,
      wallet,
    },
    blockhashWithCache: {
      get: jest.fn(async () => ({ blockhash, lastValidBlockHeight: 1 })),
    },
    onSentListeners: new Set(),
    staging: false,
  });
  (client as any).confirmTransaction = jest.fn(async () => ({
    value: { err: null },
  }));

  return { client, connection };
}

function transferInstructions(from: Keypair) {
  return [
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    }),
  ];
}

describe("the version 1 envelope is checked where the bytes leave", () => {
  const payer = Keypair.generate();
  const blockhash = Keypair.generate().publicKey.toBase58();

  function v1Transaction(): V1Transaction {
    return new V1Transaction(
      compileToV1Message({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: transferInstructions(payer),
      }),
    );
  }

  function passthroughWallet(): Wallet {
    return {
      publicKey: payer.publicKey,
      signTransaction: jest.fn(async (tx: VersionedTransaction) => {
        tx.sign([payer]);
        return tx;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;
  }

  it("sends the version 1 envelope when the transaction keeps its class", async () => {
    const wallet = passthroughWallet();
    const { client, connection } = createClient(wallet, blockhash);

    await expect(client.sendAndConfirm(v1Transaction())).resolves.toBe("txsig");

    const sent = connection.sendRawTransaction.mock
      .calls[0][0] as unknown as Uint8Array;
    expect(sent[0]).toBe(V1_MESSAGE_PREFIX);
    expect(
      VersionedTransaction.deserialize(Buffer.from(sent)).message.version,
    ).toBe(1);
  });

  it("refuses a version 1 message held by a plain VersionedTransaction", async () => {
    const wallet = passthroughWallet();
    const { client, connection } = createClient(wallet, blockhash);

    // What a caller gets by constructing the transaction themselves: the
    // message is right, the envelope its serialize() writes is version 0.
    const tx = new VersionedTransaction(
      compileToV1Message({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: transferInstructions(payer),
      }),
    );
    expect(tx.serialize()[0]).not.toBe(V1_MESSAGE_PREFIX);

    await expect(client.sendAndConfirm(tx)).rejects.toThrow(
      /does not write the version 1 envelope/,
    );
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("refuses a version 1 transaction rebuilt by VersionedTransaction.deserialize", async () => {
    const wallet = passthroughWallet();
    const { client, connection } = createClient(wallet, blockhash);

    const signed = v1Transaction();
    signed.sign([payer]);
    // The round trip a co-signing API or a relayer performs: the message reads
    // back as version 1 and is the library's own, which cannot write itself.
    const roundTripped = VersionedTransaction.deserialize(
      Buffer.from(signed.serialize()),
    );
    expect(roundTripped.message.version).toBe(1);

    await expect(client.sendAndConfirm(roundTripped)).rejects.toThrow(
      /does not write the version 1 envelope/,
    );
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("refuses when the wallet returns a transaction that dropped the envelope", async () => {
    const wallet = {
      publicKey: payer.publicKey,
      // A wallet adapter that rebuilds what it was handed, keeping the message
      // and losing the subclass that writes version 1 bytes.
      signTransaction: jest.fn(async (tx: VersionedTransaction) => {
        const rebuilt = new VersionedTransaction(tx.message);
        rebuilt.sign([payer]);
        return rebuilt;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;
    const { client, connection } = createClient(wallet, blockhash);

    await expect(client.sendAndConfirm(v1Transaction())).rejects.toThrow(
      /does not write the version 1 envelope/,
    );
    expect(wallet.signTransaction).toHaveBeenCalledTimes(1);
    expect(connection.sendRawTransaction).not.toHaveBeenCalled();
  });

  it("leaves version 0 and legacy transactions alone", async () => {
    const wallet = passthroughWallet();
    const { client, connection } = createClient(wallet, blockhash);

    const v0 = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: transferInstructions(payer),
      }).compileToV0Message(),
    );
    await expect(client.sendAndConfirm(v0)).resolves.toBe("txsig");
    const sentV0 = connection.sendRawTransaction.mock
      .calls[0][0] as unknown as Uint8Array;
    // The version 0 envelope: the compact-u16 signature count comes first.
    expect(sentV0[0]).toBe(1);

    const legacyWallet = {
      publicKey: payer.publicKey,
      signTransaction: jest.fn(async (tx: Transaction) => {
        tx.partialSign(payer);
        return tx;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;
    const legacy = createClient(legacyWallet, blockhash);
    await expect(
      legacy.client.sendAndConfirm(
        new Transaction().add(...transferInstructions(payer)),
      ),
    ).resolves.toBe("txsig");
  });
});

describe("assertV1Envelope", () => {
  const payer = Keypair.generate();
  const blockhash = Keypair.generate().publicKey.toBase58();

  function v1Message() {
    return compileToV1Message({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1,
        }),
      ],
    });
  }

  it("passes a V1Transaction and the bytes it wrote", () => {
    const tx = new V1Transaction(v1Message());
    expect(() => assertV1Envelope(tx)).not.toThrow();
    expect(() => assertV1Envelope(tx, tx.serialize())).not.toThrow();
  });

  it("names the byte a wrong envelope starts with", () => {
    const tx = new VersionedTransaction(v1Message());
    expect(() => assertV1Envelope(tx)).toThrow(/0x01 instead of 0x81/);
  });

  it("says so when the message cannot write itself at all", () => {
    const signed = new V1Transaction(v1Message());
    signed.sign([payer]);
    const roundTripped = VersionedTransaction.deserialize(
      Buffer.from(signed.serialize()),
    );
    expect(() => assertV1Envelope(roundTripped)).toThrow(
      /its serialize\(\) throws/,
    );
  });

  it("ignores anything that is not a version 1 message", () => {
    expect(() => assertV1Envelope(undefined)).not.toThrow();
    expect(() => assertV1Envelope(new Transaction())).not.toThrow();
    // A transaction from another @solana/web3.js instance, as sendAndConfirm
    // already accepts: no message to read, nothing to check.
    expect(() =>
      assertV1Envelope({ serialize: () => new Uint8Array() }),
    ).not.toThrow();
    expect(() =>
      assertV1Envelope(
        new VersionedTransaction(
          new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: blockhash,
            instructions: [],
          }).compileToV0Message(),
        ),
      ),
    ).not.toThrow();
  });
});
