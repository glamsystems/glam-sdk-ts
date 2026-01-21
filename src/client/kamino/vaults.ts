import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  AccountMeta,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Commitment,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "../base";
import { fetchMintAndTokenProgram, getProgramAccounts } from "../../utils";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  KAMINO_LENDING_PROGRAM,
  KAMINO_VAULT_STATE_SIZE,
  KAMINO_VAULTS_PROGRAM,
} from "../../constants";
import { KVaultAllocation, KVaultState } from "../../deser/kaminoLayouts";
import { PkMap } from "../../utils";
import { KaminoLendingClient } from "./lending";
import { KAMINO_VAULTS_EVENT_AUTHORITY } from "./types";

class TxBuilder extends BaseTxBuilder<KaminoVaultsClient> {
  public async depositTx(
    vault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const vaultState = await this.client.fetchAndParseVaultState(vault);
    const { tokenProgram: sharesTokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.provider.connection,
      vaultState.sharesMint,
    );

    const userTokenAta = this.client.base.getVaultAta(
      vaultState.tokenMint,
      vaultState.tokenProgram,
    );
    const userSharesAta = this.client.base.getVaultAta(
      vaultState.sharesMint,
      sharesTokenProgram,
    );

    // Create user shares ata
    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        userSharesAta,
        this.client.base.vaultPda,
        vaultState.sharesMint,
        sharesTokenProgram,
      ),
    ];

    // Remaining accounts, skip empty allocation strategies
    const remainingAccounts = await this.client.composeRemainingAccounts(
      vaultState.validAllocations,
    );

    const tx = await this.client.base.extKaminoProgram.methods
      .vaultsDeposit(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        vaultState: vault,
        tokenVault: vaultState.tokenVault,
        tokenMint: vaultState.tokenMint,
        baseVaultAuthority: vaultState.baseVaultAuthority,
        sharesMint: vaultState.sharesMint,
        userTokenAta,
        userSharesAta,
        klendProgram: KAMINO_LENDING_PROGRAM,
        tokenProgram: vaultState.tokenProgram,
        sharesTokenProgram,
        eventAuthority: KAMINO_VAULTS_EVENT_AUTHORITY,
        program: KAMINO_VAULTS_PROGRAM,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async withdrawTx(
    vault: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;

    const vaultState = await this.client.fetchAndParseVaultState(vault);
    const userTokenAta = this.client.base.getVaultAta(
      vaultState.tokenMint,
      vaultState.tokenProgram,
    );
    const { tokenProgram: sharesTokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.provider.connection,
      vaultState.sharesMint,
    );
    const userSharesAta = this.client.base.getVaultAta(
      vaultState.sharesMint,
      sharesTokenProgram,
    );

    const reserves = vaultState.vaultAllocationStrategy.filter(
      ({ reserve }) => !reserve.equals(PublicKey.default),
    );
    // Withdraw from the first reserve when kvault does not have enough liquidity
    const idx = 0;
    const withdrawReserve = (
      await this.client.kaminoLending.fetchAndParseReserves(
        reserves.map((r) => r.reserve),
      )
    )[idx];
    const vaultCollateralTokenVault =
      vaultState.vaultAllocationStrategy[idx].ctokenVault;

    const remainingAccounts =
      await this.client.composeRemainingAccounts(reserves);
    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        userTokenAta,
        this.client.base.vaultPda,
        vaultState.tokenMint,
        vaultState.tokenProgram,
      ),
    ];

    const tx = await this.client.base.extKaminoProgram.methods
      .vaultsWithdraw(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        withdrawFromAvailableVaultState: vault,
        withdrawFromAvailableGlobalConfig: this.client.globalConfigPda,
        withdrawFromAvailableTokenVault: vaultState.tokenVault,
        withdrawFromAvailableBaseVaultAuthority: vaultState.baseVaultAuthority,
        withdrawFromAvailableUserTokenAta: userTokenAta,
        withdrawFromAvailableTokenMint: vaultState.tokenMint,
        withdrawFromAvailableUserSharesAta: userSharesAta,
        withdrawFromAvailableSharesMint: vaultState.sharesMint,
        withdrawFromAvailableTokenProgram: vaultState.tokenProgram,
        withdrawFromAvailableSharesTokenProgram: sharesTokenProgram,
        withdrawFromAvailableKlendProgram: KAMINO_LENDING_PROGRAM,
        withdrawFromAvailableEventAuthority: KAMINO_VAULTS_EVENT_AUTHORITY,
        withdrawFromAvailableProgram: KAMINO_VAULTS_PROGRAM,
        withdrawFromReserveVaultState: vault,
        withdrawFromReserveReserve: withdrawReserve.getAddress(),
        withdrawFromReserveCtokenVault: vaultCollateralTokenVault,
        withdrawFromReserveLendingMarket: withdrawReserve.lendingMarket,
        withdrawFromReserveLendingMarketAuthority:
          this.client.kaminoLending.getMarketAuthority(
            withdrawReserve.lendingMarket,
          ),
        withdrawFromReserveReserveLiquiditySupply:
          withdrawReserve.liquidity.supplyVault,
        withdrawFromReserveReserveCollateralMint:
          withdrawReserve.collateral.mintPubkey,
        withdrawFromReserveReserveCollateralTokenProgram: TOKEN_PROGRAM_ID,
        withdrawFromReserveInstructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        eventAuthority: KAMINO_VAULTS_EVENT_AUTHORITY,
        program: KAMINO_VAULTS_PROGRAM,
      })
      .remainingAccounts(remainingAccounts)
      .preInstructions(preInstructions)
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }
}

export class KaminoVaultsClient {
  private vaultStates = new PkMap<KVaultState>();
  private shareMintToVaultPdaMap = new PkMap<PublicKey>();
  txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly kaminoLending: KaminoLendingClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Deposit to a Kamino vault
   */
  public async deposit(
    vault: PublicKey,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositTx(vault, new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Withdraw from a Kamino vault
   */
  public async withdraw(
    vault: PublicKey,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawTx(
      vault,
      new BN(amount),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async findAndParseKaminoVaults(
    commitment?: Commitment,
  ): Promise<KVaultState[]> {
    // Find state accounts of all kamino vaults
    const accounts = await getProgramAccounts(
      this.base.connection,
      KAMINO_VAULTS_PROGRAM,
      {
        commitment,
        filters: [
          { dataSize: KAMINO_VAULT_STATE_SIZE },
          { memcmp: { offset: 0, bytes: "5MRSpWLS65g=", encoding: "base64" } },
        ],
      },
    );
    if (accounts.length === 0) {
      throw new Error("Kamino vaults not found");
    }
    // Parse and cache vault states
    return accounts.map((a) => {
      const vaultState = KVaultState.decode(
        a.pubkey,
        a.account.data,
      ) as KVaultState;

      this.vaultStates.set(a.pubkey, vaultState);
      this.shareMintToVaultPdaMap.set(vaultState.sharesMint, a.pubkey);

      return vaultState;
    });
  }

  get globalConfigPda() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      KAMINO_VAULTS_PROGRAM,
    )[0];
  }

  // Given a list of token mints (may or may not be kvault share), return
  // matched kvault addresses
  async getVaultPdasByShareMints(mints: PublicKey[]): Promise<PublicKey[]> {
    if (this.vaultStates.size === 0) {
      await this.findAndParseKaminoVaults();
    }

    return mints
      .map((mint) => this.shareMintToVaultPdaMap.get(mint))
      .filter((p) => !!p);
  }

  async fetchAndParseVaultState(vault: PublicKey) {
    const vaultAccount =
      await this.base.connection.getAccountInfo(vault);
    if (!vaultAccount) {
      throw new Error(`Kamino vault account not found:, ${vault}`);
    }
    const vaultState = KVaultState.decode(vault, vaultAccount.data);
    this.vaultStates.set(vault, vaultState);
    this.shareMintToVaultPdaMap.set(vaultState.sharesMint, vault);
    return vaultState as KVaultState;
  }

  public async composeRemainingAccounts(
    allocations: KVaultAllocation[],
    pricingMode: boolean = false,
  ): Promise<AccountMeta[]> {
    const reserves = allocations.map((strategy) => strategy.reserve);
    const parsedReserves =
      await this.kaminoLending.fetchAndParseReserves(reserves);

    const reserveMetas = reserves.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    }));
    const marketMetas = parsedReserves.map(({ lendingMarket }) => ({
      pubkey: lendingMarket,
      isSigner: false,
      isWritable: false,
    }));

    if (pricingMode) {
      // (market, reserve) must be paired
      return marketMetas.reduce((acc: AccountMeta[], marketMeta, i) => {
        acc.push(marketMeta, reserveMetas[i]);
        return acc;
      }, []);
    }
    return [...reserveMetas, ...marketMetas]; // Non pricing mode
  }
}
