import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  type Commitment,
} from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";

describe("BaseClient transaction confirmation", () => {
  const savedEnvironment = {
    NEXT_PUBLIC_WEBSOCKET_DISABLED: process.env.NEXT_PUBLIC_WEBSOCKET_DISABLED,
    WEBSOCKET_DISABLED: process.env.WEBSOCKET_DISABLED,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_WEBSOCKET_DISABLED;
    delete process.env.WEBSOCKET_DISABLED;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createClient(commitment?: Commitment) {
    const connection = new Connection("http://localhost:8899", commitment);
    const wallet = new Wallet(Keypair.generate());
    const latestBlockhash = {
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 100,
    };
    jest
      .spyOn(connection, "getLatestBlockhash")
      .mockResolvedValue(latestBlockhash);
    jest.spyOn(connection, "sendRawTransaction").mockResolvedValue("txsig");
    const client = new BaseClient({
      provider: new AnchorProvider(connection, wallet, {}),
      cluster: ClusterNetwork.Devnet,
      useStaging: false,
    });
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    return { client, connection, latestBlockhash, tx };
  }

  it.each([
    ["processed", "processed"],
    ["confirmed", "confirmed"],
    ["recent", "recent"],
    ["single", "single"],
    ["confirmed", "finalized"],
    ["confirmed", undefined],
  ] as const)(
    "uses %s WebSocket commitment for connection commitment %s",
    async (expectedCommitment, connectionCommitment) => {
      const { client, connection, latestBlockhash, tx } =
        createClient(connectionCommitment);
      const confirm = jest
        .spyOn(connection, "confirmTransaction")
        .mockImplementation(async (_strategy, commitment) => {
          const requestedCommitment =
            commitment ?? connection.commitment ?? "finalized";
          if (requestedCommitment !== expectedCommitment) {
            throw new Error("Unexpected transaction confirmation commitment");
          }
          return { context: { slot: 1 }, value: { err: null } };
        });

      await expect(client.sendAndConfirm(tx)).resolves.toBe("txsig");

      expect(confirm).toHaveBeenCalledWith(
        { ...latestBlockhash, signature: "txsig" },
        expectedCommitment,
      );
      expect(connection.commitment).toBe(connectionCommitment);
    },
  );

  it.each(["confirmed", "finalized"] as const)(
    "accepts a %s transaction on the polling path",
    async (confirmationStatus) => {
      process.env.WEBSOCKET_DISABLED = "1";
      const { client, connection, tx } = createClient("finalized");
      const status = jest
        .spyOn(connection, "getSignatureStatus")
        .mockResolvedValue({
          context: { slot: 1 },
          value: {
            slot: 1,
            confirmations: confirmationStatus === "finalized" ? null : 1,
            confirmationStatus,
            err: null,
          },
        });

      await expect(client.sendAndConfirm(tx)).resolves.toBe("txsig");

      expect(status).toHaveBeenCalledTimes(1);
      expect(status).toHaveBeenCalledWith("txsig");
    },
  );

  it("reports a processed polling error immediately", async () => {
    process.env.WEBSOCKET_DISABLED = "1";
    const { client, connection, tx } = createClient("finalized");
    const status = jest
      .spyOn(connection, "getSignatureStatus")
      .mockResolvedValue({
        context: { slot: 1 },
        value: {
          slot: 1,
          confirmations: 0,
          confirmationStatus: "processed",
          err: { InstructionError: [0, { Custom: 6000 }] },
        },
      });
    jest.spyOn(connection, "getTransaction").mockResolvedValue(null);

    await expect(client.sendAndConfirm(tx)).rejects.toMatchObject({
      rawError: { InstructionError: [0, { Custom: 6000 }] },
    });
    expect(status).toHaveBeenCalledTimes(1);
  });

  it.each(["confirmed", "finalized"] as const)(
    "reports a %s failure on the polling path",
    async (confirmationStatus) => {
      process.env.WEBSOCKET_DISABLED = "1";
      const { client, connection, tx } = createClient("finalized");
      const rawError = { InstructionError: [0, { Custom: 6000 }] };
      const status = jest
        .spyOn(connection, "getSignatureStatus")
        .mockResolvedValue({
          context: { slot: 1 },
          value: {
            slot: 1,
            confirmations: confirmationStatus === "finalized" ? null : 1,
            confirmationStatus,
            err: rawError,
          },
        });
      jest.spyOn(connection, "getTransaction").mockResolvedValue(null);

      await expect(client.sendAndConfirm(tx)).rejects.toMatchObject({
        rawError,
      });
      expect(status).toHaveBeenCalledTimes(1);
    },
  );

  it("reads a failed transaction at confirmed and retains the confirmation error when its body is unavailable", async () => {
    const { client, connection, tx } = createClient("finalized");
    const rawError = { InstructionError: [0, { Custom: 6000 }] };
    jest.spyOn(connection, "confirmTransaction").mockResolvedValue({
      context: { slot: 1 },
      value: { err: rawError },
    });
    const readback = jest
      .spyOn(connection, "getTransaction")
      .mockResolvedValue(null);

    await expect(client.sendAndConfirm(tx)).rejects.toMatchObject({
      rawError,
      programLogs: [],
    });

    expect(readback).toHaveBeenCalledWith("txsig", {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 1,
    });
    expect(connection.commitment).toBe("finalized");
  });
});
