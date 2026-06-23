import { BN } from "@coral-xyz/anchor";
import {
  AccountMeta,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  BaseClient,
  BaseTxBuilder,
  ProtocolPolicyClient,
  ProtocolPolicyTxBuilder,
  TxOptions,
} from "./base";
import { MarginfiPolicy } from "../deser/integrationPolicies";
import {
  decodeMarginfiBalances,
  decodeMarginfiBank,
} from "../deser/marginfiLayouts";
import {
  KAMINO_FARM_PROGRAM,
  KAMINO_LENDING_PROGRAM,
  MARGINFI_PROGRAM_ID,
} from "../constants";
import { MARGINFI_PROTOCOL } from "../protocols";
import { Reserve } from "../deser/kaminoLayouts";
import { fetchMintAndTokenProgram } from "../utils/accounts";

function u16le(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function refreshKaminoReserveIx(accounts: {
  reserve: PublicKey;
  lendingMarket: PublicKey;
  scopePrices: PublicKey;
}): TransactionInstruction {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.reserve, isSigner: false, isWritable: true },
    { pubkey: accounts.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: KAMINO_LENDING_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: KAMINO_LENDING_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: KAMINO_LENDING_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: accounts.scopePrices, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId: KAMINO_LENDING_PROGRAM,
    data: Buffer.from([2, 218, 138, 235, 79, 201, 25, 102]),
  });
}

function refreshKaminoObligationIx(accounts: {
  lendingMarket: PublicKey;
  obligation: PublicKey;
  reserves: PublicKey[];
}): TransactionInstruction {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.lendingMarket, isSigner: false, isWritable: false },
    { pubkey: accounts.obligation, isSigner: false, isWritable: true },
    ...accounts.reserves.map((reserve) => ({
      pubkey: reserve,
      isSigner: false,
      isWritable: false,
    })),
  ];
  return new TransactionInstruction({
    keys,
    programId: KAMINO_LENDING_PROGRAM,
    data: Buffer.from([33, 132, 147, 228, 151, 192, 72, 89]),
  });
}

function pulseMarginfiBankPriceCacheIx(accounts: {
  group: PublicKey;
  bank: PublicKey;
  oracleKeys: PublicKey[];
}): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: accounts.group, isSigner: false, isWritable: false },
      { pubkey: accounts.bank, isSigner: false, isWritable: true },
      ...accounts.oracleKeys.map((oracleKey) => ({
        pubkey: oracleKey,
        isSigner: false,
        isWritable: false,
      })),
    ],
    programId: MARGINFI_PROGRAM_ID,
    data: Buffer.from([192, 19, 201, 135, 105, 203, 32, 222]),
  });
}

function pulseMarginfiAccountHealthIx(accounts: {
  marginfiAccount: PublicKey;
  remainingAccounts: AccountMeta[];
}): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: accounts.marginfiAccount, isSigner: false, isWritable: true },
      ...accounts.remainingAccounts,
    ],
    programId: MARGINFI_PROGRAM_ID,
    data: Buffer.from([186, 52, 117, 97, 34, 74, 39, 253]),
  });
}

export type MarginfiBaseAccounts = {
  group: PublicKey;
  marginfiAccount: PublicKey;
  bank: PublicKey;
  liquidityVault: PublicKey;
  tokenProgram?: PublicKey;
};

export type MarginfiDepositAccounts = MarginfiBaseAccounts & {
  sourceTokenAccount: PublicKey;
};

export type MarginfiWithdrawAccounts = MarginfiBaseAccounts & {
  destinationTokenAccount: PublicKey;
  bankLiquidityVaultAuthority: PublicKey;
};

export type KaminoCollateralAccounts = {
  group: PublicKey;
  marginfiAccount: PublicKey;
  bank: PublicKey;
  tokenAccount: PublicKey;
  liquidityVaultAuthority: PublicKey;
  liquidityVault: PublicKey;
  integrationAcc1: PublicKey;
  integrationAcc2: PublicKey;
  lendingMarket: PublicKey;
  lendingMarketAuthority: PublicKey;
  mint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  reserveDestinationDepositCollateral?: PublicKey;
  reserveSourceCollateral?: PublicKey;
  obligationFarmUserState?: PublicKey | null;
  reserveFarmState?: PublicKey | null;
  kaminoProgram: PublicKey;
  farmsProgram: PublicKey;
  collateralTokenProgram?: PublicKey;
  liquidityTokenProgram?: PublicKey;
};

export type MarginfiBank = {
  address: PublicKey;
  group: PublicKey;
  mint: PublicKey;
  liquidityVault: PublicKey;
  liquidityVaultAuthority: PublicKey;
  integrationAcc1: PublicKey;
  integrationAcc2: PublicKey;
  oracleKeys: PublicKey[];
};

class TxBuilder
  extends BaseTxBuilder<MarginfiClient>
  implements ProtocolPolicyTxBuilder<MarginfiPolicy>
{
  private commonAccounts(glamSigner: PublicKey) {
    return {
      glamState: this.client.base.statePda,
      glamSigner,
      cpiProgram: MARGINFI_PROGRAM_ID,
      glamProtocolProgram: this.client.base.protocolProgram.programId,
      systemProgram: SystemProgram.programId,
    };
  }

  async initializeAccountPdaIx(
    marginfiGroup: PublicKey,
    marginfiAccount: PublicKey,
    accountIndex: number,
    thirdPartyId?: number | null,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .marginfiAccountInitializePda(accountIndex, thirdPartyId ?? null)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        marginfiGroup,
        marginfiAccount,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
  }

  async closeAccountIx(
    marginfiAccount: PublicKey,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .marginfiAccountClose()
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        marginfiAccount,
      })
      .instruction();
  }

  async depositIx(
    accounts: MarginfiDepositAccounts,
    amount: BN,
    depositUpToLimit?: boolean | null,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .lendingAccountDeposit(amount, depositUpToLimit ?? null)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        signerTokenAccount: accounts.sourceTokenAccount,
        liquidityVault: accounts.liquidityVault,
        tokenProgram: accounts.tokenProgram ?? TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async withdrawIx(
    accounts: MarginfiWithdrawAccounts,
    amount: BN,
    withdrawAll?: boolean | null,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .lendingAccountWithdraw(amount, withdrawAll ?? null)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        destinationTokenAccount: accounts.destinationTokenAccount,
        bankLiquidityVaultAuthority: accounts.bankLiquidityVaultAuthority,
        liquidityVault: accounts.liquidityVault,
        tokenProgram: accounts.tokenProgram ?? TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async borrowIx(
    accounts: MarginfiWithdrawAccounts,
    amount: BN,
    signer?: PublicKey,
    remainingAccounts: AccountMeta[] = [],
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .lendingAccountBorrow(amount)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        destinationTokenAccount: accounts.destinationTokenAccount,
        bankLiquidityVaultAuthority: accounts.bankLiquidityVaultAuthority,
        liquidityVault: accounts.liquidityVault,
        tokenProgram: accounts.tokenProgram ?? TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  async repayIx(
    accounts: MarginfiDepositAccounts,
    amount: BN,
    repayAll?: boolean | null,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .lendingAccountRepay(amount, repayAll ?? null)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        signerTokenAccount: accounts.sourceTokenAccount,
        liquidityVault: accounts.liquidityVault,
        tokenProgram: accounts.tokenProgram ?? TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  async kaminoDepositIx(
    accounts: KaminoCollateralAccounts,
    amount: BN,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .kaminoDeposit(amount)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        signerTokenAccount: accounts.tokenAccount,
        liquidityVaultAuthority: accounts.liquidityVaultAuthority,
        liquidityVault: accounts.liquidityVault,
        integrationAcc2: accounts.integrationAcc2,
        lendingMarket: accounts.lendingMarket,
        lendingMarketAuthority: accounts.lendingMarketAuthority,
        integrationAcc1: accounts.integrationAcc1,
        mint: accounts.mint,
        reserveLiquiditySupply: accounts.reserveLiquiditySupply,
        reserveCollateralMint: accounts.reserveCollateralMint,
        reserveDestinationDepositCollateral:
          accounts.reserveDestinationDepositCollateral,
        obligationFarmUserState: accounts.obligationFarmUserState ?? null,
        reserveFarmState: accounts.reserveFarmState ?? null,
        kaminoProgram: accounts.kaminoProgram,
        farmsProgram: accounts.farmsProgram,
        collateralTokenProgram:
          accounts.collateralTokenProgram ?? TOKEN_PROGRAM_ID,
        liquidityTokenProgram:
          accounts.liquidityTokenProgram ?? TOKEN_PROGRAM_ID,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
  }

  async kaminoWithdrawIx(
    accounts: KaminoCollateralAccounts,
    amount: BN,
    withdrawAll?: boolean | null,
    signer?: PublicKey,
    remainingAccounts: AccountMeta[] = [],
  ): Promise<TransactionInstruction> {
    const glamSigner = signer || this.client.base.signer;
    return await this.client.base.extMarginfiProgram.methods
      .kaminoWithdraw(amount, withdrawAll ?? null)
      .accountsPartial({
        ...this.commonAccounts(glamSigner),
        group: accounts.group,
        marginfiAccount: accounts.marginfiAccount,
        bank: accounts.bank,
        destinationTokenAccount: accounts.tokenAccount,
        liquidityVaultAuthority: accounts.liquidityVaultAuthority,
        liquidityVault: accounts.liquidityVault,
        integrationAcc2: accounts.integrationAcc2,
        lendingMarket: accounts.lendingMarket,
        lendingMarketAuthority: accounts.lendingMarketAuthority,
        integrationAcc1: accounts.integrationAcc1,
        mint: accounts.mint,
        reserveLiquiditySupply: accounts.reserveLiquiditySupply,
        reserveCollateralMint: accounts.reserveCollateralMint,
        reserveSourceCollateral: accounts.reserveSourceCollateral,
        obligationFarmUserState: accounts.obligationFarmUserState ?? null,
        reserveFarmState: accounts.reserveFarmState ?? null,
        kaminoProgram: accounts.kaminoProgram,
        farmsProgram: accounts.farmsProgram,
        collateralTokenProgram:
          accounts.collateralTokenProgram ?? TOKEN_PROGRAM_ID,
        liquidityTokenProgram:
          accounts.liquidityTokenProgram ?? TOKEN_PROGRAM_ID,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
  }

  async setPolicyIx(
    policy: MarginfiPolicy,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extMarginfiProgram.methods
      .setMarginfiPolicy(policy)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async setPolicyTx(
    policy: MarginfiPolicy,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.setPolicyIx(policy, txOptions.signer);
    return await this.buildVersionedTx([ix], txOptions);
  }

  async clearPolicyIx(signer?: PublicKey): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.base.extMarginfiProgram.programId,
      MARGINFI_PROTOCOL,
      signer,
    );
  }

  async clearPolicyTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    return await this.clearProtocolPolicyTx(
      this.client.base.extMarginfiProgram.programId,
      MARGINFI_PROTOCOL,
      txOptions,
    );
  }
}

export class MarginfiClient implements ProtocolPolicyClient<MarginfiPolicy> {
  readonly txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  async fetchPolicy(): Promise<MarginfiPolicy | null> {
    return await this.base.fetchProtocolPolicy(
      this.base.extMarginfiProgram.programId,
      MARGINFI_PROTOCOL,
      MarginfiPolicy,
    );
  }

  async setPolicy(
    policy: MarginfiPolicy,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.setPolicyTx(policy, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearPolicy(txOptions: TxOptions = {}): Promise<TransactionSignature> {
    const tx = await this.txBuilder.clearPolicyTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  getAccountPda(
    group: PublicKey,
    accountIndex = 0,
    thirdPartyId: number | null = null,
    authority = this.base.vaultPda,
  ): PublicKey {
    const [account] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("marginfi_account"),
        group.toBuffer(),
        authority.toBuffer(),
        u16le(accountIndex),
        u16le(thirdPartyId ?? 0),
      ],
      MARGINFI_PROGRAM_ID,
    );
    return account;
  }

  getLiquidityVaultAuthority(bank: PublicKey): PublicKey {
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_vault_auth"), bank.toBuffer()],
      MARGINFI_PROGRAM_ID,
    );
    return authority;
  }

  getKaminoMarketAuthority(market: PublicKey): PublicKey {
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from("lma"), market.toBuffer()],
      KAMINO_LENDING_PROGRAM,
    );
    return authority;
  }

  getKaminoFarmUserState(farmUser: PublicKey, farm: PublicKey): PublicKey {
    const [farmUserState] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), farm.toBuffer(), farmUser.toBuffer()],
      KAMINO_FARM_PROGRAM,
    );
    return farmUserState;
  }

  async fetchBank(bank: PublicKey | string): Promise<MarginfiBank> {
    const address = new PublicKey(bank);
    const account = await this.base.connection.getAccountInfo(address);
    if (!account) {
      throw new Error(`Marginfi bank not found: ${address}`);
    }
    if (!account.owner.equals(MARGINFI_PROGRAM_ID)) {
      throw new Error(
        `Marginfi bank ${address} is owned by ${account.owner}, expected ${MARGINFI_PROGRAM_ID}`,
      );
    }

    const decoded = decodeMarginfiBank(account.data);

    return {
      address,
      group: decoded.group,
      mint: decoded.mint,
      liquidityVault: decoded.liquidityVault,
      liquidityVaultAuthority: this.getLiquidityVaultAuthority(address),
      integrationAcc1: decoded.integrationAcc1,
      integrationAcc2: decoded.integrationAcc2,
      oracleKeys: decoded.oracleKeys.filter(
        (oracleKey) => !oracleKey.equals(SystemProgram.programId),
      ),
    };
  }

  async getHealthRemainingAccounts(
    marginfiAccount: PublicKey | string,
    targetBank?: PublicKey | string,
  ): Promise<AccountMeta[]> {
    const banks = await this.getHealthBanks(marginfiAccount, targetBank);
    return this.buildHealthRemainingAccounts(banks);
  }

  async getHealthBanks(
    marginfiAccount: PublicKey | string,
    targetBank?: PublicKey | string,
  ): Promise<MarginfiBank[]> {
    const account = await this.base.connection.getAccountInfo(
      new PublicKey(marginfiAccount),
    );
    if (!account) {
      throw new Error(`Marginfi account not found: ${marginfiAccount}`);
    }
    if (!account.owner.equals(MARGINFI_PROGRAM_ID)) {
      throw new Error(
        `Marginfi account ${marginfiAccount} is owned by ${account.owner}, expected ${MARGINFI_PROGRAM_ID}`,
      );
    }

    const activeBanks = decodeMarginfiBalances(account.data)
      .filter((balance) => balance.active !== 0)
      .map((balance) => balance.bank)
      .filter((bank) => !bank.equals(SystemProgram.programId));
    const healthBanks = [
      ...activeBanks,
      ...(targetBank ? [new PublicKey(targetBank)] : []),
    ]
      .filter(
        (bank, index, banks) =>
          banks.findIndex((candidate) => candidate.equals(bank)) === index,
      )
      .sort((a, b) => Buffer.compare(b.toBuffer(), a.toBuffer()));

    return await Promise.all(
      healthBanks.map((activeBank) => this.fetchBank(activeBank)),
    );
  }

  buildHealthRemainingAccounts(banks: MarginfiBank[]): AccountMeta[] {
    return banks.flatMap((bank) => [
      { pubkey: bank.address, isSigner: false, isWritable: true },
      ...bank.oracleKeys.map((oracleKey) => ({
        pubkey: oracleKey,
        isSigner: false,
        isWritable: false,
      })),
    ]);
  }

  async pulseHealthIx(
    marginfiAccount: PublicKey | string,
  ): Promise<{ ixs: TransactionInstruction[]; banks: MarginfiBank[] }> {
    const account = new PublicKey(marginfiAccount);
    const banks = await this.getHealthBanks(account);
    const ixs = [
      ...(await this.getBankRefreshInstructions(banks)),
      pulseMarginfiAccountHealthIx({
        marginfiAccount: account,
        remainingAccounts: this.buildHealthRemainingAccounts(banks),
      }),
    ];
    return { ixs, banks };
  }

  async getBankRefreshInstructions(
    banks: MarginfiBank[],
  ): Promise<TransactionInstruction[]> {
    const integrationAccounts =
      await this.base.connection.getMultipleAccountsInfo(
        banks.map((bank) => bank.integrationAcc1),
      );
    const instructions: TransactionInstruction[] = [];

    for (const [index, bank] of banks.entries()) {
      const integrationAccount = integrationAccounts[index];
      if (
        integrationAccount &&
        integrationAccount.owner.equals(KAMINO_LENDING_PROGRAM) &&
        !bank.integrationAcc2.equals(SystemProgram.programId)
      ) {
        const reserve = Reserve.decode(
          bank.integrationAcc1,
          integrationAccount.data,
        );
        instructions.push(
          refreshKaminoReserveIx({
            reserve: bank.integrationAcc1,
            lendingMarket: reserve.lendingMarket,
            scopePrices: reserve.scopePriceFeed,
          }),
          refreshKaminoObligationIx({
            lendingMarket: reserve.lendingMarket,
            obligation: bank.integrationAcc2,
            reserves: [bank.integrationAcc1],
          }),
        );
      }

      instructions.push(
        pulseMarginfiBankPriceCacheIx({
          group: bank.group,
          bank: bank.address,
          oracleKeys: bank.oracleKeys,
        }),
      );
    }

    return instructions;
  }

  async resolveKaminoCollateralAccounts(
    bank: PublicKey | string,
    marginfiAccount: PublicKey | string,
  ): Promise<KaminoCollateralAccounts> {
    const parsedBank = await this.fetchBank(bank);
    const reserveAccount = await this.base.connection.getAccountInfo(
      parsedBank.integrationAcc1,
    );
    if (!reserveAccount) {
      throw new Error(
        `Kamino reserve not found: ${parsedBank.integrationAcc1}`,
      );
    }
    if (!reserveAccount.owner.equals(KAMINO_LENDING_PROGRAM)) {
      throw new Error(
        `Kamino reserve ${parsedBank.integrationAcc1} is owned by ${reserveAccount.owner}, expected ${KAMINO_LENDING_PROGRAM}`,
      );
    }

    const reserve = Reserve.decode(
      parsedBank.integrationAcc1,
      reserveAccount.data,
    );
    const obligationAccount = await this.base.connection.getAccountInfo(
      parsedBank.integrationAcc2,
    );
    if (!obligationAccount) {
      throw new Error(
        `Marginfi bank Kamino obligation ${parsedBank.integrationAcc2} is not initialized`,
      );
    }
    const obligationFarmUserState = reserve.farmCollateralNullable
      ? this.getKaminoFarmUserState(
          parsedBank.integrationAcc2,
          reserve.farmCollateralNullable,
        )
      : null;

    return {
      group: parsedBank.group,
      marginfiAccount: new PublicKey(marginfiAccount),
      bank: parsedBank.address,
      tokenAccount: this.base.getVaultAta(
        parsedBank.mint,
        reserve.liquidity.tokenProgram,
      ),
      liquidityVaultAuthority: parsedBank.liquidityVaultAuthority,
      liquidityVault: parsedBank.liquidityVault,
      integrationAcc1: parsedBank.integrationAcc1,
      integrationAcc2: parsedBank.integrationAcc2,
      lendingMarket: reserve.lendingMarket,
      lendingMarketAuthority: this.getKaminoMarketAuthority(
        reserve.lendingMarket,
      ),
      mint: reserve.liquidity.mintPubkey,
      reserveLiquiditySupply: reserve.liquidity.supplyVault,
      reserveCollateralMint: reserve.collateral.mintPubkey,
      reserveDestinationDepositCollateral: reserve.collateral.supplyVault,
      reserveSourceCollateral: reserve.collateral.supplyVault,
      obligationFarmUserState,
      reserveFarmState: reserve.farmCollateralNullable,
      kaminoProgram: KAMINO_LENDING_PROGRAM,
      farmsProgram: KAMINO_FARM_PROGRAM,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: reserve.liquidity.tokenProgram,
    };
  }

  private async resolveKaminoReserveScopePrices(
    reserve: PublicKey,
  ): Promise<PublicKey> {
    const reserveAccount = await this.base.connection.getAccountInfo(reserve);
    if (!reserveAccount) {
      throw new Error(`Kamino reserve not found: ${reserve}`);
    }
    return Reserve.decode(reserve, reserveAccount.data).scopePriceFeed;
  }

  async resolveBorrowAccounts(
    bank: PublicKey | string,
    marginfiAccount: PublicKey | string,
  ): Promise<MarginfiWithdrawAccounts> {
    const parsedBank = await this.fetchBank(bank);
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      parsedBank.mint,
    );
    return {
      group: parsedBank.group,
      marginfiAccount: new PublicKey(marginfiAccount),
      bank: parsedBank.address,
      destinationTokenAccount: this.base.getVaultAta(
        parsedBank.mint,
        tokenProgram,
      ),
      bankLiquidityVaultAuthority: parsedBank.liquidityVaultAuthority,
      liquidityVault: parsedBank.liquidityVault,
      tokenProgram,
    };
  }

  async resolveRepayAccounts(
    bank: PublicKey | string,
    marginfiAccount: PublicKey | string,
  ): Promise<MarginfiDepositAccounts> {
    const parsedBank = await this.fetchBank(bank);
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      parsedBank.mint,
    );
    return {
      group: parsedBank.group,
      marginfiAccount: new PublicKey(marginfiAccount),
      bank: parsedBank.address,
      sourceTokenAccount: this.base.getVaultAta(parsedBank.mint, tokenProgram),
      liquidityVault: parsedBank.liquidityVault,
      tokenProgram,
    };
  }

  async initializeAccountPda(
    group: PublicKey | string,
    marginfiAccount: PublicKey | string,
    accountIndex: number,
    thirdPartyId?: number | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.initializeAccountPdaIx(
      new PublicKey(group),
      new PublicKey(marginfiAccount),
      accountIndex,
      thirdPartyId,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async closeAccount(
    marginfiAccount: PublicKey | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.closeAccountIx(
      new PublicKey(marginfiAccount),
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async deposit(
    accounts: MarginfiDepositAccounts,
    amount: BN | number | string,
    depositUpToLimit?: boolean | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.depositIx(
      accounts,
      new BN(amount),
      depositUpToLimit,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async withdraw(
    accounts: MarginfiWithdrawAccounts,
    amount: BN | number | string,
    withdrawAll?: boolean | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.withdrawIx(
      accounts,
      new BN(amount),
      withdrawAll,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async borrow(
    accounts: MarginfiWithdrawAccounts,
    amount: BN | number | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const borrowBank = await this.fetchBank(accounts.bank);
    const healthBanks = await this.getHealthBanks(
      accounts.marginfiAccount,
      accounts.bank,
    );
    const preInstructions = [
      ...(txOptions.preInstructions ?? []),
      ...(await this.getBankRefreshInstructions(healthBanks)),
      createAssociatedTokenAccountIdempotentInstruction(
        txOptions.signer ?? this.base.signer,
        accounts.destinationTokenAccount,
        this.base.vaultPda,
        borrowBank.mint,
        accounts.tokenProgram ?? TOKEN_PROGRAM_ID,
      ),
    ];
    const ix = await this.txBuilder.borrowIx(
      accounts,
      new BN(amount),
      txOptions.signer,
      this.buildHealthRemainingAccounts(healthBanks),
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], {
      ...txOptions,
      preInstructions,
    });
    return await this.base.sendAndConfirm(tx);
  }

  async repay(
    accounts: MarginfiDepositAccounts,
    amount: BN | number | string,
    repayAll?: boolean | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.repayIx(
      accounts,
      new BN(amount),
      repayAll,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async kaminoDeposit(
    accounts: KaminoCollateralAccounts,
    amount: BN | number | string,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const preInstructions = [
      ...(txOptions.preInstructions ?? []),
      refreshKaminoReserveIx({
        reserve: accounts.integrationAcc1,
        lendingMarket: accounts.lendingMarket,
        scopePrices: await this.resolveKaminoReserveScopePrices(
          accounts.integrationAcc1,
        ),
      }),
      refreshKaminoObligationIx({
        lendingMarket: accounts.lendingMarket,
        obligation: accounts.integrationAcc2,
        reserves: [accounts.integrationAcc1],
      }),
    ];
    const ix = await this.txBuilder.kaminoDepositIx(
      accounts,
      new BN(amount),
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], {
      ...txOptions,
      preInstructions,
    });
    return await this.base.sendAndConfirm(tx);
  }

  async kaminoWithdraw(
    accounts: KaminoCollateralAccounts,
    amount: BN | number | string,
    withdrawAll?: boolean | null,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const healthBanks = await this.getHealthBanks(
      accounts.marginfiAccount,
      accounts.bank,
    );
    const preInstructions = [
      ...(txOptions.preInstructions ?? []),
      ...(await this.getBankRefreshInstructions(healthBanks)),
    ];
    const ix = await this.txBuilder.kaminoWithdrawIx(
      accounts,
      new BN(amount),
      withdrawAll,
      txOptions.signer,
      this.buildHealthRemainingAccounts(healthBanks),
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], {
      ...txOptions,
      preInstructions,
    });
    return await this.base.sendAndConfirm(tx);
  }
}
