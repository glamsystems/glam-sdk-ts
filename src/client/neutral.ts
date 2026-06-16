import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { NtBundlePolicy } from "../deser/integrationPolicies";
import { NTBUNDLE_PROGRAM_ID } from "../constants";
import {
  fetchMintAndTokenProgram,
  getIntegrationAuthorityPda,
  toBnAmount,
} from "../utils";
import {
  NtBundleAccount,
  NtBundleOracleDataAccount,
  NtBundleUserAccount,
} from "../deser/ntBundleLayouts";

export {
  NtBundleAccount,
  NtBundleOracleDataAccount,
  NtBundleUserAccount,
  NtBundleAccount as NeutralBundleAccount,
  NtBundleOracleDataAccount as NeutralOracleDataAccount,
  NtBundleUserAccount as NeutralUserBundleAccount,
};
export { NTBUNDLE_PROGRAM_ID };
export const NT_BUNDLE_PROTOCOL = 0b1;
export const NEUTRAL_PROTOCOL = NT_BUNDLE_PROTOCOL;
export const DEFAULT_NEUTRAL_WITHDRAWAL_MAX_DEVIATION_BPS = 100;

export type NeutralWithdrawalEstimate = {
  sharesAmount: BN;
  totalEstimatedBundleValue: BN;
  estimatedPendingWithdrawalValue: BN;
  minEstimatedValue: BN;
  maxDeviationFromEstimatedBps: number;
};

function validateBps(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("Bps value must be an integer between 0 and 10000");
  }
}

export function estimateNeutralWithdrawalValue(
  bundleAccount: NtBundleAccount,
  oracleData: NtBundleOracleDataAccount,
  sharesAmount: BN | bigint | number | string,
  maxDeviationFromEstimatedBps = DEFAULT_NEUTRAL_WITHDRAWAL_MAX_DEVIATION_BPS,
): NeutralWithdrawalEstimate {
  validateBps(maxDeviationFromEstimatedBps);

  const sharesAmountBn = toBnAmount(sharesAmount);
  if (sharesAmountBn.lten(0)) {
    throw new Error("Shares amount must be greater than zero");
  }
  if (bundleAccount.totalShares.lten(0)) {
    throw new Error("NT bundle total shares is zero");
  }

  const totalEstimatedBundleValue = bundleAccount.bundleUnderlyingBalance.add(
    oracleData.averageExternalEquity,
  );
  const estimatedPendingWithdrawalValue = sharesAmountBn
    .mul(totalEstimatedBundleValue)
    .div(bundleAccount.totalShares);
  const acceptedValueBps = 10_000 - maxDeviationFromEstimatedBps;
  const minEstimatedValue = estimatedPendingWithdrawalValue
    .muln(acceptedValueBps)
    .divn(10_000);

  return {
    sharesAmount: sharesAmountBn,
    totalEstimatedBundleValue,
    estimatedPendingWithdrawalValue,
    minEstimatedValue,
    maxDeviationFromEstimatedBps,
  };
}

export function getNtBundleUserBundlePda(
  authority: PublicKey,
  bundle: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("USER_BUNDLE"), authority.toBuffer(), bundle.toBuffer()],
    NTBUNDLE_PROGRAM_ID,
  )[0];
}

export function getNtBundleOracleDataPda(bundle: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ORACLE"), bundle.toBuffer()],
    NTBUNDLE_PROGRAM_ID,
  )[0];
}

export function getNtBundleTempDataPda(bundle: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("BUNDLE_TEMP_DATA"), bundle.toBuffer()],
    NTBUNDLE_PROGRAM_ID,
  )[0];
}

export function getNtBundlePendingAssetAuthorityPda(
  bundle: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("PENDING_BUNDLE_ASSET_AUTHORITY"), bundle.toBuffer()],
    NTBUNDLE_PROGRAM_ID,
  )[0];
}

export const getNeutralUserBundlePda = getNtBundleUserBundlePda;
export const getNeutralOracleDataPda = getNtBundleOracleDataPda;
export const getNeutralBundleTempDataPda = getNtBundleTempDataPda;
export const getNeutralPendingBundleAssetAuthorityPda =
  getNtBundlePendingAssetAuthorityPda;

class TxBuilder extends BaseTxBuilder<NeutralClient> {
  async setNeutralPolicyIx(
    policy: NtBundlePolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extNeutralProgram.methods
      .setNtbundlePolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setNeutralPolicyTx(
    policy: NtBundlePolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setNeutralPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async initializeBundleDepositorIx(
    bundle: PublicKey,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extNeutralProgram.methods
      .initializeBundleDepositor()
      .accountsPartial({
        ...this.client.baseAccounts(signer),
        bundleAccount: bundle,
        userBundleAccount: this.client.getUserBundlePda(bundle),
      })
      .instruction();
  }

  async initializeBundleDepositorTx(
    bundle: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.initializeBundleDepositorIx(bundle, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async requestDepositIx(
    bundle: PublicKey,
    amount: BN | bigint | number | string,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const { assetAddress, treasuryAccount } =
      await this.client.fetchBundle(bundle);
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      assetAddress,
    );
    const pendingBundleAssetAuthority =
      this.client.getPendingBundleAssetAuthorityPda(bundle);

    return await this.client.base.extNeutralProgram.methods
      .requestDeposit(toBnAmount(amount))
      .accountsPartial({
        ...this.client.baseAccounts(signer),
        userTokenAccount: this.client.base.getVaultAta(
          assetAddress,
          tokenProgram,
        ),
        pendingDepositTokenAccount: this.client.base.getAta(
          assetAddress,
          pendingBundleAssetAuthority,
          tokenProgram,
        ),
        treasuryAccount,
        userBundleAccount: this.client.getUserBundlePda(bundle),
        assetAddress,
        oracleData: this.client.getOracleDataPda(bundle),
        bundleTempData: this.client.getBundleTempDataPda(bundle),
        bundleAccount: bundle,
        pendingBundleAssetAuthority,
        tokenProgram,
      })
      .instruction();
  }

  async requestDepositTx(
    bundle: PublicKey,
    amount: BN | bigint | number | string,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.requestDepositIx(bundle, amount, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async requestWithdrawalIx(
    bundle: PublicKey,
    sharesAmount: BN | bigint | number | string,
    minEstimatedValue: BN | bigint | number | string,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extNeutralProgram.methods
      .requestWithdrawal(
        toBnAmount(sharesAmount),
        toBnAmount(minEstimatedValue),
      )
      .accountsPartial({
        ...this.client.baseAccounts(signer),
        userBundleAccount: this.client.getUserBundlePda(bundle),
        bundleAccount: bundle,
        oracleData: this.client.getOracleDataPda(bundle),
        bundleTempData: this.client.getBundleTempDataPda(bundle),
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  async requestWithdrawalTx(
    bundle: PublicKey,
    sharesAmount: BN | bigint | number | string,
    minEstimatedValue: BN | bigint | number | string,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.requestWithdrawalIx(
      bundle,
      sharesAmount,
      minEstimatedValue,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async closeUserBundleAccountIx(
    bundle: PublicKey,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extNeutralProgram.methods
      .closeUserBundleAccount()
      .accountsPartial({
        ...this.client.baseAccounts(signer),
        userBundleAccount: this.client.getUserBundlePda(bundle),
        bundleAccount: bundle,
      })
      .instruction();
  }

  async closeUserBundleAccountTx(
    bundle: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closeUserBundleAccountIx(bundle, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class NeutralClient {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  baseAccounts(signer?: PublicKey) {
    return {
      glamState: this.base.statePda,
      glamVault: this.base.vaultPda,
      glamSigner: signer || this.base.signer,
      integrationAuthority: this.getIntegrationAuthorityPda(),
      cpiProgram: NTBUNDLE_PROGRAM_ID,
      glamProtocolProgram: this.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
    };
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extNeutralProgram.programId);
  }

  getUserBundlePda(bundle: PublicKey): PublicKey {
    return getNtBundleUserBundlePda(this.base.vaultPda, bundle);
  }

  getOracleDataPda(bundle: PublicKey): PublicKey {
    return getNtBundleOracleDataPda(bundle);
  }

  getBundleTempDataPda(bundle: PublicKey): PublicKey {
    return getNtBundleTempDataPda(bundle);
  }

  getPendingBundleAssetAuthorityPda(bundle: PublicKey): PublicKey {
    return getNtBundlePendingAssetAuthorityPda(bundle);
  }

  async fetchBundle(bundle: PublicKey): Promise<NtBundleAccount> {
    const account = await this.base.connection.getAccountInfo(bundle);
    if (!account) {
      throw new Error(`NT bundle account not found: ${bundle}`);
    }
    if (!account.owner.equals(NTBUNDLE_PROGRAM_ID)) {
      throw new Error(
        `NT bundle ${bundle} is owned by ${account.owner}, expected ${NTBUNDLE_PROGRAM_ID}`,
      );
    }
    return NtBundleAccount.decode(bundle, account.data);
  }

  async fetchOracleData(bundle: PublicKey): Promise<NtBundleOracleDataAccount> {
    const oracleData = this.getOracleDataPda(bundle);
    const account = await this.base.connection.getAccountInfo(oracleData);
    if (!account) {
      throw new Error(`Neutral oracle data account not found: ${oracleData}`);
    }
    if (!account.owner.equals(NTBUNDLE_PROGRAM_ID)) {
      throw new Error(
        `Neutral oracle data ${oracleData} is owned by ${account.owner}, expected ${NTBUNDLE_PROGRAM_ID}`,
      );
    }
    return NtBundleOracleDataAccount.decode(oracleData, account.data);
  }

  async fetchUserBundle(bundle: PublicKey): Promise<NtBundleUserAccount> {
    const userBundle = this.getUserBundlePda(bundle);
    const account = await this.base.connection.getAccountInfo(userBundle);
    if (!account) {
      throw new Error(`Neutral user bundle account not found: ${userBundle}`);
    }
    if (!account.owner.equals(NTBUNDLE_PROGRAM_ID)) {
      throw new Error(
        `Neutral user bundle ${userBundle} is owned by ${account.owner}, expected ${NTBUNDLE_PROGRAM_ID}`,
      );
    }
    return NtBundleUserAccount.decode(userBundle, account.data);
  }

  async estimateWithdrawalValue(
    bundle: PublicKey,
    sharesAmount: BN | bigint | number | string,
    maxDeviationFromEstimatedBps = DEFAULT_NEUTRAL_WITHDRAWAL_MAX_DEVIATION_BPS,
  ): Promise<NeutralWithdrawalEstimate> {
    const sharesAmountBn = toBnAmount(sharesAmount);
    const [bundleAccount, oracleData, userBundle] = await Promise.all([
      this.fetchBundle(bundle),
      this.fetchOracleData(bundle),
      this.fetchUserBundle(bundle),
    ]);

    if (userBundle.shares.lt(sharesAmountBn)) {
      throw new Error(
        `Neutral user bundle only has ${userBundle.shares.toString()} shares, cannot withdraw ${sharesAmountBn.toString()}`,
      );
    }

    return estimateNeutralWithdrawalValue(
      bundleAccount,
      oracleData,
      sharesAmountBn,
      maxDeviationFromEstimatedBps,
    );
  }

  async fetchPolicy(): Promise<NtBundlePolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.base.extNeutralProgram.programId,
      NT_BUNDLE_PROTOCOL,
      NtBundlePolicy,
    );
  }

  async setPolicy(
    policy: NtBundlePolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setNeutralPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async allowlistBundle(
    bundle: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const policy = (await this.fetchPolicy()) ?? new NtBundlePolicy([]);
    if (policy.bundlesAllowlist.find((b) => b.equals(bundle))) {
      throw new Error(`NT bundle ${bundle} is already in the allowlist`);
    }

    policy.bundlesAllowlist.push(bundle);
    return await this.setPolicy(policy, txOptions);
  }

  async initializeBundleDepositor(
    bundle: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.initializeBundleDepositorTx(
      bundle,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async requestDeposit(
    bundle: PublicKey,
    amount: BN | bigint | number | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.requestDepositTx(bundle, amount, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async requestWithdrawal(
    bundle: PublicKey,
    sharesAmount: BN | bigint | number | string,
    minEstimatedValue: BN | bigint | number | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.requestWithdrawalTx(
      bundle,
      sharesAmount,
      minEstimatedValue,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async closeUserBundleAccount(
    bundle: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.closeUserBundleAccountTx(bundle, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
