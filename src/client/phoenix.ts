import { BN, type IdlTypes } from "@coral-xyz/anchor";
import {
  type AccountMeta,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
  type TransactionSignature,
  type VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  EMBER_PROGRAM_ID,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_LOG_AUTHORITY,
  PHOENIX_PROGRAM_ID,
  PHOENIX_PROTOCOL,
} from "../constants";
import { PhoenixPolicy } from "../deser/integrationPolicies";
import type { ExtPhoenix } from "../glamExports";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import { PhoenixApiClient, PhoenixSnapshot } from "../utils/phoenixApi";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";

export type PhoenixIdlTypes = IdlTypes<ExtPhoenix>;
export type PhoenixBaseLots = PhoenixIdlTypes["baseLots"];
export type PhoenixCancelUpToInstruction =
  PhoenixIdlTypes["cancelUpToInstruction"];
export type PhoenixDepositFundsInstruction =
  PhoenixIdlTypes["depositFundsInstruction"];
export type PhoenixDepositParams = PhoenixIdlTypes["depositParams"];
export type PhoenixOrderFlags = PhoenixIdlTypes["orderFlags"];
export type PhoenixOrderIds = PhoenixIdlTypes["orderIds"];
export type PhoenixOrderPacket = PhoenixIdlTypes["orderPacket"];
export type PhoenixQuoteLots = PhoenixIdlTypes["quoteLots"];
export type PhoenixRegisterTraderParams =
  PhoenixIdlTypes["registerTraderParams"];
export type PhoenixSelfTradeBehavior = PhoenixIdlTypes["selfTradeBehavior"];
export type PhoenixSide = PhoenixIdlTypes["side"];
export type PhoenixTicks = PhoenixIdlTypes["ticks"];
export type PhoenixWithdrawFundsInstruction =
  PhoenixIdlTypes["withdrawFundsInstruction"];
export type PhoenixWithdrawParams = PhoenixIdlTypes["withdrawParams"];
export type PhoenixPolicyInput = PhoenixIdlTypes["phoenixPolicy"];

export type PhoenixTraderIndexes = {
  traderPdaIndex?: number;
  subaccountIndex?: number;
};

export type PhoenixRemainingAccounts = {
  remainingAccounts: AccountMeta[];
};

export type PhoenixRegisterTraderAccounts = {
  traderAccount?: PublicKey;
  logAuthority?: PublicKey;
  globalConfig?: PublicKey;
};

export type PhoenixEmberAccounts = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputTokenAccount?: PublicKey;
  outputTokenAccount?: PublicKey;
  emberState?: PublicKey;
  emberVault?: PublicKey;
  tokenProgram?: PublicKey;
};

function meta(pubkey: PublicKey | string, isWritable: boolean): AccountMeta {
  return { pubkey: new PublicKey(pubkey), isSigner: false, isWritable };
}

export function getPhoenixTraderPda(
  authority: PublicKey,
  traderPdaIndex = 0,
  subaccountIndex = 0,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("trader"),
      authority.toBuffer(),
      Buffer.from([traderPdaIndex, subaccountIndex]),
    ],
    PHOENIX_PROGRAM_ID,
  )[0];
}

export function getPhoenixSplineCollectionPda(market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("spline"), market.toBuffer()],
    PHOENIX_PROGRAM_ID,
  )[0];
}

export function getPhoenixGlobalVaultPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    PHOENIX_PROGRAM_ID,
  )[0];
}

export function getEmberStatePda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PHOENIX_PROGRAM_ID.toBuffer(), Buffer.from("state")],
    EMBER_PROGRAM_ID,
  )[0];
}

export function getEmberVaultPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PHOENIX_PROGRAM_ID.toBuffer(), Buffer.from("vault")],
    EMBER_PROGRAM_ID,
  )[0];
}

class TxBuilder extends BaseTxBuilder<PhoenixClient> {
  getEmberCpiAccounts(accounts: PhoenixEmberAccounts, signer?: PublicKey) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: EMBER_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
      emberState: accounts.emberState || this.client.getEmberStatePda(),
      inputMint: accounts.inputMint,
      outputMint: accounts.outputMint,
      inputTokenAccount:
        accounts.inputTokenAccount ||
        this.client.base.getVaultAta(accounts.inputMint),
      outputTokenAccount:
        accounts.outputTokenAccount ||
        this.client.base.getVaultAta(
          accounts.outputMint,
          accounts.tokenProgram,
        ),
      emberVault: accounts.emberVault || this.client.getEmberVaultPda(),
      tokenProgram: accounts.tokenProgram || TOKEN_PROGRAM_ID,
    };
  }

  /**
   * Account map shared by every ext_phoenix Phoenix-CPI instruction
   * (`glam_state`, `glam_vault`, `glam_signer`, integration authority,
   * `cpi_program=Phoenix`, the GLAM protocol program, system program).
   */
  getPhoenixCpiAccounts(signer?: PublicKey) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: PHOENIX_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
    };
  }

  async setPolicyIx(
    policy: PhoenixPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const policyInput: PhoenixPolicyInput = {
      marketsAllowlist: policy.marketsAllowlist,
      allowedOrderTypes: Buffer.from(policy.allowedOrderTypes),
      maxPriceDeviationBps: policy.maxPriceDeviationBps,
      requireReduceOnlyOrders: policy.requireReduceOnlyOrders,
      maxReferencePriceAgeSecs: policy.maxReferencePriceAgeSecs,
    };

    return await this.client.base.extPhoenixProgram.methods
      .setPhoenixPolicy(policyInput)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
      })
      .instruction();
  }

  async registerTraderIx(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .registerTrader(params)
      .accountsPartial({
        ...this.getPhoenixCpiAccounts(signer),
        logAuthority: accounts.logAuthority || PHOENIX_LOG_AUTHORITY,
        globalConfig: accounts.globalConfig || PHOENIX_GLOBAL_CONFIG,
        traderAccount:
          accounts.traderAccount ||
          this.client.getTraderPda(
            params.traderPdaIndex,
            params.traderSubaccountIndex,
          ),
      })
      .instruction();
  }

  async updateTraderStateIx(
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .updateTraderState()
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async emberDepositIx(
    params: PhoenixDepositParams,
    accounts: PhoenixEmberAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .deposit(params)
      .accounts(this.getEmberCpiAccounts(accounts, signer))
      .instruction();
  }

  async depositFundsIx(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .depositFunds(params)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async emberWithdrawIx(
    params: PhoenixWithdrawParams,
    accounts: PhoenixEmberAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .withdraw(params)
      .accounts(this.getEmberCpiAccounts(accounts, signer))
      .instruction();
  }

  async withdrawFundsIx(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .withdrawFunds(params)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async placeLimitOrderIx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .placeLimitOrder(packet)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async placeMarketOrderIx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .placeMarketOrder(packet)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async placePostOnlyOrderIx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .placePostOnlyOrder(packet)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelAllIx(
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelAll()
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelOrdersByIdIx(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelOrdersById(orderIds)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async cancelUpToIx(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extPhoenixProgram.methods
      .cancelUpTo(args)
      .accounts(this.getPhoenixCpiAccounts(signer))
      .remainingAccounts(accounts.remainingAccounts)
      .instruction();
  }

  async setPolicyTx(
    policy: PhoenixPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async registerTraderTx(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.registerTraderIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async updateTraderStateTx(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateTraderStateIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  /**
   * Remaining-accounts list for `deposit_funds` — the vault token account
   * holding the canonical collateral, the trader PDA, Phoenix's global vault
   * for that mint, the SPL token program, and the trader-index/active-buffer
   * chunks from the snapshot.
   */
  getDepositRemainingAccounts(
    snapshot: PhoenixSnapshot,
    indexes: PhoenixTraderIndexes = {},
  ): AccountMeta[] {
    const mint = new PublicKey(snapshot.exchange.canonicalMint);
    const vaultAta = this.client.base.getVaultAta(mint);

    return [
      ...this.client.getPhoenixRemainingPrefix(true),
      meta(this.client.base.vaultPda, true),
      meta(vaultAta, true),
      meta(
        this.client.getTraderPda(
          indexes.traderPdaIndex,
          indexes.subaccountIndex,
        ),
        true,
      ),
      meta(this.client.getGlobalVaultPda(mint), true),
      meta(TOKEN_PROGRAM_ID, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
    ];
  }

  /**
   * Remaining-accounts list for `withdraw_funds`. Same shape as the deposit
   * variant plus the perp asset map and the global withdraw queue, which the
   * withdraw path mutates.
   */
  getWithdrawRemainingAccounts(
    snapshot: PhoenixSnapshot,
    indexes: PhoenixTraderIndexes = {},
  ): AccountMeta[] {
    const mint = new PublicKey(snapshot.exchange.canonicalMint);
    const vaultAta = this.client.base.getVaultAta(mint);

    return [
      ...this.client.getPhoenixRemainingPrefix(true),
      meta(this.client.base.vaultPda, true),
      meta(
        this.client.getTraderPda(
          indexes.traderPdaIndex,
          indexes.subaccountIndex,
        ),
        true,
      ),
      meta(snapshot.exchange.perpAssetMap, true),
      meta(this.client.getGlobalVaultPda(mint), true),
      meta(vaultAta, true),
      meta(TOKEN_PROGRAM_ID, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
      meta(snapshot.exchange.withdrawQueue, true),
    ];
  }

  async deposit(amount: BN, txOptions: TxOptions = {}) {
    const snapshot = await this.client.phoenixApi.fetchPhoenixSnapshot();

    const usdcMint = new PublicKey(snapshot.exchange.usdcMint);
    const canonicalMint = new PublicKey(snapshot.exchange.canonicalMint);

    const ixs = [
      // create canonical token ata
      createAssociatedTokenAccountIdempotentInstruction(
        txOptions.signer || this.client.base.signer,
        this.client.base.getVaultAta(canonicalMint),
        this.client.base.vaultPda,
        canonicalMint,
      ),
      await this.emberDepositIx(
        { amount },
        { inputMint: usdcMint, outputMint: canonicalMint },
        txOptions.signer,
      ),
      await this.depositFundsIx(
        { amount },
        { remainingAccounts: this.getDepositRemainingAccounts(snapshot) },
        txOptions.signer,
      ),
    ];
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async withdraw(amount: BN, txOptions: TxOptions = {}) {
    const snapshot = await this.client.phoenixApi.fetchPhoenixSnapshot();

    const usdcMint = new PublicKey(snapshot.exchange.usdcMint);
    const canonicalMint = new PublicKey(snapshot.exchange.canonicalMint);

    const ixs = [
      // create USDC ata
      createAssociatedTokenAccountIdempotentInstruction(
        txOptions.signer || this.client.base.signer,
        this.client.base.getVaultAta(usdcMint),
        this.client.base.vaultPda,
        usdcMint,
      ),
      await this.withdrawFundsIx(
        { amount },
        { remainingAccounts: this.getWithdrawRemainingAccounts(snapshot) },
        txOptions.signer,
      ),
      await this.emberWithdrawIx(
        { amount },
        { inputMint: usdcMint, outputMint: canonicalMint },
        txOptions.signer,
      ),
    ];
    return await this.buildVersionedTx(ixs, txOptions);
  }

  async depositFundsTx(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.depositFundsIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async withdrawFundsTx(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.withdrawFundsIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async placeLimitOrderTx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.placeLimitOrderIx(packet, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async placeMarketOrderTx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.placeMarketOrderIx(
      packet,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async placePostOnlyOrderTx(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.placePostOnlyOrderIx(
      packet,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelAllTx(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelAllIx(accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelOrdersByIdTx(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelOrdersByIdIx(
      orderIds,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async cancelUpToTx(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.cancelUpToIx(args, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class PhoenixClient {
  readonly txBuilder: TxBuilder;
  readonly phoenixApi: PhoenixApiClient;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
    this.phoenixApi = new PhoenixApiClient();
  }

  /** The ext_phoenix program id this client talks to. */
  get programId(): PublicKey {
    return this.base.extPhoenixProgram.programId;
  }

  /** Bit flag identifying Phoenix inside the GLAM integration ACL bitmask. */
  get protocolBitflag(): number {
    return PHOENIX_PROTOCOL;
  }

  /** PDA the ext_phoenix program signs CPIs with into Phoenix and Ember. */
  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extPhoenixProgram.programId);
  }

  /**
   * PDA of a Phoenix trader account owned by the GLAM vault (defaults to the
   * vault PDA as authority). `traderPdaIndex` selects the parent trader and
   * `subaccountIndex` selects a child subaccount under that parent.
   */
  getTraderPda(
    traderPdaIndex = 0,
    subaccountIndex = 0,
    authority: PublicKey = this.base.vaultPda,
  ): PublicKey {
    return getPhoenixTraderPda(authority, traderPdaIndex, subaccountIndex);
  }

  /** PDA of the spline-collection account associated with a Phoenix market. */
  getSplineCollectionPda(market: PublicKey): PublicKey {
    return getPhoenixSplineCollectionPda(market);
  }

  /** PDA of Phoenix's global-vault token account for a given mint. */
  getGlobalVaultPda(mint: PublicKey): PublicKey {
    return getPhoenixGlobalVaultPda(mint);
  }

  /** PDA of the Ember exchange-state account that backs Phoenix conversions. */
  getEmberStatePda(): PublicKey {
    return getEmberStatePda();
  }

  /** PDA of Ember's USDC vault that mints/burns canonical collateral. */
  getEmberVaultPda(): PublicKey {
    return getEmberVaultPda();
  }

  /**
   * The three accounts every Phoenix CPI begins with (program, log authority,
   * global config). `globalConfigWritable` toggles the writable flag on the
   * global config — set true for instructions that mutate exchange state.
   */
  getPhoenixRemainingPrefix(globalConfigWritable: boolean): AccountMeta[] {
    return [
      meta(PHOENIX_PROGRAM_ID, false),
      meta(PHOENIX_LOG_AUTHORITY, false),
      meta(PHOENIX_GLOBAL_CONFIG, globalConfigWritable),
    ];
  }

  /**
   * Remaining-accounts list for place/cancel/order-book CPIs against a single
   * Phoenix market. Includes the trader PDA, perp asset map, trader indices,
   * the market itself, and its spline collection.
   */
  getMarketRemainingAccounts(
    snapshot: PhoenixSnapshot,
    market: PublicKey | string,
    indexes: PhoenixTraderIndexes = {},
  ): AccountMeta[] {
    const marketPubkey = new PublicKey(market);
    return [
      ...this.getPhoenixRemainingPrefix(true),
      meta(this.base.vaultPda, true),
      meta(
        this.getTraderPda(indexes.traderPdaIndex, indexes.subaccountIndex),
        true,
      ),
      meta(snapshot.exchange.perpAssetMap, true),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
      meta(marketPubkey, true),
      meta(this.getSplineCollectionPda(marketPubkey), true),
    ];
  }

  /**
   * Remaining-accounts list for `update_trader_state` — settles funding for
   * the trader and may evict it from the active-trader buffer once it no
   * longer holds resting orders.
   */
  getUpdateTraderStateRemainingAccounts(
    snapshot: PhoenixSnapshot,
    indexes: PhoenixTraderIndexes = {},
  ): AccountMeta[] {
    return [
      ...this.getPhoenixRemainingPrefix(false),
      meta(
        this.getTraderPda(indexes.traderPdaIndex, indexes.subaccountIndex),
        true,
      ),
      meta(snapshot.exchange.perpAssetMap, false),
      ...snapshot.exchange.globalTraderIndex.map((key) => meta(key, true)),
      ...snapshot.exchange.activeTraderBuffer.map((key) => meta(key, true)),
    ];
  }

  /** Fetches the on-chain PhoenixPolicy stored under this vault, if any. */
  async fetchPolicy(): Promise<PhoenixPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      PHOENIX_PROTOCOL,
      PhoenixPolicy,
    );
  }

  /** Writes the PhoenixPolicy (market allowlist, order types, etc.). */
  async setPolicy(
    policy: PhoenixPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Creates a Phoenix trader account for the vault (parent or child subaccount)
   * sized to hold `maxPositions`.
   */
  async registerTrader(
    params: PhoenixRegisterTraderParams,
    accounts: PhoenixRegisterTraderAccounts = {},
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.registerTraderTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Settles funding for the vault's trader and may evict it from the active
   * buffer when no resting orders remain. Idempotent housekeeping call.
   */
  async updateTraderState(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.updateTraderStateTx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Full deposit flow in one transaction: converts USDC to canonical
   * collateral via Ember, then deposits the canonical amount into the vault's
   * Phoenix trader account.
   */
  async deposit(amount: BN | number, txOptions: TxOptions = {}) {
    const tx = await this.txBuilder.deposit(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Full withdraw flow in one transaction: withdraws canonical collateral
   * from Phoenix and converts it back to USDC via Ember.
   */
  async withdraw(amount: BN | number, txOptions: TxOptions = {}) {
    const tx = await this.txBuilder.withdraw(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Phoenix-only `deposit_funds` (no Ember leg) — moves an already-canonical
   * token balance from the vault's token account into Phoenix.
   */
  async depositFunds(
    params: PhoenixDepositFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositFundsTx(params, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Phoenix-only `withdraw_funds` (no Ember leg) — pulls canonical collateral
   * out of Phoenix back to the vault's token account.
   */
  async withdrawFunds(
    params: PhoenixWithdrawFundsInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawFundsTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Places a Phoenix limit order against the market in `accounts`. */
  async placeLimitOrder(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.placeLimitOrderTx(
      packet,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Places an immediate-or-cancel market order against the market. */
  async placeMarketOrder(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.placeMarketOrderTx(
      packet,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Places a post-only (maker-only) order; rejected if it would cross. */
  async placePostOnlyOrder(
    packet: PhoenixOrderPacket,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.placePostOnlyOrderTx(
      packet,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /** Cancels all resting orders the vault has on the given market. */
  async cancelAll(
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelAllTx(accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /** Cancels the specific resting orders identified by `orderIds`. */
  async cancelOrdersById(
    orderIds: PhoenixOrderIds,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelOrdersByIdTx(
      orderIds,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Cancels up to `num_orders_to_cancel` resting orders on a side, optionally
   * bounded by a price tick limit.
   */
  async cancelUpTo(
    args: PhoenixCancelUpToInstruction,
    accounts: PhoenixRemainingAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelUpToTx(args, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
