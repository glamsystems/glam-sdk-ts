import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import {
  JUPITER_V1_MAX_QUOTE_ACCOUNTS,
  JupiterSwapClient,
} from "../../src/client/jupiter";

// Without address lookup tables the route decides whether a swap fits: a
// version 1 transaction names at most 64 accounts, and GLAM's own accounts
// take 20 of them at the worst case the size suite measures. The quote is
// therefore asked for a route of at most JUPITER_V1_MAX_QUOTE_ACCOUNTS
// accounts on that path. The version 0 path keeps today's request, because its
// lookup tables absorb the route.

const VAULT = PublicKey.unique();
const SWAP_PROGRAM = PublicKey.unique();
const INPUT_MINT = PublicKey.unique();
const OUTPUT_MINT = PublicKey.unique();

function makeClient(transactionVersion: 0 | 1) {
  const getQuoteResponse = jest.fn(async () => ({
    inputMint: INPUT_MINT.toBase58(),
    outputMint: OUTPUT_MINT.toBase58(),
    inAmount: "1000",
  }));
  const getSwapInstructions = jest.fn(async () => ({
    swapInstruction: {
      programId: SWAP_PROGRAM.toBase58(),
      accounts: [
        { pubkey: VAULT.toBase58(), isSigner: false, isWritable: true },
      ],
      data: Buffer.from([1, 2, 3]).toString("base64"),
    },
    addressLookupTableAddresses: [],
  }));

  const base = {
    vaultPda: VAULT,
    resolveTransactionVersion: jest.fn(() => transactionVersion),
    jupiterApiClient: { getQuoteResponse, getSwapInstructions },
  };
  const client = new JupiterSwapClient(base as any, {} as any, {} as any);
  return { client, getQuoteResponse };
}

function quoteParams(extra: Record<string, unknown> = {}) {
  return {
    quoteParams: {
      inputMint: INPUT_MINT.toBase58(),
      outputMint: OUTPUT_MINT.toBase58(),
      amount: 1_000,
      slippageBps: 50,
      ...extra,
    },
  } as any;
}

function resolveContext(
  client: JupiterSwapClient,
  options: unknown,
  transactionVersion?: 0 | 1,
): Promise<{ swapIx: TransactionInstruction }> {
  return (client.txBuilder as any).resolveSwapInstructionContext(
    options,
    transactionVersion,
  );
}

describe("the account budget a Jupiter quote is asked for", () => {
  it("caps the route on the version 1 path", async () => {
    const { client, getQuoteResponse } = makeClient(1);

    await resolveContext(client, quoteParams());

    expect(getQuoteResponse).toHaveBeenCalledTimes(1);
    expect(getQuoteResponse.mock.calls[0][0]).toMatchObject({
      maxAccounts: JUPITER_V1_MAX_QUOTE_ACCOUNTS,
    });
    // 40 route accounts on top of the 20 a swap v2 costs beside its route
    // leaves four under the 64 a version 1 transaction allows.
    expect(JUPITER_V1_MAX_QUOTE_ACCOUNTS).toBe(40);
  });

  it("leaves the version 0 request as it was", async () => {
    const { client, getQuoteResponse } = makeClient(0);

    await resolveContext(client, quoteParams());

    expect(getQuoteResponse.mock.calls[0][0]).toEqual({
      inputMint: INPUT_MINT.toBase58(),
      outputMint: OUTPUT_MINT.toBase58(),
      amount: 1_000,
      slippageBps: 50,
    });
  });

  it("leaves a caller who asks for fewer accounts alone", async () => {
    const { client, getQuoteResponse } = makeClient(1);

    await resolveContext(client, quoteParams({ maxAccounts: 24 }));

    expect(getQuoteResponse.mock.calls[0][0]).toMatchObject({
      maxAccounts: 24,
    });
  });

  it("caps a caller who asks for more", async () => {
    const { client, getQuoteResponse } = makeClient(1);

    await resolveContext(client, quoteParams({ maxAccounts: 64 }));

    expect(getQuoteResponse.mock.calls[0][0]).toMatchObject({
      maxAccounts: JUPITER_V1_MAX_QUOTE_ACCOUNTS,
    });
  });

  it("takes the version the caller passed over the client's default", async () => {
    const { client, getQuoteResponse } = makeClient(1);

    await resolveContext(client, quoteParams(), 0);

    expect(getQuoteResponse.mock.calls[0][0].maxAccounts).toBeUndefined();
  });
});
