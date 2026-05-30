import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";

import {
  BaseClient,
  BaseTxBuilder,
  ProtocolPolicyClient,
  ProtocolPolicyTxBuilder,
  TxOptions,
} from "./base";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { WSOL } from "../constants";
import { TransferPolicy } from "../deser/integrationPolicies";
import { SPL_TOKEN_PROTOCOL } from "../protocols";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PkMap } from "../utils";

class TxBuilder
  extends BaseTxBuilder<VaultClient>
  implements ProtocolPolicyTxBuilder<TransferPolicy>
{
  async setPolicyIx(
    policy: TransferPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extSplProgram.methods
      .setTokenTransferPolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: TransferPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.base.extSplProgram.programId,
      SPL_TOKEN_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.base.extSplProgram.programId,
      SPL_TOKEN_PROTOCOL,
      txOptions,
    );
  }

  public async wrapIxs(
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vaultAta = this.client.base.getVaultAta(WSOL);

    const preIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      vaultAta,
      this.client.base.vaultPda,
      WSOL,
    );
    const ix = await this.client.base.protocolProgram.methods
      .systemTransfer(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        to: vaultAta,
      })
      .remainingAccounts([
        {
          pubkey: TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    return [preIx, ix];
  }

  public async wrapTx(
    amount: BN,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.wrapIxs(amount, glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async unwrapIx(
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    const tokenAccount = this.client.base.getVaultAta(WSOL);

    return await this.client.base.extSplProgram.methods
      .tokenCloseAccount()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        tokenAccount,
        cpiProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  public async unwrapTx(txOptions: TxOptions): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.unwrapIx(glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  public async systemTransferIx(
    amount: BN,
    to: PublicKey,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .systemTransfer(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        to,
      })
      .instruction();
  }

  public async systemTransferTx(
    amount: BN,
    to: PublicKey,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.systemTransferIx(amount, to, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  /**
   * Returns an instruction that closes the specified vault token account
   */
  public async closeTokenAccountIx(
    tokenAccount: PublicKey,
    tokenProgram: PublicKey,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extSplProgram.methods
      .tokenCloseAccount()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        tokenAccount: tokenAccount,
        cpiProgram: tokenProgram,
      })
      .instruction();
  }

  public async closeTokenAccountsTx(
    pubkeys: PublicKey[],
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const accountsInfo =
      await this.client.base.connection.getMultipleAccountsInfo(pubkeys);
    if (pubkeys.length !== accountsInfo.filter(Boolean).length) {
      throw new Error("Not all token accounts are valid");
    }

    // split token accounts into 2 arrays by owner program
    const tokenAccountsByProgram = new PkMap<PublicKey[]>([
      [TOKEN_PROGRAM_ID, []],
      [TOKEN_2022_PROGRAM_ID, []],
    ]);

    accountsInfo.forEach((accountInfo, i) => {
      [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].forEach((programId) => {
        if (accountInfo?.owner.equals(programId)) {
          tokenAccountsByProgram.get(programId)?.push(pubkeys[i]);
        }
      });
    });

    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await Promise.all(
      Array.from(tokenAccountsByProgram.pkEntries())
        .filter(([_, accounts]) => accounts.length > 0)
        .map(([programId, accounts]) => {
          return accounts.map((account) =>
            this.closeTokenAccountIx(account, programId, glamSigner),
          );
        })
        .flat(),
    );

    if (ixs.length === 0) {
      throw new Error("No token accounts to close");
    }

    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async depositSolIxs(
    lamports: number | BN,
    wrap: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const glamVault = this.client.base.vaultPda;
    const _lamports =
      lamports instanceof BN ? BigInt(lamports.toString()) : lamports;

    if (!wrap) {
      const ix = SystemProgram.transfer({
        fromPubkey: glamSigner,
        toPubkey: glamVault,
        lamports: _lamports,
      });
      return [ix];
    }

    const vaultAta = this.client.base.getVaultAta(WSOL);
    return [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        vaultAta,
        glamVault,
        WSOL,
      ),
      SystemProgram.transfer({
        fromPubkey: glamSigner,
        toPubkey: vaultAta,
        lamports: _lamports,
      }),
      createSyncNativeInstruction(vaultAta),
    ];
  }

  public async depositSolTx(
    lamports: number | BN,
    wrap = true,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositSolIxs(lamports, wrap, signer);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  public async depositIxs(
    asset: PublicKey,
    amount: number | BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      asset,
    );

    const signerAta = this.client.base.getAta(asset, glamSigner, tokenProgram);
    const vaultAta = this.client.base.getVaultAta(asset, tokenProgram);

    return [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        vaultAta,
        this.client.base.vaultPda,
        asset,
        tokenProgram,
      ),
      createTransferCheckedInstruction(
        signerAta,
        asset,
        vaultAta,
        glamSigner,
        new BN(amount).toNumber(),
        mint.decimals,
        [],
        tokenProgram,
      ),
    ];
  }

  public async depositTx(
    asset: PublicKey,
    amount: number | BN,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositIxs(asset, amount, signer);
    return await this.buildVersionedTx(ixs, txOptions);
  }

  /**
   * Transfers tokens held by the vault to the specified recipient
   */
  public async tokenTransferIxs(
    mint: PublicKey,
    amount: number | BN,
    to: PublicKey,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const { mint: mintObj, tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      mint,
    );
    const toAta = this.client.base.getAta(mint, to, tokenProgram);

    const preIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      toAta,
      to,
      mint,
      tokenProgram,
    );
    const ix = await this.client.base.extSplProgram.methods
      .tokenTransferChecked(new BN(amount), mintObj.decimals)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        from: this.client.base.getVaultAta(mint, tokenProgram),
        to: toAta,
        mint,
        cpiProgram: tokenProgram,
      })
      .instruction();

    return [preIx, ix];
  }

  public async tokenTransferTx(
    mint: PublicKey,
    amount: number | BN,
    to: PublicKey,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.tokenTransferIxs(mint, amount, to, glamSigner);
    return await this.buildVersionedTx(ixs, txOptions);
  }
}

export class VaultClient implements ProtocolPolicyClient<TransferPolicy> {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  async fetchPolicy(): Promise<TransferPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.base.extSplProgram.programId,
      SPL_TOKEN_PROTOCOL,
      TransferPolicy,
    );
  }

  async setPolicy(
    policy: TransferPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Wraps vault SOL to wSOL
   *
   * @param amount
   * @param txOptions
   */
  public async wrap(
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.wrapTx(new BN(amount), txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Unwraps vault wSOL to SOL
   *
   * @param txOptions
   */
  public async unwrap(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.unwrapTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Transfers SOL from vault to another account
   *
   * @param amount
   * @param to
   * @param txOptions
   */
  public async systemTransfer(
    amount: BN | number,
    to: PublicKey | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.systemTransferTx(
      new BN(amount),
      new PublicKey(to),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Transfers token from vault to another account
   *
   * @param mint
   * @param amount
   * @param txOptions
   */
  public async tokenTransfer(
    mint: PublicKey | string,
    amount: number | BN,
    to: PublicKey | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.tokenTransferTx(
      new PublicKey(mint),
      amount,
      new PublicKey(to),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Closes multiple vault token accounts
   *
   * @param tokenAccounts
   * @param txOptions
   */
  public async closeTokenAccounts(
    tokenAccounts: PublicKey[] | string[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.closeTokenAccountsTx(
      tokenAccounts.map((pubkey) => new PublicKey(pubkey)),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Deposits token to vault
   *
   * @param mint Token mint
   * @param amount
   * @param txOptions
   */
  public async deposit(
    mint: PublicKey | string,
    amount: number | BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositTx(
      new PublicKey(mint),
      amount,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Deposits SOL to vault
   *
   * @param lamports
   * @param wrap Whether to wrap SOL to wSOL or not
   * @param txOptions
   */
  public async depositSol(
    lamports: number | BN,
    wrap = true,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositSolTx(lamports, wrap, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Generates instructions to wrap SOL into wSOL if the vault doesn't have enough wSOL
   *
   * @param lamports Desired amount of wSOL
   * @returns Array of instructions, empty if wSOL is sufficient
   */
  public async maybeWrapSol(
    lamports: number | BN,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const glamSigner = signer || this.base.signer;
    const vaultWsolAta = this.base.getVaultAta(WSOL);
    let wsolBalance = new BN(0);
    try {
      const balance =
        await this.base.connection.getTokenAccountBalance(vaultWsolAta);
      wsolBalance = new BN(balance.value.amount);
    } catch {}
    const solBalance = new BN(
      await this.base.connection.getBalance(this.base.vaultPda),
    );
    const delta = new BN(lamports).sub(wsolBalance); // wSOL amount needed
    if (solBalance.lt(delta)) {
      throw new Error(
        "Insufficient lamports in vault to complete the transaction.",
      );
    }
    const shouldWrap = delta.gt(new BN(0)) && solBalance.gte(delta);
    return shouldWrap ? this.txBuilder.wrapIxs(delta, glamSigner) : [];
  }
}
