import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

import {
  BaseClient,
  BaseTxBuilder,
  type ProtocolPolicyClient,
  type ProtocolPolicyTxBuilder,
  type TxOptions,
} from "../base";
import {
  JUPITER_LENDING_PROGRAM_ID,
  JUPITER_LIQUIDITY_PROGRAM_ID,
} from "../../constants";
import { JupiterEarnPolicy } from "../../deser/integrationPolicies";
import { getIntegrationAuthorityPda } from "../../utils/glamPDAs";
import { toBn } from "../../utils/common";
import {
  LENDING_DISCRIMINATOR,
  LENDING_REWARDS_RATE_MODEL_OFFSET,
  LENDING_SUPPLY_POSITION_OFFSET,
  LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET,
  JUPITER_EARN_PROTOCOL,
  PUBKEY_BYTES,
  U64_MAX,
  fetchAndValidate,
  fetchReserveVault,
  getClaimAccountPda,
  getFTokenMintPda,
  getLendingAdminPda,
  getLendingPda,
  getLiquidityPda,
  getRateModelPda,
} from "./shared";

export type JupiterEarnDepositAccounts = {
  depositorTokenAccount?: PublicKey;
  recipientTokenAccount?: PublicKey;
  mint: PublicKey;
  lendingAdmin: PublicKey;
  lending: PublicKey;
  fTokenMint: PublicKey;
  supplyTokenReservesLiquidity: PublicKey;
  lendingSupplyPositionOnLiquidity: PublicKey;
  rateModel: PublicKey;
  vault: PublicKey;
  liquidity: PublicKey;
  liquidityProgram?: PublicKey;
  rewardsRateModel: PublicKey;
  tokenProgram?: PublicKey;
  fTokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

export type JupiterEarnWithdrawAccounts = {
  ownerTokenAccount?: PublicKey;
  recipientTokenAccount?: PublicKey;
  lendingAdmin: PublicKey;
  lending: PublicKey;
  mint: PublicKey;
  fTokenMint: PublicKey;
  supplyTokenReservesLiquidity: PublicKey;
  lendingSupplyPositionOnLiquidity: PublicKey;
  rateModel: PublicKey;
  vault: PublicKey;
  claimAccount: PublicKey;
  liquidity: PublicKey;
  liquidityProgram?: PublicKey;
  rewardsRateModel: PublicKey;
  tokenProgram?: PublicKey;
  fTokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
};

class TxBuilder
  extends BaseTxBuilder<JupiterEarnClient>
  implements ProtocolPolicyTxBuilder<JupiterEarnPolicy>
{
  async depositIx(
    amount: BN | bigint | number,
    minAmountOut: BN | bigint | number,
    accounts: JupiterEarnDepositAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const fTokenProgram = accounts.fTokenProgram || tokenProgram;

    return await this.client.base.extJupiterProgram.methods
      .earnDeposit(toBn(amount), toBn(minAmountOut))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: JUPITER_LENDING_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        depositorTokenAccount:
          accounts.depositorTokenAccount ||
          this.client.base.getVaultAta(accounts.mint, tokenProgram),
        recipientTokenAccount:
          accounts.recipientTokenAccount ||
          this.client.base.getVaultAta(accounts.fTokenMint, fTokenProgram),
        mint: accounts.mint,
        lendingAdmin: accounts.lendingAdmin,
        lending: accounts.lending,
        fTokenMint: accounts.fTokenMint,
        supplyTokenReservesLiquidity: accounts.supplyTokenReservesLiquidity,
        lendingSupplyPositionOnLiquidity:
          accounts.lendingSupplyPositionOnLiquidity,
        rateModel: accounts.rateModel,
        vault: accounts.vault,
        liquidity: accounts.liquidity,
        liquidityProgram:
          accounts.liquidityProgram || JUPITER_LIQUIDITY_PROGRAM_ID,
        rewardsRateModel: accounts.rewardsRateModel,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async depositTx(
    amount: BN | bigint | number,
    minAmountOut: BN | bigint | number,
    accounts: JupiterEarnDepositAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const fTokenProgram = accounts.fTokenProgram || tokenProgram;
    const recipientAta =
      accounts.recipientTokenAccount ||
      this.client.base.getVaultAta(accounts.fTokenMint, fTokenProgram);
    const createRecipientAtaIx =
      createAssociatedTokenAccountIdempotentInstruction(
        signer,
        recipientAta,
        this.client.base.vaultPda,
        accounts.fTokenMint,
        fTokenProgram,
      );
    const ix = await this.depositIx(amount, minAmountOut, accounts, signer);
    return await this.buildVersionedTx([createRecipientAtaIx, ix], txOptions);
  }

  async withdrawIx(
    amount: BN | bigint | number,
    maxSharesBurn: BN | bigint | number,
    accounts: JupiterEarnWithdrawAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const fTokenProgram = accounts.fTokenProgram || tokenProgram;

    return await this.client.base.extJupiterProgram.methods
      .earnWithdraw(toBn(amount), toBn(maxSharesBurn))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: JUPITER_LENDING_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        ownerTokenAccount:
          accounts.ownerTokenAccount ||
          this.client.base.getVaultAta(accounts.fTokenMint, fTokenProgram),
        recipientTokenAccount:
          accounts.recipientTokenAccount ||
          this.client.base.getVaultAta(accounts.mint, tokenProgram),
        lendingAdmin: accounts.lendingAdmin,
        lending: accounts.lending,
        mint: accounts.mint,
        fTokenMint: accounts.fTokenMint,
        supplyTokenReservesLiquidity: accounts.supplyTokenReservesLiquidity,
        lendingSupplyPositionOnLiquidity:
          accounts.lendingSupplyPositionOnLiquidity,
        rateModel: accounts.rateModel,
        vault: accounts.vault,
        claimAccount: accounts.claimAccount,
        liquidity: accounts.liquidity,
        liquidityProgram:
          accounts.liquidityProgram || JUPITER_LIQUIDITY_PROGRAM_ID,
        rewardsRateModel: accounts.rewardsRateModel,
        tokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async withdrawTx(
    amount: BN | bigint | number,
    maxSharesBurn: BN | bigint | number,
    accounts: JupiterEarnWithdrawAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const tokenProgram = accounts.tokenProgram || TOKEN_PROGRAM_ID;
    const recipientAta =
      accounts.recipientTokenAccount ||
      this.client.base.getVaultAta(accounts.mint, tokenProgram);
    const createRecipientAtaIx =
      createAssociatedTokenAccountIdempotentInstruction(
        signer,
        recipientAta,
        this.client.base.vaultPda,
        accounts.mint,
        tokenProgram,
      );
    const ix = await this.withdrawIx(amount, maxSharesBurn, accounts, signer);
    return await this.buildVersionedTx([createRecipientAtaIx, ix], txOptions);
  }

  async setPolicyIx(
    policy: JupiterEarnPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extJupiterProgram.methods
      .setEarnPolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: JupiterEarnPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.base.extJupiterProgram.programId,
      JUPITER_EARN_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.base.extJupiterProgram.programId,
      JUPITER_EARN_PROTOCOL,
      txOptions,
    );
  }
}

export class JupiterEarnClient
  implements ProtocolPolicyClient<JupiterEarnPolicy>
{
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extJupiterProgram.programId);
  }

  async deposit(
    mint: PublicKey,
    amount: BN | bigint | number,
    minAmountOut: BN | bigint | number = new BN(0),
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const accounts = await this.resolveAccounts(mint);
    const tx = await this.txBuilder.depositTx(
      amount,
      minAmountOut,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async withdraw(
    mint: PublicKey,
    amount: BN | bigint | number,
    maxSharesBurn: BN | bigint | number = U64_MAX,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const earnAccounts = await this.resolveAccounts(mint);
    const claimAccount = getClaimAccountPda(mint, earnAccounts.lendingAdmin);
    const tx = await this.txBuilder.withdrawTx(
      amount,
      maxSharesBurn,
      { ...earnAccounts, claimAccount },
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async fetchPolicy(): Promise<JupiterEarnPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.base.extJupiterProgram.programId,
      JUPITER_EARN_PROTOCOL,
      JupiterEarnPolicy,
    );
  }

  async setPolicy(
    policy: JupiterEarnPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  private async resolveAccounts(mint: PublicKey): Promise<
    Omit<JupiterEarnDepositAccounts, "liquidity" | "rateModel"> & {
      liquidity: PublicKey;
      rateModel: PublicKey;
    }
  > {
    const connection = this.base.connection;
    const fTokenMint = getFTokenMintPda(mint);
    const lending = getLendingPda(mint, fTokenMint);
    const data = await fetchAndValidate(
      connection,
      lending,
      JUPITER_LENDING_PROGRAM_ID,
      LENDING_DISCRIMINATOR,
      "Lending",
    );
    const rewardsRateModel = new PublicKey(
      data.subarray(
        LENDING_REWARDS_RATE_MODEL_OFFSET,
        LENDING_REWARDS_RATE_MODEL_OFFSET + PUBKEY_BYTES,
      ),
    );
    const supplyTokenReservesLiquidity = new PublicKey(
      data.subarray(
        LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET,
        LENDING_TOKEN_RESERVES_LIQUIDITY_OFFSET + PUBKEY_BYTES,
      ),
    );
    const lendingSupplyPositionOnLiquidity = new PublicKey(
      data.subarray(
        LENDING_SUPPLY_POSITION_OFFSET,
        LENDING_SUPPLY_POSITION_OFFSET + PUBKEY_BYTES,
      ),
    );
    const vault = await fetchReserveVault(
      connection,
      supplyTokenReservesLiquidity,
      mint,
    );
    return {
      mint,
      lendingAdmin: getLendingAdminPda(),
      lending,
      fTokenMint,
      supplyTokenReservesLiquidity,
      lendingSupplyPositionOnLiquidity,
      rewardsRateModel,
      vault,
      rateModel: getRateModelPda(mint),
      liquidity: getLiquidityPda(),
    };
  }
}
