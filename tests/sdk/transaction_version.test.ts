import { Connection, PublicKey } from "@solana/web3.js";
import { getTransactionsForAddress } from "../../src/utils/rpc";

// Transaction reads must ask the node for version 1 and accept what comes
// back: legacy, version 0 and version 1 rows in one history. A version 1 row
// carries its resource configuration in the message; the client library
// validates the response before any caller sees it, so the wire shapes here
// are the ones a node serves, not simplified stand-ins.

const ADDRESS = new PublicKey("11111111111111111111111111111112");
const SIGNER = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const SIGNATURES = [
  "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW",
  "4ETf86tK7b4W72f27kNLJLgRWVvxWRwdW8tKAkV3HsrbXdmyUeLHzjMzfQKthmPvvxMhfNJGjxgkrpjDQDCezS3E",
  "2xNweLHLqrbx4zo1waDvgWJHgsUpPj8Y8icbAFeR4a8iVdaPUqW4YvSGqJgFcPBPoHPjrLUhE6VBUP6ycXZGyvi8",
];

type JsonRpcRequest = { id: unknown; method: string; params: unknown[] };

function message(transactionConfig?: Record<string, number | null>) {
  return {
    accountKeys: [SIGNER, ADDRESS.toBase58()],
    header: {
      numRequiredSignatures: 1,
      numReadonlySignedAccounts: 0,
      numReadonlyUnsignedAccounts: 1,
    },
    instructions: [{ accounts: [0, 1], data: "", programIdIndex: 1 }],
    recentBlockhash: BLOCKHASH,
    ...(transactionConfig !== undefined && { transactionConfig }),
  };
}

function meta(fee: number) {
  return {
    err: null,
    fee,
    innerInstructions: [],
    preBalances: [1_000_000, 0],
    postBalances: [1_000_000 - fee, 0],
    logMessages: [`Program log: fee ${fee}`],
    preTokenBalances: [],
    postTokenBalances: [],
    computeUnitsConsumed: 150,
  };
}

/** One row per format, as `getTransaction` with `encoding: "json"` serves them. */
const ROWS: Record<string, Record<string, unknown>> = {
  [SIGNATURES[0]]: {
    slot: 100,
    blockTime: 1_700_000_000,
    version: "legacy",
    transaction: { message: message(), signatures: [SIGNATURES[0]] },
    meta: meta(5000),
  },
  [SIGNATURES[1]]: {
    slot: 101,
    blockTime: 1_700_000_001,
    version: 0,
    transaction: {
      message: { ...message(), addressTableLookups: [] },
      signatures: [SIGNATURES[1]],
    },
    meta: meta(5001),
  },
  [SIGNATURES[2]]: {
    slot: 102,
    blockTime: 1_700_000_002,
    version: 1,
    transaction: {
      message: message({
        computeUnitLimit: 200_000,
        heapSize: null,
        loadedAccountsDataSizeLimit: 65_536,
        priorityFee: 1_000,
      }),
      signatures: [SIGNATURES[2]],
    },
    meta: meta(6000),
  },
};

function jsonRpc(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function parseBody(init?: RequestInit): JsonRpcRequest {
  return JSON.parse(String(init?.body)) as JsonRpcRequest;
}

describe("transaction reads and transaction version 1", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reads legacy, version 0 and version 1 rows in one history over a standard RPC", async () => {
    const requests: JsonRpcRequest[] = [];
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = parseBody(init);
        requests.push(request);
        if (request.method === "getSignaturesForAddress") {
          return jsonRpc(
            request.id,
            SIGNATURES.map((signature, index) => ({
              signature,
              slot: 100 + index,
              err: null,
              memo: null,
              blockTime: 1_700_000_000 + index,
            })),
          );
        }
        if (request.method === "getTransaction") {
          const [signature] = request.params as [string];
          return jsonRpc(request.id, ROWS[signature] ?? null);
        }
        throw new Error(`unexpected method ${request.method}`);
      },
    );

    const connection = new Connection("https://rpc.example.com", {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const transactions = await getTransactionsForAddress(
      connection,
      ADDRESS,
      {},
    );

    const reads = requests.filter((r) => r.method === "getTransaction");
    expect(reads).toHaveLength(SIGNATURES.length);
    for (const read of reads) {
      const [, config] = read.params as [string, Record<string, unknown>];
      expect(config.maxSupportedTransactionVersion).toBe(1);
    }

    expect(transactions.map((tx) => tx.version)).toEqual(["legacy", 0, 1]);
    expect(transactions.map((tx) => tx.slot)).toEqual([100, 101, 102]);
    expect(transactions.map((tx) => tx.meta?.fee)).toEqual([5000, 5001, 6000]);
    expect(transactions[2].meta?.logMessages).toEqual([
      "Program log: fee 6000",
    ]);

    // The version 1 message carries its resource configuration.
    const v1 = transactions[2].transaction.message as unknown as {
      transactionConfig?: Record<string, number | null>;
    };
    expect(v1.transactionConfig).toEqual({
      computeUnitLimit: 200_000,
      heapSize: null,
      loadedAccountsDataSizeLimit: 65_536,
      priorityFee: 1_000,
    });
  });

  it("reads one version 1 transaction by signature with the version 1 ceiling", async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = parseBody(init);
        expect(request.method).toBe("getTransaction");
        const [signature, config] = request.params as [
          string,
          Record<string, unknown>,
        ];
        expect(config.maxSupportedTransactionVersion).toBe(1);
        return jsonRpc(request.id, ROWS[signature] ?? null);
      },
    );
    const connection = new Connection("https://rpc.example.com", {
      fetch: fetchMock as unknown as typeof fetch,
    });

    const tx = await connection.getTransaction(SIGNATURES[2], {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 1,
    });

    expect(tx?.version).toBe(1);
    expect(tx?.meta?.err).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks Helius for version 1 on every history page", async () => {
    const bodies: JsonRpcRequest[] = [];
    const pages = [
      {
        data: [ROWS[SIGNATURES[0]], ROWS[SIGNATURES[2]]],
        paginationToken: "102:1",
      },
      { data: [ROWS[SIGNATURES[1]]] },
    ];
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = parseBody(init);
        bodies.push(request);
        return jsonRpc(request.id, pages[bodies.length - 1]);
      },
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const connection = new Connection(
      "https://mainnet.helius-rpc.com/?api-key=test",
    );
    const transactions = await getTransactionsForAddress(connection, ADDRESS, {
      commitment: "confirmed",
    });

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.method).toBe("getTransactionsForAddress");
      const [address, config] = body.params as [
        string,
        Record<string, unknown>,
      ];
      expect(address).toBe(ADDRESS.toBase58());
      expect(config.transactionDetails).toBe("full");
      expect(config.maxSupportedTransactionVersion).toBe(1);
      expect(config.commitment).toBe("confirmed");
    }
    const [, second] = bodies[1].params as [string, Record<string, unknown>];
    expect(second.paginationToken).toBe("102:1");
    expect(transactions.map((tx) => tx.version)).toEqual(["legacy", 1, 0]);
  });
});
