import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";
import { transactionVersionFromEnv } from "../../src/utils/messageV1";

// Version 1 is the SDK's default. Version 0 stays reachable, unchanged,
// through one explicit option at three altitudes: the transaction, the client,
// and the environment, in that order. Under them sits the cluster: the
// repository's localnet is an Agave 3.1.9 validator, which cannot take a
// version 1 transaction, so a client pointed at it builds version 0 without
// anyone asking.

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const PAYER = PublicKey.unique();

function makeClient(
  cluster: ClusterNetwork,
  transactionVersion?: 0 | 1,
): BaseClient {
  const client = Object.create(BaseClient.prototype) as BaseClient;
  Object.assign(client, {
    cluster,
    provider: {
      connection: {
        commitment: "confirmed",
        rpcEndpoint: "http://localhost:8899",
        simulateTransaction: jest.fn(async () => ({
          context: { slot: 1 },
          value: { err: null, unitsConsumed: 200_000 },
        })),
      },
      publicKey: PAYER,
    },
    blockhashWithCache: {
      get: jest.fn(async () => ({
        blockhash: BLOCKHASH,
        lastValidBlockHeight: 1,
      })),
    },
    onSentListeners: new Set(),
    staging: false,
    transactionVersion,
  });
  return client;
}

function resolve(client: BaseClient, explicit?: 0 | 1) {
  return (client as any).resolveTransactionVersion(explicit);
}

describe("choosing a transaction version", () => {
  const saved = process.env.GLAM_TRANSACTION_VERSION;

  afterEach(() => {
    if (saved === undefined) delete process.env.GLAM_TRANSACTION_VERSION;
    else process.env.GLAM_TRANSACTION_VERSION = saved;
  });

  it("builds version 1 by default", () => {
    delete process.env.GLAM_TRANSACTION_VERSION;
    expect(resolve(makeClient(ClusterNetwork.Mainnet))).toBe(1);
    expect(resolve(makeClient(ClusterNetwork.Devnet))).toBe(1);
  });

  it("builds version 0 on localnet", () => {
    delete process.env.GLAM_TRANSACTION_VERSION;
    expect(resolve(makeClient(ClusterNetwork.Localnet))).toBe(0);
  });

  it("reads GLAM_TRANSACTION_VERSION under the cluster", () => {
    process.env.GLAM_TRANSACTION_VERSION = "0";
    expect(resolve(makeClient(ClusterNetwork.Mainnet))).toBe(0);
    process.env.GLAM_TRANSACTION_VERSION = "1";
    expect(resolve(makeClient(ClusterNetwork.Localnet))).toBe(1);
  });

  it("refuses a GLAM_TRANSACTION_VERSION that is neither 0 nor 1", () => {
    process.env.GLAM_TRANSACTION_VERSION = "2";
    expect(() => transactionVersionFromEnv()).toThrow(
      'GLAM_TRANSACTION_VERSION is "2" and the only values are "0" and "1". Nothing was built. Set it to 0 or 1, or unset it to let the client decide.',
    );
  });

  it("ignores an empty GLAM_TRANSACTION_VERSION", () => {
    process.env.GLAM_TRANSACTION_VERSION = "";
    expect(transactionVersionFromEnv()).toBeUndefined();
    expect(resolve(makeClient(ClusterNetwork.Mainnet))).toBe(1);
  });

  it("lets the client's own default beat the environment", () => {
    process.env.GLAM_TRANSACTION_VERSION = "1";
    expect(resolve(makeClient(ClusterNetwork.Mainnet, 0))).toBe(0);
  });

  it("lets one transaction beat the client's default", () => {
    process.env.GLAM_TRANSACTION_VERSION = "1";
    expect(resolve(makeClient(ClusterNetwork.Mainnet, 0), 1)).toBe(1);
    expect(resolve(makeClient(ClusterNetwork.Mainnet, 1), 0)).toBe(0);
  });
});

describe("the version a transaction is actually built at", () => {
  const saved = process.env.GLAM_TRANSACTION_VERSION;

  afterEach(() => {
    if (saved === undefined) delete process.env.GLAM_TRANSACTION_VERSION;
    else process.env.GLAM_TRANSACTION_VERSION = saved;
  });

  function legacyTx() {
    const tx = new Transaction();
    tx.add(
      new TransactionInstruction({
        programId: PublicKey.unique(),
        keys: [
          { pubkey: PublicKey.unique(), isSigner: false, isWritable: true },
        ],
        data: Buffer.from([1]),
      }),
    );
    return tx;
  }

  it("builds version 1 against a devnet client with no options", async () => {
    delete process.env.GLAM_TRANSACTION_VERSION;
    const built = await makeClient(
      ClusterNetwork.Devnet,
    ).intoVersionedTransaction(legacyTx(), {});
    expect(built.message.version).toBe(1);
  });

  it("builds version 0 against a localnet client with no options", async () => {
    delete process.env.GLAM_TRANSACTION_VERSION;
    const built = await makeClient(
      ClusterNetwork.Localnet,
    ).intoVersionedTransaction(legacyTx(), {});
    expect(built.message.version).toBe(0);
  });
});
