import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { JupiterSwapClient } from "../../src/client/jupiter";
import { KAMINO_LENDING_PROGRAM, WSOL } from "../../src/constants";

const STATE = PublicKey.unique();
const VAULT = PublicKey.unique();
const SIGNER = PublicKey.unique();
const PROTOCOL = PublicKey.unique();
const INPUT_MINT = PublicKey.unique();
const OUTPUT_MINT = PublicKey.unique();
const INPUT_RESERVE = PublicKey.unique();
const OUTPUT_RESERVE = PublicKey.unique();
const SOL_RESERVE = PublicKey.unique();
const PYTH_ORACLE = PublicKey.unique();
const MARKET = PublicKey.unique();
const SWAP_PROGRAM = PublicKey.unique();

type OracleSpec = { oracle: PublicKey; oracleSource: string };

function mintAccountInfo() {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: 0n,
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  );
  return {
    data,
    executable: false,
    lamports: 0,
    owner: TOKEN_PROGRAM_ID,
    rentEpoch: 0,
  };
}

function reserve(pubkey: PublicKey) {
  return {
    getAddress: () => pubkey,
    lendingMarket: MARKET,
    scopePriceFeed: PublicKey.default,
  };
}

function expectPubkeys(actual: PublicKey[], expected: PublicKey[]) {
  expect(actual.map((pubkey) => pubkey.toBase58())).toEqual(
    expected.map((pubkey) => pubkey.toBase58()),
  );
}

/**
 * swap-v2 reads three oracles: the input mint's, the output mint's and
 * SOL/USD. Each of them can be a Kamino reserve, and a reserve klend has
 * marked stale is refused by glam_protocol, so the transaction must carry one
 * refresh_reserves_batch covering all of them.
 */
function makeSwapClient(oracles: Map<string, OracleSpec>) {
  const swapIx = new TransactionInstruction({
    programId: PROTOCOL,
    keys: [],
    data: Buffer.from([7]),
  });
  const swapBuilder: {
    accounts: jest.Mock;
    remainingAccounts: jest.Mock;
    instruction: jest.Mock;
  } = {
    accounts: jest.fn(() => swapBuilder),
    remainingAccounts: jest.fn(() => swapBuilder),
    instruction: jest.fn(async () => swapIx),
  };
  const jupiterSwapV2 = jest.fn(() => swapBuilder);

  const getAssetMeta = jest.fn(async (mint: PublicKey) => {
    const spec = oracles.get(mint.toBase58());
    if (!spec) {
      throw new Error(`Asset not supported: ${mint.toBase58()}`);
    }
    return {
      asset: mint,
      decimals: 6,
      oracle: spec.oracle,
      oracleSource: spec.oracleSource,
      programId: TOKEN_PROGRAM_ID,
    };
  });

  const fetchAndParseReserves = jest.fn(async (pubkeys: PublicKey[]) =>
    pubkeys.map((pubkey) => reserve(pubkey)),
  );
  const refreshReservesBatchIx = jest.fn(
    (reserves: ReturnType<typeof reserve>[]) =>
      new TransactionInstruction({
        programId: KAMINO_LENDING_PROGRAM,
        keys: reserves.map((parsed) => ({
          pubkey: parsed.getAddress(),
          isSigner: false,
          isWritable: true,
        })),
        data: Buffer.from([reserves.length]),
      }),
  );

  const base = {
    statePda: STATE,
    vaultPda: VAULT,
    signer: SIGNER,
    protocolProgram: { programId: PROTOCOL, methods: { jupiterSwapV2 } },
    connection: { getAccountInfo: jest.fn(async () => mintAccountInfo()) },
    getVaultAta: (mint: PublicKey, tokenProgram?: PublicKey) =>
      getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgram),
    getAssetMeta,
    getSolOracle: jest.fn(async () => {
      const spec = oracles.get(WSOL.toBase58());
      if (!spec) {
        throw new Error("Asset not supported: WSOL");
      }
      return spec.oracle;
    }),
    jupiterApiClient: {},
  };
  const vault = { maybeWrapSol: jest.fn(async () => []) };
  const klend = {
    fetchAndParseReserves,
    txBuilder: { refreshReservesBatchIx },
  };

  const client = new JupiterSwapClient(base as any, vault as any, klend as any);

  return {
    client,
    swapIx,
    fetchAndParseReserves,
    refreshReservesBatchIx,
    getAssetMeta,
  };
}

function swapOptions() {
  return {
    quoteParams: {
      inputMint: INPUT_MINT.toBase58(),
      outputMint: OUTPUT_MINT.toBase58(),
      amount: 1_000,
      slippageBps: 50,
    },
    swapInstructions: {
      swapInstruction: {
        programId: SWAP_PROGRAM.toBase58(),
        accounts: [
          { pubkey: VAULT.toBase58(), isSigner: false, isWritable: true },
        ],
        data: Buffer.from([1, 2, 3]).toString("base64"),
      },
      addressLookupTableAddresses: [],
    },
  } as any;
}

function refreshIxs(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return ixs.filter((ix) => ix.programId.equals(KAMINO_LENDING_PROGRAM));
}

describe("Jupiter swap-v2 Kamino reserve oracle refresh", () => {
  it("collects the input, output and SOL/USD reserves, each once", async () => {
    const { client } = makeSwapClient(
      new Map([
        [
          INPUT_MINT.toBase58(),
          { oracle: INPUT_RESERVE, oracleSource: "KaminoReserve" },
        ],
        [
          OUTPUT_MINT.toBase58(),
          { oracle: OUTPUT_RESERVE, oracleSource: "KaminoReserve" },
        ],
        [
          WSOL.toBase58(),
          { oracle: SOL_RESERVE, oracleSource: "KaminoReserve" },
        ],
      ]),
    );

    const accounts = await client.txBuilder.getSwapV2OracleAccounts(
      INPUT_MINT,
      OUTPUT_MINT,
      false,
    );

    expect(accounts.solUsdOracle?.toBase58()).toBe(SOL_RESERVE.toBase58());
    expectPubkeys(accounts.kaminoReservesToRefresh, [
      INPUT_RESERVE,
      OUTPUT_RESERVE,
      SOL_RESERVE,
    ]);
  });

  it("collects the SOL/USD reserve when only the SOL oracle is a Kamino reserve", async () => {
    const { client } = makeSwapClient(
      new Map([
        [INPUT_MINT.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
        [OUTPUT_MINT.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
        [
          WSOL.toBase58(),
          { oracle: SOL_RESERVE, oracleSource: "KaminoReserve" },
        ],
      ]),
    );

    const accounts = await client.txBuilder.getSwapV2OracleAccounts(
      INPUT_MINT,
      OUTPUT_MINT,
      false,
    );

    expectPubkeys(accounts.kaminoReservesToRefresh, [SOL_RESERVE]);
  });

  it("lists a reserve once when the SOL oracle and an input oracle share it", async () => {
    const { client } = makeSwapClient(
      new Map([
        [
          INPUT_MINT.toBase58(),
          { oracle: SOL_RESERVE, oracleSource: "KaminoReserve" },
        ],
        [
          OUTPUT_MINT.toBase58(),
          { oracle: OUTPUT_RESERVE, oracleSource: "KaminoReserve" },
        ],
        [
          WSOL.toBase58(),
          { oracle: SOL_RESERVE, oracleSource: "KaminoReserve" },
        ],
      ]),
    );

    const accounts = await client.txBuilder.getSwapV2OracleAccounts(
      INPUT_MINT,
      OUTPUT_MINT,
      false,
    );

    expectPubkeys(accounts.kaminoReservesToRefresh, [
      SOL_RESERVE,
      OUTPUT_RESERVE,
    ]);
  });

  it("collects nothing when no oracle is a Kamino reserve", async () => {
    const { client } = makeSwapClient(
      new Map([
        [INPUT_MINT.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
        [OUTPUT_MINT.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
        [WSOL.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
      ]),
    );

    const accounts = await client.txBuilder.getSwapV2OracleAccounts(
      INPUT_MINT,
      OUTPUT_MINT,
      false,
    );

    expect(accounts.kaminoReservesToRefresh).toEqual([]);
  });

  it("builds one refresh instruction, before the swap, holding each reserve once", async () => {
    const { client, swapIx, fetchAndParseReserves, refreshReservesBatchIx } =
      makeSwapClient(
        new Map([
          [
            INPUT_MINT.toBase58(),
            { oracle: INPUT_RESERVE, oracleSource: "KaminoReserve" },
          ],
          [
            OUTPUT_MINT.toBase58(),
            { oracle: OUTPUT_RESERVE, oracleSource: "KaminoReserve" },
          ],
          [
            WSOL.toBase58(),
            { oracle: SOL_RESERVE, oracleSource: "KaminoReserve" },
          ],
        ]),
      );

    const [ixs] = await client.txBuilder.swapV2Ixs(swapOptions(), SIGNER);

    const refreshes = refreshIxs(ixs);
    expect(refreshes).toHaveLength(1);
    expect(fetchAndParseReserves).toHaveBeenCalledTimes(1);
    expect(refreshReservesBatchIx).toHaveBeenCalledTimes(1);
    expectPubkeys(fetchAndParseReserves.mock.calls[0][0], [
      INPUT_RESERVE,
      OUTPUT_RESERVE,
      SOL_RESERVE,
    ]);
    expectPubkeys(
      refreshes[0].keys.map(({ pubkey }) => pubkey),
      [INPUT_RESERVE, OUTPUT_RESERVE, SOL_RESERVE],
    );
    expect(ixs.indexOf(refreshes[0])).toBeLessThan(ixs.indexOf(swapIx));
    expect(ixs[ixs.length - 1]).toBe(swapIx);
  });

  it("builds no refresh instruction when no oracle is a Kamino reserve", async () => {
    const { client, refreshReservesBatchIx, fetchAndParseReserves } =
      makeSwapClient(
        new Map([
          [
            INPUT_MINT.toBase58(),
            { oracle: PYTH_ORACLE, oracleSource: "Pyth" },
          ],
          [
            OUTPUT_MINT.toBase58(),
            { oracle: PYTH_ORACLE, oracleSource: "Pyth" },
          ],
          [WSOL.toBase58(), { oracle: PYTH_ORACLE, oracleSource: "Pyth" }],
        ]),
      );

    const [ixs] = await client.txBuilder.swapV2Ixs(swapOptions(), SIGNER);

    expect(refreshIxs(ixs)).toHaveLength(0);
    expect(fetchAndParseReserves).not.toHaveBeenCalled();
    expect(refreshReservesBatchIx).not.toHaveBeenCalled();
  });
});
