import { BN } from "@coral-xyz/anchor";
import {
  AccountInfo as Web3AccountInfo,
  Commitment,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { BaseClient, type ProtocolPolicyClient, type TxOptions } from "../base";
import { LoopscaleBorrowPolicy } from "../../deser/integrationPolicies";
import { LOOPSCALE_BORROW_PROTOCOL } from "../../protocols";
import { PkSet } from "../../utils/pkset";
import {
  LoopscaleLoan,
  LoopscaleMarketInformation,
  LoopscaleStrategy,
} from "../../deser";
import {
  BorrowMarketAccounts,
  BorrowPrincipalAccounts,
  BorrowPrincipalParams,
  CreateLoanParams,
  createVaultTokenAtaSetupIx,
  DepositCollateralAccounts,
  DepositCollateralParams,
  getLoopscaleApiMessages,
  LoopscaleBorrowPrincipalTerms,
  LoopscaleBorrowQuoteTerms,
  LoopscaleBorrowTxBuilder,
  LoopscaleCoreClient,
  LoopscaleApiTransactionResponse,
  LOOPSCALE_BORROW_PRINCIPAL_DISCRIMINATOR,
  LOOPSCALE_CREATE_LOAN_DISCRIMINATOR,
  LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR,
  LoopscaleMaxQuoteParams,
  LoopscaleQuote,
  LOOPSCALE_REPAY_PRINCIPAL_DISCRIMINATOR,
  LOOPSCALE_WITHDRAW_COLLATERAL_DISCRIMINATOR,
  PriceLoansAccounts,
  RepayPrincipalAccounts,
  RepayPrincipalParams,
  isLoopscaleLoanAccountInfo,
  readLoopscaleOracleMints,
  UpdateWeightMatrixAccounts,
  UpdateWeightMatrixParams,
  WithdrawCollateralAccounts,
  WithdrawCollateralParams,
} from "./core";
import { bnToSafeNumber } from "../../utils/common";

export type Tuple5 = [number, number, number, number, number];

export class LoopscaleBorrowClient
  implements ProtocolPolicyClient<LoopscaleBorrowPolicy>
{
  readonly txBuilder: LoopscaleBorrowTxBuilder;

  public constructor(private readonly core: LoopscaleCoreClient) {
    this.txBuilder = core.borrowTxBuilder;
  }

  get base(): BaseClient {
    return this.core.base;
  }

  get programId(): PublicKey {
    return this.core.programId;
  }

  get integrationAuthorityPda(): PublicKey {
    return this.core.integrationAuthorityPda;
  }

  getEventAuthorityPda(): PublicKey {
    return this.core.getEventAuthorityPda();
  }

  getLoanPda = this.core.getLoanPda;

  getLoanTokenAta(
    loan: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return this.core.getLoanTokenAta(loan, mint, tokenProgram);
  }

  async fetchPolicy(): Promise<LoopscaleBorrowPolicy | null> {
    return await this.fetchBorrowPolicy();
  }

  async fetchBorrowPolicy(): Promise<LoopscaleBorrowPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      LOOPSCALE_BORROW_PROTOCOL,
      LoopscaleBorrowPolicy,
    );
  }

  async setPolicy(
    policy: LoopscaleBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.setBorrowPolicy(policy, txOptions);
  }

  async setBorrowPolicy(
    policy: LoopscaleBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setBorrowPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async fetchLoan(loan: PublicKey): Promise<LoopscaleLoan> {
    return await this.core.fetchLoan(loan);
  }

  async fetchOwnedLoan(
    loan: PublicKey,
    borrower: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleLoan> {
    return await this.core.fetchOwnedLoan(loan, borrower);
  }

  async fetchRegisteredLoans(
    commitment?: Commitment,
  ): Promise<LoopscaleLoan[]> {
    return await this.core.fetchRegisteredLoans(commitment);
  }

  async fetchMarketInformation(
    marketInformation: PublicKey,
  ): Promise<LoopscaleMarketInformation> {
    return await this.core.fetchMarketInformation(marketInformation);
  }

  async fetchStrategy(strategy: PublicKey): Promise<LoopscaleStrategy> {
    return await this.core.fetchStrategy(strategy);
  }

  async fetchMaxQuotes(
    params: LoopscaleMaxQuoteParams,
  ): Promise<LoopscaleQuote[]> {
    return await this.core.fetchMaxQuotes(params);
  }

  async selectBestQuote(
    quotes: LoopscaleQuote[],
    externalYieldSource?: number,
    borrowAmount?: BN,
  ): Promise<LoopscaleQuote> {
    return await this.core.selectBestQuote(
      quotes,
      externalYieldSource,
      borrowAmount,
    );
  }

  async fetchBestQuote(
    params: LoopscaleMaxQuoteParams,
  ): Promise<LoopscaleQuote> {
    return await this.core.fetchBestQuote(params);
  }

  async resolveBorrowMarketAccounts(params: {
    strategy: PublicKey | LoopscaleStrategy;
    collateralMint: PublicKey;
    expectedApy: BN;
  }): Promise<BorrowMarketAccounts> {
    return await this.core.resolveBorrowMarketAccounts(params);
  }

  async resolveBorrowTermsFromStrategy(params: {
    strategy: PublicKey | LoopscaleStrategy;
    principalMint: PublicKey;
    assetIdentifier: PublicKey;
    expectedApy: BN;
    expectedLqt: Tuple5;
  }): Promise<LoopscaleBorrowPrincipalTerms> {
    return await this.core.resolveBorrowTermsFromStrategy(params);
  }

  async resolveBorrowTermsFromTargetStrategy(params: {
    strategy: PublicKey | LoopscaleStrategy;
    principalMint: PublicKey;
    assetIdentifier: PublicKey;
    requestedDurationIndex?: number;
  }): Promise<LoopscaleBorrowPrincipalTerms> {
    return await this.core.resolveBorrowTermsFromTargetStrategy(params);
  }

  async resolveBorrowTermsFromQuote(params: {
    principalMint: PublicKey;
    collateralMint: PublicKey;
    assetIdentifier: PublicKey;
    collateralAmount: BN;
    borrowAmount: BN;
    durationType: number;
    duration: number;
    externalYieldSource?: number;
  }): Promise<LoopscaleBorrowQuoteTerms> {
    return await this.core.resolveBorrowTermsFromQuote(params);
  }

  async buildApiCreateLoanIxs(
    params: CreateLoanParams,
  ): Promise<{ loan: PublicKey; ixs: TransactionInstruction[] }> {
    const payload = (await this.core.fetchApiTransaction(
      "/markets/creditbook/create",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          borrower: this.base.vaultPda.toBase58(),
          depositCollateral: [],
          principalRequested: [],
          assetIndexGuidance: [],
          loanNonce: params.nonce.toString(),
        }),
      },
    )) as LoopscaleApiTransactionResponse;

    const ixs = await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_CREATE_LOAN_DISCRIMINATOR,
    );
    return { loan: new PublicKey(payload.loanAddress!), ixs };
  }

  async buildApiDepositCollateralIxs(params: {
    loan: PublicKey;
    depositMint: PublicKey;
    amount: BN;
    assetType: number;
    assetIdentifier: PublicKey;
    assetIndexGuidance: number[];
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/creditbook/collateral/deposit",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          depositMint: params.depositMint.toBase58(),
          amount: bnToSafeNumber(params.amount, "deposit amount"),
          assetType: params.assetType,
          assetIdentifier: params.assetIdentifier.toBase58(),
          assetIndexGuidance: params.assetIndexGuidance,
        }),
      },
    );
    const ixs = await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_DEPOSIT_COLLATERAL_DISCRIMINATOR,
    );
    const apiAssetIndexGuidance =
      this.core.getApiUpdateWeightMatrixAssetIndexGuidance(ixs, params.loan);
    const assetIndexGuidance =
      apiAssetIndexGuidance.length > 0
        ? apiAssetIndexGuidance
        : params.assetIndexGuidance;
    return this.core.addDepositCollateralLedgerAccounts(
      this.core.setDepositCollateralAssetIndexGuidance(ixs, assetIndexGuidance),
    );
  }

  async buildApiBorrowPrincipalIxs(params: {
    loan: PublicKey;
    strategy: PublicKey;
    amount: BN;
    assetIndexGuidance: number[];
    duration: number;
    expectedLoanValues: { expectedApy: BN; expectedLqt: Tuple5 };
    skipSolUnwrap: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/creditbook/borrow",
      {
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          strategy: params.strategy.toBase58(),
          borrowParams: {
            amount: bnToSafeNumber(params.amount, "borrow amount"),
            assetIndexGuidance: params.assetIndexGuidance,
            duration: params.duration,
            expectedLoanValues: {
              expectedApy: bnToSafeNumber(
                params.expectedLoanValues.expectedApy,
                "expected APY",
              ),
              expectedLqt: params.expectedLoanValues.expectedLqt,
            },
            skipSolUnwrap: params.skipSolUnwrap,
          },
        }),
      },
    );
    return await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_BORROW_PRINCIPAL_DISCRIMINATOR,
    );
  }

  async buildApiWithdrawCollateralIxs(params: {
    loan: PublicKey;
    collateralMint: PublicKey;
    amount: BN;
    collateralIndex: number;
    assetIndexGuidance: number[];
    expectedLoanValues: { expectedApy: BN; expectedLqt: Tuple5 };
  }): Promise<TransactionInstruction[]> {
    const body: {
      loan: string;
      collateralMint: string;
      amount: number;
      collateralIndex: number;
      expectedLoanValues: { expectedApy: number; expectedLqt: Tuple5 };
      assetIndexGuidance?: number[];
    } = {
      loan: params.loan.toBase58(),
      collateralMint: params.collateralMint.toBase58(),
      amount: bnToSafeNumber(params.amount, "withdraw amount"),
      collateralIndex: params.collateralIndex,
      expectedLoanValues: {
        expectedApy: bnToSafeNumber(
          params.expectedLoanValues.expectedApy,
          "expected APY",
        ),
        expectedLqt: params.expectedLoanValues.expectedLqt,
      },
    };
    if (params.assetIndexGuidance.length > 0) {
      body.assetIndexGuidance = params.assetIndexGuidance;
    }

    const payload = await this.core.fetchApiTransaction(
      "/markets/creditbook/collateral/withdraw",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify(body),
      },
    );
    const mappedIxs = await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_WITHDRAW_COLLATERAL_DISCRIMINATOR,
    );
    const setupIx = createVaultTokenAtaSetupIx({
      mint: params.collateralMint,
      payer: this.base.signer,
      vaultPda: this.base.vaultPda,
      vaultAta: this.base.getVaultAta(params.collateralMint),
    });
    return [setupIx, ...mappedIxs];
  }

  async buildApiRepayPrincipalIxs(params: {
    loan: PublicKey;
    strategy: PublicKey;
    amount: BN;
    ledgerIndex: number;
    repayAll: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/creditbook/repay_simple",
      {
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          strategy: params.strategy.toBase58(),
          repayParams: {
            amount: bnToSafeNumber(params.amount, "repay amount"),
            ledgerIndex: params.ledgerIndex,
            repayAll: params.repayAll,
          },
        }),
      },
    );
    return await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_REPAY_PRINCIPAL_DISCRIMINATOR,
    );
  }

  async cosignTransaction(params: {
    tx: VersionedTransaction;
    identifier: string;
  }): Promise<VersionedTransaction> {
    return await this.core.cosignTransaction(params);
  }

  async createLoan(
    params: CreateLoanParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { loan, ixs } = await this.buildApiCreateLoanIxs(params);
    const loanPda = this.getLoanPda(params.nonce);

    if (!loan.equals(loanPda)) {
      throw new Error(
        `Loopscale create loan API returned loan ${loan}, expected ${loanPda}`,
      );
    }
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async closeLoan(
    loan: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    // close loan ix doesn't need dynamic remaining accounts, build it locally
    const ix = await this.txBuilder.closeLoanIx(loan, txOptions.signer);
    return await this.core.coSignAndSend([ix], txOptions);
  }

  async depositCollateral(
    params: DepositCollateralParams,
    accounts: DepositCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    if (params.assetType !== 0) {
      throw new Error(`Asset type not supported: ${params.assetType}`);
    }

    const { loan, depositMint } = accounts;

    await this.fetchOwnedLoan(loan); // validate loan owner

    const ixs = await this.buildApiDepositCollateralIxs({
      loan,
      depositMint,
      ...params,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  /** @deprecated */
  async updateWeightMatrix(
    params: UpdateWeightMatrixParams,
    accounts: UpdateWeightMatrixAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.updateWeightMatrixIx(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend([ix], txOptions);
  }

  async borrowPrincipal(
    params: BorrowPrincipalParams,
    accounts: BorrowPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const {
      amount,
      duration,
      expectedLoanValues,
      assetIndexGuidance,
      skipSolUnwrap,
    } = params;
    const { loan, strategy } = accounts;

    const ixs = await this.buildApiBorrowPrincipalIxs({
      loan,
      strategy,
      amount,
      assetIndexGuidance,
      duration,
      expectedLoanValues,
      skipSolUnwrap,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async withdrawCollateral(
    params: WithdrawCollateralParams,
    accounts: WithdrawCollateralAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { loan, assetMint } = accounts;
    const ixs = await this.buildApiWithdrawCollateralIxs({
      loan,
      collateralMint: assetMint,
      ...params,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async repayPrincipal(
    params: RepayPrincipalParams,
    accounts: RepayPrincipalAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiRepayPrincipalIxs({
      ...accounts,
      ...params,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  /** @deprecated */
  async resolveLedgerStrategyAccounts(strategy: PublicKey): Promise<{
    strategy: PublicKey;
    marketInformation: PublicKey;
    principalMint: PublicKey;
  }> {
    const strategyInfo = await this.fetchStrategy(strategy);
    return {
      strategy,
      marketInformation: strategyInfo.marketInformation,
      principalMint: strategyInfo.principalMint,
    };
  }

  async getPriceLoansAccounts(
    commitment?: Commitment,
  ): Promise<PriceLoansAccounts | null> {
    const { externalPositions } = await this.base.fetchStateAccount();
    if ((externalPositions || []).length === 0) {
      return null;
    }

    const accountsInfo: (Web3AccountInfo<Buffer> | null)[] = [];
    const chunkSize = 100;
    for (let i = 0; i < externalPositions.length; i += chunkSize) {
      const chunk = externalPositions.slice(i, i + chunkSize);
      const chunkInfos = await this.base.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accountsInfo.push(...chunkInfos);
    }

    const loanAccounts: PublicKey[] = [];
    const oracleMints = new PkSet();
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (!isLoopscaleLoanAccountInfo(info)) {
        continue;
      }

      loanAccounts.push(externalPositions[i]);
      readLoopscaleOracleMints(info.data).forEach((mint) =>
        oracleMints.add(mint),
      );
    }

    if (loanAccounts.length === 0) {
      return null;
    }

    const assetMetas = await this.base.fetchAssetMetas();
    const oracleAccounts: PublicKey[] = [];
    const seenOracles = new PkSet();

    for (const mint of oracleMints) {
      const assetMeta = assetMetas.get(mint);
      if (!assetMeta?.oracle) {
        throw new Error(`Oracle unavailable for asset ${mint.toBase58()}`);
      }
      if (!seenOracles.has(assetMeta.oracle)) {
        seenOracles.add(assetMeta.oracle);
        oracleAccounts.push(assetMeta.oracle);
      }
    }

    return {
      loanAccounts,
      oracleAccounts,
    };
  }
}
