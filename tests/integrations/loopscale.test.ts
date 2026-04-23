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
// Strategy.external_yield_amount in the cloned Loopscale account layout.
const LOOPSCALE_STRATEGY_EXTERNAL_YIELD_AMOUNT_OFFSET = 188;
const LOCALNET_BORROW_AMOUNT_CAP = 100_000;
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

    await glamClient.access.setProtocolPolicy(
      glamClient.extLoopscaleProgram.programId,
      LOOPSCALE_PROTOCOL,
      new LoopscalePolicy([LOOPSCALE_STRATEGY]).encode(),
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
          assetType: 0,
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

    const versionedTx = await glamClient.intoVersionedTransaction(tx, {});

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

    expect(simulation.value.err).toBeNull();

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
});
