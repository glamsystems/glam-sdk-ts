import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
  AccountMeta,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import { LOOPSCALE_PROGRAM_ID } from "../constants";
import { toBn } from "../utils/common";

export const LOOPSCALE_BS_AUTH = new PublicKey(
  "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs",
);

export type LoopscaleExpectedLoanValues = {
  expectedApy: BN;
  expectedLqt: [number, number, number, number, number];
};

export type CreateLoanParams = {
  nonce: BN;
};

export type DepositCollateralParams = {
  amount: BN;
  assetType: number;
  assetIdentifier: PublicKey;
  assetIndexGuidance: Buffer;
};

export type UpdateWeightMatrixParams = {
  collateralIndex: number;
  weightMatrix: [number, number, number, number, number];
  expectedLoanValues: LoopscaleExpectedLoanValues;
  assetIndexGuidance: Buffer;
};

export type BorrowPrincipalParams = {
  amount: BN;
  assetIndexGuidance: Buffer;
  duration: number;
  expectedLoanValues: LoopscaleExpectedLoanValues;
  skipSolUnwrap: boolean;
};

export type CreateLoanAccounts = {
  loan: PublicKey;
};

export type DepositCollateralAccounts = {
  loan: PublicKey;
  depositMint: PublicKey;
  borrowerCollateralTa?: PublicKey;
  loanCollateralTa?: PublicKey;
  assetIdentifier?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type UpdateWeightMatrixAccounts = {
  loan: PublicKey;
};

export type BorrowPrincipalAccounts = {
  loan: PublicKey;
  strategy: PublicKey;
  marketInformation: PublicKey;
  principalMint: PublicKey;
  borrowerTa?: PublicKey;
  strategyTa?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export function getLoopscaleEventAuthorityPda(
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  )[0];
}

export function getLoopscaleLoanPda(
  borrower: PublicKey,
  nonce: BN | bigint | number,
  programId: PublicKey = LOOPSCALE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [borrower.toBuffer(), toBn(nonce).toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

class TxBuilder extends BaseTxBuilder<LoopscaleClient> {
  async createLoanIx(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .createLoan({ nonce: params.nonce })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async createLoanTx(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.createLoanIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async depositCollateralIx(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;

    return await this.client.base.extLoopscaleProgram.methods
      .depositCollateral({
        amount: params.amount,
        assetType: params.assetType,
        assetIdentifier: params.assetIdentifier,
        assetIndexGuidance: params.assetIndexGuidance,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        borrowerCollateralTa:
          accounts.borrowerCollateralTa ||
          this.client.base.getVaultAta(accounts.depositMint, tokenProgram),
        loanCollateralTa:
          accounts.loanCollateralTa ||
          this.client.getLoanTokenAta(accounts.loan, accounts.depositMint),
        depositMint: accounts.depositMint,
        assetIdentifier: accounts.assetIdentifier || accounts.depositMint,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        eventAuthority: this.client.getEventAuthorityPda(),
      })
      .instruction();
  }

  async depositCollateralTx(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.depositCollateralIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async updateWeightMatrixIx(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extLoopscaleProgram.methods
      .updateWeightMatrix({
        collateralIndex: params.collateralIndex,
        weightMatrix: params.weightMatrix,
        expectedLoanValues: params.expectedLoanValues,
        assetIndexGuidance: params.assetIndexGuidance,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
      })
      .instruction();
  }

  async updateWeightMatrixTx(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateWeightMatrixIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async borrowPrincipalIx(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const instruction = this.client.base.extLoopscaleProgram.methods
      .borrowPrincipal({
        amount: params.amount,
        assetIndexGuidance: params.assetIndexGuidance,
        duration: params.duration,
        expectedLoanValues: params.expectedLoanValues,
        skipSolUnwrap: params.skipSolUnwrap,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: LOOPSCALE_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        bsAuth: LOOPSCALE_BS_AUTH,
        loan: accounts.loan,
        strategy: accounts.strategy,
        marketInformation: accounts.marketInformation,
        principalMint: accounts.principalMint,
        borrowerTa:
          accounts.borrowerTa ||
          this.client.base.getVaultAta(accounts.principalMint, tokenProgram),
        strategyTa:
          accounts.strategyTa ||
          this.client.getStrategyTokenAta(
            accounts.strategy,
            accounts.principalMint,
          ),
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram,
        eventAuthority: this.client.getEventAuthorityPda(),
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async borrowPrincipalTx(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.borrowPrincipalIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class LoopscaleClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extLoopscaleProgram.programId);
  }

  getEventAuthorityPda(): PublicKey {
    return getLoopscaleEventAuthorityPda();
  }

  getBsAuth(): PublicKey {
    return LOOPSCALE_BS_AUTH;
  }

  getLoanPda(
    nonce: BN | bigint | number,
    borrower: PublicKey = this.base.vaultPda,
  ) {
    return getLoopscaleLoanPda(borrower, nonce);
  }

  getLoanTokenAta(
    loan: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(mint, loan, true, tokenProgram);
  }

  getStrategyTokenAta(
    strategy: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(mint, strategy, true, tokenProgram);
  }

  async createLoan(
    params: CreateLoanParams,
    accounts: CreateLoanAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.createLoanTx(params, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async depositCollateral(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositCollateralTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async updateWeightMatrix(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.updateWeightMatrixTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async borrowPrincipal(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.borrowPrincipalTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }
}
