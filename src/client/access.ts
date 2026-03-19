import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { EmergencyAccessUpdateArgs } from "../models";
import { fetchMintAndTokenProgram } from "../utils/accounts";

class TxBuilder extends BaseTxBuilder<AccessClient> {
  async emergencyAccessUpdateIx(
    args: Partial<EmergencyAccessUpdateArgs>,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .emergencyAccessUpdate(new EmergencyAccessUpdateArgs(args))
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
      })
      .instruction();
  }

  async emergencyAccessUpdateTx(
    args: Partial<EmergencyAccessUpdateArgs>,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.emergencyAccessUpdateIx(args, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async enableDisableProtocolsIx(
    integrationProgram: PublicKey,
    protocolBitmask: number,
    setEnabled: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .enableDisableProtocols(integrationProgram, protocolBitmask, setEnabled)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
  }

  async enableDisableProtocolsTx(
    integrationProgram: PublicKey,
    protocolBitmask: number,
    setEnabled: boolean,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.enableDisableProtocolsIx(
      integrationProgram,
      protocolBitmask,
      setEnabled,
      glamSigner,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async grantRevokeDelegatePermissionsIx(
    delegate: PublicKey,
    integrationProgram: PublicKey,
    protocolBitflag: number,
    permissionsBitmask: BN,
    setGranted: boolean,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .grantRevokeDelegatePermissions(
        delegate,
        integrationProgram,
        protocolBitflag,
        permissionsBitmask,
        setGranted,
      )
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
      })
      .instruction();
  }

  async grantRevokeDelegatePermissionsTx(
    delegate: PublicKey,
    integrationProgram: PublicKey,
    protocolBitflag: number,
    permissionsBitmask: BN,
    setGranted: boolean,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.grantRevokeDelegatePermissionsIx(
      delegate,
      integrationProgram,
      protocolBitflag,
      permissionsBitmask,
      setGranted,
      glamSigner,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async addAssetsIx(
    assets: PublicKey[],
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await (this.client.base.protocolProgram.methods as any)
      .addAssets()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .remainingAccounts(
        assets.map((mint) => ({
          pubkey: mint,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();
  }

  async addAssetsTx(
    assets: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.addAssetsIx(assets, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async deleteAssetsIx(
    assets: PublicKey[],
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    const vault = this.client.base.vaultPda;
    const connection = this.client.base.provider.connection;

    const mintAccounts = assets.map((mint) => ({
      pubkey: mint,
      isSigner: false,
      isWritable: false,
    }));

    const ataAccounts = await Promise.all(
      assets.map(async (mint) => {
        let tokenProgram: PublicKey;
        try {
          ({ tokenProgram } = await fetchMintAndTokenProgram(connection, mint));
        } catch {
          tokenProgram = TOKEN_PROGRAM_ID;
        }
        const ata = getAssociatedTokenAddressSync(
          mint,
          vault,
          true,
          tokenProgram,
        );
        return {
          pubkey: ata,
          isSigner: false,
          isWritable: false,
        };
      }),
    );

    return await (this.client.base.protocolProgram.methods as any)
      .deleteAssets()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .remainingAccounts([...mintAccounts, ...ataAccounts])
      .instruction();
  }

  async deleteAssetsTx(
    assets: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.deleteAssetsIx(assets, glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async setProtocolPolicyIx(
    integrationProgram: PublicKey,
    protocolBitflag: number,
    data: Buffer,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.protocolProgram.methods
      .setProtocolPolicy(integrationProgram, protocolBitflag, data)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
  }

  async setProtocolPolicyTx(
    integrationProgram: PublicKey,
    protocolBitflag: number,
    data: Buffer,
    txOptions: TxOptions,
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.client.base.protocolProgram.methods
      .setProtocolPolicy(integrationProgram, protocolBitflag, data)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
      })
      .instruction();
    return await this.buildVersionedTx([ix], txOptions);
  }
}

export class AccessClient {
  txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Add assets to the vault allowlist
   */
  public async addAssets(
    assets: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.addAssetsTx(assets, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Delete assets from the vault allowlist.
   * Assets must have zero vault balance (ATA empty or non-existent).
   */
  public async deleteAssets(
    assets: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.deleteAssetsTx(assets, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Emergency access update - bypasses timelock for critical access control changes
   */
  public async emergencyAccessUpdate(
    args: Partial<EmergencyAccessUpdateArgs>,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.emergencyAccessUpdateTx(args, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Enable protocols for an integration program
   */
  public async enableProtocols(
    integrationProgram: PublicKey,
    protocolBitmask: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.enableDisableProtocolsTx(
      integrationProgram,
      protocolBitmask,
      true,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Disable protocols for an integration program
   */
  public async disableProtocols(
    integrationProgram: PublicKey,
    protocolBitmask: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.enableDisableProtocolsTx(
      integrationProgram,
      protocolBitmask,
      false,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Grant delegate permissions for a specific protocol
   */
  public async grantDelegatePermissions(
    delegate: PublicKey,
    integrationProgram: PublicKey,
    protocolBitflag: number,
    permissionsBitmask: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.grantRevokeDelegatePermissionsTx(
      delegate,
      integrationProgram,
      protocolBitflag,
      permissionsBitmask,
      true,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Revoke delegate permissions for a specific protocol
   */
  public async revokeDelegatePermissions(
    delegate: PublicKey,
    integrationProgram: PublicKey,
    protocolBitflag: number,
    permissionsBitmask: BN,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.grantRevokeDelegatePermissionsTx(
      delegate,
      integrationProgram,
      protocolBitflag,
      permissionsBitmask,
      false,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  /**
   * Set protocol policy data for an integration
   */
  public async setProtocolPolicy(
    integrationProgram: PublicKey,
    protocolBitflag: number,
    data: Buffer,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vTx = await this.txBuilder.setProtocolPolicyTx(
      integrationProgram,
      protocolBitflag,
      data,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }
}
