import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  AccountMeta,
  Commitment,
} from "@solana/web3.js";
import {
  DriftUser,
  DriftVault,
  PerpPosition,
  SpotPosition,
} from "../../deser/driftLayouts";

import { BaseClient, BaseTxBuilder, TxOptions } from "../base";
import {
  DRIFT_PROGRAM_ID,
  DRIFT_VAULT_DEPOSITOR_SIZE,
  DRIFT_VAULTS_PROGRAM_ID,
} from "../../constants";
import { BN } from "@coral-xyz/anchor";
import { DRIFT_SIGNER, DriftProtocolClient } from "./protocol-v2";

class TxBuilder extends BaseTxBuilder<DriftVaultsClient> {
  public async initializeVaultDepositorTx(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const vaultDepositor = this.client.getDepositorPda(driftVault);

    const tx = await this.client.base.extDriftProgram.methods
      .vaultsInitializeVaultDepositor()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vault: driftVault,
        vaultDepositor,
      })
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async depositTx(
    driftVault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const {
      user: driftUser,
      tokenAccount: vaultTokenAccount,
      userStats: driftUserStats,
      spotMarketIndex,
      vaultProtocol,
    } = await this.client.parseDriftVault(driftVault);
    if (vaultProtocol) {
      throw new Error("Drift Vault with an external protocol is not supported");
    }

    const preInstructions = [];

    const vaultDepositor = this.client.getDepositorPda(driftVault);
    if (
      !(await this.client.base.provider.connection.getAccountInfo(
        vaultDepositor,
      ))
    ) {
      preInstructions.push(
        await this.client.base.extDriftProgram.methods
          .vaultsInitializeVaultDepositor()
          .accounts({
            glamState: this.client.base.statePda,
            glamSigner,
            vault: driftVault,
            vaultDepositor,
          })
          .instruction(),
      );
    }

    const {
      vault: driftSpotMarketVault,
      mint,
      tokenProgramId: tokenProgram,
    } = await this.client.drift.fetchAndParseSpotMarket(spotMarketIndex);

    const remainingAccounts =
      await this.client.composeRemainingAccounts(driftUser);

    const userTokenAccount = this.client.base.getVaultAta(mint, tokenProgram);

    const tx = await this.client.base.extDriftProgram.methods
      .vaultsDeposit(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vault: driftVault,
        vaultDepositor,
        vaultTokenAccount,
        driftUserStats,
        driftUser,
        driftState: this.client.drift.driftStatePda,
        driftSpotMarketVault,
        userTokenAccount,
        tokenProgram,
        driftProgram: DRIFT_PROGRAM_ID,
      })
      .preInstructions(preInstructions)
      .remainingAccounts(remainingAccounts)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async requestWithdrawTx(
    driftVault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const vaultDepositor = this.client.getDepositorPda(driftVault);

    const { user: driftUser, userStats: driftUserStats } =
      await this.client.parseDriftVault(driftVault);

    const remainingAccounts =
      await this.client.composeRemainingAccounts(driftUser);

    const tx = await this.client.base.extDriftProgram.methods
      .vaultsRequestWithdraw(amount, { shares: {} })
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vault: driftVault,
        vaultDepositor,
        driftUserStats,
        driftUser,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async cancelWithdrawRequestTx(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const vaultDepositor = this.client.getDepositorPda(driftVault);

    const { user: driftUser, userStats: driftUserStats } =
      await this.client.parseDriftVault(driftVault);

    const remainingAccounts =
      await this.client.composeRemainingAccounts(driftUser);

    const tx = await this.client.base.extDriftProgram.methods
      .vaultsCancelRequestWithdraw()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vault: driftVault,
        vaultDepositor,
        driftUserStats,
        driftUser,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async withdrawTx(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const vaultDepositor = this.client.getDepositorPda(driftVault);

    const {
      user: driftUser,
      userStats: driftUserStats,
      tokenAccount: vaultTokenAccount,
      spotMarketIndex,
    } = await this.client.parseDriftVault(driftVault);
    const {
      vault: driftSpotMarketVault,
      mint,
      tokenProgramId: tokenProgram,
    } = await this.client.drift.fetchAndParseSpotMarket(spotMarketIndex);
    const userTokenAccount = this.client.base.getVaultAta(mint, tokenProgram);

    const remainingAccounts =
      await this.client.composeRemainingAccounts(driftUser);

    const tx = await this.client.base.extDriftProgram.methods
      .vaultsWithdraw()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vault: driftVault,
        vaultDepositor,
        vaultTokenAccount,
        driftUserStats,
        driftUser,
        driftSpotMarketVault,
        driftSigner: DRIFT_SIGNER,
        userTokenAccount,
        driftState: this.client.drift.driftStatePda,
        driftProgram: DRIFT_PROGRAM_ID,
        tokenProgram,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }
}

export class DriftVaultsClient {
  txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly drift: DriftProtocolClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  async fetchUserPositions(user: PublicKey): Promise<{
    perpPositions: PerpPosition[];
    spotPositions: SpotPosition[];
  }> {
    const accountInfo = await this.base.connection.getAccountInfo(user);
    if (!accountInfo) {
      throw new Error(`Drift user account ${user} not found for vault.`);
    }
    const { spotPositions, perpPositions } = DriftUser.decode(
      user,
      accountInfo.data,
    );
    return { perpPositions, spotPositions };
  }

  getDepositorPda(driftVault: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault_depositor"),
        driftVault.toBuffer(),
        this.base.vaultPda.toBuffer(),
      ],
      DRIFT_VAULTS_PROGRAM_ID,
    )[0];
  }

  async parseDriftVaults(driftVaults: PublicKey[]) {
    const connection = this.base.provider.connection;
    const accountsInfo = await connection.getMultipleAccountsInfo(driftVaults);

    const validAccountsInfo = accountsInfo.map((accountInfo, i) => {
      if (!accountInfo) {
        throw new Error(`Drift vault account not found: ${driftVaults[i]}`);
      }
      return accountInfo;
    });

    return validAccountsInfo.map((accountInfo, i) => {
      return DriftVault.decode(driftVaults[i], accountInfo.data);
    });
  }

  async parseDriftVault(driftVault: PublicKey) {
    return (await this.parseDriftVaults([driftVault]))[0];
  }

  async composeRemainingAccounts(user: PublicKey): Promise<AccountMeta[]> {
    const { spotPositions, perpPositions } =
      await this.fetchUserPositions(user);
    const spotMarketIndexes = spotPositions.map((p) => p.marketIndex);
    const perpMarketIndexes = perpPositions.map((p) => p.marketIndex);

    if (perpMarketIndexes.length > 0 && !spotMarketIndexes.includes(0)) {
      spotMarketIndexes.push(0);
    }

    const spotMarkets =
      await this.drift.fetchAndParseSpotMarkets(spotMarketIndexes);
    const perpMarkets =
      await this.drift.fetchAndParsePerpMarkets(perpMarketIndexes);

    const oracles = spotMarkets
      .map((m) => m.oracle)
      .concat(perpMarkets.map((m) => m.oracle));
    const markets = spotMarkets
      .map((m) => m.marketPda)
      .concat(perpMarkets.map((m) => m.marketPda));

    return oracles
      .map((o) => ({
        pubkey: new PublicKey(o),
        isWritable: false,
        isSigner: false,
      }))
      .concat(
        markets.map((m) => ({
          pubkey: new PublicKey(m),
          isWritable: true,
          isSigner: false,
        })),
      );
  }

  parseDepositor(depositor: PublicKey, data: Buffer) {
    const driftVault = new PublicKey(data.subarray(8, 40));
    const shares = new BN(data.subarray(104, 112), "le");
    return { address: depositor, driftVault, shares };
  }

  /**
   * Finds all drift vault depositors
   */
  public async findAndParseVaultDepositors(commitment?: Commitment) {
    const accounts = await this.base.connection.getProgramAccounts(
      DRIFT_VAULTS_PROGRAM_ID,
      {
        commitment,
        filters: [
          { dataSize: DRIFT_VAULT_DEPOSITOR_SIZE },
          {
            memcmp: {
              offset: 72,
              bytes: this.base.vaultPda.toBase58(),
            },
          },
        ],
      },
    );
    return accounts.map((a) => this.parseDepositor(a.pubkey, a.account.data));
  }

  /**
   * Initialize a vault depositor
   */
  public async initializeVaultDepositor(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.initializeVaultDepositorTx(
      driftVault,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Deposit to a drift vault
   */
  public async deposit(
    driftVault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositTx(driftVault, amount, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Request withdrawal from a drift vault
   */
  public async requestWithdraw(
    driftVault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.requestWithdrawTx(
      driftVault,
      amount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Cancel a withdrawal request
   */
  public async cancelWithdrawRequest(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.cancelWithdrawRequestTx(
      driftVault,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Withdraw from a drift vault
   */
  public async withdraw(
    driftVault: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawTx(driftVault, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
