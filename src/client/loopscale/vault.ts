import { BN } from "@coral-xyz/anchor";
import {
  Commitment,
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { BaseClient, type ProtocolPolicyClient, type TxOptions } from "../base";
import { LOOPSCALE_PROGRAM_ID } from "../../constants";
import { LoopscaleVault, hasLoopscaleVaultDiscriminator } from "../../deser";
import { LoopscaleVaultPolicy } from "../../deser/integrationPolicies";
import { LOOPSCALE_VAULT_PROTOCOL } from "../../protocols";
import { fetchMintsAndTokenPrograms } from "../../utils";
import {
  ClaimVaultRewardsAccounts,
  DepositWithdrawUserVaultAccounts,
  LoopscaleCoreClient,
  LoopscaleLpParams,
  PriceVaultsAccounts,
  LoopscaleVaultStakeParams,
  LoopscaleVaultTxBuilder,
  LoopscaleVaultUnstakeParams,
  isLoopscaleVaultAccountInfo,
  readLoopscaleVaultLpMint,
  readLoopscaleVaultPrincipalMint,
  readLoopscaleVaultStakeVault,
  StakeUserVaultLpAccounts,
  UnstakeUserVaultLpAccounts,
} from "./core";
import { PkSet } from "../../utils/pkset";

export type LoopscaleVaultDepositWithdrawAmounts =
  | {
      amountIn: BN;
      minAmountOut: BN;
    }
  | {
      amountOut: BN;
      maxAmountIn: BN;
    };

export type LoopscaleVaultData = {
  lpDecimals: number;
  principalDecimals: number;
  accounts: DepositWithdrawUserVaultAccounts;
};

export class LoopscaleVaultClient
  implements ProtocolPolicyClient<LoopscaleVaultPolicy>
{
  readonly txBuilder: LoopscaleVaultTxBuilder;

  public constructor(private readonly core: LoopscaleCoreClient) {
    this.txBuilder = core.vaultTxBuilder;
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

  getVaultPda(vaultNonce: PublicKey): PublicKey {
    return this.core.getVaultPda(vaultNonce);
  }

  getVaultStrategyPda(vault: PublicKey): PublicKey {
    return this.core.getVaultStrategyPda(vault);
  }

  getVaultRewardsInfoPda(vault: PublicKey): PublicKey {
    return this.core.getVaultRewardsInfoPda(vault);
  }

  getVaultStakePda(stakeNonce: PublicKey, vault: PublicKey): PublicKey {
    return this.core.getVaultStakePda(stakeNonce, vault);
  }

  getUserRewardsInfoPda(vaultStake: PublicKey): PublicKey {
    return this.core.getUserRewardsInfoPda(vaultStake);
  }

  async fetchVault(vault: PublicKey): Promise<LoopscaleVault> {
    const account = await this.base.connection.getAccountInfo(vault);
    if (!account) {
      throw new Error(`Loopscale vault account not found: ${vault}`);
    }
    if (!account.owner.equals(LOOPSCALE_PROGRAM_ID)) {
      throw new Error(
        `Loopscale vault ${vault} is owned by ${account.owner}, expected ${LOOPSCALE_PROGRAM_ID}`,
      );
    }
    if (!hasLoopscaleVaultDiscriminator(account.data)) {
      throw new Error(`Account is not a Loopscale Vault: ${vault}`);
    }

    return LoopscaleVault.decode(vault, account.data);
  }

  async resolveVaultData(vault: PublicKey): Promise<LoopscaleVaultData> {
    const { lpMint, principalMint } = await this.fetchVault(vault);
    const strategy = this.getVaultStrategyPda(vault);
    const strategyAccount = await this.core.fetchStrategy(strategy);

    const [principalMintInfo, lpMintInfo] = await fetchMintsAndTokenPrograms(
      this.base.connection,
      [principalMint, lpMint],
    );

    return {
      lpDecimals: lpMintInfo.mint.decimals,
      principalDecimals: principalMintInfo.mint.decimals,
      accounts: {
        vault,
        strategy,
        marketInformation: strategyAccount.marketInformation,
        lpMint,
        principalMint,
        lpTokenProgram: lpMintInfo.tokenProgram,
        principalTokenProgram: principalMintInfo.tokenProgram,
      },
    };
  }

  async fetchPolicy(): Promise<LoopscaleVaultPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.programId,
      LOOPSCALE_VAULT_PROTOCOL,
      LoopscaleVaultPolicy,
    );
  }

  async setPolicy(
    policy: LoopscaleVaultPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setVaultPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearVaultPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async depositUserVault(
    amounts: LoopscaleVaultDepositWithdrawAmounts,
    accounts: DepositWithdrawUserVaultAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.txBuilder.depositUserVaultIxs(
      toLpParams(amounts),
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async withdrawUserVault(
    amounts: LoopscaleVaultDepositWithdrawAmounts,
    accounts: DepositWithdrawUserVaultAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.txBuilder.withdrawUserVaultIxs(
      toLpParams(amounts),
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async stakeUserVaultLp(
    params: LoopscaleVaultStakeParams,
    accounts: StakeUserVaultLpAccounts,
    txOptions: TxOptions = {},
    additionalSigners: Keypair[] = [],
  ): Promise<TransactionSignature> {
    const ixs = await this.txBuilder.stakeUserVaultLpIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend(ixs, txOptions, additionalSigners);
  }

  async unstakeUserVaultLp(
    params: LoopscaleVaultUnstakeParams,
    accounts: UnstakeUserVaultLpAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ixs = await this.txBuilder.unstakeUserVaultLpIxs(
      params,
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend(ixs, txOptions);
  }

  async claimVaultRewards(
    mints: PublicKey[],
    accounts: ClaimVaultRewardsAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.claimVaultRewardsIx(
      mints,
      accounts,
      txOptions.signer,
    );
    return await this.core.coSignAndSend([ix], txOptions);
  }

  async getPriceVaultsAccounts(
    commitment?: Commitment,
  ): Promise<PriceVaultsAccounts | null> {
    const policy = await this.fetchPolicy();
    const vaultAllowlist = policy?.vaultAllowlist ?? [];
    if (vaultAllowlist.length === 0) {
      return null;
    }

    const [state, vaultInfos, registeredStakes] = await Promise.all([
      this.base.fetchStateAccount(),
      this.base.connection.getMultipleAccountsInfo(vaultAllowlist, commitment),
      this.core.fetchRegisteredVaultStakeAccountInfos(commitment),
    ]);

    const allowedVaults = new PkSet(vaultAllowlist);
    const trackedExternalPositions = new PkSet(state.externalPositions ?? []);
    const stakeAccountsByVault = new Map<string, PublicKey[]>();
    for (const { address, info } of registeredStakes) {
      const vault = readLoopscaleVaultStakeVault(info.data);
      if (!allowedVaults.has(vault)) {
        throw new Error(
          `Registered Loopscale vault stake ${address.toBase58()} belongs to non-allowlisted vault ${vault.toBase58()}`,
        );
      }
      const key = vault.toBase58();
      const accounts = stakeAccountsByVault.get(key) ?? [];
      accounts.push(address);
      stakeAccountsByVault.set(key, accounts);
    }

    const assetMetas = await this.base.fetchAssetMetas();
    const vaultAccounts: PublicKey[] = [];
    const strategyAccounts: PublicKey[] = [];
    const userLpTokenAccounts: PublicKey[] = [];
    const vaultStakeAccounts: PublicKey[] = [];
    const oracleAccounts: PublicKey[] = [];
    const seenOracles = new PkSet();

    for (let i = 0; i < vaultAllowlist.length; i++) {
      const vault = vaultAllowlist[i];
      const vaultInfo = vaultInfos[i];
      if (!isLoopscaleVaultAccountInfo(vaultInfo)) {
        throw new Error(
          `Loopscale vault account unavailable or invalid: ${vault.toBase58()}`,
        );
      }

      const lpMint = readLoopscaleVaultLpMint(vaultInfo.data);
      const principalMint = readLoopscaleVaultPrincipalMint(vaultInfo.data);
      const userLpTokenAccount = this.core.getVaultLpTokenAta(
        lpMint,
        this.base.vaultPda,
        TOKEN_2022_PROGRAM_ID,
      );
      const stakes = stakeAccountsByVault.get(vault.toBase58()) ?? [];
      const hasTrackedLp = trackedExternalPositions.has(userLpTokenAccount);

      if (!hasTrackedLp && stakes.length === 0) {
        continue;
      }

      const assetMeta = assetMetas.get(principalMint);
      if (!assetMeta?.oracle) {
        throw new Error(
          `Oracle unavailable for Loopscale vault principal ${principalMint.toBase58()}`,
        );
      }
      if (!seenOracles.has(assetMeta.oracle)) {
        seenOracles.add(assetMeta.oracle);
        oracleAccounts.push(assetMeta.oracle);
      }

      vaultAccounts.push(vault);
      strategyAccounts.push(this.getVaultStrategyPda(vault));
      userLpTokenAccounts.push(userLpTokenAccount);
      vaultStakeAccounts.push(...stakes);
    }

    if (vaultAccounts.length === 0) {
      return null;
    }

    return {
      numVaults: vaultAccounts.length,
      vaultAccounts,
      strategyAccounts,
      userLpTokenAccounts,
      vaultStakeAccounts,
      oracleAccounts,
    };
  }
}

function toLpParams(
  amounts: LoopscaleVaultDepositWithdrawAmounts,
): LoopscaleLpParams {
  if ("amountIn" in amounts) {
    return {
      exactIn: {
        amountIn: amounts.amountIn,
        minAmountOut: amounts.minAmountOut,
      },
    };
  }

  return {
    exactOut: {
      amountOut: amounts.amountOut,
      maxAmountIn: amounts.maxAmountIn,
    },
  };
}
