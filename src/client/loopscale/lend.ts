import { BN } from "@coral-xyz/anchor";
import {
  AccountInfo as Web3AccountInfo,
  Commitment,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { BaseClient, type ProtocolPolicyClient, type TxOptions } from "../base";
import { LoopscaleLendingPolicy } from "../../deser/integrationPolicies";
import { LOOPSCALE_LENDING_PROTOCOL } from "../../protocols";
import { PkSet } from "../../utils/pkset";
import { LOOPSCALE_PROGRAM_ID } from "../../constants";
import { bnToSafeNumber } from "../../utils/common";
import {
  LoopscaleLoan,
  LoopscaleMarketInformation,
  LoopscaleStrategy,
} from "../../deser";
import {
  CloseStrategyAccounts,
  CreateStrategyParams,
  createVaultWsolAtaSetupIxs,
  DepositStrategyAccounts,
  getLoopscaleApiMessages,
  LoopscaleApiCollateralTermUpdate,
  LoopscaleApiUpdateStrategyParams,
  LoopscaleCoreClient,
  LoopscaleLendTxBuilder,
  LoopscaleMappedTransaction,
  LoopscaleMultiCollateralTermsUpdateParams,
  LoopscaleSellLedgerTerms,
  LoopscaleStrategyWithMarket,
  LOOPSCALE_CLOSE_STRATEGY_DISCRIMINATOR,
  LOOPSCALE_CREATE_STRATEGY_DISCRIMINATOR,
  LOOPSCALE_DEPOSIT_STRATEGY_DISCRIMINATOR,
  LOOPSCALE_SELL_LEDGER_DISCRIMINATOR,
  LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR,
  LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT,
  LOOPSCALE_WITHDRAW_STRATEGY_DISCRIMINATOR,
  PriceStrategiesAccounts,
  replaceLoopscaleApiExtraSigners,
  isLoopscaleStrategyAccountInfo,
  readLoopscaleStrategyPrincipalMint,
  SellLedgerAccounts,
  SellLedgerParams,
  WithdrawStrategyAccounts,
} from "./core";

export type CreateStrategyResult = {
  nonce: PublicKey;
  strategy: PublicKey;
  signature: TransactionSignature;
  signatures: TransactionSignature[];
};

export type PriceStrategiesParams = {
  commitment?: Commitment;
  solUsdOracle?: PublicKey;
  baseAssetOracle?: PublicKey;
};

export class LoopscaleLendClient
  implements ProtocolPolicyClient<LoopscaleLendingPolicy>
{
  readonly txBuilder: LoopscaleLendTxBuilder;

  public constructor(private readonly core: LoopscaleCoreClient) {
    this.txBuilder = core.lendTxBuilder;
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

  getStrategyPda(nonce: PublicKey): PublicKey {
    return this.core.getStrategyPda(nonce);
  }

  getStrategyTokenAta(
    strategy: PublicKey,
    mint: PublicKey,
    tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return this.core.getStrategyTokenAta(strategy, mint, tokenProgram);
  }

  async fetchPolicy(): Promise<LoopscaleLendingPolicy | null> {
    return await this.fetchLendingPolicy();
  }

  async fetchLendingPolicy(): Promise<LoopscaleLendingPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      LOOPSCALE_LENDING_PROTOCOL,
      LoopscaleLendingPolicy,
    );
  }

  async setPolicy(
    policy: LoopscaleLendingPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.setLendingPolicy(policy, txOptions);
  }

  async setLendingPolicy(
    policy: LoopscaleLendingPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setLendingPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    return await this.clearLendingPolicy(txOptions);
  }

  async clearLendingPolicy(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearLendingPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async fetchMarketInformation(
    marketInformation: PublicKey,
  ): Promise<LoopscaleMarketInformation> {
    return await this.core.fetchMarketInformation(marketInformation);
  }

  async fetchStrategy(strategy: PublicKey): Promise<LoopscaleStrategy> {
    return await this.core.fetchStrategy(strategy);
  }

  async fetchOwnedStrategy(
    strategy: PublicKey,
    lender: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleStrategy> {
    return await this.core.fetchOwnedStrategy(strategy, lender);
  }

  async fetchRegisteredStrategies(
    commitment?: Commitment,
  ): Promise<LoopscaleStrategy[]> {
    return await this.core.fetchRegisteredStrategies(commitment);
  }

  async fetchStrategyMarket(
    strategy: PublicKey | LoopscaleStrategy,
  ): Promise<LoopscaleMarketInformation> {
    return await this.core.fetchStrategyMarket(strategy);
  }

  async fetchOwnedStrategyWithMarket(
    strategy: PublicKey,
    lender: PublicKey = this.base.vaultPda,
  ): Promise<LoopscaleStrategyWithMarket> {
    return await this.core.fetchOwnedStrategyWithMarket(strategy, lender);
  }

  assertStrategyClosable(strategy: LoopscaleStrategy): void {
    this.core.assertStrategyClosable(strategy);
  }

  async resolveSellLedgerMarketAccounts(params: {
    loan: PublicKey | LoopscaleLoan;
    ledgerIndex: number;
    newStrategy: PublicKey | LoopscaleStrategy;
  }): Promise<LoopscaleSellLedgerTerms> {
    return await this.core.resolveSellLedgerMarketAccounts(params);
  }

  async buildApiSellLedgerIxs(params: {
    loan: PublicKey;
    oldStrategy: PublicKey;
    newStrategy: PublicKey;
    ledgerIndex: number;
    expectedSalePrice: BN;
    assetIndexGuidance: number[];
  }): Promise<TransactionInstruction[]> {
    const sellParams: {
      ledgerIndex: number;
      expectedSalePrice: number;
      assetIndexGuidance?: number[];
    } = {
      ledgerIndex: params.ledgerIndex,
      expectedSalePrice: bnToSafeNumber(
        params.expectedSalePrice,
        "expected sale price",
      ),
    };
    if (params.assetIndexGuidance.length > 0) {
      sellParams.assetIndexGuidance = params.assetIndexGuidance;
    }

    const payload = await this.core.fetchApiTransaction(
      "/markets/creditbook/sell",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          loan: params.loan.toBase58(),
          oldStrategy: params.oldStrategy.toBase58(),
          newStrategy: params.newStrategy.toBase58(),
          sellParams,
        }),
      },
    );
    return await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_SELL_LEDGER_DISCRIMINATOR,
    );
  }

  async buildApiDepositStrategyIxs(params: {
    strategy: PublicKey;
    amount: BN;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/strategy/deposit",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          amount: bnToSafeNumber(params.amount, "deposit amount"),
        }),
      },
    );
    return await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_DEPOSIT_STRATEGY_DISCRIMINATOR,
    );
  }

  async buildApiWithdrawStrategyIxs(params: {
    strategy: PublicKey;
    principalMint?: PublicKey;
    amount: BN;
    withdrawAll: boolean;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/strategy/withdraw",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          amount: bnToSafeNumber(params.amount, "withdraw amount"),
          withdrawAll: params.withdrawAll,
        }),
      },
    );
    const mappedIxs = await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_WITHDRAW_STRATEGY_DISCRIMINATOR,
    );
    const setupIxs = params.principalMint
      ? createVaultWsolAtaSetupIxs({
          mint: params.principalMint,
          payer: this.base.signer,
          vaultPda: this.base.vaultPda,
          vaultAta: this.base.getVaultAta(params.principalMint),
        })
      : [];
    return [...setupIxs, ...mappedIxs];
  }

  async buildApiCloseStrategyIxs(params: {
    strategy: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const payload = await this.core.fetchApiTransaction(
      `/markets/strategy/close/${params.strategy.toBase58()}`,
      {
        headers: {
          "content-type": "application/json",
          payer: this.base.signer.toBase58(),
        },
      },
    );
    return await this.core.mapApiMessagesToGlamIxs(
      getLoopscaleApiMessages(payload),
      LOOPSCALE_CLOSE_STRATEGY_DISCRIMINATOR,
    );
  }

  async buildApiUpdateStrategyTxs(params: {
    strategy: PublicKey;
    collateralTerms?: LoopscaleApiCollateralTermUpdate;
    updateParams?: LoopscaleApiUpdateStrategyParams;
  }): Promise<LoopscaleMappedTransaction[]> {
    const payload = await this.core.fetchApiTransaction(
      "/markets/strategy/update",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          strategy: params.strategy.toBase58(),
          collateralTerms: params.collateralTerms,
          updateParams: params.updateParams,
        }),
      },
    );
    const strategyInfo = await this.fetchStrategy(params.strategy);

    let sawExpectedInstruction = false;
    const txs: LoopscaleMappedTransaction[] = [];
    for (const message of getLoopscaleApiMessages(payload)) {
      const ixs: TransactionInstruction[] = [];
      const additionalSigners: Keypair[] = [];

      for (const ix of await this.core.decompileApiMessage(message)) {
        if (ix.programId.equals(ComputeBudgetProgram.programId)) {
          continue;
        }
        if (!ix.programId.equals(LOOPSCALE_PROGRAM_ID)) {
          throw new Error(
            `Loopscale update strategy API returned unsupported setup instruction for program ${ix.programId.toBase58()}`,
          );
        }
        const isUpdateStrategy = ix.data
          .subarray(0, LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR.length)
          .equals(LOOPSCALE_UPDATE_STRATEGY_DISCRIMINATOR);
        if (!isUpdateStrategy) {
          throw new Error(
            `Loopscale update strategy API returned unsupported Loopscale instruction discriminator ${Buffer.from(ix.data.subarray(0, 8)).toString("hex")}`,
          );
        }
        sawExpectedInstruction = true;
        if (ix.keys.length < LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT) {
          throw new Error(
            "Loopscale update_strategy template has too few accounts",
          );
        }

        const replaced = replaceLoopscaleApiExtraSigners(
          ix,
          LOOPSCALE_UPDATE_STRATEGY_STANDARD_ACCOUNT_COUNT,
        );
        additionalSigners.push(...replaced.additionalSigners);
        ixs.push(
          this.core.addUpdateStrategyValidationMarket(
            this.core.mapApiIx(replaced.ixs[0]),
            strategyInfo.marketInformation,
          ),
        );
      }
      if (ixs.length > 0) {
        txs.push({ ixs, additionalSigners });
      }
    }

    if (!sawExpectedInstruction) {
      throw new Error(
        "Loopscale update strategy API response did not include update_strategy",
      );
    }
    if (txs.length === 0) {
      throw new Error(
        "Loopscale update strategy API response had no mappable instructions",
      );
    }
    return txs;
  }

  async buildApiCreateStrategyTxs(
    params: CreateStrategyParams & {
      amount: BN;
      collateralTerms: LoopscaleMultiCollateralTermsUpdateParams[];
    },
    accounts: {
      marketInformation: PublicKey;
      principalMint: PublicKey;
      nonce: Keypair;
    },
  ): Promise<{
    nonce: Keypair;
    strategy: PublicKey;
    txs: LoopscaleMappedTransaction[];
  }> {
    const { nonce, marketInformation, principalMint } = accounts;
    const strategy = this.getStrategyPda(nonce.publicKey);
    const lender = this.base.vaultPda;
    const payload = await this.core.fetchApiTransaction(
      "/markets/strategy/create",
      {
        headers: {
          "content-type": "application/json",
          "user-wallet": this.base.vaultPda.toBase58(),
          payer: this.base.signer.toBase58(),
        },
        body: JSON.stringify({
          principalMint: principalMint.toBase58(),
          lender: lender.toBase58(),
          amount: bnToSafeNumber(params.amount, "deposit amount"),
          originationsEnabled: params.originationsEnabled,
          liquidityBuffer: bnToSafeNumber(
            params.liquidityBuffer,
            "liquidity buffer",
          ),
          interestFee: bnToSafeNumber(params.interestFee, "interest fee"),
          originationFee: bnToSafeNumber(
            params.originationFee,
            "origination fee",
          ),
          principalFee: bnToSafeNumber(params.principalFee, "principal fee"),
          originationCap: bnToSafeNumber(
            params.originationCap,
            "origination cap",
          ),
          collateralTerms: params.collateralTerms,
          marketInformation: marketInformation.toBase58(),
          externalYieldSourceArgs: params.externalYieldSourceArgs,
        }),
      },
    );

    let apiNonce: PublicKey | null = null;
    let apiStrategy: PublicKey | null = null;
    const txs: LoopscaleMappedTransaction[] = [];
    for (const message of getLoopscaleApiMessages(payload)) {
      const ixs: TransactionInstruction[] = [];
      for (const ix of await this.core.decompileApiMessage(message)) {
        if (ix.programId.equals(ComputeBudgetProgram.programId)) {
          continue;
        }
        if (!ix.programId.equals(LOOPSCALE_PROGRAM_ID)) {
          throw new Error(
            `Loopscale create strategy API returned unsupported setup instruction for program ${ix.programId.toBase58()}`,
          );
        }
        if (
          ix.data
            .subarray(0, LOOPSCALE_CREATE_STRATEGY_DISCRIMINATOR.length)
            .equals(LOOPSCALE_CREATE_STRATEGY_DISCRIMINATOR)
        ) {
          apiNonce = ix.keys[2]?.pubkey ?? null;
          apiStrategy = ix.keys[3]?.pubkey ?? null;
        }
        ixs.push(this.core.mapApiIx(ix));
      }
      if (ixs.length > 0) {
        txs.push({ ixs, additionalSigners: [] });
      }
    }

    if (!apiNonce || !apiStrategy) {
      throw new Error(
        "Loopscale create strategy API response did not include create_strategy",
      );
    }
    if (txs.length === 0) {
      throw new Error(
        "Loopscale create strategy API response had no mappable instructions",
      );
    }

    const patchedTxs = txs.map(({ ixs, additionalSigners }, index) => ({
      ixs: ixs.map((ix) =>
        this.replaceApiCreateStrategyAccounts(
          ix,
          apiNonce,
          nonce.publicKey,
          apiStrategy,
          strategy,
        ),
      ),
      additionalSigners:
        index === 0 ? [nonce, ...additionalSigners] : additionalSigners,
    }));
    return { nonce, strategy, txs: patchedTxs };
  }

  private replaceApiCreateStrategyAccounts(
    ix: TransactionInstruction,
    apiNonce: PublicKey,
    nonce: PublicKey,
    apiStrategy: PublicKey,
    strategy: PublicKey,
  ): TransactionInstruction {
    if (process.env.NODE_ENV === "development") {
      console.log(`Replacing api nonce ${apiNonce} with ${nonce}`);
      console.log(`Replacing api strategy ${apiStrategy} with ${strategy}`);
    }
    return new TransactionInstruction({
      programId: ix.programId,
      data: ix.data,
      keys: ix.keys.map((account) => {
        const pubkey = account.pubkey.equals(apiNonce)
          ? nonce
          : account.pubkey.equals(apiStrategy)
            ? strategy
            : account.pubkey;
        return {
          ...account,
          pubkey,
        };
      }),
    });
  }

  /**
   * Creates a strategy account using local ix builder
   *
   * @param params
   * @param accounts
   * @param txOptions
   * @returns
   */
  async createStrategy(
    params: CreateStrategyParams,
    accounts: {
      marketInformation: PublicKey;
      principalMint: PublicKey;
      nonce?: Keypair;
    },
    txOptions: TxOptions = {},
  ): Promise<CreateStrategyResult> {
    const { marketInformation, principalMint, nonce } = accounts;

    const nonceSigner = nonce ?? Keypair.generate();
    const strategy = this.getStrategyPda(nonceSigner.publicKey);
    const ix = await this.txBuilder.createStrategyIx(
      params,
      {
        nonce: nonceSigner.publicKey,
        strategy,
        marketInformation,
        principalMint,
      },
      txOptions.signer,
    );
    const signature = await this.core.coSignAndSend([ix], txOptions, [
      nonceSigner,
    ]);
    return {
      nonce: nonceSigner.publicKey,
      strategy,
      signature,
      signatures: [signature],
    };
  }

  /**
   * Creates a strategy account and deposits initial principal using API
   *
   * @param params
   * @param accounts
   * @param txOptions
   * @returns
   */
  async createAndDepositStrategy(
    params: CreateStrategyParams & {
      amount: BN;
      collateralTerms: LoopscaleMultiCollateralTermsUpdateParams[];
    },
    accounts: {
      marketInformation: PublicKey;
      principalMint: PublicKey;
      nonce?: Keypair;
    },
    txOptions: TxOptions = {},
  ): Promise<CreateStrategyResult> {
    const { nonce, marketInformation, principalMint } = accounts;
    const nonceSigner = nonce ?? Keypair.generate();

    const { strategy, txs } = await this.buildApiCreateStrategyTxs(params, {
      marketInformation,
      principalMint,
      nonce: nonceSigner,
    });
    const signatures = await this.core.sendCosignedIxBatches(txs, txOptions);
    return {
      nonce: nonceSigner.publicKey,
      strategy,
      signature: signatures[0],
      signatures,
    };
  }

  async depositStrategy(
    amount: BN,
    accounts: DepositStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiDepositStrategyIxs({
      strategy: accounts.strategy,
      amount,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async updateStrategy(
    params: {
      strategy: PublicKey;
      collateralTerms?: LoopscaleApiCollateralTermUpdate;
      updateParams?: LoopscaleApiUpdateStrategyParams;
    },
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature[]> {
    const txs = await this.buildApiUpdateStrategyTxs(params);
    return await this.core.sendCosignedIxBatches(txs, txOptions);
  }

  async withdrawStrategy(
    amount: BN,
    withdrawAll: boolean,
    accounts: WithdrawStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const strategy = await this.fetchOwnedStrategy(accounts.strategy);
    this.core.assertStrategyPrincipalWithdrawable(
      strategy,
      amount,
      withdrawAll,
    );
    const ixs = await this.buildApiWithdrawStrategyIxs({
      strategy: accounts.strategy,
      principalMint: accounts.principalMint,
      amount,
      withdrawAll,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async closeStrategy(
    accounts: CloseStrategyAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiCloseStrategyIxs({
      strategy: accounts.strategy,
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async sellLedger(
    params: SellLedgerParams,
    accounts: SellLedgerAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.buildApiSellLedgerIxs({
      loan: accounts.loan,
      oldStrategy: accounts.oldStrategy,
      newStrategy: accounts.newStrategy,
      ledgerIndex: params.ledgerIndex,
      expectedSalePrice: params.expectedSalePrice,
      assetIndexGuidance: [...params.assetIndexGuidance],
    });
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  // FIXME: why in this module? should be part of price sub-client
  async priceStrategiesIx(
    params: PriceStrategiesParams = {},
  ): Promise<TransactionInstruction | null> {
    const methods = this.base.mintProgram.methods as any;
    if (typeof methods.priceLoopscaleStrategies !== "function") {
      return null;
    }

    const accounts = await this.getPriceStrategiesAccounts(params.commitment);
    if (!accounts) {
      return null;
    }

    const [solUsdOracle, baseAssetOracle] = await Promise.all([
      params.solUsdOracle
        ? Promise.resolve(params.solUsdOracle)
        : accounts.solUsdOracle
          ? Promise.resolve(accounts.solUsdOracle)
          : this.base.getSolOracle(),
      params.baseAssetOracle
        ? Promise.resolve(params.baseAssetOracle)
        : accounts.baseAssetOracle
          ? Promise.resolve(accounts.baseAssetOracle)
          : this.core.getBaseAssetOracle(),
    ]);

    const remainingAccounts = [
      ...accounts.strategyAccounts,
      ...accounts.oracleAccounts,
    ].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    return await methods
      .priceLoopscaleStrategies()
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle,
        baseAssetOracle,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  // FIXME: why in this module? should be part of price sub-client
  async priceStrategies(
    params: PriceStrategiesParams = {},
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature | null> {
    const ix = await this.priceStrategiesIx(params);
    if (!ix) {
      return null;
    }

    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async getPriceStrategiesAccounts(
    commitment?: Commitment,
  ): Promise<PriceStrategiesAccounts | null> {
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

    const strategyAccounts: PublicKey[] = [];
    const oracleMints = new PkSet();
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (!isLoopscaleStrategyAccountInfo(info)) {
        continue;
      }

      strategyAccounts.push(externalPositions[i]);
      const principalMint = readLoopscaleStrategyPrincipalMint(info.data);
      if (!principalMint.equals(PublicKey.default)) {
        oracleMints.add(principalMint);
      }
    }

    if (strategyAccounts.length === 0) {
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
      strategyAccounts,
      oracleAccounts,
    };
  }
}
