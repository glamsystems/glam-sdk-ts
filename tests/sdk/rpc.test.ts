import { Connection, PublicKey } from "@solana/web3.js";
import { getProgramAccounts } from "../../src/utils/rpc";

describe("getProgramAccounts", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("times out an in-flight direct RPC request", async () => {
    const abortController = new AbortController();
    const timeoutSpy = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(abortController.signal);

    const fetchMock = jest.fn(
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
            rejectTimeout();
          });
        }),
    );
    global.fetch = fetchMock as typeof fetch;

    const promise = getProgramAccounts(
      new Connection("https://rpc.example.com"),
      PublicKey.default,
      { timeoutMs: 5_000 },
    );

    abortController.abort();

    await expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
