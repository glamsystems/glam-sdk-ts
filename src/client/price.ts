import {
  AccountMeta,
  Commitment,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { KaminoLendingClient, KaminoVaultsClient } from "./kamino";

import { BaseClient } from "./base";

import { ASSETS_MAINNET, SOL_ORACLE } from "../assets";
import { StateAccountType, StateModel } from "../models";
import { DriftProtocolClient, DriftVaultsClient } from "./drift";
import {
  bfToDecimal,
  findStakeAccounts,
  Fraction,
  MarketType,
  PkMap,
  PkSet,
  PositionCategorizer,
  toUiAmount,
} from "../utils";
import Decimal from "decimal.js";
import {
  AccountLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { USDC } from "../constants";
import {
  DriftSpotMarket,
  DriftPerpMarket,
  DriftUser,
  DriftVault,
  KVaultState,
  Obligation,
  Reserve,
  DriftVaultDepositor,
} from "../deser";
import { JupiterApiClient, TokenListItem } from "../utils/jupiterApi";

/**
 * Represents a single asset holding within a vault.
 *
 * @param mintAddress - The SPL token mint address of the held asset
 * @param decimals - Number of decimal places for the token (e.g., 6 for USDC, 9 for SOL)
 * @param amount - Unsigned token amount in native units; direction (deposit/borrow) is in protocolMeta
 * @param price - Current price of the asset denominated in the base asset (e.g., USD, SOL)
 * @param priceMeta - Additional pricing context (e.g., source, slot, base asset). Default base asset, if not specified, is USD.
 * @param protocol - Protocol identifier where the asset is allocated
 * @param protocolMeta - Protocol-specific metadata (e.g., market index, position direction, reserve address)
 */
export class Holding {
  readonly uiAmount!: number;

  constructor(
    readonly mintAddress: PublicKey,
    readonly decimals: number,
    readonly amount: BN,
    readonly price: number,
    readonly priceMeta: Record<string, any> = {},
    readonly protocol: string,
    readonly protocolMeta: Record<string, any> = {},
  ) {
    this.uiAmount = toUiAmount(this.amount, this.decimals);
  }
}

/**
 * Aggregates all holdings for a GLAM vault.
 * Includes token balances, DeFi positions (Drift, Kamino).
 *
 * @param vaultState - The vault's state account address (stores vault configuration)
 * @param vaultPda - The vault's PDA that holds tokens and positions
 * @param priceBaseAssetMint - The base asset mint used for pricing (e.g., PublicKey.default for USD, So11111111111111111111111111111111111111112 for SOL)
 * @param slot - The Solana slot at which holdings were fetched
 * @param timestamp - Unix timestamp (seconds) when holdings were fetched
 * @param commitment - The Solana commitment level used for fetching account data
 */
export class VaultHoldings {
  holdings: Holding[];

  constructor(
    readonly vaultState: PublicKey,
    readonly vaultPda: PublicKey,
    readonly priceBaseAssetMint: PublicKey,
    readonly slot: number,
    readonly timestamp: number,
    readonly commitment: Commitment,
  ) {
    this.holdings = [];
  }

  add(holding: Holding) {
    this.holdings.push(holding);
  }

  toJson() {
    return JSON.stringify(this, null, 2);
  }
}

export class PriceClient {
  private _stateModel: StateModel | null = null;
  private _lookupTables = new PkSet();
  private _kaminoVaults = new PkSet();

  public constructor(
    readonly base: BaseClient,
    readonly klend: KaminoLendingClient,
    readonly kvaults: KaminoVaultsClient,
    readonly drift: DriftProtocolClient,
    readonly dvaults: DriftVaultsClient,
    private readonly getJupiterApi: () => JupiterApiClient,
  ) {}

  get jupiterApi(): JupiterApiClient {
    return this.getJupiterApi();
  }

  get cachedStateModel(): StateModel | null {
    if (!this._stateModel) {
      console.warn("State model not cached");
      return null;
    }
    return this._stateModel;
  }

  set cachedStateModel(stateModel: StateModel) {
    this._stateModel = stateModel;
  }

  get lookupTables() {
    return Array.from(this._lookupTables);
  }

  get kaminoVaults() {
    return Array.from(this._kaminoVaults);
  }

  /**
   * Fetches all holdings in the vault.
   *
   * The source of truth for external positions is the `externalPositions` array
   * from the state account, which tracks:
   * - Drift user PDAs (direct trading positions)
   * - Drift vault depositor accounts (shares in drift vaults)
   * - Kamino obligation accounts (lending positions)
   * - Kamino vault share ATAs (shares in kamino vaults)
   *
   * @param commitment Commitment level for fetching accounts
   * @param priceBaseAssetMint Price reference/numeraire asset mint (default: PublicKey.default for USD).
   *                           Pass a token mint (e.g., WSOL) to get prices denominated in that asset.
   * @returns VaultHoldings object containing all holdings
   */
  async getVaultHoldings(
    commitment: Commitment,
    priceBaseAssetMint: PublicKey = PublicKey.default,
  ): Promise<VaultHoldings> {
    const { externalPositions } = await this.base.fetchStateAccount();
    const externalPositionsSet = new PkSet(externalPositions);

    // Categorize external positions by protocol type
    const categorizer = new PositionCategorizer(
      this.base.connection,
      this.base.vaultPda,
    );
    const {
      driftUsers,
      driftVaultDepositors,
      kaminoObligations,
      kaminoVaultShareAtas,
    } = await categorizer.categorizePositions(externalPositions, commitment);

    // Initialize maps for holdings data
    let glamDriftUserSpotMarketsMap = new PkMap<PkSet>();
    let glamDriftUserPerpMarketsMap = new PkMap<PkSet>();
    let dvaultDepositorsAndVaultsMap = new PkMap<DriftVault>();
    let dvaultUserSpotMarketsMap = new PkMap<PkSet>();
    let dvaultUserPerpMarketsMap = new PkMap<PkSet>();
    let obligationReservesMap = new PkMap<PkSet>();
    let kvaultAtasAndStatesMap = new PkMap<KVaultState>();
    let kvaultReserves = new PkSet();

    // Process drift users from categorized positions
    if (driftUsers.length > 0) {
      glamDriftUserSpotMarketsMap = await this.getPubkeysForSpotHoldings(
        driftUsers,
        commitment,
      );
      glamDriftUserPerpMarketsMap = await this.getPubkeysForPerpHoldings(
        driftUsers,
        commitment,
      );
    }

    // Process drift vault depositors from categorized positions
    if (driftVaultDepositors.length > 0) {
      dvaultDepositorsAndVaultsMap = await this.getDepositorsAndDriftVaults(
        driftVaultDepositors,
        commitment,
      );
      const userPdas = Array.from(dvaultDepositorsAndVaultsMap.values()).map(
        ({ user }) => user,
      );
      dvaultUserSpotMarketsMap = await this.getPubkeysForSpotHoldings(
        userPdas,
        commitment,
      );
      dvaultUserPerpMarketsMap = await this.getPubkeysForPerpHoldings(
        userPdas,
        commitment,
      );
    }

    // Process kamino obligations from categorized positions
    if (kaminoObligations.length > 0) {
      obligationReservesMap = await this.getPubkeysForKaminoHoldings(
        kaminoObligations,
        commitment,
      );
    }

    // Process kamino vault shares from categorized positions
    if (kaminoVaultShareAtas.length > 0) {
      kvaultAtasAndStatesMap = await this.getKaminoVaultStatesFromAtas(
        kaminoVaultShareAtas,
        commitment,
      );
      Array.from(kvaultAtasAndStatesMap.pkEntries()).map(([_, kvaultState]) => {
        kvaultState.validAllocations.forEach(({ reserve }) => {
          kvaultReserves.add(reserve);
        });
      });
    }

    const tokenPubkeys = await this.getPubkeysForTokenHoldings(
      externalPositionsSet,
      commitment,
    );

    const glamDriftUsers = Array.from(glamDriftUserSpotMarketsMap.pkKeys());
    const glamDriftSpotMarkets = [...glamDriftUserSpotMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();
    const glamDriftPerpMarkets = [...glamDriftUserPerpMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();

    const dvaultDepositors = Array.from(dvaultDepositorsAndVaultsMap.pkKeys());
    const dvaultUsers = [...dvaultDepositorsAndVaultsMap.values()].map(
      (v) => v.user,
    );
    const dvaultUserSpotMarkets = [...dvaultUserSpotMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();
    const dvaultUserPerpMarkets = [...dvaultUserPerpMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();

    const kaminoReserves = [...obligationReservesMap.values()]
      .map((v) => Array.from(v.pkValues()))
      .flat()
      .concat(Array.from(kvaultReserves));
    const kvaultAtas = Array.from(kvaultAtasAndStatesMap.pkKeys());

    // Dedupe keys and fetch all accounts in a single RPC call
    const pubkeys = Array.from(
      new PkSet([
        ...tokenPubkeys,
        ...glamDriftUsers,
        ...glamDriftSpotMarkets,
        ...glamDriftPerpMarkets,
        ...dvaultDepositors,
        ...dvaultUsers,
        ...dvaultUserSpotMarkets,
        ...dvaultUserPerpMarkets,
        ...kaminoObligations,
        ...kaminoReserves,
        ...kvaultAtas,
        SYSVAR_CLOCK_PUBKEY, // read unix timestamp from sysvar clock account
      ]),
    );

    if (pubkeys.length > 100) {
      throw new Error(
        `Too many pubkeys to fetch accounts for: ${pubkeys.length} > 100`,
      );
    }

    const {
      context: { slot },
      value: accountsInfo,
    } = await this.base.connection.getMultipleAccountsInfoAndContext(
      pubkeys,
      commitment,
    );

    // Build a map of pubkey to account data for quick lookup
    const accountsDataMap = new PkMap<Buffer>();
    for (let i = 0; i < accountsInfo.length; i++) {
      const accountInfo = accountsInfo[i];
      if (accountInfo) {
        accountsDataMap.set(pubkeys[i], accountInfo.data);
      }
    }

    // Build a map of parsed drift spot markets
    const driftSpotMarketsMap = new PkMap<DriftSpotMarket>();
    for (const marketPda of glamDriftSpotMarkets) {
      const data = accountsDataMap.get(marketPda);
      if (data) {
        const market = DriftSpotMarket.decode(marketPda, data);
        driftSpotMarketsMap.set(marketPda, market);
      }
    }
    for (const marketPda of dvaultUserSpotMarkets) {
      const data = accountsDataMap.get(marketPda);
      if (data) {
        const market = DriftSpotMarket.decode(marketPda, data);
        driftSpotMarketsMap.set(marketPda, market);
      }
    }

    // Build a map of parsed drift perp markets
    const driftPerpMarketsMap = new PkMap<DriftPerpMarket>();
    for (const marketPda of glamDriftPerpMarkets) {
      const data = accountsDataMap.get(marketPda);
      if (data) {
        const market = DriftPerpMarket.decode(marketPda, data);
        driftPerpMarketsMap.set(marketPda, market);
      }
    }
    for (const marketPda of dvaultUserPerpMarkets) {
      const data = accountsDataMap.get(marketPda);
      if (data) {
        const market = DriftPerpMarket.decode(marketPda, data);
        driftPerpMarketsMap.set(marketPda, market);
      }
    }

    // Build a map of parsed dvault deposits
    const dvaultDepositorsMap = new PkMap<DriftVaultDepositor>();
    for (const pubkey of dvaultDepositors) {
      const data = accountsDataMap.get(pubkey);
      if (data) {
        const depositor = DriftVaultDepositor.decode(pubkey, data);
        dvaultDepositorsMap.set(pubkey, depositor);
      }
    }

    // Build a map of parsed kamino reserves
    const kaminoReservesMap = new PkMap<Reserve>();
    for (let i = 0; i < kaminoReserves.length; i++) {
      const data = accountsDataMap.get(kaminoReserves[i]);
      if (data) {
        const reserve = Reserve.decode(kaminoReserves[i], data);
        kaminoReservesMap.set(kaminoReserves[i], reserve);
      }
    }

    // Build a map of token prices (in USD)
    const tokenPricesMap = new PkMap<TokenListItem>();
    const tokenList = await this.jupiterApi.fetchTokensList(true);
    tokenList.tokens.forEach((item) => {
      const tokenMint = new PublicKey(item.address);
      tokenPricesMap.set(tokenMint, item);
    });

    const [
      tokenHoldings,
      driftHoldings,
      dvaultHoldings,
      kaminoLendHoldings,
      kaminoVaultsHoldings,
    ] = await Promise.all([
      this.getTokenHoldings(
        tokenPubkeys,
        accountsDataMap,
        tokenPricesMap,
        "Jupiter",
      ),
      this.getDriftHoldings(
        glamDriftUserSpotMarketsMap.pkKeys(), // all drift users controlled by glam vault
        driftSpotMarketsMap,
        driftPerpMarketsMap,
        accountsDataMap,
        tokenPricesMap,
        "Jupiter",
      ),
      this.getDriftVaultsHoldings(
        dvaultDepositorsAndVaultsMap,
        dvaultDepositorsMap,
        driftSpotMarketsMap,
        driftPerpMarketsMap,
        accountsDataMap,
        tokenPricesMap,
        "Jupiter",
      ),
      this.getKaminoLendHoldings(
        obligationReservesMap.pkKeys(),
        kaminoReservesMap,
        accountsDataMap,
        tokenPricesMap,
        "Jupiter",
      ),
      this.getKaminoVaultsHoldings(
        kvaultAtasAndStatesMap,
        kaminoReservesMap,
        accountsDataMap,
        tokenPricesMap,
        "Jupiter",
      ),
    ]);

    const clockData = accountsDataMap.get(SYSVAR_CLOCK_PUBKEY);
    const timestamp = clockData ? clockData.readUInt32LE(32) : 0;
    const vaultHoldings = new VaultHoldings(
      this.base.statePda,
      this.base.vaultPda,
      priceBaseAssetMint,
      slot,
      timestamp,
      commitment,
    );

    // Collect all holdings
    const allHoldings = [
      ...tokenHoldings,
      ...driftHoldings,
      ...dvaultHoldings,
      ...kaminoLendHoldings,
      ...kaminoVaultsHoldings,
    ];

    // If priceBaseAssetMint is not default (USD), convert prices to the base asset
    if (!priceBaseAssetMint.equals(PublicKey.default)) {
      const { usdPrice: baseAssetUsdPrice } = await this.getTokenPrice(
        priceBaseAssetMint,
        tokenPricesMap,
      );
      if (baseAssetUsdPrice <= 0) {
        throw new Error(
          `Invalid base asset price for ${priceBaseAssetMint.toBase58()}`,
        );
      }

      // Convert each holding's price from USD to base asset denomination
      for (const holding of allHoldings) {
        const convertedHolding = new Holding(
          holding.mintAddress,
          holding.decimals,
          holding.amount,
          holding.price / baseAssetUsdPrice,
          {
            ...holding.priceMeta,
            baseAsset: priceBaseAssetMint.toBase58(),
            baseAssetUsdPrice,
          },
          holding.protocol,
          holding.protocolMeta,
        );
        vaultHoldings.add(convertedHolding);
      }
    } else {
      // USD pricing - add holdings as-is
      allHoldings.forEach((holding) => vaultHoldings.add(holding));
    }

    return vaultHoldings;
  }

  async getPubkeysForTokenHoldings(
    externalPositionsSet: PkSet,
    commitment?: Commitment,
  ): Promise<PublicKey[]> {
    const results = await Promise.all(
      [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
        this.base.connection.getTokenAccountsByOwner(
          this.base.vaultPda,
          { programId },
          commitment,
        ),
      ),
    );
    const pubkeys = results.flatMap((result) =>
      result.value.map((ta) => ta.pubkey),
    );
    // Filter out token accounts tracked as external positions
    // They are NOT considered as token holdings
    return pubkeys.filter((p) => !externalPositionsSet.has(p));
  }

  async getPubkeysForSpotHoldings(
    driftUserPdas: PublicKey[],
    commitment?: Commitment,
  ): Promise<PkMap<PkSet>> {
    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      driftUserPdas,
      commitment,
    );
    const userMarketsMap = new PkMap<PkSet>();
    for (let i = 0; i < accountsInfo.length; i++) {
      const accountInfo = accountsInfo[i];
      if (accountInfo) {
        // get spot markets user has a position in
        const { spotPositions } = DriftUser.decode(
          driftUserPdas[i],
          accountInfo.data,
        );
        const spotMarketIndexes = spotPositions.map((p) => p.marketIndex);
        const spotMarketPdas = spotMarketIndexes.map((index) =>
          this.drift.getMarketPda(MarketType.SPOT, index),
        );
        userMarketsMap.set(driftUserPdas[i], new PkSet(spotMarketPdas));
      }
    }

    return userMarketsMap;
  }

  async getPubkeysForPerpHoldings(
    driftUserPdas: PublicKey[],
    commitment?: Commitment,
  ): Promise<PkMap<PkSet>> {
    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      driftUserPdas,
      commitment,
    );
    const userMarketsMap = new PkMap<PkSet>();
    for (let i = 0; i < accountsInfo.length; i++) {
      const accountInfo = accountsInfo[i];
      if (accountInfo) {
        // get perp markets user has a position in
        const { perpPositions } = DriftUser.decode(
          driftUserPdas[i],
          accountInfo.data,
        );
        const perpMarketIndexes = perpPositions.map((p) => p.marketIndex);
        const perpMarketPdas = perpMarketIndexes.map((index) =>
          this.drift.getMarketPda(MarketType.PERP, index),
        );
        userMarketsMap.set(driftUserPdas[i], new PkSet(perpMarketPdas));
      }
    }

    return userMarketsMap;
  }

  /**
   * Parses drift vault depositors from known pubkeys.
   */
  async getDepositorsAndDriftVaults(
    depositorPubkeys: PublicKey[],
    commitment?: Commitment,
  ): Promise<PkMap<DriftVault>> {
    const depositorVaultMap = new PkMap<DriftVault>();

    if (depositorPubkeys.length === 0) {
      return depositorVaultMap;
    }

    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      depositorPubkeys,
      commitment,
    );

    const driftVaultPubkeys: PublicKey[] = [];
    const validDepositors: PublicKey[] = [];

    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (info) {
        // Parse drift vault pubkey from depositor account data (offset 8-40)
        const driftVault = new PublicKey(info.data.subarray(8, 40));
        driftVaultPubkeys.push(driftVault);
        validDepositors.push(depositorPubkeys[i]);
      }
    }

    if (validDepositors.length === 0) {
      return depositorVaultMap;
    }

    const parsedDriftVaults =
      await this.dvaults.parseDriftVaults(driftVaultPubkeys);

    for (let i = 0; i < validDepositors.length; i++) {
      depositorVaultMap.set(validDepositors[i], parsedDriftVaults[i]);
    }

    return depositorVaultMap;
  }

  /**
   * Gets kamino obligation reserves from known obligation pubkeys.
   */
  async getPubkeysForKaminoHoldings(
    obligationPubkeys: PublicKey[],
    commitment?: Commitment,
  ): Promise<PkMap<PkSet>> {
    const obligationReservesMap = new PkMap<PkSet>();

    if (obligationPubkeys.length === 0) {
      return obligationReservesMap;
    }

    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      obligationPubkeys,
      commitment,
    );

    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      if (info) {
        const { activeDeposits, activeBorrows } = Obligation.decode(
          obligationPubkeys[i],
          info.data,
        );
        const reservesSet = new PkSet([
          ...activeDeposits.map((d) => d.depositReserve),
          ...activeBorrows.map((b) => b.borrowReserve),
        ]);
        obligationReservesMap.set(obligationPubkeys[i], reservesSet);
      }
    }

    return obligationReservesMap;
  }

  /**
   * Gets kamino vault states from known share ATA pubkeys.
   * Used by getVaultHoldingsV2 to process vault shares from externalPositions.
   */
  async getKaminoVaultStatesFromAtas(
    shareAtaPubkeys: PublicKey[],
    commitment?: Commitment,
  ): Promise<PkMap<KVaultState>> {
    const map = new PkMap<KVaultState>();

    if (shareAtaPubkeys.length === 0) {
      return map;
    }

    // Fetch all kvault states to build mint -> state mapping
    const allKvaultStates =
      await this.kvaults.findAndParseKaminoVaults(commitment);
    const shareMintToState = new PkMap<KVaultState>();
    allKvaultStates.forEach((state) => {
      shareMintToState.set(state.sharesMint, state);
    });

    // Fetch the ATA accounts to get their mints
    const ataAccountsInfo = await this.base.connection.getMultipleAccountsInfo(
      shareAtaPubkeys,
      commitment,
    );

    for (let i = 0; i < ataAccountsInfo.length; i++) {
      const info = ataAccountsInfo[i];
      if (info) {
        const tokenAccount = AccountLayout.decode(info.data);
        const mint = new PublicKey(tokenAccount.mint);
        const kvaultState = shareMintToState.get(mint)!;
        map.set(shareAtaPubkeys[i], kvaultState);
      }
    }

    return map;
  }

  /**
   * Fetches token price from the prefetched map, falling back to Jupiter API if not found.
   * @throws Error if price cannot be fetched from either source
   */
  private async getTokenPrice(
    mint: PublicKey,
    tokenPricesMap: PkMap<TokenListItem>,
  ): Promise<{ usdPrice: number; decimals: number; slot?: number }> {
    const tokenInfo = tokenPricesMap.get(mint);
    if (tokenInfo) {
      return {
        usdPrice: tokenInfo.usdPrice,
        decimals: tokenInfo.decimals,
        slot: tokenInfo.slot,
      };
    }

    // Fallback: fetch from Jupiter price API (includes decimals and blockId aka slot)
    const prices = await this.jupiterApi.fetchTokenPrices([mint.toBase58()]);
    const priceData = prices.find((p) => p.mint === mint.toBase58());
    if (!priceData) {
      throw new Error(`Failed to fetch price for token ${mint.toBase58()}`);
    }

    return {
      usdPrice: priceData.usdPrice,
      decimals: priceData.decimals,
      slot: priceData.blockId,
    };
  }

  async getTokenHoldings(
    tokenAccountPubkeys: PublicKey[],
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];
    if (tokenAccountPubkeys.length === 0) {
      return holdings;
    }

    for (const pubkey of tokenAccountPubkeys) {
      const data = accountsDataMap.get(pubkey)!;

      const { amount, mint } = AccountLayout.decode(data);

      const { usdPrice, decimals, slot } = await this.getTokenPrice(
        mint,
        tokenPricesMap,
      );
      const holding = new Holding(
        mint,
        decimals,
        new BN(amount),
        usdPrice,
        { slot, source: priceSource },
        "Token",
        {
          tokenAccount: pubkey,
        },
      );
      holdings.push(holding);
    }

    return holdings;
  }

  async getDriftHoldings(
    userPubkeys: Iterable<PublicKey>,
    spotMarketsMap: PkMap<DriftSpotMarket>,
    perpMarketsMap: PkMap<DriftPerpMarket>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];

    for (const userPda of userPubkeys) {
      const userData = accountsDataMap.get(userPda)!;

      const { spotPositions, perpPositions } = DriftUser.decode(
        userPda,
        userData,
      );

      for (const spotPosition of spotPositions) {
        const {
          marketIndex,
          mint,
          decimals,
          cumulativeDepositInterest,
          cumulativeBorrowInterest,
        } = spotMarketsMap.get(spotPosition.marketPda)!;

        const amount = spotPosition
          .calcBalanceBn(
            decimals,
            cumulativeDepositInterest,
            cumulativeBorrowInterest,
          )
          .abs();
        const { usdPrice, slot } = await this.getTokenPrice(
          mint,
          tokenPricesMap,
        );

        const holding = new Holding(
          mint,
          decimals,
          amount,
          usdPrice,
          { slot, source: priceSource },
          "DriftProtocol",
          {
            user: userPda,
            marketIndex,
            direction: spotPosition.direction,
            marketType: "spot",
          },
        );
        holdings.push(holding);
      }

      for (const perpPosition of perpPositions) {
        const { marketIndex, marketPda } = perpPosition;
        const {
          lastOraclePrice,
          cumulativeFundingRateLong,
          cumulativeFundingRateShort,
        } = perpMarketsMap.get(marketPda)!;

        const amount = perpPosition.getUsdValueScaled(
          lastOraclePrice,
          cumulativeFundingRateLong,
          cumulativeFundingRateShort,
        );
        const baseAssetAmountUi = toUiAmount(perpPosition.baseAssetAmount, 9);
        const { usdPrice, slot } = await this.getTokenPrice(
          USDC,
          tokenPricesMap,
        );

        const holding = new Holding(
          USDC,
          6,
          amount,
          usdPrice,
          { slot, source: priceSource },
          "DriftProtocol",
          {
            user: userPda,
            marketIndex,
            marketType: "perp",
            // Preserve both USD value and signed base size for downstream UIs.
            usdValueUi: toUiAmount(amount, 6),
            baseAssetAmount: perpPosition.baseAssetAmount.toString(),
            baseAssetAmountUi,
          },
        );
        holdings.push(holding);
      }
    }

    return holdings;
  }

  async getDriftVaultsHoldings(
    dvaultDepositorsAndVaults: PkMap<DriftVault>,
    dvaultDepositorsMap: PkMap<DriftVaultDepositor>,
    spotMarketsMap: PkMap<DriftSpotMarket>,
    perpMarketsMap: PkMap<DriftPerpMarket>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];
    for (const [pubkey, dvault] of dvaultDepositorsAndVaults.pkEntries()) {
      const depositor = dvaultDepositorsMap.get(pubkey)!;
      const dvaultUserData = accountsDataMap.get(dvault.user)!;

      const { spotPositions, perpPositions } = DriftUser.decode(
        dvault.user,
        dvaultUserData,
      );
      const aum = dvault.aumInBaseAsset(
        spotPositions,
        perpPositions,
        spotMarketsMap,
        perpMarketsMap,
      );

      // Deduct accrued management fee from AUM (matches Rust logic)
      const clockData = accountsDataMap.get(SYSVAR_CLOCK_PUBKEY);
      const nowTs = new BN(clockData ? clockData.readUInt32LE(32) : 0);
      let aumPostMgmt = aum;
      if (dvault.managementFee.gtn(0) && aum.gtn(0)) {
        const sinceLast = nowTs.sub(dvault.lastFeeUpdateTs);
        const depositorsAum = aum
          .mul(dvault.userShares)
          .div(dvault.totalShares);
        const mgmtFee = depositorsAum
          .mul(dvault.managementFee)
          .div(new BN(1_000_000))
          .mul(sinceLast)
          .div(new BN(31_536_000));
        aumPostMgmt = aum.sub(mgmtFee);
      }

      // Compute depositor position WITHOUT pending withdrawal (matches Rust logic)
      const depositorNetShares = depositor.netSharesRebased(dvault.sharesBase);
      const sharesPosition = depositorNetShares
        .mul(aumPostMgmt)
        .div(dvault.totalShares);
      const pendingWithdrawalValue = depositor.lastWithdrawRequest.value;

      // PnL & fee breakdown (perf fee is computed on shares position only)
      const costBasis = depositor.netDeposits.add(
        depositor.cumulativeProfitShareAmount,
      );
      const pnlBeforeFees = sharesPosition.sub(costBasis);

      let pendingPerfFee = new BN(0);
      if (dvault.profitShare > 0) {
        const hurdleBaseline = costBasis
          .mul(new BN(dvault.hurdleRate))
          .div(new BN(1_000_000));
        if (pnlBeforeFees.gt(hurdleBaseline)) {
          pendingPerfFee = pnlBeforeFees
            .mul(new BN(dvault.profitShare))
            .div(new BN(1_000_000));
        }
      }

      // final = shares_position - perf_fee + pending_withdrawal
      const amount = sharesPosition
        .sub(pendingPerfFee)
        .add(pendingWithdrawalValue);
      const { mint, decimals } = dvault.getBaseAsset(spotMarketsMap);
      const { usdPrice, slot } = await this.getTokenPrice(mint, tokenPricesMap);

      const holding = new Holding(
        mint,
        decimals,
        amount,
        usdPrice,
        { slot, source: priceSource },
        "DriftVaults",
        {
          vault: dvault.getAddress(),
          depositor: depositor.getAddress(),
          pnlBeforeFees,
          pendingPerfFee,
          profitSharePct: dvault.profitShare / 10_000,
        },
      );
      holdings.push(holding);
    }
    return holdings;
  }

  async getKaminoLendHoldings(
    obligationPubkeys: Iterable<PublicKey>,
    reservesMap: PkMap<Reserve>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];
    for (const obligation of obligationPubkeys) {
      const obligationData = accountsDataMap.get(obligation)!;

      const { activeDeposits, activeBorrows } = Obligation.decode(
        obligation,
        obligationData,
      );

      for (const { depositReserve, depositedAmount } of activeDeposits) {
        const reserve = reservesMap.get(depositReserve)!;

        const { collateralExchangeRate, lendingMarket, liquidity } = reserve;
        const supplyAmount = new Decimal(depositedAmount.toString())
          .div(collateralExchangeRate)
          .floor();
        const amount = new BN(supplyAmount.toString());

        const { usdPrice, slot } = await this.getTokenPrice(
          liquidity.mintPubkey,
          tokenPricesMap,
        );
        const holding = new Holding(
          liquidity.mintPubkey,
          liquidity.mintDecimals.toNumber(),
          amount,
          usdPrice,
          { slot, source: priceSource },
          "KaminoLend",
          {
            obligation,
            market: lendingMarket,
            reserve: depositReserve,
            direction: "deposit" as const,
          },
        );
        holdings.push(holding);
      }

      for (const {
        borrowReserve,
        borrowedAmountSf,
        cumulativeBorrowRateBsf,
      } of activeBorrows) {
        const reserve = reservesMap.get(borrowReserve)!;

        const { cumulativeBorrowRate, lendingMarket, liquidity } = reserve;
        const obligationCumulativeBorrowRate = bfToDecimal(
          cumulativeBorrowRateBsf,
        );
        const borrowAmount = new Fraction(borrowedAmountSf)
          .toDecimal()
          .mul(cumulativeBorrowRate)
          .div(obligationCumulativeBorrowRate)
          .ceil();

        const amount = new BN(borrowAmount.toString());

        const { usdPrice, slot } = await this.getTokenPrice(
          liquidity.mintPubkey,
          tokenPricesMap,
        );
        const holding = new Holding(
          liquidity.mintPubkey,
          liquidity.mintDecimals.toNumber(),
          amount,
          usdPrice,
          { slot, source: priceSource },
          "KaminoLend",
          {
            obligation,
            market: lendingMarket,
            reserve: borrowReserve,
            direction: "borrow" as const,
          },
        );
        holdings.push(holding);
      }
    }

    return holdings;
  }

  async getKaminoVaultsHoldings(
    kvaultAtasAndStates: PkMap<KVaultState>,
    reservesMap: PkMap<Reserve>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];
    const FRACTION_SCALE = new Decimal(2).pow(60); // U68F60 fixed-point scale
    const SECONDS_PER_YEAR_KAMINO = 31_556_926;
    const clockData = accountsDataMap.get(SYSVAR_CLOCK_PUBKEY);
    const nowTs = clockData ? clockData.readUInt32LE(32) : 0;

    for (const [ata, kvaultState] of kvaultAtasAndStates.pkEntries()) {
      const ataData = accountsDataMap.get(ata)!;

      const tokenAccount = AccountLayout.decode(ataData);

      let aumAndFees = new Decimal(kvaultState.tokenAvailable.toString());
      kvaultState.validAllocations.map((allocation) => {
        const reserve = reservesMap.get(allocation.reserve)!;

        const { collateralExchangeRate } = reserve;

        // allocation ctoken amount to liq asset amount
        const liqAmount = new Decimal(allocation.ctokenAllocation.toString())
          .div(collateralExchangeRate)
          .floor();
        aumAndFees = aumAndFees.add(liqAmount);
      });

      // Deduct pending fees from AUM (matches Rust: aum = available + allocated - pending_fees)
      const pendingFees = new Decimal(kvaultState.pendingFeesSf.toString()).div(FRACTION_SCALE);
      let vaultAum = aumAndFees.sub(pendingFees);

      const sharesIssued = new Decimal(kvaultState.sharesIssued.toString());
      if (vaultAum.lte(0) || sharesIssued.lte(0)) {
        continue; // early return like Rust: if vault_aum == 0 || shares_issued == 0
      }

      // Management fee: prev_aum * from_bps(mgmt_fee_bps) * since_last / SECONDS_PER_YEAR
      const prevAum = new Decimal(kvaultState.prevAumSf.toString()).div(FRACTION_SCALE);
      const sinceLast = Math.max(0, nowTs - kvaultState.lastFeeChargeTimestamp.toNumber());

      let mgmtCharge = new Decimal(0);
      if (sinceLast > 0) {
        const mgmtFeeRate = new Decimal(kvaultState.managementFeeBps.toString()).div(10_000);
        mgmtCharge = prevAum
          .mul(mgmtFeeRate)
          .mul(sinceLast)
          .div(SECONDS_PER_YEAR_KAMINO);
      }

      // Performance fee: from_bps(perf_fee_bps) * max(0, vault_aum - prev_aum)
      const earnedInterest = Decimal.max(0, vaultAum.sub(prevAum));
      const perfCharge = new Decimal(kvaultState.performanceFeeBps.toString())
        .div(10_000)
        .mul(earnedInterest);

      // Deduct fees from AUM (matches Rust: vault_aum = vault_aum - mgmt_charge - perf_charge)
      vaultAum = vaultAum.sub(mgmtCharge).sub(perfCharge);

      // calculate liquidity token amount: shares * vault_aum.floor() / shares_issued
      const amount = new Decimal(tokenAccount.amount.toString())
        .mul(vaultAum.floor())
        .div(sharesIssued)
        .floor();

      const { usdPrice, slot } = await this.getTokenPrice(
        kvaultState.tokenMint,
        tokenPricesMap,
      );
      const holding = new Holding(
        kvaultState.tokenMint,
        kvaultState.tokenMintDecimals.toNumber(),
        new BN(amount.toString()),
        usdPrice,
        { slot, source: priceSource },
        "KaminoVaults",
        {
          kaminoVault: kvaultState._address,
          kaminoVaultAta: ata,
          pendingMgmtFee: mgmtCharge.toFixed(0),
          pendingPerfFee: perfCharge.toFixed(0),
          managementFeeBps: kvaultState.managementFeeBps.toNumber(),
          performanceFeeBps: kvaultState.performanceFeeBps.toNumber(),
        },
      );
      holdings.push(holding);
    }

    return holdings;
  }

  /**
   * Returns an instruction that prices Kamino obligations.
   * If there are no Kamino obligations, returns null.
   */
  async priceKaminoObligationsIxs(): Promise<TransactionInstruction[]> {
    const parsedObligations = await this.klend.findAndParseObligations(
      this.base.vaultPda,
    );
    if (parsedObligations.length === 0) {
      return [];
    }

    const ixs: TransactionInstruction[] = [];

    const obligationReservesMap = new PkMap<PkSet>();
    const reservesSet = new PkSet();

    // Get all reserves used by obligations
    parsedObligations.map((obligation) => {
      const { activeDeposits, activeBorrows } = obligation;
      const address = obligation.getAddress();
      obligationReservesMap.set(address, new PkSet());
      activeDeposits.forEach(({ depositReserve }) => {
        reservesSet.add(depositReserve);
        obligationReservesMap.get(address)?.add(depositReserve);
      });
      activeBorrows.forEach(({ borrowReserve }) => {
        reservesSet.add(borrowReserve);
        obligationReservesMap.get(address)?.add(borrowReserve);
      });
    });

    // Refresh reserves in batch
    const parsedReserves = await this.klend.fetchAndParseReserves(
      Array.from(reservesSet),
    );
    ixs.push(
      this.klend.txBuilder.refreshReservesBatchIx(parsedReserves, false),
    );

    // Refresh obligations
    parsedObligations.forEach((obligation) => {
      const { lendingMarket } = obligation;
      const address = obligation.getAddress();

      ixs.push(
        this.klend.txBuilder.refreshObligationIx({
          obligation: address,
          lendingMarket,
          reserves: Array.from(obligationReservesMap.get(address) || []),
        }),
      );
    });

    const remainingAccounts = Array.from(obligationReservesMap.pkKeys()).map(
      (pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: true,
      }),
    );

    const priceIx = await this.base.mintProgram.methods
      .priceKaminoObligations()
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
    ixs.push(priceIx);

    return ixs;
  }

  public async priceKaminoVaultSharesIx(): Promise<
    TransactionInstruction[] | null
  > {
    const allKvaultStates = await this.kvaults.findAndParseKaminoVaults();
    const allKvaultMints = allKvaultStates.map((kvault) => kvault.sharesMint);

    // All kvault share token accounts GLAM vault could possibly hold
    const possibleShareAtas = allKvaultMints.map((mint) =>
      this.base.getVaultAta(mint),
    );

    const possibleShareAtaAccountsInfo =
      await this.base.connection.getMultipleAccountsInfo(possibleShareAtas);
    const shareAtas: typeof possibleShareAtas = [];
    const shareMints: typeof allKvaultMints = [];
    const kvaultStates: typeof allKvaultStates = [];
    const oracles: PublicKey[] = []; // oracle of kvault deposit token
    possibleShareAtaAccountsInfo.forEach((info, i) => {
      // share ata must exist and it must be tracked by glam state
      // otherwise skip it for pricing
      if (
        info !== null &&
        this.cachedStateModel?.externalPositions?.find((a) =>
          a.equals(possibleShareAtas[i]),
        )
      ) {
        shareAtas.push(possibleShareAtas[i]);
        shareMints.push(allKvaultMints[i]);
        kvaultStates.push(allKvaultStates[i]);

        // get oracle and lookup table from kvault state
        const { tokenMint, vaultLookupTable } = allKvaultStates[i];
        const assetMeta = ASSETS_MAINNET.get(tokenMint.toBase58());
        if (!assetMeta || !assetMeta.oracle) {
          throw new Error(`Oracle unavailable for asset ${tokenMint}`);
        }
        oracles.push(assetMeta.oracle);
        this._lookupTables.add(vaultLookupTable); // cache lookup table
      }
    });
    const kvaultPdas = await this.kvaults.getVaultPdasByShareMints(shareMints);
    kvaultPdas.forEach((p) => this._kaminoVaults.add(p)); // cache kvault keys

    const remainingAccounts = [] as AccountMeta[];

    // first 4N remaining accounts are N tuples of (kvault_shares_ata, kvault_shares_mint, kvault_state, kvault_deposit_asset_oracle)
    for (let i = 0; i < shareAtas.length; i++) {
      [shareAtas[i], shareMints[i], kvaultPdas[i], oracles[i]].map((pubkey) => {
        remainingAccounts.push({
          pubkey,
          isSigner: false,
          isWritable: false,
        });
      });
    }

    const marketsAndReserves = (
      await Promise.all(
        kvaultStates.map((kvault) => {
          return this.kvaults.composeRemainingAccounts(
            kvault.vaultAllocationStrategy.filter(
              (alloc) => !alloc.reserve.equals(PublicKey.default),
            ),
            true,
          );
        }),
      )
    ).flat();

    const processed = new PkSet();
    const reserves = [] as PublicKey[];
    const markets = [] as PublicKey[];
    const chunkSize = 2;
    for (let i = 0; i < marketsAndReserves.length; i += chunkSize) {
      const chunk = marketsAndReserves.slice(i, i + chunkSize);
      const market = chunk[0].pubkey;
      const reserve = chunk[1].pubkey;

      // reserve should always be added to remaining accounts
      remainingAccounts.push(chunk[1]);

      // record reserves and markets for refreshReservesBatchIx
      if (!processed.has(reserve)) {
        reserves.push(reserve);
        markets.push(market);
        processed.add(reserve);
      }
    }

    const parsedReserves = await this.klend.fetchAndParseReserves(reserves);
    const refreshReservesIx = this.klend.txBuilder.refreshReservesBatchIx(
      parsedReserves,
      false, // always update prices
    );
    const preInstructions = [refreshReservesIx];

    const priceIx = await this.base.mintProgram.methods
      .priceKaminoVaultShares(shareAtas.length)
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return [...preInstructions, priceIx];
  }

  /**
   * Returns an instruction that prices all Drift users (aka sub-accounts) controlled by the GLAM vault.
   */
  public async priceDriftUsersIx(): Promise<TransactionInstruction | null> {
    // 1st remaining account is user_stats, all sub accounts share the same user_stats
    const { userStats } = this.drift.getDriftUserPdas();
    const remainingAccounts = [
      { pubkey: userStats, isSigner: false, isWritable: false },
    ];

    const driftUsers = await this.drift.fetchAndParseDriftUsers();
    driftUsers.forEach((user) => {
      remainingAccounts.push({
        pubkey: user.getAddress(),
        isSigner: false,
        isWritable: false,
      });
    });

    if (driftUsers.length === 0) {
      return null;
    }

    // Build a set of markets and oracles that are used by all sub accounts
    const marketsAndOracles = new PkSet();
    const spotMarketIndexes = new Set<number>(
      driftUsers.map((u) => u.spotPositions.map((p) => p.marketIndex)).flat(),
    );
    const perpMarketIndexes = new Set<number>(
      driftUsers.map((u) => u.perpPositions.map((p) => p.marketIndex)).flat(),
    );
    const spotMarkets = await this.drift.fetchAndParseSpotMarkets(
      Array.from(spotMarketIndexes),
    );
    const perpMarkets = await this.drift.fetchAndParsePerpMarkets(
      Array.from(perpMarketIndexes),
    );
    spotMarkets.forEach((m) => {
      marketsAndOracles.add(m.oracle);
      marketsAndOracles.add(m.marketPda);
    });
    perpMarkets.forEach((m) => {
      marketsAndOracles.add(m.oracle);
      marketsAndOracles.add(m.marketPda);
    });

    // Add markets and oracles to remaining accounts
    Array.from(marketsAndOracles).map((pubkey) =>
      remainingAccounts.push({
        pubkey,
        isSigner: false,
        isWritable: false,
      }),
    );

    const priceDriftUsersIx = await this.base.mintProgram.methods
      .priceDriftUsers(driftUsers.length)
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return priceDriftUsersIx;
  }

  /**
   * Returns an instruction that prices a drift vault depositor.
   * If there are no vault depositor accounts, returns null.
   */
  public async priceDriftVaultDepositorsIx(): Promise<TransactionInstruction | null> {
    const parsedVaultDepositors =
      await this.dvaults.findAndParseVaultDepositors();

    if (parsedVaultDepositors.length === 0) {
      return null;
    }

    const { remainingAccounts, numSpotMarkets, numPerpMarkets } =
      await this.remainingAccountsForPricingDriftVaultDepositors(
        parsedVaultDepositors,
      );

    const priceIx = await this.base.mintProgram.methods
      .priceDriftVaultDepositors(
        parsedVaultDepositors.length,
        numSpotMarkets,
        numPerpMarkets,
      )
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return priceIx;
  }

  /**
   * Returns an instruction that prices vault balance and tokens
   */
  async priceVaultTokensIx(): Promise<TransactionInstruction> {
    const remainingAccounts =
      await this.remainingAccountsForPricingVaultAssets();
    const aggIndexes: number[][] = [];
    const chunkSize = 3;
    for (let i = 0; i < remainingAccounts.length; i += chunkSize) {
      const chunk = remainingAccounts.slice(i, i + chunkSize);
      const mint = chunk[1].pubkey;
      const aggIndex = ASSETS_MAINNET.get(mint.toBase58())?.aggIndex || -1;
      aggIndexes.push([aggIndex, -1, -1, -1]);
    }
    // Add oracle mapping if agg oracle is used for any token
    if (aggIndexes.flat().find((i) => i >= 0)) {
      remainingAccounts.push({
        pubkey: new PublicKey("Chpu5ZgfWX5ZzVpUx9Xvv4WPM75Xd7zPJNDPsFnCpLpk"),
        isSigner: false,
        isWritable: false,
      });
    }

    const priceVaultIx = await this.base.mintProgram.methods
      .priceVaultTokens(aggIndexes)
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
    return priceVaultIx;
  }

  /**
   * Returns an instruction that prices stake accounts.
   * If there are no stake accounts, returns null.
   */
  async priceStakeAccountsIx(): Promise<TransactionInstruction | null> {
    const stakes = await findStakeAccounts(
      this.base.connection,
      this.base.vaultPda,
    );
    if (stakes.length === 0) {
      return null;
    }
    const priceStakesIx = await (this.base.mintProgram.methods as any)
      .priceStakeAccounts()
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle: SOL_ORACLE,
        baseAssetOracle: await this.getbaseAssetOracle(),
      })
      .remainingAccounts(
        stakes.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();
    return priceStakesIx;
  }

  public async priceVaultIxs(): Promise<TransactionInstruction[]> {
    // Cache state model
    this.cachedStateModel = await this.base.fetchStateModel();

    if (
      StateAccountType.equals(
        this.cachedStateModel.accountType,
        StateAccountType.SINGLE_ASSET_VAULT,
      )
    ) {
      const baseAssetAta = this.base.getVaultAta(
        this.cachedStateModel.baseAssetMint,
        this.cachedStateModel.baseAssetTokenProgramId,
      );
      const ix = await this.base.mintProgram.methods
        .priceSingleAssetVault()
        .accounts({
          glamState: this.base.statePda,
          baseAssetAta,
        })
        .instruction();
      return [ix];
    }

    const priceVaultIx = await this.priceVaultTokensIx();

    // If there are no external assets, we don't need to price DeFi positions
    if ((this.cachedStateModel.externalPositions || []).length === 0) {
      return [priceVaultIx];
    }

    const pricingIxs = [priceVaultIx];
    const integrationAcls = this.cachedStateModel.integrationAcls || [];

    const driftIntegrationAcl = integrationAcls.find((acl) =>
      acl.integrationProgram.equals(this.base.extDriftProgram.programId),
    );
    if (driftIntegrationAcl) {
      // drift protocol
      if (driftIntegrationAcl.protocolsBitmask & 0b01) {
        const ix = await this.priceDriftUsersIx();
        if (ix) pricingIxs.push(ix);
      }
      // drift vaults
      if (driftIntegrationAcl.protocolsBitmask & 0b10) {
        const ix = await this.priceDriftVaultDepositorsIx();
        if (ix) pricingIxs.push(ix);
      }
    }

    const kaminoIntegrationAcl = integrationAcls.find((acl) =>
      acl.integrationProgram.equals(this.base.extKaminoProgram.programId),
    );
    if (kaminoIntegrationAcl) {
      // kamino lending
      if (kaminoIntegrationAcl.protocolsBitmask & 0b01) {
        const ixs = await this.priceKaminoObligationsIxs();
        pricingIxs.push(...ixs);
      }
      // kamino vaults
      if (kaminoIntegrationAcl.protocolsBitmask & 0b10) {
        const ixs = await this.priceKaminoVaultSharesIx();
        if (ixs) pricingIxs.push(...ixs);
      }
    }

    const nativeIntegrationAcl = integrationAcls.find((acl) =>
      acl.integrationProgram.equals(this.base.protocolProgram.programId),
    );
    if (nativeIntegrationAcl) {
      // stake program
      if (nativeIntegrationAcl.protocolsBitmask & 0b10) {
        const ix = await this.priceStakeAccountsIx();
        if (ix) pricingIxs.push(ix);
      }
    }

    return pricingIxs.filter(Boolean);
  }

  public async validateAumIx(): Promise<TransactionInstruction> {
    return await this.base.mintProgram.methods
      .validateAum()
      .accounts({
        glamState: this.base.statePda,
      })
      .instruction();
  }

  async getbaseAssetOracle() {
    const { baseAssetMint } =
      this.cachedStateModel || (await this.base.fetchStateModel());
    const assetMeta = ASSETS_MAINNET.get(baseAssetMint.toBase58());
    if (!assetMeta) {
      throw new Error(`Unsupported base asset: ${baseAssetMint}`);
    }
    return assetMeta.oracle;
  }

  async remainingAccountsForPricingDriftVaultDepositors(
    parsedVaultDepositors: {
      address: PublicKey;
      driftVault: PublicKey;
      shares: any;
    }[],
  ): Promise<{
    remainingAccounts: AccountMeta[];
    numSpotMarkets: number;
    numPerpMarkets: number;
  }> {
    // Extra accounts for pricing N vault depositors:
    // - (vault_depositor, drift_vault, drift_user) x N
    // - spot_market used by drift users of vaults (no specific order)
    // - perp markets used by drift users of vaults (no specific order)
    // - oracles of spot markets and perp markets (no specific order)
    const remainingAccounts: AccountMeta[] = [];
    const spotMarketsSet = new PkSet();
    const perpMarketsSet = new PkSet();
    const oraclesSet = new PkSet();
    for (const { address: depositor, driftVault } of parsedVaultDepositors) {
      const { user } = await this.dvaults.parseDriftVault(driftVault); // get drift user used by the vault
      [depositor, driftVault, user].forEach((k) =>
        remainingAccounts.push({
          pubkey: k,
          isSigner: false,
          isWritable: false,
        }),
      );

      const { spotPositions, perpPositions } =
        await this.dvaults.fetchUserPositions(user);
      const spotMarketIndexes = spotPositions.map((p) => p.marketIndex);
      const perpMarketIndexes = perpPositions.map((p) => p.marketIndex);

      // If there are perp positions, add spot market 0 as it's used as quote market for perp
      if (perpMarketIndexes.length > 0 && !spotMarketIndexes.includes(0)) {
        spotMarketIndexes.push(0);
      }

      const spotMarkets =
        await this.drift.fetchAndParseSpotMarkets(spotMarketIndexes);
      const perpMarkets =
        await this.drift.fetchAndParsePerpMarkets(perpMarketIndexes);

      spotMarkets.forEach((m) => {
        oraclesSet.add(m.oracle);
        spotMarketsSet.add(m.marketPda);
      });
      perpMarkets.forEach((m) => {
        oraclesSet.add(m.oracle);
        perpMarketsSet.add(m.marketPda);
      });
    }

    [...spotMarketsSet, ...perpMarketsSet, ...oraclesSet].forEach((pubkey) =>
      remainingAccounts.push({
        pubkey,
        isSigner: false,
        isWritable: false,
      }),
    );

    return {
      remainingAccounts,
      numSpotMarkets: spotMarketsSet.size,
      numPerpMarkets: perpMarketsSet.size,
    };
  }

  async remainingAccountsForPricingVaultAssets(): Promise<AccountMeta[]> {
    const stateModel = await this.base.fetchStateModel();
    return stateModel.assetsForPricing
      .map((mint) => {
        const assetMeta = ASSETS_MAINNET.get(mint.toBase58());
        if (!assetMeta) {
          throw new Error(`Asset meta not found for ${mint}`);
        }
        const ata = this.base.getVaultAta(mint, assetMeta?.programId);
        return [ata, mint, assetMeta.oracle];
      })
      .flat()
      .map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      }));
  }
}
