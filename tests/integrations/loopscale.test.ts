import { BN } from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  AccountMeta,
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import {
  GlamClient,
  LOOPSCALE_PROTOCOL,
  LOOPSCALE_SPL_TOKEN_COLLATERAL_ASSET_TYPE,
  LoopscalePolicy,
  USDC,
  USDT,
  getLoopscaleEventAuthorityPda,
  getLoopscaleLoanPda,
  LOOPSCALE_PROGRAM_ID,
  nameToChars,
} from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  loadWalletFromDisk,
} from "../glam_protocol/setup";

const LOOPSCALE_STRATEGY = new PublicKey(
  "4NdW83twQyYxLA1SNZuPNhHLpULtZEMyAKjmpBJwzbRQ",
);
// Loopscale borrower signing authority — a required co-signer on every loopscale
// instruction, provided by Loopscale's MPC service in production.
const LOOPSCALE_BS_AUTH = new PublicKey(
  "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs",
);
const LOOPSCALE_MARKET_INFORMATION = new PublicKey(
  "Go6kfCbT9f1R1MFSfbh9uYviWE4TAG9MFrTWot8s7rCB",
);
const LOOPSCALE_MARGINFI_BANK_A = new PublicKey(
  "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB",
);
const LOOPSCALE_MARGINFI_BANK_B = new PublicKey(
  "HERHSALUF6xRejewNndDdwHaNZytcASbdECtDon2dM2X",
);
const LOOPSCALE_MARGINFI_BANK_VAULT = new PublicKey(
  "4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8",
);
const LOOPSCALE_MARGINFI_VAULT_TOKEN_ACCOUNT = new PublicKey(
  "7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat",
);
const LOOPSCALE_WITHDRAW_AUTHORITY = new PublicKey(
  "3uxNepDbmkDNq6JhRja5Z8QwbTrfmkKP8AKZV5chYDGG",
);
const MARGINFI_PROGRAM = new PublicKey(
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
);
const LOOPSCALE_STRATEGY_AUTHORITY_STATE = new PublicKey(
  "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
);
const LOOPSCALE_STRATEGY_AUTHORITY_CONFIG = new PublicKey(
  "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
);
// Cloned mainnet Loopscale address lookup table (see Anchor.toml). Compresses
// the borrow remaining accounts so the combined lifecycle tx fits in one packet.
const LOOPSCALE_LOOKUP_TABLE = new PublicKey(
  "HGmknUTUmeovMc9ryERNWG6UFZDFDVr9xrum3ZhyL4fC",
);
// Strategy.external_yield_amount in the cloned Loopscale account layout.
const LOOPSCALE_STRATEGY_EXTERNAL_YIELD_AMOUNT_OFFSET = 188;
const LOCALNET_BORROW_AMOUNT_CAP = 100_000;
// Mainnet-cloned oracle accounts can be stale on localnet during the borrow step.
const LOOPSCALE_STALE_PRICE_ERROR = 6024;
const LOOPSCALE_BORROW_REMAINING_ACCOUNTS: AccountMeta[] = [
  { pubkey: LOOPSCALE_MARGINFI_BANK_A, isSigner: false, isWritable: true },
  { pubkey: LOOPSCALE_MARGINFI_BANK_B, isSigner: false, isWritable: true },
  { pubkey: LOOPSCALE_MARGINFI_BANK_VAULT, isSigner: false, isWritable: true },
  {
    pubkey: LOOPSCALE_MARGINFI_VAULT_TOKEN_ACCOUNT,
    isSigner: false,
    isWritable: true,
  },
  { pubkey: LOOPSCALE_WITHDRAW_AUTHORITY, isSigner: false, isWritable: true },
  { pubkey: MARGINFI_PROGRAM, isSigner: false, isWritable: false },
  {
    pubkey: LOOPSCALE_STRATEGY_AUTHORITY_STATE,
    isSigner: false,
    isWritable: true,
  },
  {
    pubkey: LOOPSCALE_MARKET_INFORMATION,
    isSigner: false,
    isWritable: true,
  },
  {
    pubkey: LOOPSCALE_STRATEGY_AUTHORITY_STATE,
    isSigner: false,
    isWritable: true,
  },
  {
    pubkey: LOOPSCALE_STRATEGY_AUTHORITY_CONFIG,
    isSigner: false,
    isWritable: false,
  },
];

async function getLoopscaleStrategyExternalYieldAmount(
  connection: Connection,
): Promise<number> {
  const account = await connection.getAccountInfo(LOOPSCALE_STRATEGY);
  if (!account) {
    throw new Error("Loopscale strategy account is not available on localnet");
  }

  return Number(
    account.data.readBigUInt64LE(
      LOOPSCALE_STRATEGY_EXTERNAL_YIELD_AMOUNT_OFFSET,
    ),
  );
}

describe("loopscale sdk", () => {
  const glamClient = new GlamClient();
  const mintAuthority = loadWalletFromDisk("./tests/test-keypair.json").payer;
  const fixtureNonce = new BN("1776462797");

  let vaultUsdcAta: PublicKey;
  let vaultUsdtAta: PublicKey;

  beforeAll(async () => {
    await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars(`Loopscale SDK ${Date.now()}`),
      baseAssetMint: USDC,
      assets: [USDC, USDT],
      integrationAcls: [
        {
          integrationProgram: glamClient.extLoopscaleProgram.programId,
          protocolsBitmask: LOOPSCALE_PROTOCOL,
          protocolPolicies: [],
        },
      ],
    });

    await airdrop(
      glamClient.connection,
      mintAuthority.publicKey,
      1_000_000_000,
    );
    await airdrop(glamClient.connection, glamClient.vaultPda, 10_000_000_000);

    // Deposit requires the collateral mint in the deposit allowlist; borrow
    // requires the principal mint in the borrow allowlist AND the market in the
    // markets allowlist. Withdraw and repay only check the permission bitmask.
    await glamClient.access.setProtocolPolicy(
      glamClient.extLoopscaleProgram.programId,
      LOOPSCALE_PROTOCOL,
      new LoopscalePolicy(
        [USDT],
        [USDC],
        [LOOPSCALE_MARKET_INFORMATION],
      ).encode(),
    );

    vaultUsdcAta = (
      await getOrCreateAssociatedTokenAccount(
        glamClient.connection,
        mintAuthority,
        USDC,
        glamClient.vaultPda,
        true,
      )
    ).address;
    vaultUsdtAta = (
      await getOrCreateAssociatedTokenAccount(
        glamClient.connection,
        mintAuthority,
        USDT,
        glamClient.vaultPda,
        true,
      )
    ).address;

    await mintTo(
      glamClient.connection,
      mintAuthority,
      USDC,
      vaultUsdcAta,
      mintAuthority,
      1_000_000_000,
    );

    await mintTo(
      glamClient.connection,
      mintAuthority,
      USDT,
      vaultUsdtAta,
      mintAuthority,
      1_000_000_000,
    );
  }, 45_000);

  it("derives the fixture loan PDA from borrower and nonce", () => {
    const borrower = new PublicKey(
      "gLJHKPrZLGBiBZ33hFgZh6YnsEhTVxuRT17UCqNp6ff",
    );
    const loan = getLoopscaleLoanPda(borrower, fixtureNonce);

    expect(loan.toBase58()).toBe(
      "HF7r2z8Phx668weASuUnpVYdMd3Ge1bmC7o45doNmr8N",
    );
  });

  it("derives the loopscale event authority PDA", () => {
    expect(getLoopscaleEventAuthorityPda(LOOPSCALE_PROGRAM_ID).toBase58()).toBe(
      "6sbyEiDvcYELrqoxurz3XTTLLg5wpe8dHCXi4uTvSSTV",
    );
  });

  it("simulates the mainnet createLoan flow on localnet", async () => {
    const balance =
      await glamClient.connection.getTokenAccountBalance(vaultUsdtAta);
    expect(balance.value.amount).toBe("1000000000");

    const externalYieldAmount = await getLoopscaleStrategyExternalYieldAmount(
      glamClient.connection,
    );
    expect(externalYieldAmount).toBeGreaterThan(1);
    // The historical tx borrowed 2 USDC, but localnet clones use current strategy accounting.
    const borrowAmount = new BN(
      Math.min(LOCALNET_BORROW_AMOUNT_CAP, externalYieldAmount - 1),
    );

    const loan = glamClient.loopscale.getLoanPda(fixtureNonce);
    const createLoanIx = await glamClient.loopscale.txBuilder.createLoanIx(
      { nonce: fixtureNonce },
      { loan },
    );
    const depositCollateralIx =
      await glamClient.loopscale.txBuilder.depositCollateralIx(
        {
          amount: new BN(5_000_000),
          assetType: LOOPSCALE_SPL_TOKEN_COLLATERAL_ASSET_TYPE,
          assetIdentifier: USDT,
          assetIndexGuidance: Buffer.alloc(0),
        },
        {
          loan,
          depositMint: USDT,
        },
      );
    const updateWeightMatrixIx =
      await glamClient.loopscale.txBuilder.updateWeightMatrixIx(
        {
          collateralIndex: 0,
          weightMatrix: [1_000_000, 0, 0, 0, 0],
          expectedLoanValues: {
            expectedApy: new BN(0),
            expectedLqt: [0, 0, 0, 0, 0],
          },
          assetIndexGuidance: Buffer.alloc(0),
        },
        { loan },
      );
    const borrowPrincipalIx =
      await glamClient.loopscale.txBuilder.borrowPrincipalIx(
        {
          amount: borrowAmount,
          assetIndexGuidance: Buffer.from([11, 1, 11]),
          duration: 0,
          expectedLoanValues: {
            expectedApy: new BN(1_000),
            expectedLqt: [980_000, 0, 0, 0, 0],
          },
          skipSolUnwrap: false,
        },
        {
          loan,
          strategy: LOOPSCALE_STRATEGY,
          marketInformation: LOOPSCALE_MARKET_INFORMATION,
          principalMint: USDC,
          borrowerTa: vaultUsdcAta,
          remainingAccounts: LOOPSCALE_BORROW_REMAINING_ACCOUNTS,
        },
      );
    const tx = new Transaction().add(
      createLoanIx,
      depositCollateralIx,
      updateWeightMatrixIx,
      borrowPrincipalIx,
    );
    expect(tx.instructions).toHaveLength(4);

    const versionedTx = await glamClient.intoVersionedTransaction(tx, {
      lookupTables: [LOOPSCALE_LOOKUP_TABLE],
    });

    console.log(
      "Versioned TX:",
      Buffer.from(versionedTx.serialize()).toString("base64"),
    );

    const simulation = await glamClient.connection.simulateTransaction(
      versionedTx,
      {
        sigVerify: false,
        replaceRecentBlockhash: true,
      },
    );

    console.log("Simulation result:", JSON.stringify(simulation, null, 2));

    const instructionError = (
      simulation.value.err as {
        InstructionError?: [number, { Custom: number }];
      } | null
    )?.InstructionError;
    if (instructionError) {
      expect(instructionError).toEqual([
        3,
        { Custom: LOOPSCALE_STALE_PRICE_ERROR },
      ]);
    } else {
      expect(simulation.value.err).toBeNull();
    }

    const logs = simulation.value.logs ?? [];
    expect(logs.some((log) => log.includes("Instruction: CreateLoan"))).toBe(
      true,
    );
    expect(
      logs.some((log) => log.includes("Instruction: DepositCollateral")),
    ).toBe(true);
    expect(
      logs.some((log) => log.includes("Instruction: UpdateWeightMatrix")),
    ).toBe(true);
    expect(
      logs.some((log) => log.includes("Instruction: BorrowPrincipal")),
    ).toBe(true);
  }, 45_000);

  // Loopscale instructions cannot be executed or simulated-to-success on
  // localnet: every instruction requires the Loopscale bs_auth co-signature,
  // which is only provided by Loopscale's remote MPC service (see
  // LoopscaleClient.cosignTransaction). On top of that, withdraw_collateral and
  // repay_principal require an active ledger that has settled in an earlier slot
  // (running them in the borrow's slot fails with InvalidLedgerStatusForRefinance,
  // and withdraw on a loan with no active term fails with LoanPastEndTime). Since
  // we cannot persist a borrowed loan without the MPC signature, we validate the
  // new builders deterministically by asserting the constructed instruction's
  // program, decoded params, and resolved accounts.
  it("builds a withdrawCollateral instruction with the expected accounts and params", async () => {
    const nonce = new BN("1776462798");
    const loan = glamClient.loopscale.getLoanPda(nonce);

    const ix = await glamClient.loopscale.txBuilder.withdrawCollateralIx(
      {
        amount: new BN(1_000_000),
        collateralIndex: 2,
        assetIndexGuidance: Buffer.alloc(0),
        expectedLoanValues: {
          expectedApy: new BN(1_000),
          expectedLqt: [980_000, 0, 0, 0, 0],
        },
        closeIfEligible: true,
        withdrawAll: false,
      },
      {
        loan,
        assetMint: USDT,
      },
    );

    expect(ix.programId.equals(glamClient.extLoopscaleProgram.programId)).toBe(
      true,
    );

    const findKey = (pubkey: PublicKey) =>
      ix.keys.find((k) => k.pubkey.equals(pubkey));
    // bs_auth is a required co-signer (provided by MPC in production).
    const bsAuthMeta = findKey(LOOPSCALE_BS_AUTH);
    expect(bsAuthMeta?.isSigner).toBe(true);
    expect(findKey(loan)).toBeDefined();
    expect(findKey(USDT)).toBeDefined();
    // borrowerTa defaults to the vault ATA, loanTa to the loan ATA.
    expect(findKey(vaultUsdtAta)).toBeDefined();
    expect(
      findKey(glamClient.loopscale.getLoanTokenAta(loan, USDT)),
    ).toBeDefined();

    const decoded = glamClient.extLoopscaleProgram.coder.instruction.decode(
      ix.data,
    );
    expect(decoded?.name).toBe("withdrawCollateral");
    const params = (decoded?.data as any).params;
    expect(params.amount.toString()).toBe("1000000");
    expect(params.collateralIndex).toBe(2);
    expect(params.closeIfEligible).toBe(true);
    expect(params.withdrawAll).toBe(false);
  });

  it("builds a repayPrincipal instruction with the expected accounts and params", async () => {
    const nonce = new BN("1776462799");
    const loan = glamClient.loopscale.getLoanPda(nonce);

    const ix = await glamClient.loopscale.txBuilder.repayPrincipalIx(
      {
        amount: new BN(2_000_000),
        ledgerIndex: 1,
        repayAll: true,
      },
      {
        loan,
        strategy: LOOPSCALE_STRATEGY,
        marketInformation: LOOPSCALE_MARKET_INFORMATION,
        principalMint: USDC,
      },
    );

    expect(ix.programId.equals(glamClient.extLoopscaleProgram.programId)).toBe(
      true,
    );

    const findKey = (pubkey: PublicKey) =>
      ix.keys.find((k) => k.pubkey.equals(pubkey));
    const bsAuthMeta = findKey(LOOPSCALE_BS_AUTH);
    expect(bsAuthMeta?.isSigner).toBe(true);
    expect(findKey(loan)).toBeDefined();
    expect(findKey(LOOPSCALE_STRATEGY)).toBeDefined();
    expect(findKey(LOOPSCALE_MARKET_INFORMATION)).toBeDefined();
    expect(findKey(USDC)).toBeDefined();
    // borrowerTa defaults to the vault ATA, strategyTa to the strategy ATA.
    expect(findKey(vaultUsdcAta)).toBeDefined();
    expect(
      findKey(
        glamClient.loopscale.getStrategyTokenAta(LOOPSCALE_STRATEGY, USDC),
      ),
    ).toBeDefined();

    const decoded = glamClient.extLoopscaleProgram.coder.instruction.decode(
      ix.data,
    );
    expect(decoded?.name).toBe("repayPrincipal");
    const params = (decoded?.data as any).params;
    expect(params.amount.toString()).toBe("2000000");
    expect(params.ledgerIndex).toBe(1);
    expect(params.repayAll).toBe(true);
  });
});
