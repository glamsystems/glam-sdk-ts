import { Connection, PublicKey } from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import { ClusterNetwork } from "../../src/clientConfig";

function makeClient(opts: {
  cluster: ClusterNetwork;
  getMultipleAccountsInfo?: jest.Mock;
  getProgramAccounts?: jest.Mock;
  statePda?: PublicKey;
}): BaseClient {
  const client = Object.create(BaseClient.prototype) as BaseClient;
  const connection = {
    rpcEndpoint: "http://localhost:8899",
    commitment: "confirmed",
    getMultipleAccountsInfo:
      opts.getMultipleAccountsInfo ?? jest.fn(async () => []),
    getProgramAccounts: opts.getProgramAccounts ?? jest.fn(async () => []),
  };
  Object.assign(client, {
    cluster: opts.cluster,
    provider: {
      connection,
      publicKey: PublicKey.default,
    },
    staging: false,
  });
  if (opts.statePda) {
    (client as any)._statePda = opts.statePda;
  }
  return client;
}

describe("BaseClient default lookup table cache", () => {
  it("skips the RPC fetch entirely on non-mainnet clusters", async () => {
    const getMultipleAccountsInfo = jest.fn();
    const client = makeClient({
      cluster: ClusterNetwork.Devnet,
      getMultipleAccountsInfo,
    });

    const result = await (client as any).getDefaultLookupTables();

    expect(result).toEqual([]);
    expect(getMultipleAccountsInfo).not.toHaveBeenCalled();
  });

  it("fetches once and serves subsequent calls from cache on mainnet", async () => {
    const getMultipleAccountsInfo = jest.fn(async () => []);
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      getMultipleAccountsInfo,
    });

    await (client as any).getDefaultLookupTables();
    await (client as any).getDefaultLookupTables();
    await (client as any).getDefaultLookupTables();

    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
  });

  it("clears the cache when the fetch rejects so the next call retries", async () => {
    const getMultipleAccountsInfo = jest
      .fn()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValueOnce([]);
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      getMultipleAccountsInfo,
    });

    await expect((client as any).getDefaultLookupTables()).rejects.toThrow(
      /rpc down/,
    );
    await (client as any).getDefaultLookupTables();

    expect(getMultipleAccountsInfo).toHaveBeenCalledTimes(2);
  });
});

describe("BaseClient GLAM lookup table cache", () => {
  const statePda = new PublicKey("11111111111111111111111111111112");
  const otherStatePda = new PublicKey("11111111111111111111111111111113");
  const originalFetch = global.fetch;
  const emptyProgramAccountsResponse = () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: [] }));

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("discovers ALTs once per statePda and serves subsequent calls from cache", async () => {
    global.fetch = jest.fn(async () => emptyProgramAccountsResponse());
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      statePda,
    });

    await (client as any).getGlamLookupTablesCached();
    await (client as any).getGlamLookupTablesCached();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("re-discovers when statePda changes", async () => {
    global.fetch = jest.fn(async () => emptyProgramAccountsResponse());
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      statePda,
    });

    await (client as any).getGlamLookupTablesCached();
    client.statePda = otherStatePda;
    await (client as any).getGlamLookupTablesCached();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidateGlamLookupTablesCache forces the next call to re-fetch", async () => {
    global.fetch = jest.fn(async () => emptyProgramAccountsResponse());
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      statePda,
    });

    await (client as any).getGlamLookupTablesCached();
    client.invalidateGlamLookupTablesCache();
    await (client as any).getGlamLookupTablesCached();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("clears the cache when discovery rejects so the next call retries", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            error: { code: -32000, message: "rpc deprioritized" },
          }),
        ),
      )
      .mockResolvedValueOnce(emptyProgramAccountsResponse());
    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      statePda,
    });

    await expect((client as any).getGlamLookupTablesCached()).rejects.toThrow(
      /rpc deprioritized/,
    );
    await (client as any).getGlamLookupTablesCached();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight GLAM ALT discovery when the timeout fires", async () => {
    const abortController = new AbortController();
    const timeoutSpy = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(abortController.signal);
    const abortListener = jest.fn();
    global.fetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const rejectTimeout = () => {
            reject(
              new DOMException("The operation timed out.", "TimeoutError"),
            );
          };
          if (init?.signal?.aborted) {
            rejectTimeout();
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            abortListener();
            rejectTimeout();
          });
        }),
    ) as typeof fetch;
    jest.spyOn(console, "warn").mockImplementation();

    const client = makeClient({
      cluster: ClusterNetwork.Mainnet,
      statePda,
    });
    client.provider.connection = new Connection("https://rpc.example.com");
    Object.defineProperty(client, "vaultPda", {
      value: otherStatePda,
    });

    const promise = (client as any).getGlamLookupTablesCached();
    abortController.abort();

    await expect(promise).resolves.toEqual([]);
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
    expect(abortListener).toHaveBeenCalledTimes(1);
  });
});
