import { BN } from "@coral-xyz/anchor";
import {
  AccountMeta,
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "../base";
import { VaultClient } from "../vault";
import {
  JUPITER_LIQUIDITY_PROGRAM_ID,
  JUPITER_ORACLE_PROGRAM_ID,
  JUPITER_VAULTS_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  WSOL,
} from "../../constants";
import { JupiterBorrowPolicy } from "../../deser/integrationPolicies";
import { fetchMintAndTokenProgram } from "../../utils/accounts";
import { getIntegrationAuthorityPda } from "../../utils/glamPDAs";
import { getProgramAccounts } from "../../utils/rpc";
import {
  BORROW_OPERATE_EXPECTED_TICK_RE,
  BorrowOperateRemainingAccounts,
  JupiterPosition,
  JupiterTransferType,
  JupiterVault,
  LIQUIDITY_BORROW_POSITION_DISCRIMINATOR,
  LIQUIDITY_BORROW_POSITION_SIZE,
  LIQUIDITY_SUPPLY_POSITION_DISCRIMINATOR,
  LIQUIDITY_SUPPLY_POSITION_SIZE,
  MIN_TICK,
  PUBKEY_BYTES,
  VAULT_CONFIG_BORROW_TOKEN_OFFSET,
  VAULT_CONFIG_DISCRIMINATOR,
  VAULT_CONFIG_ORACLE_OFFSET,
  VAULT_CONFIG_SUPPLY_TOKEN_OFFSET,
  VAULT_STATE_VAULT_ID_OFFSET,
  buildBorrowOperateRemainingAccounts,
  decodePositionInfo,
  fetchLendingReserveAndVault,
  fetchLiquidityPosition,
  fetchPositionInfo,
  fetchTickByValue,
  fetchTickIdLiquidationByTick,
  fetchVaultConfigInfo,
  fetchVaultMetadataLookupTable,
  fetchVaultStateInfo,
  getBranchPda,
  getLiquidityPda,
  getPositionMintPda,
  getPositionPda,
  getRateModelPda,
  getTokenMetadataPda,
  getVaultAdminPda,
  getVaultConfigPda,
  getVaultMetadataPda,
  getVaultStatePda,
  memcmpFilter,
  POSITION_DISCRIMINATOR,
  POSITION_MINT_OFFSET,
  POSITION_VAULT_ID_OFFSET,
  resolveLookupTableAccounts,
  resolveOracleRemainingAccounts,
  toBn,
  toU8Buffer,
  u16LeBytes,
} from "./shared";

export type JupiterBorrowInitPositionAccounts = {
  vaultAdmin: PublicKey;
  vaultState: PublicKey;
  position: PublicKey;
  positionMint: PublicKey;
  positionTokenAccount: PublicKey;
  metadataAccount?: PublicKey;
  tokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  sysvarInstruction?: PublicKey;
  metadataProgram?: PublicKey;
};

export type JupiterBorrowOperateAccounts = {
  signerSupplyTokenAccount?: PublicKey;
  signerBorrowTokenAccount?: PublicKey;
  recipient?: PublicKey | null;
  recipientBorrowTokenAccount?: PublicKey | null;
  recipientSupplyTokenAccount?: PublicKey | null;
  vaultConfig: PublicKey;
  vaultState: PublicKey;
  supplyToken: PublicKey;
  borrowToken: PublicKey;
  oracle: PublicKey;
  position: PublicKey;
  positionTokenAccount: PublicKey;
  currentPositionTick: PublicKey;
  finalPositionTick: PublicKey;
  currentPositionTickId: PublicKey;
  finalPositionTickId: PublicKey;
  newBranch: PublicKey;
  supplyTokenReservesLiquidity: PublicKey;
  borrowTokenReservesLiquidity: PublicKey;
  vaultSupplyPositionOnLiquidity: PublicKey;
  vaultBorrowPositionOnLiquidity: PublicKey;
  supplyRateModel: PublicKey;
  borrowRateModel: PublicKey;
  vaultSupplyTokenAccount: PublicKey;
  vaultBorrowTokenAccount: PublicKey;
  supplyTokenClaimAccount?: PublicKey | null;
  borrowTokenClaimAccount?: PublicKey | null;
  liquidity: PublicKey;
  liquidityProgram?: PublicKey;
  oracleProgram?: PublicKey;
  supplyTokenProgram?: PublicKey;
  borrowTokenProgram?: PublicKey;
  associatedTokenProgram?: PublicKey;
  remainingAccounts?: AccountMeta[];
};

export type JupiterBorrowPosition = JupiterPosition & {
  positionTokenAccount: PublicKey;
  tokenAmount: string;
  tokenProgram: PublicKey;
};

type BorrowAction = "deposit" | "withdraw" | "borrow" | "repay";

type PositionTokenAccount = {
  pubkey: PublicKey;
  mint: PublicKey;
  amount: string;
  programId: PublicKey;
};

async function fetchVaultTokenAccounts(
  client: BaseClient,
): Promise<PositionTokenAccount[]> {
  const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  const accounts = await Promise.all(
    tokenPrograms.map(async (programId) => {
      const response = await client.connection.getTokenAccountsByOwner(
        client.vaultPda,
        { programId },
      );
      return response.value.map(({ pubkey, account }) => {
        const decoded = AccountLayout.decode(account.data);
        return {
          pubkey,
          mint: decoded.mint,
          amount: decoded.amount.toString(),
          programId,
        };
      });
    }),
  );
  return accounts.flat().filter((account) => account.amount !== "0");
}

export class JupiterBorrowTxBuilder extends BaseTxBuilder<JupiterBorrowClient> {
  async initPositionIx(
    vaultId: number,
    nextPositionId: number,
    accounts: JupiterBorrowInitPositionAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extJupiterProgram.methods
      .borrowInitPosition(vaultId, nextPositionId)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: JUPITER_VAULTS_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        vaultAdmin: accounts.vaultAdmin,
        vaultState: accounts.vaultState,
        position: accounts.position,
        positionMint: accounts.positionMint,
        positionTokenAccount: accounts.positionTokenAccount,
        metadataAccount:
          accounts.metadataAccount ||
          getTokenMetadataPda(accounts.positionMint),
        tokenProgram: accounts.tokenProgram || TOKEN_PROGRAM_ID,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
        sysvarInstruction:
          accounts.sysvarInstruction || SYSVAR_INSTRUCTIONS_PUBKEY,
        metadataProgram: accounts.metadataProgram || TOKEN_METADATA_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  async borrowInitPositionIx(
    vaultId: number,
    nextPositionId: number,
    accounts: JupiterBorrowInitPositionAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.initPositionIx(vaultId, nextPositionId, accounts, signer);
  }

  async initPositionTx(
    vaultId: number,
    nextPositionId: number,
    accounts: JupiterBorrowInitPositionAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.initPositionIx(
      vaultId,
      nextPositionId,
      accounts,
      txOptions.signer,
    );
    return await this.buildVersionedTx([ix], txOptions);
  }

  async borrowInitPositionTx(
    vaultId: number,
    nextPositionId: number,
    accounts: JupiterBorrowInitPositionAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.initPositionTx(
      vaultId,
      nextPositionId,
      accounts,
      txOptions,
    );
  }

  async operateIx(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const supplyTokenProgram = accounts.supplyTokenProgram || TOKEN_PROGRAM_ID;
    const borrowTokenProgram = accounts.borrowTokenProgram || TOKEN_PROGRAM_ID;
    const instruction = this.client.base.extJupiterProgram.methods
      .borrowOperate(
        toBn(newCol),
        toBn(newDebt),
        transferType,
        toU8Buffer(remainingAccountsIndices),
      )
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: signer || this.client.base.signer,
        integrationAuthority: this.client.getIntegrationAuthorityPda(),
        cpiProgram: JUPITER_VAULTS_PROGRAM_ID,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        signerSupplyTokenAccount:
          accounts.signerSupplyTokenAccount ||
          this.client.base.getVaultAta(
            accounts.supplyToken,
            supplyTokenProgram,
          ),
        signerBorrowTokenAccount:
          accounts.signerBorrowTokenAccount ||
          this.client.base.getVaultAta(
            accounts.borrowToken,
            borrowTokenProgram,
          ),
        recipient: accounts.recipient ?? null,
        recipientBorrowTokenAccount:
          accounts.recipientBorrowTokenAccount ?? null,
        recipientSupplyTokenAccount:
          accounts.recipientSupplyTokenAccount ?? null,
        vaultConfig: accounts.vaultConfig,
        vaultState: accounts.vaultState,
        supplyToken: accounts.supplyToken,
        borrowToken: accounts.borrowToken,
        oracle: accounts.oracle,
        position: accounts.position,
        positionTokenAccount: accounts.positionTokenAccount,
        currentPositionTick: accounts.currentPositionTick,
        finalPositionTick: accounts.finalPositionTick,
        currentPositionTickId: accounts.currentPositionTickId,
        finalPositionTickId: accounts.finalPositionTickId,
        newBranch: accounts.newBranch,
        supplyTokenReservesLiquidity: accounts.supplyTokenReservesLiquidity,
        borrowTokenReservesLiquidity: accounts.borrowTokenReservesLiquidity,
        vaultSupplyPositionOnLiquidity: accounts.vaultSupplyPositionOnLiquidity,
        vaultBorrowPositionOnLiquidity: accounts.vaultBorrowPositionOnLiquidity,
        supplyRateModel: accounts.supplyRateModel,
        borrowRateModel: accounts.borrowRateModel,
        vaultSupplyTokenAccount: accounts.vaultSupplyTokenAccount,
        vaultBorrowTokenAccount: accounts.vaultBorrowTokenAccount,
        supplyTokenClaimAccount: accounts.supplyTokenClaimAccount ?? null,
        borrowTokenClaimAccount: accounts.borrowTokenClaimAccount ?? null,
        liquidity: accounts.liquidity,
        liquidityProgram:
          accounts.liquidityProgram || JUPITER_LIQUIDITY_PROGRAM_ID,
        oracleProgram: accounts.oracleProgram || JUPITER_ORACLE_PROGRAM_ID,
        supplyTokenProgram,
        borrowTokenProgram,
        associatedTokenProgram:
          accounts.associatedTokenProgram || ASSOCIATED_TOKEN_PROGRAM_ID,
      });

    if (accounts.remainingAccounts?.length) {
      instruction.remainingAccounts(accounts.remainingAccounts);
    }

    return await instruction.instruction();
  }

  async borrowOperateIx(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.operateIx(
      newCol,
      newDebt,
      transferType,
      remainingAccountsIndices,
      accounts,
      signer,
    );
  }

  async operateTx(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const preInstructions: TransactionInstruction[] = [];
    const newColBn = toBn(newCol);
    if (accounts.supplyToken.equals(WSOL) && newColBn.gt(new BN(0))) {
      preInstructions.push(
        ...(await this.client.vault.maybeWrapSol(newColBn, signer)),
      );
    }
    const ix = await this.operateIx(
      newCol,
      newDebt,
      transferType,
      remainingAccountsIndices,
      accounts,
      signer,
    );
    return await this.buildVersionedTx([...preInstructions, ix], txOptions);
  }

  async borrowOperateTx(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.operateTx(
      newCol,
      newDebt,
      transferType,
      remainingAccountsIndices,
      accounts,
      txOptions,
    );
  }

  async setPolicyIx(
    policy: JupiterBorrowPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extJupiterProgram.methods
      .setBorrowPolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setBorrowPolicyIx(
    policy: JupiterBorrowPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.setPolicyIx(policy, signer);
  }

  async setPolicyTx(
    policy: JupiterBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async setBorrowPolicyTx(
    policy: JupiterBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.setPolicyTx(policy, txOptions);
  }
}

export class JupiterBorrowClient {
  readonly txBuilder: JupiterBorrowTxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly vault: VaultClient,
  ) {
    this.txBuilder = new JupiterBorrowTxBuilder(this);
  }

  getIntegrationAuthorityPda(): PublicKey {
    return getIntegrationAuthorityPda(this.base.extJupiterProgram.programId);
  }

  async getPosition(position: PublicKey): Promise<JupiterPosition> {
    return await fetchPositionInfo(this.base.connection, position);
  }

  async listPositions(vaultId?: number): Promise<JupiterBorrowPosition[]> {
    const tokenAccounts = await fetchVaultTokenAccounts(this.base);
    const tokenAccountByMint = new Map<string, PositionTokenAccount>();
    for (const tokenAccount of tokenAccounts) {
      tokenAccountByMint.set(tokenAccount.mint.toBase58(), tokenAccount);
    }

    const positions = await Promise.all(
      [...tokenAccountByMint.values()].map(async (tokenAccount) => {
        const filters = [
          memcmpFilter(0, POSITION_DISCRIMINATOR),
          memcmpFilter(POSITION_MINT_OFFSET, tokenAccount.mint.toBuffer()),
        ];
        if (vaultId !== undefined) {
          filters.push(
            memcmpFilter(POSITION_VAULT_ID_OFFSET, u16LeBytes(vaultId)),
          );
        }
        const accounts = await getProgramAccounts(
          this.base.connection,
          JUPITER_VAULTS_PROGRAM_ID,
          { filters },
        );
        return accounts.map(({ pubkey, account }) => ({
          ...decodePositionInfo(pubkey, account.data),
          positionTokenAccount: tokenAccount.pubkey,
          tokenAmount: tokenAccount.amount,
          tokenProgram: tokenAccount.programId,
        }));
      }),
    );

    return positions.flat().sort((a, b) => {
      if (a.vaultId !== b.vaultId) {
        return a.vaultId - b.vaultId;
      }
      return a.pubkey.toBase58().localeCompare(b.pubkey.toBase58());
    });
  }

  async getVault(vaultId: number): Promise<JupiterVault> {
    const vaultConfig = getVaultConfigPda(vaultId);
    const info = await fetchVaultConfigInfo(this.base.connection, vaultConfig);
    return {
      vaultId,
      vaultConfig,
      vaultState: getVaultStatePda(vaultId),
      oracle: info.oracle,
      supplyToken: info.supplyToken,
      borrowToken: info.borrowToken,
    };
  }

  async listVaults(): Promise<JupiterVault[]> {
    const accounts = await getProgramAccounts(
      this.base.connection,
      JUPITER_VAULTS_PROGRAM_ID,
      { filters: [memcmpFilter(0, VAULT_CONFIG_DISCRIMINATOR)] },
    );
    return accounts
      .map(({ pubkey, account }) => {
        const data = account.data;
        const vaultId = data.readUInt16LE(VAULT_STATE_VAULT_ID_OFFSET);
        return {
          vaultId,
          vaultConfig: pubkey,
          vaultState: getVaultStatePda(vaultId),
          oracle: new PublicKey(
            data.subarray(
              VAULT_CONFIG_ORACLE_OFFSET,
              VAULT_CONFIG_ORACLE_OFFSET + PUBKEY_BYTES,
            ),
          ),
          supplyToken: new PublicKey(
            data.subarray(
              VAULT_CONFIG_SUPPLY_TOKEN_OFFSET,
              VAULT_CONFIG_SUPPLY_TOKEN_OFFSET + PUBKEY_BYTES,
            ),
          ),
          borrowToken: new PublicKey(
            data.subarray(
              VAULT_CONFIG_BORROW_TOKEN_OFFSET,
              VAULT_CONFIG_BORROW_TOKEN_OFFSET + PUBKEY_BYTES,
            ),
          ),
        };
      })
      .sort((a, b) => a.vaultId - b.vaultId);
  }

  async initPosition(
    vaultId: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const vaultState = getVaultStatePda(vaultId);
    const { nextPositionId } = await fetchVaultStateInfo(
      this.base.connection,
      vaultState,
    );
    const position = getPositionPda(vaultId, nextPositionId);
    const positionMint = getPositionMintPda(vaultId, nextPositionId);
    const positionTokenAccount = getAssociatedTokenAddressSync(
      positionMint,
      this.base.vaultPda,
      true,
    );
    const tx = await this.txBuilder.initPositionTx(
      vaultId,
      nextPositionId,
      {
        vaultAdmin: getVaultAdminPda(),
        vaultState,
        position,
        positionMint,
        positionTokenAccount,
      },
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async borrowInitPosition(
    vaultId: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.initPosition(vaultId, txOptions);
  }

  async deposit(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.runBorrowOperate(
      "deposit",
      position,
      toBn(amount),
      txOptions,
    );
  }

  async borrowDeposit(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.deposit(position, amount, txOptions);
  }

  async withdraw(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.runBorrowOperate(
      "withdraw",
      position,
      toBn(amount),
      txOptions,
    );
  }

  async borrowWithdraw(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.withdraw(position, amount, txOptions);
  }

  async borrow(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.runBorrowOperate(
      "borrow",
      position,
      toBn(amount),
      txOptions,
    );
  }

  async borrowBorrow(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.borrow(position, amount, txOptions);
  }

  async repay(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.runBorrowOperate(
      "repay",
      position,
      toBn(amount),
      txOptions,
    );
  }

  async borrowRepay(
    position: PublicKey,
    amount: BN | bigint | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.repay(position, amount, txOptions);
  }

  async operate(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.operateTx(
      newCol,
      newDebt,
      transferType,
      remainingAccountsIndices,
      accounts,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async borrowOperate(
    newCol: BN | bigint | number,
    newDebt: BN | bigint | number,
    transferType: JupiterTransferType | null,
    remainingAccountsIndices: Buffer | Uint8Array | number[],
    accounts: JupiterBorrowOperateAccounts,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.operate(
      newCol,
      newDebt,
      transferType,
      remainingAccountsIndices,
      accounts,
      txOptions,
    );
  }

  async setPolicy(
    policy: JupiterBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async setBorrowPolicy(
    policy: JupiterBorrowPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    return await this.setPolicy(policy, txOptions);
  }

  private async simulateExpectedFinalTick(
    newCol: BN,
    newDebt: BN,
    transferType: JupiterTransferType | null,
    probeRemainingAccounts: BorrowOperateRemainingAccounts,
    accounts: JupiterBorrowOperateAccounts,
    lookupTable?: PublicKey,
  ): Promise<number | null> {
    const lookupTableAccounts = await resolveLookupTableAccounts(
      this.base.connection,
      this.base.statePda,
      this.base.vaultPda,
      lookupTable,
    );
    const ix = await this.txBuilder.operateIx(
      newCol,
      newDebt,
      transferType,
      probeRemainingAccounts.indices,
      { ...accounts, remainingAccounts: probeRemainingAccounts.accounts },
      this.base.signer,
    );
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: this.base.signer,
        recentBlockhash: PublicKey.default.toString(),
        instructions: [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
          ix,
        ],
      }).compileToV0Message(lookupTableAccounts),
    );
    const simulation = await this.base.connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });
    for (const log of simulation.value.logs ?? []) {
      const match = log.match(BORROW_OPERATE_EXPECTED_TICK_RE);
      if (match) {
        return Number(match[1]);
      }
    }
    return null;
  }

  private async runBorrowOperate(
    action: BorrowAction,
    position: PublicKey,
    amount: BN,
    txOptions: TxOptions,
  ): Promise<TransactionSignature> {
    if (amount.isNeg() || amount.isZero()) {
      throw new Error(
        `Jupiter Borrow ${action}: amount must be a positive BN, got ${amount.toString()}`,
      );
    }
    const connection = this.base.connection;
    const positionInfo = await fetchPositionInfo(connection, position);
    const vaultId = positionInfo.vaultId;
    const vaultState = getVaultStatePda(vaultId);
    const vaultStateInfo = await fetchVaultStateInfo(connection, vaultState);
    const vaultConfig = getVaultConfigPda(vaultId);
    const vaultMetadata = getVaultMetadataPda(vaultId);
    const vaultConfigInfo = await fetchVaultConfigInfo(connection, vaultConfig);
    const metadataLookupTable = await fetchVaultMetadataLookupTable(
      connection,
      vaultMetadata,
    );

    const supplyToken = vaultConfigInfo.supplyToken;
    const borrowToken = vaultConfigInfo.borrowToken;
    const supplyTokenProgram = (
      await fetchMintAndTokenProgram(connection, supplyToken)
    ).tokenProgram;
    const borrowTokenProgram = (
      await fetchMintAndTokenProgram(connection, borrowToken)
    ).tokenProgram;

    let newCol = new BN(0);
    let newDebt = new BN(0);
    switch (action) {
      case "deposit":
        newCol = amount;
        break;
      case "withdraw":
        newCol = amount.neg();
        break;
      case "borrow":
        newDebt = amount;
        break;
      case "repay":
        newDebt = amount.neg();
        break;
    }

    const positionTokenAccount = getAssociatedTokenAddressSync(
      positionInfo.positionMint,
      this.base.vaultPda,
      true,
    );
    const {
      reserve: supplyTokenReservesLiquidity,
      vault: vaultSupplyTokenAccount,
    } = await fetchLendingReserveAndVault(connection, supplyToken);
    const {
      reserve: borrowTokenReservesLiquidity,
      vault: vaultBorrowTokenAccount,
    } = await fetchLendingReserveAndVault(connection, borrowToken);

    const currentTickValue = positionInfo.isSupplyOnlyPosition
      ? MIN_TICK
      : positionInfo.tick;
    const currentTickInfo = await fetchTickByValue(
      connection,
      vaultId,
      currentTickValue,
    );
    const currentTickMap = positionInfo.isSupplyOnlyPosition
      ? 0
      : positionInfo.tickId;
    const currentPositionTickId = await fetchTickIdLiquidationByTick(
      connection,
      vaultId,
      currentTickInfo.tick,
      currentTickMap,
    );

    const newBranch = getBranchPda(vaultId, vaultStateInfo.currentBranchId);
    const vaultSupplyPositionOnLiquidity = await fetchLiquidityPosition(
      connection,
      LIQUIDITY_SUPPLY_POSITION_DISCRIMINATOR,
      LIQUIDITY_SUPPLY_POSITION_SIZE,
      vaultConfig,
      supplyToken,
      "supply",
    );
    const vaultBorrowPositionOnLiquidity = await fetchLiquidityPosition(
      connection,
      LIQUIDITY_BORROW_POSITION_DISCRIMINATOR,
      LIQUIDITY_BORROW_POSITION_SIZE,
      vaultConfig,
      borrowToken,
      "borrow",
    );

    const oracleAccounts = await resolveOracleRemainingAccounts(
      connection,
      vaultConfigInfo.oracle,
    );

    const transferType: JupiterTransferType = { direct: {} };

    let finalTickInfo = currentTickInfo;
    let finalPositionTickId = currentPositionTickId;

    const accounts: JupiterBorrowOperateAccounts = {
      vaultConfig,
      vaultState,
      supplyToken,
      borrowToken,
      oracle: vaultConfigInfo.oracle,
      position,
      positionTokenAccount,
      currentPositionTick: currentTickInfo.pubkey,
      finalPositionTick: finalTickInfo.pubkey,
      currentPositionTickId,
      finalPositionTickId,
      newBranch,
      supplyTokenReservesLiquidity,
      borrowTokenReservesLiquidity,
      vaultSupplyPositionOnLiquidity,
      vaultBorrowPositionOnLiquidity,
      supplyRateModel: getRateModelPda(supplyToken),
      borrowRateModel: getRateModelPda(borrowToken),
      vaultSupplyTokenAccount,
      vaultBorrowTokenAccount,
      supplyTokenClaimAccount: null,
      borrowTokenClaimAccount: null,
      liquidity: getLiquidityPda(),
      recipient: null,
      supplyTokenProgram,
      borrowTokenProgram,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };

    const probeRemainingAccounts = buildBorrowOperateRemainingAccounts(
      vaultId,
      oracleAccounts,
      currentTickInfo.tick,
      currentTickInfo.tick,
    );
    const expectedFinalTick = await this.simulateExpectedFinalTick(
      newCol,
      newDebt,
      transferType,
      probeRemainingAccounts,
      accounts,
      metadataLookupTable ?? undefined,
    );
    if (
      expectedFinalTick !== null &&
      expectedFinalTick !== finalTickInfo.tick
    ) {
      finalTickInfo = await fetchTickByValue(
        connection,
        vaultId,
        expectedFinalTick,
      );
      finalPositionTickId = await fetchTickIdLiquidationByTick(
        connection,
        vaultId,
        finalTickInfo.tick,
        finalTickInfo.totalIds,
      );
    }

    // Deposits into supply-only positions skip the oracle.
    const includeOracle =
      action !== "deposit" || !positionInfo.isSupplyOnlyPosition;
    const remainingAccounts = buildBorrowOperateRemainingAccounts(
      vaultId,
      includeOracle ? oracleAccounts : [],
      currentTickInfo.tick,
      finalTickInfo.tick,
    );

    const effectiveTxOptions = metadataLookupTable
      ? { ...txOptions, lookupTables: [metadataLookupTable] }
      : txOptions;

    return await this.operate(
      newCol,
      newDebt,
      transferType,
      remainingAccounts.indices,
      {
        ...accounts,
        finalPositionTick: finalTickInfo.pubkey,
        finalPositionTickId,
        remainingAccounts: remainingAccounts.accounts,
      },
      effectiveTxOptions,
    );
  }
}
