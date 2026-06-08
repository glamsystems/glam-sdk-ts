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

describe("BaseClient.sendAndConfirm", () => {
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
        get: jest.fn(async () => ({
          blockhash,
          lastValidBlockHeight: 1,
        })),
      },
      onSentListeners: new Set(),
      staging: false,
    });
    (client as any).confirmTransaction = jest.fn(async () => ({
      value: { err: null },
    }));

    return { client, connection };
  }

  it("signs legacy transactions through the wallet without reading payer", async () => {
    const walletKeypair = Keypair.generate();
    const to = Keypair.generate().publicKey;
    const blockhash = Keypair.generate().publicKey.toBase58();

    const wallet = {
      get payer() {
        throw new Error("payer should not be accessed");
      },
      publicKey: walletKeypair.publicKey,
      signTransaction: jest.fn(async (tx: Transaction) => {
        tx.partialSign(walletKeypair);
        return tx;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;

    const { client, connection } = createClient(wallet, blockhash);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletKeypair.publicKey,
        toPubkey: to,
        lamports: 1,
      }),
    );

    await expect(client.sendAndConfirm(tx)).resolves.toBe("txsig");

    expect(tx.feePayer?.equals(walletKeypair.publicKey)).toBe(true);
    expect(tx.recentBlockhash).toBe(blockhash);
    expect(wallet.signTransaction).toHaveBeenCalledWith(tx);
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it("does not re-sign legacy transactions after wallet signing when extra signers are present", async () => {
    const walletKeypair = Keypair.generate();
    const extraSigner = Keypair.generate();
    const to = Keypair.generate().publicKey;
    const blockhash = Keypair.generate().publicKey.toBase58();

    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: jest.fn(async (tx: Transaction) => {
        tx.partialSign(walletKeypair);
        return tx;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;

    const { client, connection } = createClient(wallet, blockhash);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: extraSigner.publicKey,
        toPubkey: to,
        lamports: 1,
      }),
    );
    const signSpy = jest.spyOn(tx, "sign");

    await expect(client.sendAndConfirm(tx, [extraSigner])).resolves.toBe(
      "txsig",
    );

    expect(signSpy).not.toHaveBeenCalled();
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it("signs versioned transactions with extra signers after wallet signing", async () => {
    const walletKeypair = Keypair.generate();
    const extraSigner = Keypair.generate();
    const to = Keypair.generate().publicKey;
    const blockhash = Keypair.generate().publicKey.toBase58();

    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: jest.fn(async (tx: VersionedTransaction) => {
        tx.sign([walletKeypair]);
        return tx;
      }),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;

    const { client, connection } = createClient(wallet, blockhash);

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: walletKeypair.publicKey,
        recentBlockhash: blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: extraSigner.publicKey,
            toPubkey: to,
            lamports: 1,
          }),
        ],
      }).compileToV0Message(),
    );
    const signSpy = jest.spyOn(tx, "sign");

    await expect(client.sendAndConfirm(tx, [extraSigner])).resolves.toBe(
      "txsig",
    );

    expect(signSpy).toHaveBeenCalledWith([walletKeypair]);
    expect(signSpy).toHaveBeenCalledWith([extraSigner]);
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it("signs structurally versioned transactions from another web3.js instance", async () => {
    const walletKeypair = Keypair.generate();
    const extraSigner = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();
    const signedTx = {
      sign: jest.fn(),
      serialize: jest.fn(() => new Uint8Array()),
    } as unknown as VersionedTransaction;

    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: jest.fn(async () => signedTx),
      signAllTransactions: jest.fn(),
    } as unknown as Wallet;

    const { client, connection } = createClient(wallet, blockhash);
    const tx = {
      serialize: jest.fn(() => new Uint8Array()),
    } as unknown as VersionedTransaction;

    await expect(client.sendAndConfirm(tx, [extraSigner])).resolves.toBe(
      "txsig",
    );

    expect(signedTx.sign).toHaveBeenCalledWith([extraSigner]);
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(1);
  });
});
