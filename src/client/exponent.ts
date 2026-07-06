import { type IdlTypes } from "@coral-xyz/anchor";
import {
  type AccountMeta,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
  type TransactionSignature,
  type VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { EXPONENT_CORE_PROGRAM_ID } from "../constants";
import type { ExponentPolicy } from "../deser/integrationPolicies";
import type { ExtExponent } from "../glamExports";
import { type BnInput, toBn } from "../utils/common";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import { BaseTxBuilder, type BaseClient, type TxOptions } from "./base";

export type ExponentIdlTypes = IdlTypes<ExtExponent>;
export type ExponentPolicyInput = ExponentIdlTypes["exponentPolicy"];
export type ExponentPolicyLike = {
  marketsAllowlist?: PublicKey[];
  vaultsAllowlist?: PublicKey[];
};

export type ExponentWrapperAccounts = {
  market: PublicKey;
  tokenSyTrader: PublicKey;
  tokenPtTrader: PublicKey;
  tokenSyEscrow: PublicKey;
  tokenPtEscrow: PublicKey;
  addressLookupTable: PublicKey;
  syProgram: PublicKey;
  tokenFeeTreasurySy: PublicKey;
  eventAuthority?: PublicKey;
  tokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type ExponentWrapperBuyPtParams = {
  ptAmount: BnInput;
  maxBaseAmount: BnInput;
  mintSyRemAccountsUntil: number;
};

export type ExponentWrapperSellPtParams = {
  amountPt: BnInput;
  minBaseAmount: BnInput;
  redeemSyRemAccountsUntil: number;
};

export type ExponentWrapperMergeAccounts = {
  tokenSyMerger: PublicKey;
  vault: PublicKey;
  escrowSy: PublicKey;
  tokenYtMerger: PublicKey;
  tokenPtMerger: PublicKey;
  mintYt: PublicKey;
  mintPt: PublicKey;
  authority: PublicKey;
  vaultAddressLookupTable: PublicKey;
  vaultRobotYieldPosition: PublicKey;
  syProgram: PublicKey;
  eventAuthority?: PublicKey;
  tokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type ExponentWrapperMergeParams = {
  amountPy: BnInput;
  redeemSyAccountsUntil: number;
};

export function getExponentEventAuthorityPda(
  programId = EXPONENT_CORE_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  )[0];
}

function toPolicyInput(
  policy: ExponentPolicy | ExponentPolicyLike,
): ExponentPolicyInput {
  return {
    marketsAllowlist: policy.marketsAllowlist ?? [],
    vaultsAllowlist: policy.vaultsAllowlist ?? [],
  } as ExponentPolicyInput;
}

class TxBuilder extends BaseTxBuilder<ExponentClient> {
  private wrapperAccounts(
    accounts: ExponentWrapperAccounts,
    signer?: PublicKey,
  ) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: EXPONENT_CORE_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
      market: accounts.market,
      tokenSyTrader: accounts.tokenSyTrader,
      tokenPtTrader: accounts.tokenPtTrader,
      tokenSyEscrow: accounts.tokenSyEscrow,
      tokenPtEscrow: accounts.tokenPtEscrow,
      addressLookupTable: accounts.addressLookupTable,
      tokenProgram: accounts.tokenProgram || TOKEN_PROGRAM_ID,
      syProgram: accounts.syProgram,
      tokenFeeTreasurySy: accounts.tokenFeeTreasurySy,
      eventAuthority: accounts.eventAuthority || getExponentEventAuthorityPda(),
    };
  }

  private wrapperMergeAccounts(
    accounts: ExponentWrapperMergeAccounts,
    signer?: PublicKey,
  ) {
    return {
      glamState: this.client.base.statePda,
      glamVault: this.client.base.vaultPda,
      glamSigner: signer || this.client.base.signer,
      integrationAuthority: this.client.getIntegrationAuthorityPda(),
      cpiProgram: EXPONENT_CORE_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
      tokenSyMerger: accounts.tokenSyMerger,
      vault: accounts.vault,
      escrowSy: accounts.escrowSy,
      tokenYtMerger: accounts.tokenYtMerger,
      tokenPtMerger: accounts.tokenPtMerger,
      mintYt: accounts.mintYt,
      mintPt: accounts.mintPt,
      authority: accounts.authority,
      vaultAddressLookupTable: accounts.vaultAddressLookupTable,
      tokenProgram: accounts.tokenProgram || TOKEN_PROGRAM_ID,
      vaultRobotYieldPosition: accounts.vaultRobotYieldPosition,
      syProgram: accounts.syProgram,
      eventAuthority: accounts.eventAuthority || getExponentEventAuthorityPda(),
    };
  }

  async setExponentPolicyIx(
    policy: ExponentPolicy | ExponentPolicyLike,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extExponentProgram.methods
      .setExponentPolicy(toPolicyInput(policy))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setExponentPolicyTx(
    policy: ExponentPolicy | ExponentPolicyLike,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setExponentPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async wrapperBuyPtIx(
    params: ExponentWrapperBuyPtParams,
    accounts: ExponentWrapperAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extExponentProgram.methods
      .wrapperBuyPt(
        toBn(params.ptAmount),
        toBn(params.maxBaseAmount),
        params.mintSyRemAccountsUntil,
      )
      .accountsPartial(this.wrapperAccounts(accounts, signer))
      .remainingAccounts(accounts.remainingAccounts || [])
      .instruction();
  }

  async wrapperBuyPtTx(
    params: ExponentWrapperBuyPtParams,
    accounts: ExponentWrapperAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.wrapperBuyPtIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async wrapperSellPtIx(
    params: ExponentWrapperSellPtParams,
    accounts: ExponentWrapperAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extExponentProgram.methods
      .wrapperSellPt(
        toBn(params.amountPt),
        toBn(params.minBaseAmount),
        params.redeemSyRemAccountsUntil,
      )
      .accountsPartial(this.wrapperAccounts(accounts, signer))
      .remainingAccounts(accounts.remainingAccounts || [])
      .instruction();
  }

  async wrapperSellPtTx(
    params: ExponentWrapperSellPtParams,
    accounts: ExponentWrapperAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.wrapperSellPtIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async wrapperMergeIx(
    params: ExponentWrapperMergeParams,
    accounts: ExponentWrapperMergeAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extExponentProgram.methods
      .wrapperMerge(toBn(params.amountPy), params.redeemSyAccountsUntil)
      .accountsPartial(this.wrapperMergeAccounts(accounts, signer))
      .remainingAccounts(accounts.remainingAccounts || [])
      .instruction();
  }

  async wrapperMergeTx(
    params: ExponentWrapperMergeParams,
    accounts: ExponentWrapperMergeAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.wrapperMergeIx(params, accounts, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class ExponentClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extExponentProgram.programId);
  }

  async setExponentPolicy(
    policy: ExponentPolicy | ExponentPolicyLike,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setExponentPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async wrapperBuyPt(
    params: ExponentWrapperBuyPtParams,
    accounts: ExponentWrapperAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.wrapperBuyPtTx(params, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async wrapperSellPt(
    params: ExponentWrapperSellPtParams,
    accounts: ExponentWrapperAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.wrapperSellPtTx(
      params,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async wrapperMerge(
    params: ExponentWrapperMergeParams,
    accounts: ExponentWrapperMergeAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.wrapperMergeTx(params, accounts, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
