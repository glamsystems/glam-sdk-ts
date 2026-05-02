import type { Wallet } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";

describe("BaseClient.sendAndConfirm", () => {
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
        publicKey: walletKeypair.publicKey,
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
});
