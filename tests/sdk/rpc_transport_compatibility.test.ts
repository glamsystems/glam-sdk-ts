import { createRequire } from "node:module";
import { Connection, PublicKey, SolanaJSONRPCError } from "@solana/web3.js";

type RpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: unknown[];
};

const ADDRESS = "11111111111111111111111111111112";
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function mockConnection(reply: (body: RpcRequest | RpcRequest[]) => Response) {
  const fetchMock = jest.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) =>
      reply(JSON.parse(String(init?.body))),
  );
  return {
    fetchMock,
    connection: new Connection("https://rpc.example.com", {
      fetch: fetchMock as unknown as typeof fetch,
      disableRetryOnRateLimit: true,
    }),
  };
}

function parsedTransaction(signature: string, slot: number) {
  return {
    slot,
    blockTime: 1_700_000_000 + slot,
    version: "legacy",
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [{ pubkey: ADDRESS, signer: true, writable: true }],
        instructions: [],
        recentBlockhash: BLOCKHASH,
      },
    },
    meta: {
      err: null,
      fee: 5000,
      preBalances: [100_000],
      postBalances: [95_000],
    },
  };
}

describe("web3.js JSON-RPC transport compatibility", () => {
  it("generates distinct request IDs and reads successful single responses", async () => {
    const requests: RpcRequest[] = [];
    const { connection, fetchMock } = mockConnection((body) => {
      const request = body as RpcRequest;
      requests.push(request);
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        result: 100 + requests.length,
      });
    });

    await expect(connection.getSlot("confirmed")).resolves.toBe(101);
    await expect(connection.getSlot("confirmed")).resolves.toBe(102);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const request of requests) {
      expect(request).toMatchObject({
        jsonrpc: "2.0",
        method: "getSlot",
        params: [{ commitment: "confirmed" }],
      });
      expect(request.id).toMatch(UUID_V4);
    }
    expect(requests[0].id).not.toBe(requests[1].id);
  });

  it("preserves explicit string and numeric IDs, including zero", async () => {
    // Resolve the browser client from its actual consumer rather than depending
    // on a separately installed Jayson copy. Connection uses this same entry.
    const requireFromWeb3 = createRequire(require.resolve("@solana/web3.js"));
    const BrowserClient = requireFromWeb3("jayson/lib/client/browser");
    const requests: RpcRequest[] = [];
    const client = new BrowserClient(
      (
        message: string,
        callback: (error: Error | null, response: string) => void,
      ) => {
        const request = JSON.parse(message) as RpcRequest;
        requests.push(request);
        callback(
          null,
          JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "ok" }),
        );
      },
    );

    for (const id of ["request-7", 7, 0]) {
      await expect(
        new Promise((resolve, reject) => {
          client.request(
            "echo",
            ["ok"],
            id,
            (error: Error | null, response: unknown) => {
              if (error) reject(error);
              else resolve(response);
            },
          );
        }),
      ).resolves.toEqual({ jsonrpc: "2.0", id, result: "ok" });
    }
    expect(requests.map((request) => request.id)).toEqual(["request-7", 7, 0]);
  });

  it("reads a parsed transaction batch without losing ordering or null entries", async () => {
    const signatures = [
      "first-signature",
      "missing-signature",
      "last-signature",
    ];
    const results = [
      parsedTransaction(signatures[0], 101),
      null,
      parsedTransaction(signatures[2], 303),
    ];
    let requests: RpcRequest[] = [];
    const { connection, fetchMock } = mockConnection((body) => {
      expect(Array.isArray(body)).toBe(true);
      requests = body as RpcRequest[];
      return jsonResponse(
        requests.map((request, index) => ({
          jsonrpc: "2.0",
          id: request.id,
          result: results[index],
        })),
      );
    });

    const transactions = await connection.getParsedTransactions(signatures, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requests.map((request) => request.params[0])).toEqual(signatures);
    expect(new Set(requests.map((request) => request.id)).size).toBe(3);
    for (const request of requests) {
      expect(request.method).toBe("getTransaction");
      expect(request.params[1]).toEqual({
        encoding: "jsonParsed",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 1,
      });
      expect(request.id).toMatch(UUID_V4);
    }
    expect(
      transactions.map((transaction) => transaction?.slot ?? null),
    ).toEqual([101, null, 303]);
    expect(transactions[0]?.transaction.signatures).toEqual([signatures[0]]);
    expect(transactions[2]?.transaction.signatures).toEqual([signatures[2]]);
    expect(transactions[0]?.transaction.message.accountKeys[0].pubkey).toEqual(
      new PublicKey(ADDRESS),
    );
  });

  it("rejects the whole batch when one RPC response is an error", async () => {
    const rpcError = {
      code: -32015,
      message: "Unsupported transaction version",
      data: { version: 2 },
    };
    const { connection } = mockConnection((body) => {
      const requests = body as RpcRequest[];
      return jsonResponse([
        { jsonrpc: "2.0", id: requests[0].id, result: null },
        { jsonrpc: "2.0", id: requests[1].id, error: rpcError },
      ]);
    });

    await expect(
      connection.getParsedTransactions(["missing", "unsupported"]),
    ).rejects.toMatchObject({
      code: rpcError.code,
      data: rpcError.data,
      message: `failed to get transactions: ${rpcError.message}`,
    });
  });

  it("preserves a single JSON-RPC error's code and data", async () => {
    const rpcError = {
      code: -32005,
      message: "Node is behind",
      data: { numSlotsBehind: 42 },
    };
    const { connection } = mockConnection((body) =>
      jsonResponse({
        jsonrpc: "2.0",
        id: (body as RpcRequest).id,
        error: rpcError,
      }),
    );

    const request = connection.getSlot();
    await expect(request).rejects.toBeInstanceOf(SolanaJSONRPCError);
    await expect(request).rejects.toMatchObject({
      code: rpcError.code,
      data: rpcError.data,
    });
  });

  it("rejects invalid JSON instead of treating it as a successful response", async () => {
    const { connection } = mockConnection(() => new Response("not JSON"));
    await expect(connection.getSlot()).rejects.toBeInstanceOf(SyntaxError);
  });

  it("propagates unsuccessful HTTP responses", async () => {
    const { connection, fetchMock } = mockConnection(
      () =>
        new Response("RPC unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        }),
    );
    await expect(connection.getSlot()).rejects.toThrow(
      "503 Service Unavailable: RPC unavailable",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates transport failures", async () => {
    const transportError = new Error("connection interrupted");
    const { connection } = mockConnection(() => {
      throw transportError;
    });
    await expect(connection.getSlot()).rejects.toBe(transportError);
  });
});
