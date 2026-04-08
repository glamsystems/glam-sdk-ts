import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  TransactionInstruction,
  AccountMeta,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "../base";
import * as borsh from "@coral-xyz/borsh";
import { fetchMintAndTokenProgram } from "../../utils/accounts";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  KAMINO_FARM_PROGRAM,
  KAMINO_LENDING_PROGRAM,
  KAMINO_OBTRIGATION_SIZE,
  KAMINO_RESERVE_SIZE,
  WSOL,
} from "../../constants";
import { Reserve, Obligation } from "../../deser/kaminoLayouts";
import { VaultClient } from "../vault";
import { PkSet, PkMap, getProgramAccounts } from "../../utils";
import {
  DEFAULT_OBLIGATION_ARGS,
  RefreshObligationAccounts,
  RefreshReserveAccounts,
  RefreshObligationFarmsForReserveArgs,
  RefreshObligationFarmsForReserveAccounts,
} from "./types";

class TxBuilder extends BaseTxBuilder<KaminoLendingClient> {
  refreshObligationIx(accounts: RefreshObligationAccounts) {
    const keys: Array<AccountMeta> = [
      { pubkey: accounts.lendingMarket, isSigner: false, isWritable: false },
      { pubkey: accounts.obligation, isSigner: false, isWritable: true },
    ];
    accounts.reserves.forEach((reserve) => {
      keys.push({ pubkey: reserve, isSigner: false, isWritable: false });
    });

    const identifier = Buffer.from([33, 132, 147, 228, 151, 192, 72, 89]);
    const data = identifier;
    return new TransactionInstruction({
      keys,
      programId: KAMINO_LENDING_PROGRAM,
      data,
    });
  }

  refreshReserveIx(accounts: RefreshReserveAccounts) {
    const keys: Array<AccountMeta> = [
      { pubkey: accounts.reserve, isSigner: false, isWritable: true },
      { pubkey: accounts.lendingMarket, isSigner: false, isWritable: false },
      { pubkey: accounts.pythOracle, isSigner: false, isWritable: false },
      {
        pubkey: accounts.switchboardPriceOracle,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: accounts.switchboardTwapOracle,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: accounts.scopePrices, isSigner: false, isWritable: false },
    ];
    const identifier = Buffer.from([2, 218, 138, 235, 79, 201, 25, 102]);
    const data = identifier;
    return new TransactionInstruction({
      keys,
      programId: KAMINO_LENDING_PROGRAM,
      data,
    });
  }

  refreshObligationFarmsForReserveIx(
    args: RefreshObligationFarmsForReserveArgs,
    accounts: RefreshObligationFarmsForReserveAccounts,
  ) {
    const keys: Array<AccountMeta> = [
      { pubkey: accounts.crank, isSigner: true, isWritable: false },
      {
        pubkey: accounts.baseAccounts.obligation,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: accounts.baseAccounts.lendingMarketAuthority,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: accounts.baseAccounts.reserve,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: accounts.baseAccounts.reserveFarmState,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: accounts.baseAccounts.obligationFarmUserState,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: accounts.baseAccounts.lendingMarket,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: accounts.farmsProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.rent, isSigner: false, isWritable: false },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ];
    const identifier = Buffer.from([140, 144, 253, 21, 10, 74, 248, 3]);
    const buffer = Buffer.alloc(1000);
    const layout = borsh.struct([borsh.u8("mode")]);
    const len = layout.encode({ mode: args.mode }, buffer);
    const data = Buffer.concat([identifier, buffer]).subarray(0, 8 + len);
    return new TransactionInstruction({
      keys,
      programId: KAMINO_LENDING_PROGRAM,
      data,
    });
  }

  refreshReservesBatchIx(reserves: Reserve[], skipPriceUpdates: boolean) {
    const keys: Array<AccountMeta> = [];
    for (const reserve of reserves) {
      const { lendingMarket, scopePriceFeed } = reserve;
      keys.push({
        pubkey: reserve.getAddress(),
        isSigner: false,
        isWritable: true,
      });
      keys.push({
        pubkey: lendingMarket,
        isSigner: false,
        isWritable: true,
      });
      if (!skipPriceUpdates) {
        [
          KAMINO_LENDING_PROGRAM, // pyth oracle, null
          KAMINO_LENDING_PROGRAM, // switchboard price oracle, null
          KAMINO_LENDING_PROGRAM, // switchboard twap oracle, null
          scopePriceFeed,
        ].forEach((p) =>
          keys.push({ pubkey: p, isSigner: false, isWritable: false }),
        );
      }
    }
    const identifier = Buffer.from([144, 110, 26, 103, 162, 204, 252, 147]);
    const buffer = Buffer.alloc(1000);
    const layout = borsh.struct([borsh.bool("skipPriceUpdates")]);
    const len = layout.encode({ skipPriceUpdates }, buffer);
    const data = Buffer.concat([identifier, buffer]).subarray(0, 8 + len);
    return new TransactionInstruction({
      keys,
      programId: KAMINO_LENDING_PROGRAM,
      data,
    });
  }

  refreshReservesIxs(reserves: Reserve[]) {
    return reserves.map((reserve) =>
      this.refreshReserveIx({
        reserve: reserve.getAddress(),
        lendingMarket: reserve.lendingMarket,
        pythOracle: KAMINO_LENDING_PROGRAM,
        switchboardPriceOracle: KAMINO_LENDING_PROGRAM,
        switchboardTwapOracle: KAMINO_LENDING_PROGRAM,
        scopePrices: reserve.scopePriceFeed,
      }),
    );
  }

  refreshObligationCollateralFarmsForReservesIxs(
    obligation: PublicKey,
    reserves: Reserve[],
  ) {
    return reserves
      .filter(({ farmCollateralNullable }) => !farmCollateralNullable)
      .map((reserve) => {
        const { farmCollateral, lendingMarket } = reserve;
        const obligationFarmUserState = this.client.getFarmUserState(
          obligation,
          farmCollateral,
        );
        return this.refreshObligationFarmsForReserveIx(
          { mode: 0 },
          {
            crank: this.client.base.signer, // Must be signer
            baseAccounts: {
              obligation,
              lendingMarketAuthority:
                this.client.getMarketAuthority(lendingMarket),
              reserve: reserve.getAddress(),
              reserveFarmState: farmCollateral,
              obligationFarmUserState,
              lendingMarket,
            },
            farmsProgram: KAMINO_FARM_PROGRAM,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
        );
      });
  }

  refreshObligationDebtFarmsForReservesIxs(
    obligation: PublicKey,
    reserves: Reserve[],
  ) {
    return reserves
      .filter(({ farmDebtNullable }) => !farmDebtNullable)
      .map((reserve) => {
        const { farmDebt, lendingMarket } = reserve;
        const obligationFarmUserState = this.client.getFarmUserState(
          obligation,
          farmDebt,
        );
        return this.refreshObligationFarmsForReserveIx(
          { mode: 1 },
          {
            crank: this.client.base.signer, // Must be signer
            baseAccounts: {
              obligation,
              lendingMarketAuthority:
                this.client.getMarketAuthority(lendingMarket),
              reserve: reserve.getAddress(),
              reserveFarmState: farmDebt,
              obligationFarmUserState,
              lendingMarket,
            },
            farmsProgram: KAMINO_FARM_PROGRAM,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
          },
        );
      });
  }

  /**
   * Returns two instructions that refresh reserves in batch and refresh obligation
   */
  async refreshReservesAndObligationIxs(
    obligation: PublicKey,
    targetReserve: Reserve,
  ) {
    // Get a set of reserves to refresh
    const { activeDeposits, activeBorrows, lendingMarket } =
      await this.client.fetchAndParseObligation(obligation);
    const reservesInUse = [
      ...activeDeposits.map(({ depositReserve }) => depositReserve),
      ...activeBorrows.map(({ borrowReserve }) => borrowReserve),
    ];
    // Refresh all reserves, including those in use and target reserve
    const reservesSet = new PkSet();
    reservesInUse.forEach((reserve) => reservesSet.add(reserve));
    reservesSet.add(targetReserve.getAddress());
    const reserves = await this.client.fetchAndParseReserves(
      Array.from(reservesSet),
    );
    const refreshReservesIx = this.refreshReservesBatchIx(reserves, false);

    // Refresh obligation with reserves in use (exclude target reserve)
    const refreshObligationIx = this.refreshObligationIx({
      lendingMarket,
      obligation,
      reserves: reservesInUse,
    });

    return [refreshReservesIx, refreshObligationIx];
  }

  /**
   * Returns an instruction to initialize obligation farm user if it doesn't exist
   *
   * @param mode 0 collateral farm, 1 debt farm
   */
  async initObligationFarmUserForReserveIx(
    obligation: PublicKey,
    reserve: Reserve,
    mode: 0 | 1,
    signer?: PublicKey,
  ) {
    const { lendingMarket, farmCollateralNullable, farmDebtNullable } = reserve;
    const farmState = mode === 0 ? farmCollateralNullable : farmDebtNullable;

    if (!farmState) {
      return { farmUser: null, initIx: null };
    }

    const farmUser = this.client.getFarmUserState(obligation, farmState);
    const farmUserAccount =
      await this.client.base.connection.getAccountInfo(farmUser);
    const initIx = farmUserAccount
      ? null
      : await this.client.base.extKaminoProgram.methods
          .lendingInitObligationFarmsForReserve(mode)
          .accounts({
            glamState: this.client.base.statePda,
            glamSigner: signer || this.client.base.signer,
            obligation,
            lendingMarketAuthority:
              this.client.getMarketAuthority(lendingMarket),
            reserve: reserve.getAddress(),
            reserveFarmState: farmState,
            obligationFarm: farmUser,
            lendingMarket,
            farmsProgram: KAMINO_FARM_PROGRAM,
          })
          .instruction();
    return { farmUser, initIx };
  }

  public async initUserMetadataTx(
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const vault = this.client.base.vaultPda;
    const userMetadata = this.client.getUserMetadataPda(vault);
    const lookupTable = new PublicKey(0); // FIXME: create lookup table

    const tx = await this.client.base.extKaminoProgram.methods
      .lendingInitUserMetadata(lookupTable)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        userMetadata,
        referrerUserMetadata: null,
      })
      .transaction();

    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async depositIxs(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vault = this.client.base.vaultPda;
    const userMetadata = this.client.getUserMetadataPda(vault);
    const obligation = this.client.getObligationPda(vault, market);

    const preInstructions = [];
    const postInstructions = [];

    const [userMetadataAccount, obligationAccount] =
      await this.client.base.provider.connection.getMultipleAccountsInfo([
        userMetadata,
        obligation,
      ]);

    // If user metadata doesn't exist, initialize it
    if (!userMetadataAccount) {
      preInstructions.push(
        await this.client.base.extKaminoProgram.methods
          .lendingInitUserMetadata(new PublicKey(0))
          .accounts({
            glamState: this.client.base.statePda,
            glamSigner,
            userMetadata,
            referrerUserMetadata: null,
          })
          .instruction(),
      );
    }

    // If obligation doesn't exist, initialize it
    if (!obligationAccount) {
      preInstructions.push(
        await this.client.base.extKaminoProgram.methods
          .lendingInitObligation(DEFAULT_OBLIGATION_ARGS)
          .accounts({
            glamState: this.client.base.statePda,
            glamSigner,
            obligation,
            lendingMarket: market,
            seed1Account: new PublicKey(0),
            seed2Account: new PublicKey(0),
            ownerUserMetadata: userMetadata,
          })
          .instruction(),
      );
    }

    const depositReserve = await this.client.findAndParseReserve(market, asset);

    const { farmUser: obligationFarmUser, initIx } =
      await this.initObligationFarmUserForReserveIx(
        obligation,
        depositReserve,
        0, // collateral farm
        glamSigner,
      );
    if (initIx) {
      preInstructions.push(initIx);
    }

    if (obligationAccount) {
      const ixs = await this.refreshReservesAndObligationIxs(
        obligation,
        depositReserve,
      );
      preInstructions.push(...ixs);
    } else {
      // Only refresh deposit reserve
      preInstructions.push(...this.refreshReservesIxs([depositReserve]));
      // Refresh obligation with 0 reserves
      preInstructions.push(
        this.refreshObligationIx({
          lendingMarket: market,
          obligation,
          reserves: [],
        }),
      );
    }

    if (depositReserve.farmCollateralNullable) {
      const ixs = this.refreshObligationCollateralFarmsForReservesIxs(
        obligation,
        [depositReserve],
      );
      preInstructions.push(...ixs);
      postInstructions.push(...ixs); // farms must be refreshed after deposit
    }

    // If deposit asset is WSOL, wrap SOL first in case vault doesn't have enough wSOL
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      asset,
    );
    const userSourceLiquidity = this.client.base.getVaultAta(
      asset,
      tokenProgram,
    );
    if (asset.equals(WSOL)) {
      const wrapSolIxs = await this.client.vault.maybeWrapSol(amount);
      preInstructions.unshift(...wrapSolIxs);
    }

    const ix = await this.client.base.extKaminoProgram.methods
      .lendingDepositReserveLiquidityAndObligationCollateralV2(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        obligation,
        lendingMarket: market,
        lendingMarketAuthority: this.client.getMarketAuthority(market),
        reserve: depositReserve.getAddress(),
        reserveLiquidityMint: asset,
        reserveLiquiditySupply: depositReserve.liquidity.supplyVault,
        reserveCollateralMint: depositReserve.collateral.mintPubkey,
        reserveDestinationDepositCollateral:
          depositReserve.collateral.supplyVault,
        userSourceLiquidity,
        placeholderUserDestinationCollateral: KAMINO_LENDING_PROGRAM,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        liquidityTokenProgram: tokenProgram,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        obligationFarmUserState: obligationFarmUser,
        reserveFarmState: depositReserve.farmCollateralNullable,
        farmsProgram: KAMINO_FARM_PROGRAM,
      })
      .instruction();

    return [...preInstructions, ix, ...postInstructions];
  }

  public async depositTx(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.depositIxs(market, asset, amount, glamSigner);

    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async withdrawIxs(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vault = this.client.base.vaultPda;
    const obligation = this.client.getObligationPda(vault, market);

    const preInstructions = [];
    const postInstructions = [];

    const withdrawReserve = await this.client.findAndParseReserve(
      market,
      asset,
    );

    const { farmUser: obligationFarmUser, initIx } =
      await this.initObligationFarmUserForReserveIx(
        obligation,
        withdrawReserve,
        0, // collateral farm
        glamSigner,
      );
    if (initIx) {
      preInstructions.push(initIx);
    }

    const ixs = await this.refreshReservesAndObligationIxs(
      obligation,
      withdrawReserve,
    );
    preInstructions.push(...ixs);

    if (withdrawReserve.farmCollateralNullable) {
      const ixs = this.refreshObligationCollateralFarmsForReservesIxs(
        obligation,
        [withdrawReserve],
      );
      preInstructions.push(...ixs);
      postInstructions.push(...ixs); // farms must be refreshed after withdraw
    }

    // Create asset ATA in case it doesn't exist. Add it to the beginning of preInstructions
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.provider.connection,
      asset,
    );
    const userDestinationLiquidity = this.client.base.getVaultAta(
      asset,
      tokenProgram,
    );
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      userDestinationLiquidity,
      vault,
      asset,
      tokenProgram,
    );
    preInstructions.unshift(createAtaIx);

    // When all assets are being withdrawn from a market, the klend program attempts to close the
    // obligation account, which requires the system program. We always pass the system program
    // account as a remaining account just in case.
    const withdrawIx = await this.client.base.extKaminoProgram.methods
      .lendingWithdrawObligationCollateralAndRedeemReserveCollateralV2(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        obligation,
        lendingMarket: market,
        lendingMarketAuthority: this.client.getMarketAuthority(market),
        withdrawReserve: withdrawReserve.getAddress(),
        reserveLiquidityMint: asset,
        reserveSourceCollateral: withdrawReserve.collateral.supplyVault,
        reserveCollateralMint: withdrawReserve.collateral.mintPubkey,
        reserveLiquiditySupply: withdrawReserve.liquidity.supplyVault,
        userDestinationLiquidity,
        placeholderUserDestinationCollateral: null,
        collateralTokenProgram: TOKEN_PROGRAM_ID,
        liquidityTokenProgram: tokenProgram,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        obligationFarmUserState: obligationFarmUser,
        reserveFarmState: withdrawReserve.farmCollateralNullable,
        farmsProgram: KAMINO_FARM_PROGRAM,
      })
      .remainingAccounts([
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    return [...preInstructions, withdrawIx, ...postInstructions];
  }

  public async withdrawTx(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.withdrawIxs(market, asset, amount, glamSigner);

    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async borrowIxs(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vault = this.client.base.vaultPda;
    const obligation = this.client.getObligationPda(vault, market);

    const preInstructions = [];
    const postInstructions = [];
    const borrowReserve = await this.client.findAndParseReserve(market, asset);

    const { farmUser: obligationFarmUser, initIx } =
      await this.initObligationFarmUserForReserveIx(
        obligation,
        borrowReserve,
        1, // debt farm
        glamSigner,
      );
    if (initIx) {
      preInstructions.push(initIx);
    }

    const ixs = await this.refreshReservesAndObligationIxs(
      obligation,
      borrowReserve,
    );
    preInstructions.push(...ixs);

    if (borrowReserve.farmDebtNullable) {
      const ixs = this.refreshObligationDebtFarmsForReservesIxs(obligation, [
        borrowReserve,
      ]);
      preInstructions.push(...ixs);
      postInstructions.push(...ixs); // farms must be refreshed after borrow
    }

    // Create asset ATA in case it doesn't exist. Add it to the beginning of preInstructions
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.provider.connection,
      asset,
    );
    const userDestinationLiquidity = this.client.base.getVaultAta(
      asset,
      tokenProgram,
    );
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      userDestinationLiquidity,
      vault,
      asset,
      tokenProgram,
    );
    preInstructions.unshift(createAtaIx);

    const borrowIx = await this.client.base.extKaminoProgram.methods
      .lendingBorrowObligationLiquidityV2(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        obligation,
        lendingMarket: market,
        lendingMarketAuthority: this.client.getMarketAuthority(market),
        borrowReserve: borrowReserve.getAddress(),
        borrowReserveLiquidityMint: asset,
        reserveSourceLiquidity: borrowReserve.liquidity.supplyVault,
        borrowReserveLiquidityFeeReceiver: borrowReserve.liquidityFeeReceiver,
        userDestinationLiquidity,
        referrerTokenState: null,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram,
        obligationFarmUserState: obligationFarmUser,
        reserveFarmState: borrowReserve.farmDebtNullable,
        farmsProgram: KAMINO_FARM_PROGRAM,
      })
      .instruction();

    return [...preInstructions, borrowIx];
  }

  public async borrowTx(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.borrowIxs(market, asset, amount, glamSigner);

    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async requestElevationGroupIxs(
    lendingMarket: PublicKey,
    elevationGroup: number,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vault = this.client.base.vaultPda;
    const obligation = this.client.getObligationPda(vault, lendingMarket);

    // Find all reserve keys
    const { activeDeposits, activeBorrows } =
      await this.client.fetchAndParseObligation(obligation);
    const reserveKeys = [
      ...activeDeposits.map(({ depositReserve }) => depositReserve),
      ...activeBorrows.map(({ borrowReserve }) => borrowReserve),
    ];

    // Build refresh ixs
    const reserves = await this.client.fetchAndParseReserves(reserveKeys);
    const refreshReservesIx = this.refreshReservesBatchIx(reserves, false);
    const refreshObligationIx = this.refreshObligationIx({
      lendingMarket,
      obligation,
      reserves: reserveKeys,
    });

    const ix = await this.client.base.extKaminoProgram.methods
      .lendingRequestElevationGroup(elevationGroup)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        obligation,
        lendingMarket,
      })
      .remainingAccounts(
        reserveKeys.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();

    return [refreshReservesIx, refreshObligationIx, ix];
  }

  public async requestElevationGroupTx(
    lendingMarket: PublicKey,
    elevationGroup: number,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    if (!this.client.base.staging) {
      throw new Error(
        "requestElevationGroupTx is only available in staging mode",
      );
    }

    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.requestElevationGroupIxs(
      lendingMarket,
      elevationGroup,
      glamSigner,
    );

    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }

  public async repayIxs(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const vault = this.client.base.vaultPda;
    const obligation = this.client.getObligationPda(vault, market);

    const preInstructions = [];
    const repayReserve = await this.client.findAndParseReserve(market, asset);

    const { farmUser: obligationFarmUser, initIx } =
      await this.initObligationFarmUserForReserveIx(
        obligation,
        repayReserve,
        1, // debt farm
        glamSigner,
      );
    if (initIx) {
      preInstructions.push(initIx);
    }

    const ixs = await this.refreshReservesAndObligationIxs(
      obligation,
      repayReserve,
    );
    preInstructions.push(...ixs);

    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.provider.connection,
      asset,
    );

    const repayIx = await this.client.base.extKaminoProgram.methods
      .lendingRepayObligationLiquidityV2(amount)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        obligation,
        lendingMarket: market,
        lendingMarketAuthority: this.client.getMarketAuthority(market),
        repayReserve: repayReserve.getAddress(),
        reserveLiquidityMint: asset,
        reserveDestinationLiquidity: repayReserve.liquidity.supplyVault,
        userSourceLiquidity: this.client.base.getVaultAta(asset, tokenProgram),
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram,
        obligationFarmUserState: obligationFarmUser,
        reserveFarmState: repayReserve.farmDebtNullable,
        farmsProgram: KAMINO_FARM_PROGRAM,
      })
      .instruction();

    return [...preInstructions, repayIx];
  }

  public async repayTx(
    market: PublicKey,
    asset: PublicKey,
    amount: BN,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.repayIxs(market, asset, amount, glamSigner);

    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }
}

export class KaminoLendingClient {
  private reserves: PkMap<Reserve> = new PkMap();
  private obligations: PkMap<Obligation> = new PkMap();
  txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    readonly vault: VaultClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Initializes Kamino user metadata
   */
  public async initUserMetadata(
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.initUserMetadataTx(txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Deposits asset to the lending market.
   */
  public async deposit(
    market: PublicKey | string,
    asset: PublicKey | string,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.depositTx(
      new PublicKey(market),
      new PublicKey(asset),
      new BN(amount),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Withdraws asset from the lending market.
   */
  public async withdraw(
    market: PublicKey | string,
    asset: PublicKey | string,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.withdrawTx(
      new PublicKey(market),
      new PublicKey(asset),
      new BN(amount),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Borrows asset from the lending market.
   */
  public async borrow(
    market: PublicKey | string,
    asset: PublicKey | string,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.borrowTx(
      new PublicKey(market),
      new PublicKey(asset),
      new BN(amount),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Requests an elevation group for an obligation.
   */
  public async requestElevationGroup(
    market: PublicKey | string,
    elevationGroup: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    if (!this.base.staging) {
      throw new Error(
        "requestElevationGroup is only available in staging mode",
      );
    }

    const tx = await this.txBuilder.requestElevationGroupTx(
      new PublicKey(market),
      elevationGroup,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Repays asset to the lending market.
   */
  public async repay(
    market: PublicKey | string,
    asset: PublicKey | string,
    amount: BN | number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.repayTx(
      new PublicKey(market),
      new PublicKey(asset),
      new BN(amount),
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  getUserMetadataPda(owner: PublicKey) {
    const [userMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_meta"), owner.toBuffer()],
      KAMINO_LENDING_PROGRAM,
    );
    return userMetadataPda;
  }

  getObligationPda(
    owner: PublicKey,
    market: PublicKey,
    args: { tag: number; id: number } = DEFAULT_OBLIGATION_ARGS,
  ) {
    const seed = [
      Buffer.from([args.tag]),
      Buffer.from([args.id]),
      owner.toBuffer(),
      market.toBuffer(),
      PublicKey.default.toBuffer(),
      PublicKey.default.toBuffer(),
    ];
    const [obligation, _] = PublicKey.findProgramAddressSync(
      seed,
      KAMINO_LENDING_PROGRAM,
    );
    return obligation;
  }

  // seeds = [BASE_SEED_USER_STATE, farm_state.key().as_ref(), delegatee.key().as_ref()],
  getFarmUserState(farmUser: PublicKey, farm: PublicKey) {
    const [obligationFarm] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), farm.toBuffer(), farmUser.toBuffer()],
      KAMINO_FARM_PROGRAM,
    );
    return obligationFarm;
  }

  getMarketAuthority(market: PublicKey) {
    const [authority, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("lma"), market.toBuffer()],
      KAMINO_LENDING_PROGRAM,
    );
    return authority;
  }

  async fetchAndParseObligation(obligation: PublicKey): Promise<Obligation> {
    const cached = this.obligations.get(obligation);
    if (cached) {
      return cached;
    }

    const obligationAccount =
      await this.base.connection.getAccountInfo(obligation);
    if (!obligationAccount) {
      throw new Error("Obligation account not found");
    }

    const parsedObligation = Obligation.decode(
      obligation,
      obligationAccount.data,
    );

    this.obligations.set(obligation, parsedObligation);
    return parsedObligation;
  }

  async fetchAndParseReserves(reserves: PublicKey[]): Promise<Reserve[]> {
    const requestReservesSet = new PkSet(reserves);
    const cachedReservesSet = new PkSet(Array.from(this.reserves.pkKeys()));

    if (cachedReservesSet.includes(requestReservesSet)) {
      return Array.from(this.reserves.values()).filter((r) =>
        requestReservesSet.has(r.getAddress()),
      );
    }

    const reservesToFetch = Array.from(requestReservesSet).filter(
      (r) => !cachedReservesSet.has(r),
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Fetching reserves:",
        reservesToFetch.map((r) => r.toBase58()),
      );
    }

    const reserveAccounts =
      await this.base.connection.getMultipleAccountsInfo(reservesToFetch);
    if (reserveAccounts.some((a) => !a)) {
      throw new Error("Not all reserves can be found");
    }
    reserveAccounts.forEach((account, i) => {
      const reserve = Reserve.decode(reservesToFetch[i], account!.data);
      this.reserves.set(reservesToFetch[i], reserve);
    });

    return Array.from(this.reserves.values()).filter((r) =>
      requestReservesSet.has(r.getAddress()),
    );
  }

  async findAndParseReserve(
    market: PublicKey,
    asset: PublicKey,
  ): Promise<Reserve> {
    const accounts = await getProgramAccounts(
      this.base.connection,
      KAMINO_LENDING_PROGRAM,
      {
        filters: [
          { dataSize: KAMINO_RESERVE_SIZE },
          { memcmp: { offset: 32, bytes: market.toBase58() } },
          { memcmp: { offset: 128, bytes: asset.toBase58() } },
        ],
      },
    );
    if (accounts.length === 0) {
      throw new Error("Reserve not found");
    }
    const reserve = Reserve.decode(
      accounts[0].pubkey,
      accounts[0].account.data,
    );
    this.reserves.set(accounts[0].pubkey, reserve);
    return reserve;
  }

  public async findAndParseObligations(
    owner: PublicKey,
    market?: PublicKey,
  ): Promise<Obligation[]> {
    const accounts = await getProgramAccounts(
      this.base.connection,
      KAMINO_LENDING_PROGRAM,
      {
        filters: [
          { dataSize: KAMINO_OBTRIGATION_SIZE },
          { memcmp: { offset: 64, bytes: owner.toBase58() } },
          ...(market
            ? [{ memcmp: { offset: 32, bytes: market.toBase58() } }]
            : []),
        ],
      },
    );
    return accounts.map((a) => {
      const o = Obligation.decode(a.pubkey, a.account.data);
      this.obligations.set(a.pubkey, o);
      return o;
    });
  }
}
