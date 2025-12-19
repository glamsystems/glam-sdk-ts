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
import { StateModel } from "../models";
import { DriftProtocolClient, DriftVaultsClient } from "./drift";
import {
  bfToDecimal,
  findStakeAccounts,
  Fraction,
  MarketType,
  PkMap,
  PkSet,
  SpotBalanceType,
  toUiAmount,
} from "../utils";
import Decimal from "decimal.js";
import {
  AccountLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { KAMINO_LENDING_PROGRAM, KAMINO_OBTRIGATION_SIZE } from "../constants";
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
    readonly jupiterApi: JupiterApiClient,
  ) {}

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
   * @param commitment Commitment level for fetching accounts
   * @param priceBaseAssetMint Price reference/numeraire asset mint (default: USD)
   * @returns VaultHoldings object containing all holdings
   */
  async getVaultHoldings(
    commitment: Commitment,
    priceBaseAssetMint: PublicKey = PublicKey.default,
  ): Promise<VaultHoldings> {
    const { integrationAcls, externalPositions } =
      await this.base.fetchStateAccount(); // fetch state account only, don't need to build entire state model
    const externalPositionsSet = new PkSet(externalPositions);

    let glamDriftUserSpotMarketsMap = new PkMap<PkSet>(); // glam-controlled drift user -> spot markets map
    let dvaultDepositorsAndVaults = new PkMap<DriftVault>(); // dvault depositor -> drift vault map
    let dvaultUserSpotMarketsMap = new PkMap<PkSet>(); // dvault drift user -> spot markets map
    let dvaultUserPerpMarketsMap = new PkMap<PkSet>(); // dvault drift user -> perp markets map

    let kaminoPubkeys = new PkMap<PkSet>(); // obligation -> reserves map
    let kvaultAtasAndStates = new PkMap<KVaultState>(); // kvault share ata -> kvault state
    let kvaultReserves = new PkSet();

    const driftIntegrationAcl = integrationAcls.find((acl) =>
      acl.integrationProgram.equals(this.base.extDriftProgram.programId),
    );
    if (driftIntegrationAcl) {
      // drift protocol, fetch up to 8 sub-accounts (aka drift users)
      if (driftIntegrationAcl.protocolsBitmask & 0b01) {
        const userPdas = Array.from(Array(8).keys()).map((subAccountId) => {
          const { user } = this.drift.getDriftUserPdas(subAccountId);
          return user;
        });
        glamDriftUserSpotMarketsMap = await this.getPubkeysForSpotHoldings(
          userPdas,
          commitment,
        );
      }
      if (driftIntegrationAcl.protocolsBitmask & 0b10) {
        // 1. find all depositors
        // 2. for each depositor, calculate the underlying drift vault AUM
        //    2.1 fetch drift vault's user accout
        //    2.2 price drift vault's spot positions and perp PnL
        //    2.3 drift vault AUM = spot value + perp PnL
        // 3. glam vault holding = deposit_share / total_shares * drift vault AUM
        dvaultDepositorsAndVaults =
          await this.getDepositorsAndDriftVaults(commitment);
        const userPdas = Array.from(dvaultDepositorsAndVaults.values()).map(
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
    }

    const kaminoIntegrationAcl = integrationAcls.find((acl) =>
      acl.integrationProgram.equals(this.base.extKaminoProgram.programId),
    );
    if (kaminoIntegrationAcl) {
      // kamino lending
      if (kaminoIntegrationAcl.protocolsBitmask & 0b01) {
        kaminoPubkeys = await this.getPubkeysForKaminoHoldings(commitment);
      }
      // kamino vaults
      if (kaminoIntegrationAcl.protocolsBitmask & 0b10) {
        kvaultAtasAndStates = await this.getKaminoVaultStates(
          externalPositionsSet,
          commitment,
        );
        // from each kvault state we can get the allocations (including reserves)
        Array.from(kvaultAtasAndStates.pkEntries()).map(([_, kvaultState]) => {
          kvaultState.validAllocations.forEach(({ reserve }) => {
            kvaultReserves.add(reserve);
          });
        });
      }
    }

    const tokenPubkeys = await this.getPubkeysForTokenHoldings(
      externalPositionsSet,
      commitment,
    );

    const glamDriftUsers = Array.from(glamDriftUserSpotMarketsMap.pkKeys());
    const glamDriftSpotMarkets = [...glamDriftUserSpotMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();

    const dvaultDepositors = Array.from(dvaultDepositorsAndVaults.pkKeys());
    const dvaultUsers = [...dvaultDepositorsAndVaults.values()].map(
      (v) => v.user,
    );
    const dvaultUserSpotMarkets = [...dvaultUserSpotMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();
    const dvaultUserPerpMarkets = [...dvaultUserPerpMarketsMap.values()]
      .map((s) => Array.from(s.pkValues()))
      .flat();

    const kaminoObligations = Array.from(kaminoPubkeys.pkKeys());
    const kaminoReserves = [...kaminoPubkeys.values()]
      .map((v) => Array.from(v.pkValues()))
      .flat()
      .concat(Array.from(kvaultReserves));
    const kvaultAtas = Array.from(kvaultAtasAndStates.pkKeys());

    // Dedupe keys and fetch all accounts in a single RPC call
    const pubkeys = Array.from(
      new PkSet([
        ...tokenPubkeys,
        ...glamDriftUsers,
        ...glamDriftSpotMarkets,
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
    } = await this.base.provider.connection.getMultipleAccountsInfoAndContext(
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
    const tokenList = await this.jupiterApi.fetchTokensList();
    tokenList.forEach((item) => {
      const tokenMint = new PublicKey(item.address);
      tokenPricesMap.set(tokenMint, item);
    });

    const tokenHoldings = this.getTokenHoldings(
      tokenPubkeys,
      accountsDataMap,
      tokenPricesMap,
      "Jupiter",
    );
    const driftSpotHoldings = this.getDriftSpotHoldings(
      glamDriftUserSpotMarketsMap.pkKeys(),
      driftSpotMarketsMap,
      accountsDataMap,
      tokenPricesMap,
      "Jupiter",
    );
    const dvaultHoldings = this.getDriftVaultsHoldings(
      dvaultDepositorsAndVaults,
      dvaultDepositorsMap,
      driftSpotMarketsMap,
      driftPerpMarketsMap,
      accountsDataMap,
      tokenPricesMap,
      "Jupiter",
    );

    const kaminoLendHoldings = this.getKaminoLendHoldings(
      kaminoPubkeys.pkKeys(),
      kaminoReservesMap,
      accountsDataMap,
      tokenPricesMap,
      "Jupiter",
    );
    const kaminoVaultsHoldings = this.getKaminoVaultsHoldings(
      kvaultAtasAndStates,
      kaminoReservesMap,
      accountsDataMap,
      tokenPricesMap,
      "Jupiter",
    );

    const clockData = accountsDataMap.get(SYSVAR_CLOCK_PUBKEY);
    const timestamp = clockData ? clockData.readUInt32LE(32) : 0;
    const ret = new VaultHoldings(
      this.base.statePda,
      this.base.vaultPda,
      priceBaseAssetMint,
      slot,
      timestamp,
      commitment,
    );
    tokenHoldings.forEach((holding) => ret.add(holding));
    driftSpotHoldings.forEach((holding) => ret.add(holding));
    dvaultHoldings.forEach((holding) => ret.add(holding));
    kaminoLendHoldings.forEach((holding) => ret.add(holding));
    kaminoVaultsHoldings.forEach((holding) => ret.add(holding));
    return ret;
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

  async getDepositorsAndDriftVaults(
    commitment?: Commitment,
  ): Promise<PkMap<DriftVault>> {
    const depositorVaultMap = new PkMap<DriftVault>(); // depositor pubkey -> drift vault
    const depositors =
      await this.dvaults.findAndParseVaultDepositors(commitment);
    const parsedDriftVaults = await this.dvaults.parseDriftVaults(
      depositors.map((d) => d.driftVault),
    );
    if (depositors.length != parsedDriftVaults.length) {
      throw new Error(
        `Depositors length ${depositors.length} does not match parsed drift vaults length ${parsedDriftVaults.length}`,
      );
    }

    for (let i = 0; i < depositors.length; i++) {
      depositorVaultMap.set(depositors[i].address, parsedDriftVaults[i]);
    }

    return depositorVaultMap;
  }

  async getKaminoVaultStates(
    externalPositionsSet: PkSet,
    commitment?: Commitment,
  ): Promise<PkMap<KVaultState>> {
    // Get all kvault states and share token mints
    const allKvaultStates =
      await this.kvaults.findAndParseKaminoVaults(commitment);
    const allKvaultMints = allKvaultStates.map((kvault) => kvault.sharesMint);
    const possibleShareAtas = allKvaultMints.map((mint) =>
      this.base.getVaultAta(mint),
    );
    const possibleShareAtaAccountsInfo =
      await this.base.provider.connection.getMultipleAccountsInfo(
        possibleShareAtas,
        commitment,
      );

    const map = new PkMap<KVaultState>();
    possibleShareAtaAccountsInfo.forEach((info, i) => {
      // share ata must exist and it must be tracked by glam state
      const ata = possibleShareAtas[i];
      if (info !== null && externalPositionsSet.has(possibleShareAtas[i])) {
        map.set(ata, allKvaultStates[i]);
      }
    });
    return map;
  }

  async getPubkeysForKaminoHoldings(
    commitment?: Commitment,
  ): Promise<PkMap<PkSet>> {
    const obligationAccounts =
      await this.base.provider.connection.getProgramAccounts(
        KAMINO_LENDING_PROGRAM,
        {
          commitment,
          filters: [
            { dataSize: KAMINO_OBTRIGATION_SIZE },
            { memcmp: { offset: 64, bytes: this.base.vaultPda.toBase58() } },
          ],
        },
      );
    if (obligationAccounts.length === 0) {
      return new PkMap<PkSet>();
    }

    const obligationReservesMap = new PkMap<PkSet>();
    for (const { pubkey, account } of obligationAccounts) {
      const { activeDeposits, activeBorrows } = Obligation.decode(
        pubkey,
        account.data,
      );
      const reservesSet = new PkSet([
        ...activeDeposits.map((d) => d.depositReserve),
        ...activeBorrows.map((b) => b.borrowReserve),
      ]);
      obligationReservesMap.set(pubkey, reservesSet);
    }

    return obligationReservesMap;
  }

  getTokenHoldings(
    tokenAccountPubkeys: PublicKey[],
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Holding[] {
    const holdings: Holding[] = [];
    if (tokenAccountPubkeys.length === 0) {
      return holdings;
    }

    for (const pubkey of tokenAccountPubkeys) {
      const data = accountsDataMap.get(pubkey);
      if (!data) continue;

      const { amount, mint } = AccountLayout.decode(data);

      const tokenInfo = tokenPricesMap.get(mint);
      if (tokenInfo) {
        const { decimals, usdPrice } = tokenInfo;
        const holding = new Holding(
          mint,
          decimals,
          new BN(amount),
          usdPrice,
          { slot: tokenInfo.slot, source: priceSource },
          "Token",
          {
            tokenAccount: pubkey,
          },
        );
        holdings.push(holding);
      }
    }

    return holdings;
  }

  getDriftSpotHoldings(
    userPubkeys: Iterable<PublicKey>,
    spotMarketsMap: PkMap<DriftSpotMarket>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Holding[] {
    const holdings: Holding[] = [];

    for (const userPda of userPubkeys) {
      const userData = accountsDataMap.get(userPda);
      if (!userData) continue;

      const { spotPositions } = DriftUser.decode(userPda, userData);

      for (const { marketIndex, scaledBalance, balanceType } of spotPositions) {
        const marketPda = this.drift.getMarketPda(MarketType.SPOT, marketIndex);
        const spotMarket = spotMarketsMap.get(marketPda);
        if (!spotMarket) continue;

        const amount = spotMarket
          .calcSpotBalanceBn(scaledBalance, balanceType)
          .abs();

        const direction = Object.keys(balanceType)[0] as "deposit" | "borrow";
        const tokenPrice = tokenPricesMap.get(spotMarket.mint);
        if (!tokenPrice) continue;

        const { usdPrice, slot } = tokenPrice;
        const holding = new Holding(
          spotMarket.mint,
          spotMarket.decimals,
          amount,
          usdPrice,
          { slot, source: priceSource },
          "DriftProtocol",
          {
            user: userPda,
            marketIndex,
            direction,
          },
        );
        holdings.push(holding);
      }
    }

    return holdings;
  }

  getDriftVaultsHoldings(
    dvaultDepositorsAndVaults: PkMap<DriftVault>,
    dvaultDepositorsMap: PkMap<DriftVaultDepositor>,
    spotMarketsMap: PkMap<DriftSpotMarket>,
    perpMarketsMap: PkMap<DriftPerpMarket>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Holding[] {
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
      const amount = depositor.vaultShares.mul(aum).div(dvault.totalShares);
      const { mint, decimals } = dvault.getBaseAsset(spotMarketsMap);
      const tokenPrice = tokenPricesMap.get(mint);
      if (!tokenPrice) continue;

      const { usdPrice, slot } = tokenPrice;
      const holding = new Holding(
        mint,
        decimals,
        amount,
        usdPrice,
        { slot, source: priceSource },
        "DriftVaults",
        {
          vault: pubkey,
          depositor: depositor.getAddress(),
        },
      );
      holdings.push(holding);
    }
    return holdings;
  }

  getKaminoLendHoldings(
    obligationPubkeys: Iterable<PublicKey>,
    reservesMap: PkMap<Reserve>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Holding[] {
    const holdings: Holding[] = [];
    for (const obligation of obligationPubkeys) {
      const obligationData = accountsDataMap.get(obligation);
      if (!obligationData) continue;

      const { activeDeposits, activeBorrows } = Obligation.decode(
        obligation,
        obligationData,
      );

      for (const { depositReserve, depositedAmount } of activeDeposits) {
        const reserve = reservesMap.get(depositReserve);
        if (!reserve) continue;

        const { collateralExchangeRate, lendingMarket, liquidity } = reserve;
        const supplyAmount = new Decimal(depositedAmount.toString())
          .div(collateralExchangeRate)
          .floor();
        const amount = new BN(supplyAmount.toString());

        const tokenPrice = tokenPricesMap.get(liquidity.mintPubkey);
        if (!tokenPrice) continue;

        const { usdPrice, slot } = tokenPrice;
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
        const reserve = reservesMap.get(borrowReserve);
        if (!reserve) continue;

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

        const tokenPrice = tokenPricesMap.get(liquidity.mintPubkey);
        if (!tokenPrice) continue;

        const { usdPrice, slot } = tokenPrice;
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

  getKaminoVaultsHoldings(
    kvaultAtasAndStates: PkMap<KVaultState>,
    reservesMap: PkMap<Reserve>,
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    priceSource: string,
  ): Holding[] {
    const holdings: Holding[] = [];
    for (const [ata, kvaultState] of kvaultAtasAndStates.pkEntries()) {
      const ataData = accountsDataMap.get(ata);
      if (!ataData) continue;

      const tokenAccount = AccountLayout.decode(ataData);

      let aum = new Decimal(kvaultState.tokenAvailable.toString());
      kvaultState.validAllocations.map((allocation) => {
        const reserve = reservesMap.get(allocation.reserve);
        if (!reserve) return;

        const { collateralExchangeRate } = reserve;

        // allocation ctoken amount to liq asset amount
        const liqAmount = new Decimal(allocation.ctokenAllocation.toString())
          .div(collateralExchangeRate)
          .floor();
        aum = aum.add(liqAmount);
      });

      // calculate liquidity token amount
      const amount = new Decimal(tokenAccount.amount.toString())
        .div(new Decimal(kvaultState.sharesIssued.toString()))
        .mul(aum)
        .floor();

      const tokenPrice = tokenPricesMap.get(kvaultState.tokenMint);
      if (!tokenPrice) continue;

      const { usdPrice, slot } = tokenPrice;
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
      await this.base.provider.connection.getMultipleAccountsInfo(
        possibleShareAtas,
      );
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
    const priceStakesIx = await this.base.mintProgram.methods
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
