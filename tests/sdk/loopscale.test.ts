import fs from "fs";
import path from "path";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  encodeLoopscaleSellLedgerAssetIndexGuidance,
  LoopscaleBorrowClient,
  LoopscaleLendClient,
  LOOPSCALE_STRATEGY_DISCRIMINATOR,
} from "../../src/client/loopscale";
import { LoopscaleCoreClient } from "../../src/client/loopscale/core";
import { LOOPSCALE_PROGRAM_ID, USDC, USDT, WSOL } from "../../src/constants";
import { LoopscaleLoan, LoopscaleStrategy } from "../../src/deser";
import { PkMap } from "../../src/utils";

const LOOPSCALE_LOAN_DISCRIMINATOR = Buffer.from([
  20, 195, 70, 117, 165, 227, 182, 1,
]);
const LOOPSCALE_LOAN_LEDGER_SIZE = 182;
const LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET =
  1 + 1 + 1 + 32 + 8 + 8 + 5 * LOOPSCALE_LOAN_LEDGER_SIZE;
const LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET = 42;
const LOOPSCALE_FIXTURE_DIR = path.resolve(
  __dirname,
  "../../fixtures/accounts/loopscale",
);

type SolanaCliAccountDump = {
  pubkey: string;
  account: {
    lamports: number;
    owner: string;
    data: [string, "base64"];
  };
};

function pk(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[31] = seed;
  return new PublicKey(bytes);
}

function loadLoopscaleFixtureAccount(fixtureName: string) {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(LOOPSCALE_FIXTURE_DIR, `${fixtureName}.json`),
      "utf8",
    ),
  ) as SolanaCliAccountDump;
  const [base64, encoding] = raw.account.data;

  expect(encoding).toBe("base64");

  return {
    pubkey: new PublicKey(raw.pubkey),
    owner: new PublicKey(raw.account.owner),
    lamports: raw.account.lamports,
    data: Buffer.from(base64, "base64"),
  };
}

function toAccountInfo(
  fixture: ReturnType<typeof loadLoopscaleFixtureAccount>,
) {
  return {
    data: fixture.data,
    owner: fixture.owner,
    executable: false,
    lamports: fixture.lamports,
    rentEpoch: 0,
  };
}

function createLoopscaleLoanAccountData(params: {
  principalMint?: PublicKey;
  collateralMint?: PublicKey;
  collateralAmount?: bigint;
}): Buffer {
  const data = Buffer.alloc(1_658);
  LOOPSCALE_LOAN_DISCRIMINATOR.copy(data, 0);

  const body = data.subarray(8);
  if (params.principalMint) {
    params.principalMint.toBuffer().copy(body, 51 + 1 + 32);
  }
  if (params.collateralMint) {
    params.collateralMint
      .toBuffer()
      .copy(body, LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET);
  }
  if (params.collateralAmount !== undefined) {
    body.writeBigUInt64LE(
      params.collateralAmount,
      LOOPSCALE_LOAN_COLLATERAL_SECTION_OFFSET + 32,
    );
  }

  return data;
}

function createLoopscaleStrategyAccountData(params: {
  principalMint?: PublicKey;
}): Buffer {
  const data = Buffer.alloc(220);
  LOOPSCALE_STRATEGY_DISCRIMINATOR.copy(data, 0);
  if (params.principalMint) {
    params.principalMint
      .toBuffer()
      .copy(data, LOOPSCALE_STRATEGY_PRINCIPAL_MINT_OFFSET);
  }

  return data;
}

function createLoopscaleCoreClientForApiIxTests() {
  const signer = pk(10);
  const vaultPda = pk(11);
  const base = {
    signer,
    vaultPda,
    getVaultAta: jest.fn((mint: PublicKey, tokenProgram = TOKEN_PROGRAM_ID) =>
      // Match BaseClient.getVaultAta, including allowOwnerOffCurve for the PDA.
      getAssociatedTokenAddressSync(mint, vaultPda, true, tokenProgram),
    ),
  } as any;
  const core = new LoopscaleCoreClient(base);
  const borrowClient = new LoopscaleBorrowClient(core);
  const lendClient = new LoopscaleLendClient(core);
  const mappedIx = new TransactionInstruction({
    programId: pk(12),
    keys: [],
    data: Buffer.from([1]),
  });

  (core as any).fetchApiTransaction = jest
    .fn()
    .mockResolvedValue({ message: "stubbed" });
  (core as any).mapApiMessagesToGlamIxs = jest
    .fn()
    .mockResolvedValue([mappedIx]);

  return { borrowClient, core, lendClient, signer, vaultPda, mappedIx };
}

describe("LoopscaleCoreClient", () => {
  it("fetches and validates a Loopscale loan account", async () => {
    const fixture = loadLoopscaleFixtureAccount(
      "FbX2zTQ49sSmxDe4HfSowBM6uzWswcwvpVjtQ1aMyME6",
    );
    const base = {
      connection: {
        getAccountInfo: jest.fn().mockResolvedValue(toAccountInfo(fixture)),
      },
    } as any;

    const client = new LoopscaleCoreClient(base);
    const loan = await client.fetchLoan(fixture.pubkey);

    expect(loan.getAddress()).toEqual(fixture.pubkey);
    await expect(
      client.fetchOwnedLoan(fixture.pubkey, loan.borrower),
    ).resolves.toMatchObject({ borrower: loan.borrower });
    await expect(client.fetchOwnedLoan(fixture.pubkey, pk(29))).rejects.toThrow(
      `Loopscale loan ${fixture.pubkey} borrower ${loan.borrower} does not match expected borrower ${pk(29)}`,
    );
  });

  it("fetches and validates an owned Loopscale strategy account", async () => {
    const fixture = loadLoopscaleFixtureAccount(
      "4NdW83twQyYxLA1SNZuPNhHLpULtZEMyAKjmpBJwzbRQ",
    );
    const decoded = LoopscaleStrategy.decode(fixture.pubkey, fixture.data);
    const base = {
      connection: {
        getAccountInfo: jest.fn().mockResolvedValue(toAccountInfo(fixture)),
      },
    } as any;

    const client = new LoopscaleCoreClient(base);

    await expect(
      client.fetchOwnedStrategy(fixture.pubkey, decoded.lender),
    ).resolves.toMatchObject({ lender: decoded.lender });
    await expect(
      client.fetchOwnedStrategy(fixture.pubkey, pk(39)),
    ).rejects.toThrow(
      `Loopscale strategy ${fixture.pubkey} lender ${decoded.lender} does not match expected lender ${pk(39)}`,
    );
  });

  it("resolves sell-ledger asset index guidance from loan and strategy state", async () => {
    const loanAddress = pk(41);
    const oldStrategy = pk(42);
    const newStrategy = pk(43);
    const marketInformation = pk(44);
    const collateralMint = pk(45);
    const principalOracle = pk(46);
    const collateralOracle = pk(47);
    const client = new LoopscaleCoreClient({} as any);
    const loan = Object.assign(new LoopscaleLoan(), {
      _address: loanAddress,
      ledgers: [
        {
          status: 2,
          strategy: oldStrategy,
          principalMint: USDC,
          marketInformation,
        },
      ],
      collateral: [
        {
          amount: new BN(1),
          assetIdentifier: collateralMint,
        },
      ],
      weightMatrix: [[1_000_000]],
    });
    const strategy = Object.assign(new LoopscaleStrategy(), {
      _address: newStrategy,
      principalMint: USDC,
      marketInformation,
    });
    (client as any).fetchMarketInformation = jest.fn().mockResolvedValue({
      principalMint: USDC,
      assetData: {
        1: { oracleAccount: principalOracle },
        175: { oracleAccount: collateralOracle },
      },
      findAssetIndex: (asset: PublicKey) =>
        asset.equals(collateralMint) ? 175 : asset.equals(USDC) ? 1 : null,
    });

    const terms = await client.resolveSellLedgerMarketAccounts({
      loan,
      ledgerIndex: 0,
      newStrategy: strategy,
    });

    expect(terms).toMatchObject({
      ledgerIndex: 0,
      oldStrategy,
      newStrategy,
      oldStrategyMarketInformation: marketInformation,
      newStrategyMarketInformation: marketInformation,
      principalMint: USDC,
      guidance: {
        principalAssetIndex: 1,
        collateralAssetIndex: 175,
      },
    });
    expect(terms.assetIndexGuidance).toEqual(
      encodeLoopscaleSellLedgerAssetIndexGuidance({
        principalAssetIndex: 1,
        collateralAssetIndex: 175,
      }),
    );
    expect(terms.remainingAccounts).toEqual([
      { pubkey: principalOracle, isSigner: false, isWritable: false },
      { pubkey: collateralOracle, isSigner: false, isWritable: false },
    ]);
  });

  it("asserts Loopscale strategy close readiness", () => {
    const strategy = Object.assign(new LoopscaleStrategy(), {
      _address: pk(40),
      tokenBalance: new BN(0),
      currentDeployedAmount: new BN(0),
      externalYieldAmount: new BN(0),
      outstandingInterestAmount: new BN(0),
      feeClaimable: new BN(0),
      activeLoanCount: new BN(0),
    });
    const client = new LoopscaleCoreClient({} as any);

    expect(() => client.assertStrategyClosable(strategy)).not.toThrow();

    strategy.tokenBalance = new BN(1);
    expect(() => client.assertStrategyClosable(strategy)).toThrow(
      `Strategy ${strategy.getAddress()} still has token balance 1; withdraw principal before closing.`,
    );
  });

  it("asserts Loopscale strategy principal withdraw readiness", () => {
    const strategy = Object.assign(new LoopscaleStrategy(), {
      _address: pk(41),
      tokenBalance: new BN(0),
      externalYieldAmount: new BN(5),
    });
    const client = new LoopscaleCoreClient({} as any);

    expect(() =>
      client.assertStrategyPrincipalWithdrawable(strategy, new BN(0), true),
    ).toThrow(
      `Strategy ${strategy.getAddress()} has no undeployed principal for --all; token balance is 0. Strategy external yield amount is 5; specify an explicit amount to withdraw it.`,
    );

    expect(() =>
      client.assertStrategyPrincipalWithdrawable(strategy, new BN(5), false),
    ).not.toThrow();

    strategy.tokenBalance = new BN(3);
    expect(() =>
      client.assertStrategyPrincipalWithdrawable(strategy, new BN(9), false),
    ).toThrow(
      `Strategy ${strategy.getAddress()} has only 8 withdrawable amount; requested 9.`,
    );

    expect(() =>
      client.assertStrategyPrincipalWithdrawable(strategy, new BN(8), false),
    ).not.toThrow();
  });

  it("fetches registered Loopscale loans from external positions", async () => {
    const loanFixture = loadLoopscaleFixtureAccount(
      "FbX2zTQ49sSmxDe4HfSowBM6uzWswcwvpVjtQ1aMyME6",
    );
    const strategyFixture = loadLoopscaleFixtureAccount(
      "4NdW83twQyYxLA1SNZuPNhHLpULtZEMyAKjmpBJwzbRQ",
    );
    const otherExternalPosition = pk(30);

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [
          otherExternalPosition,
          loanFixture.pubkey,
          strategyFixture.pubkey,
        ],
      }),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: Buffer.alloc(0),
            owner: pk(31),
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
          toAccountInfo(loanFixture),
          toAccountInfo(strategyFixture),
        ]),
      },
    } as any;

    const client = new LoopscaleCoreClient(base);
    const loans = await client.fetchRegisteredLoans();

    expect(loans.map((loan) => loan.getAddress())).toEqual([
      loanFixture.pubkey,
    ]);
  });

  it("fetches registered Loopscale strategies from external positions", async () => {
    const loanFixture = loadLoopscaleFixtureAccount(
      "FbX2zTQ49sSmxDe4HfSowBM6uzWswcwvpVjtQ1aMyME6",
    );
    const strategyFixture = loadLoopscaleFixtureAccount(
      "4NdW83twQyYxLA1SNZuPNhHLpULtZEMyAKjmpBJwzbRQ",
    );
    const otherExternalPosition = pk(32);

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [
          loanFixture.pubkey,
          strategyFixture.pubkey,
          otherExternalPosition,
        ],
      }),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          toAccountInfo(loanFixture),
          toAccountInfo(strategyFixture),
          {
            data: Buffer.alloc(0),
            owner: pk(33),
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleCoreClient(base);
    const strategies = await client.fetchRegisteredStrategies();

    expect(strategies.map((strategy) => strategy.getAddress())).toEqual([
      strategyFixture.pubkey,
    ]);
  });

  it("discovers loopscale loan and oracle accounts from external positions", async () => {
    const loanAccount = pk(31);
    const otherExternalPosition = pk(32);
    const collateralMint = pk(33);
    const principalMint = pk(34);
    const collateralOracle = pk(35);
    const principalOracle = pk(36);

    const assetMetas = new PkMap<any>();
    assetMetas.set(collateralMint, { oracle: collateralOracle });
    assetMetas.set(principalMint, { oracle: principalOracle });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [loanAccount, otherExternalPosition],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: createLoopscaleLoanAccountData({
              principalMint,
              collateralMint,
              collateralAmount: 5_000_000n,
            }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
          {
            data: Buffer.alloc(0),
            owner: pk(37),
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleBorrowClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceLoansAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.loanAccounts).toEqual([loanAccount]);
    expect(accounts?.oracleAccounts).toEqual([
      principalOracle,
      collateralOracle,
    ]);
  });

  it("discovers oracle accounts from the real loopscale loan fixture", async () => {
    const usdcOracle = pk(41);
    const usdtOracle = pk(42);
    const fixture = loadLoopscaleFixtureAccount(
      "FbX2zTQ49sSmxDe4HfSowBM6uzWswcwvpVjtQ1aMyME6",
    );
    const assetMetas = new PkMap<any>();
    assetMetas.set(USDC, { oracle: usdcOracle });
    assetMetas.set(USDT, { oracle: usdtOracle });

    expect(fixture.owner.equals(LOOPSCALE_PROGRAM_ID)).toBe(true);
    expect(fixture.data.length).toBe(1_658);
    expect(
      fixture.data
        .subarray(0, LOOPSCALE_LOAN_DISCRIMINATOR.length)
        .equals(LOOPSCALE_LOAN_DISCRIMINATOR),
    ).toBe(true);

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [fixture.pubkey],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: fixture.data,
            owner: fixture.owner,
            executable: false,
            lamports: fixture.lamports,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleBorrowClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceLoansAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.loanAccounts).toEqual([fixture.pubkey]);
    expect(accounts?.oracleAccounts).toEqual([usdcOracle, usdtOracle]);
  });

  it("preserves loan indexing across chunked external position fetches", async () => {
    const firstChunkNoise = Array.from({ length: 100 }, (_, i) => pk(60 + i));
    const loanAccount = pk(200);
    const collateralMint = pk(201);
    const collateralOracle = pk(202);
    const assetMetas = new PkMap<any>();
    assetMetas.set(collateralMint, { oracle: collateralOracle });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [...firstChunkNoise, loanAccount],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest
          .fn()
          .mockResolvedValueOnce(
            firstChunkNoise.map(() => ({
              data: Buffer.alloc(0),
              owner: pk(250),
              executable: false,
              lamports: 1,
              rentEpoch: 0,
            })),
          )
          .mockResolvedValueOnce([
            {
              data: createLoopscaleLoanAccountData({
                collateralMint,
                collateralAmount: 5_000_000n,
              }),
              owner: LOOPSCALE_PROGRAM_ID,
              executable: false,
              lamports: 1,
              rentEpoch: 0,
            },
          ]),
      },
    } as any;

    const client = new LoopscaleBorrowClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceLoansAccounts();

    expect(base.connection.getMultipleAccountsInfo).toHaveBeenCalledTimes(2);
    expect(accounts).not.toBeNull();
    expect(accounts?.loanAccounts).toEqual([loanAccount]);
    expect(accounts?.oracleAccounts).toEqual([collateralOracle]);
  });

  it("deduplicates repeated oracle accounts across collateral and debt mints", async () => {
    const loanAccount = pk(210);
    const collateralMint = pk(211);
    const principalMint = pk(212);
    const sharedOracle = pk(213);
    const assetMetas = new PkMap<any>();
    assetMetas.set(collateralMint, { oracle: sharedOracle });
    assetMetas.set(principalMint, { oracle: sharedOracle });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [loanAccount],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: createLoopscaleLoanAccountData({
              principalMint,
              collateralMint,
              collateralAmount: 5_000_000n,
            }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleBorrowClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceLoansAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.loanAccounts).toEqual([loanAccount]);
    expect(accounts?.oracleAccounts).toEqual([sharedOracle]);
  });

  it("fails closed when a discovered loan mint has no oracle metadata", async () => {
    const loanAccount = pk(220);
    const fixture = loadLoopscaleFixtureAccount(
      "FbX2zTQ49sSmxDe4HfSowBM6uzWswcwvpVjtQ1aMyME6",
    );
    const assetMetas = new PkMap<any>();
    assetMetas.set(USDC, { oracle: pk(221) });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [loanAccount],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: fixture.data,
            owner: fixture.owner,
            executable: false,
            lamports: fixture.lamports,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleBorrowClient(new LoopscaleCoreClient(base));

    await expect(client.getPriceLoansAccounts()).rejects.toThrow(
      `Oracle unavailable for asset ${USDT.toBase58()}`,
    );
  });

  it("discovers loopscale strategy and oracle accounts from external positions", async () => {
    const strategyAccount = pk(230);
    const otherExternalPosition = pk(231);
    const principalMint = pk(232);
    const principalOracle = pk(233);

    const assetMetas = new PkMap<any>();
    assetMetas.set(principalMint, { oracle: principalOracle });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [strategyAccount, otherExternalPosition],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: createLoopscaleStrategyAccountData({ principalMint }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
          {
            data: Buffer.alloc(0),
            owner: pk(234),
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleLendClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceStrategiesAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.strategyAccounts).toEqual([strategyAccount]);
    expect(accounts?.oracleAccounts).toEqual([principalOracle]);
  });

  it("discovers oracle accounts from the real loopscale strategy fixture", async () => {
    const usdcOracle = pk(241);
    const fixture = loadLoopscaleFixtureAccount(
      "4NdW83twQyYxLA1SNZuPNhHLpULtZEMyAKjmpBJwzbRQ",
    );
    const assetMetas = new PkMap<any>();
    assetMetas.set(USDC, { oracle: usdcOracle });

    expect(fixture.owner.equals(LOOPSCALE_PROGRAM_ID)).toBe(true);
    expect(fixture.data.length).toBe(8_460);
    expect(
      fixture.data
        .subarray(0, LOOPSCALE_STRATEGY_DISCRIMINATOR.length)
        .equals(LOOPSCALE_STRATEGY_DISCRIMINATOR),
    ).toBe(true);

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [fixture.pubkey],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: fixture.data,
            owner: fixture.owner,
            executable: false,
            lamports: fixture.lamports,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleLendClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceStrategiesAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.strategyAccounts).toEqual([fixture.pubkey]);
    expect(accounts?.oracleAccounts).toEqual([usdcOracle]);
  });

  it("deduplicates repeated strategy oracle accounts", async () => {
    const strategyA = pk(250);
    const strategyB = pk(251);
    const principalMint = pk(252);
    const sharedOracle = pk(253);
    const assetMetas = new PkMap<any>();
    assetMetas.set(principalMint, { oracle: sharedOracle });

    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [strategyA, strategyB],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(assetMetas),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: createLoopscaleStrategyAccountData({ principalMint }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
          {
            data: createLoopscaleStrategyAccountData({ principalMint }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleLendClient(new LoopscaleCoreClient(base));
    const accounts = await client.getPriceStrategiesAccounts();

    expect(accounts).not.toBeNull();
    expect(accounts?.strategyAccounts).toEqual([strategyA, strategyB]);
    expect(accounts?.oracleAccounts).toEqual([sharedOracle]);
  });

  it("fails closed when a discovered strategy mint has no oracle metadata", async () => {
    const strategyAccount = pk(260);
    const principalMint = pk(261);
    const base = {
      fetchStateAccount: jest.fn().mockResolvedValue({
        externalPositions: [strategyAccount],
      }),
      fetchAssetMetas: jest.fn().mockResolvedValue(new PkMap<any>()),
      connection: {
        getMultipleAccountsInfo: jest.fn().mockResolvedValue([
          {
            data: createLoopscaleStrategyAccountData({ principalMint }),
            owner: LOOPSCALE_PROGRAM_ID,
            executable: false,
            lamports: 1,
            rentEpoch: 0,
          },
        ]),
      },
    } as any;

    const client = new LoopscaleLendClient(new LoopscaleCoreClient(base));

    await expect(client.getPriceStrategiesAccounts()).rejects.toThrow(
      `Oracle unavailable for asset ${principalMint.toBase58()}`,
    );
  });

  it("prepends vault WSOL ATA creation to API withdraw-collateral instructions", async () => {
    const { borrowClient, core, signer, vaultPda, mappedIx } =
      createLoopscaleCoreClientForApiIxTests();

    const ixs = await borrowClient.buildApiWithdrawCollateralIxs({
      loan: pk(70),
      collateralMint: WSOL,
      amount: new BN(1_000_000),
      collateralIndex: 0,
      assetIndexGuidance: [],
      expectedLoanValues: {
        expectedApy: new BN(0),
        expectedLqt: [0, 0, 0, 0, 0],
      },
    });

    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
    expect(ixs[0].keys[0].pubkey).toEqual(signer);
    expect(ixs[0].keys[2].pubkey).toEqual(vaultPda);
    expect(ixs[0].keys[3].pubkey).toEqual(WSOL);
    expect(ixs[1]).toBe(mappedIx);
    const [, init] = (core as any).fetchApiTransaction.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.closeIfEligible).toBeUndefined();
    expect(body.withdrawAll).toBeUndefined();
  });

  it("prepends vault token ATA creation to non-SOL API withdraw-collateral instructions", async () => {
    const { borrowClient, signer, vaultPda, mappedIx } =
      createLoopscaleCoreClientForApiIxTests();

    const ixs = await borrowClient.buildApiWithdrawCollateralIxs({
      loan: pk(71),
      collateralMint: USDC,
      amount: new BN(1_000_000),
      collateralIndex: 0,
      assetIndexGuidance: [],
      expectedLoanValues: {
        expectedApy: new BN(0),
        expectedLqt: [0, 0, 0, 0, 0],
      },
    });

    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
    expect(ixs[0].keys[0].pubkey).toEqual(signer);
    expect(ixs[0].keys[2].pubkey).toEqual(vaultPda);
    expect(ixs[0].keys[3].pubkey).toEqual(USDC);
    expect(ixs[1]).toBe(mappedIx);
  });

  it("builds API/remapped sell-ledger instructions", async () => {
    const { core, lendClient, signer, vaultPda, mappedIx } =
      createLoopscaleCoreClientForApiIxTests();
    const loan = pk(80);
    const oldStrategy = pk(81);
    const newStrategy = pk(82);

    const ixs = await lendClient.buildApiSellLedgerIxs({
      loan,
      oldStrategy,
      newStrategy,
      ledgerIndex: 2,
      expectedSalePrice: new BN(12_345),
      assetIndexGuidance: [1, 175],
    });

    expect(ixs).toEqual([mappedIx]);
    expect((core as any).fetchApiTransaction).toHaveBeenCalledWith(
      "/markets/creditbook/sell",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
          "user-wallet": vaultPda.toBase58(),
          payer: signer.toBase58(),
        },
      }),
    );
    const [, init] = (core as any).fetchApiTransaction.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      loan: loan.toBase58(),
      oldStrategy: oldStrategy.toBase58(),
      newStrategy: newStrategy.toBase58(),
      sellParams: {
        ledgerIndex: 2,
        expectedSalePrice: 12_345,
        assetIndexGuidance: [1, 175],
      },
    });
    expect((core as any).mapApiMessagesToGlamIxs).toHaveBeenCalledWith(
      ["stubbed"],
      Buffer.from([55, 17, 153, 148, 120, 242, 80, 5]),
    );
  });

  it("prepends vault WSOL ATA creation to API withdraw-strategy instructions", async () => {
    const { lendClient, mappedIx } = createLoopscaleCoreClientForApiIxTests();

    const ixs = await lendClient.buildApiWithdrawStrategyIxs({
      strategy: pk(72),
      principalMint: WSOL,
      amount: new BN(1_000_000),
      withdrawAll: true,
    });

    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
    expect(ixs[0].keys[3].pubkey).toEqual(WSOL);
    expect(ixs[1]).toBe(mappedIx);
  });
});
