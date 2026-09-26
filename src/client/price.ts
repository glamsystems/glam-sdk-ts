import {
  AccountInfo,
  AccountMeta,
  AddressLookupTableAccount,
  Commitment,
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { fetchAddressLookupTableAccounts } from "../utils/lookupTables";
import { BN } from "@coral-xyz/anchor";
import { KaminoLendingClient, KaminoVaultsClient } from "./kamino";
import {
  collectKaminoReserveOracleOverrides,
  collectKaminoReserveOracles,
  kaminoReserveRefreshIx,
} from "./kamino/oracles";
import { OrcaWhirlpoolsClient } from "./orca";
import { MarginfiClient } from "./marginfi";

import { BaseClient } from "./base";

import { StateAccountType, StateModel } from "../models";
import {
  bfToDecimal,
  findStakeAccounts,
  Fraction,
  getProgramAccounts,
  getGlobalConfigPda,
  getIntegrationAuthorityPda,
  extPricerIx,
  extRegisteredPositionsPricerIx,
  ExtPositionPricerName,
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
  unpackMint,
} from "@solana/spl-token";
import { KVaultState, Obligation, Reserve } from "../deser";
import { JupiterApiClient, TokenListItem } from "../utils/jupiterApi";
import {
  MARGINFI_PROGRAM_ID,
  MARINADE_PROGRAM_ID,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID,
  SANCTUM_STAKE_POOL_PROGRAM_ID,
  SPL_STAKE_POOL_PROGRAM_ID,
  USDC,
  WSOL,
} from "../constants";
import { STAKE_POOLS_MAP } from "../assets";
import { BridgeClient, getActiveRegistryTransfers } from "./bridge";
import { RpiClient } from "./rpi";
import {
  LoopscaleBorrowClient,
  LoopscaleLendClient,
  LoopscaleVaultClient,
} from "./loopscale";
import {
  RPI_PROTOCOL,
  BRIDGE_CCTP_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  KAMINO_VAULTS_PROTOCOL,
  LAYERZERO_OFT_PROTOCOL,
  JUPITER_BORROW_PROTOCOL,
  JUPITER_EARN_PROTOCOL,
  LOOPSCALE_BORROW_PROTOCOL,
  LOOPSCALE_LENDING_PROTOCOL,
  LOOPSCALE_VAULT_PROTOCOL,
  MARGINFI_PROTOCOL,
  ORCA_WHIRLPOOLS_PROTOCOL,
  PHOENIX_PROTOCOL,
  STAKE_PROTOCOL,
} from "../protocols";
import {
  getNeutralOracleDataPda,
  getNeutralUserBundlePda,
  NT_BUNDLE_PROTOCOL,
  NeutralBundleAccount,
  NTBUNDLE_PROGRAM_ID,
} from "./neutral";
import {
  MIN_TICK,
  buildUpdateExchangePricesIx,
  buildUpdateRateIx,
  fetchLendingByFTokenMint,
  fetchLendingReserveAndVault,
  fetchPositionInfo,
  fetchVaultConfigInfo,
  getTickPda,
  getVaultConfigPda,
  getVaultStatePda,
} from "./jupiter-lend/shared";

const PHOENIX_GLOBAL_CONFIG_PERP_ASSET_MAP_OFFSET = 360;
const PUBKEY_LEN = 32;
const PHOENIX_TRADER_DISCRIMINATOR = [41, 97, 73, 105, 110, 214, 112, 9];
const PHOENIX_REQUEST_HEAP_FRAME_BYTES = 256 * 1024;
const ORCA_PRICING_MAX_ACCOUNT_KEYS = 64;
const NT_BUNDLE_ACCOUNT_DISCRIMINATOR = Buffer.from([
  15, 82, 167, 230, 37, 214, 82, 80,
]);
// The owners glam_protocol accepts for a stake pool state, StakePoolProgramInterface::ids()
// in anchor_v1/libs/common/src/interfaces.rs.
const STAKE_POOL_PROGRAM_IDS = [
  SPL_STAKE_POOL_PROGRAM_ID,
  SANCTUM_STAKE_POOL_PROGRAM_ID,
  SANCTUM_MULTI_VALIDATOR_STAKE_POOL_PROGRAM_ID,
];
// The StakePool prefix glam_protocol reads, anchor_v1/libs/common/src/stake_pool.rs:
// AccountType::StakePool in byte 0, pool_mint at 162, 282 bytes of fixed prefix. The
// audited anchor/ copy reaches the same verdict for a live pool account by borsh
// deserializing the whole StakePool (anchor/programs/glam_protocol/src/state/price/oracle.rs,
// validate_oracle's StakePool::deserialize call).
const STAKE_POOL_ACCOUNT_TYPE = 1;
const STAKE_POOL_POOL_MINT_OFFSET = 162;
const STAKE_POOL_FIXED_PREFIX_LEN = 282;
// The Marinade State account, anchor_v1/deps/gen/marinade/finance_gen/src/lib.rs:
// the discriminator, then msol_mint as the first field.
const MARINADE_STATE_DISCRIMINATOR = Buffer.from([
  216, 146, 107, 94, 104, 75, 182, 177,
]);
const MARINADE_STATE_MSOL_MINT_OFFSET = 8;

/**
 * States what stopped the pricing of an unregistered liquid staking token, what
 * is still true, and what to do next.
 */
function lstPricingError(
  mint: PublicKey,
  poolState: PublicKey,
  found: string,
): Error {
  return new Error(
    `Pricing ${mint} through pool state ${poolState} stopped because ${found}. ` +
      `No pricing instruction was built, so the vault's pricing is unchanged. ` +
      `Register ${mint} in GlobalConfig or check that ${poolState} is the pool state of that token.`,
  );
}

/**
 * Checks a pool state account the way glam_protocol's validate_oracle checks it
 * before it reads GlobalConfig: a stake pool account owned by one of the stake
 * pool programs whose pool_mint is the mint, or a Marinade state whose msol_mint
 * is the mint.
 */
function validateLstPoolState(
  mint: PublicKey,
  poolState: PublicKey,
  accountInfo: AccountInfo<Buffer> | null,
) {
  if (!accountInfo) {
    throw lstPricingError(mint, poolState, "that account was not found");
  }

  const { data, owner } = accountInfo;
  if (STAKE_POOL_PROGRAM_IDS.some((programId) => owner.equals(programId))) {
    if (data.length < STAKE_POOL_FIXED_PREFIX_LEN) {
      throw lstPricingError(
        mint,
        poolState,
        `that account holds ${data.length} bytes and a stake pool prefix needs ${STAKE_POOL_FIXED_PREFIX_LEN}`,
      );
    }
    if (data[0] !== STAKE_POOL_ACCOUNT_TYPE) {
      throw lstPricingError(
        mint,
        poolState,
        `its account type byte is ${data[0]} and a stake pool is ${STAKE_POOL_ACCOUNT_TYPE}`,
      );
    }
    const poolMint = new PublicKey(
      data.subarray(
        STAKE_POOL_POOL_MINT_OFFSET,
        STAKE_POOL_POOL_MINT_OFFSET + PUBKEY_LEN,
      ),
    );
    if (!poolMint.equals(mint)) {
      throw lstPricingError(
        mint,
        poolState,
        `the pool mint it names is ${poolMint}`,
      );
    }
    return;
  }

  if (owner.equals(MARINADE_PROGRAM_ID)) {
    if (data.length < MARINADE_STATE_MSOL_MINT_OFFSET + PUBKEY_LEN) {
      throw lstPricingError(
        mint,
        poolState,
        `that account holds ${data.length} bytes and a Marinade state needs ${MARINADE_STATE_MSOL_MINT_OFFSET + PUBKEY_LEN}`,
      );
    }
    if (
      !data
        .subarray(0, MARINADE_STATE_DISCRIMINATOR.length)
        .equals(MARINADE_STATE_DISCRIMINATOR)
    ) {
      throw lstPricingError(
        mint,
        poolState,
        "its first bytes are not the Marinade state discriminator",
      );
    }
    const msolMint = new PublicKey(
      data.subarray(
        MARINADE_STATE_MSOL_MINT_OFFSET,
        MARINADE_STATE_MSOL_MINT_OFFSET + PUBKEY_LEN,
      ),
    );
    if (!msolMint.equals(mint)) {
      throw lstPricingError(
        mint,
        poolState,
        `the mSOL mint it names is ${msolMint}`,
      );
    }
    return;
  }

  throw lstPricingError(
    mint,
    poolState,
    `that account is owned by ${owner} and not by a stake pool program or the Marinade program`,
  );
}

/**
 * States what stopped the pricing because the mint account itself is missing or is
 * owned by neither token program, and what to check about that mint account.
 */
function lstMintAccountError(
  mint: PublicKey,
  poolState: PublicKey,
  found: string,
): Error {
  return new Error(
    `Pricing ${mint} through pool state ${poolState} stopped because ${found}. ` +
      `No pricing instruction was built, so the vault's pricing is unchanged. ` +
      `Check that ${mint} is a token mint owned by the Token or Token 2022 program.`,
  );
}

/**
 * Returns the token program that owns the mint, which is the program its vault
 * ata is derived under.
 */
function lstMintTokenProgram(
  mint: PublicKey,
  poolState: PublicKey,
  accountInfo: AccountInfo<Buffer> | null,
): PublicKey {
  if (!accountInfo) {
    throw lstMintAccountError(
      mint,
      poolState,
      "its mint account was not found",
    );
  }
  const { owner } = accountInfo;
  if (!owner.equals(TOKEN_PROGRAM_ID) && !owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw lstMintAccountError(
      mint,
      poolState,
      `its mint account is owned by ${owner} and not by a token program`,
    );
  }
  return owner;
}

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
 * Includes token balances and supported DeFi positions.
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

type ParsedKaminoObligation = Awaited<
  ReturnType<KaminoLendingClient["findAndParseObligations"]>
>[number];

type PricingChunk = {
  ixs: TransactionInstruction[];
  kaminoReserves: PublicKey[];
};

export class PriceClient {
  private _stateModel: StateModel | null = null;
  private _lookupTables = new PkMap<AddressLookupTableAccount>();
  private _kaminoVaults = new PkSet();
  private _priceVaultIxsQueue: Promise<unknown> = Promise.resolve();

  public constructor(
    readonly base: BaseClient,
    readonly klend: KaminoLendingClient,
    readonly kvaults: KaminoVaultsClient,
    readonly bridge: BridgeClient,
    readonly rpi: RpiClient,
    readonly loopscaleBorrow: LoopscaleBorrowClient,
    readonly loopscaleLend: LoopscaleLendClient,
    readonly loopscaleVault: LoopscaleVaultClient,
    readonly marginfi: MarginfiClient,
    private readonly getJupiterApi: () => JupiterApiClient,
  ) {}

  get jupiterApi(): JupiterApiClient {
    return this.getJupiterApi();
  }

  get cachedStateModel(): StateModel | null {
    return this._stateModel;
  }

  set cachedStateModel(stateModel: StateModel) {
    this._stateModel = stateModel;
  }

  get lookupTables(): AddressLookupTableAccount[] {
    return Array.from(this._lookupTables.values());
  }

  get kaminoVaults() {
    return Array.from(this._kaminoVaults);
  }

  private getKaminoObligationReserveSets(
    parsedObligations: ParsedKaminoObligation[],
  ) {
    // klend's refresh_obligation takes one account per active deposit and then one per active
    // borrow, so a reserve an obligation both deposits into and borrows from appears twice.
    // Only the set handed to the batch reserve refresh is deduplicated.
    const obligationReservesMap = new PkMap<PublicKey[]>();
    const reservesSet = new PkSet();

    parsedObligations.forEach((obligation) => {
      const { activeDeposits, activeBorrows } = obligation;
      const reserves = [
        ...activeDeposits.map(({ depositReserve }) => depositReserve),
        ...activeBorrows.map(({ borrowReserve }) => borrowReserve),
      ];
      reserves.forEach((reserve) => reservesSet.add(reserve));
      obligationReservesMap.set(obligation.getAddress(), reserves);
    });

    return { obligationReservesMap, reservesSet };
  }

  /**
   * Fetches all holdings in the vault.
   *
   * The source of truth for external positions is the `externalPositions` array
   * from the state account, which tracks:
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
    const categorizer = new PositionCategorizer(this.base.connection);
    const { kaminoObligations, kaminoVaultShareAtas } =
      await categorizer.categorizePositions(externalPositions, commitment);

    // Initialize maps for holdings data
    let obligationReservesMap = new PkMap<PkSet>();
    let kvaultAtasAndStatesMap = new PkMap<KVaultState>();
    let kvaultReserves = new PkSet();

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
    // A tracked share account whose mint no Kamino vault state names is listed
    // as the plain token account it is.
    const unresolvedShareAtas = kaminoVaultShareAtas.filter(
      (ata) => !kvaultAtasAndStatesMap.has(ata),
    );

    const kaminoReserves = [...obligationReservesMap.values()]
      .map((v) => Array.from(v.pkValues()))
      .flat()
      .concat(Array.from(kvaultReserves));
    const kvaultAtas = Array.from(kvaultAtasAndStatesMap.pkKeys());

    // Dedupe keys and fetch all accounts in a single RPC call
    const pubkeys = Array.from(
      new PkSet([
        ...tokenPubkeys,
        ...kaminoObligations,
        ...kaminoReserves,
        ...kvaultAtas,
        ...unresolvedShareAtas,
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

    const tokenHoldingPubkeys = [
      ...tokenPubkeys,
      ...unresolvedShareAtas.filter((ata) => accountsDataMap.has(ata)),
    ];

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

    const tokenMintDecimalsMap = await this.getTokenMintDecimals(
      tokenHoldingPubkeys,
      accountsDataMap,
      commitment,
    );

    const [tokenHoldings, kaminoLendHoldings, kaminoVaultsHoldings] =
      await Promise.all([
        this.getTokenHoldings(
          tokenHoldingPubkeys,
          accountsDataMap,
          tokenPricesMap,
          tokenMintDecimalsMap,
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
        const kvaultState = shareMintToState.get(mint);
        // A share account whose mint no vault state names stays out of the map.
        if (kvaultState) {
          map.set(shareAtaPubkeys[i], kvaultState);
        }
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

  private async getHoldingTokenPrice(
    mint: PublicKey,
    decimals: number,
    tokenPricesMap: PkMap<TokenListItem>,
  ): Promise<{ usdPrice: number; decimals: number; slot?: number }> {
    try {
      return await this.getTokenPrice(mint, tokenPricesMap);
    } catch {
      return { usdPrice: 0, decimals };
    }
  }

  private async getTokenMintDecimals(
    tokenAccountPubkeys: PublicKey[],
    accountsDataMap: PkMap<Buffer>,
    commitment: Commitment,
  ): Promise<PkMap<number>> {
    const mintSet = new PkSet();
    for (const pubkey of tokenAccountPubkeys) {
      const data = accountsDataMap.get(pubkey);
      if (!data) {
        continue;
      }
      const { mint } = AccountLayout.decode(data);
      mintSet.add(mint);
    }

    const mints = Array.from(mintSet.pkValues());
    const decimalsMap = new PkMap<number>();
    const batchSize = 100;

    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize);
      const mintAccountsInfo =
        await this.base.connection.getMultipleAccountsInfo(batch, commitment);

      mintAccountsInfo.forEach((accountInfo, index) => {
        if (!accountInfo) {
          return;
        }
        const mint = unpackMint(batch[index], accountInfo, accountInfo.owner);
        decimalsMap.set(batch[index], mint.decimals);
      });
    }

    return decimalsMap;
  }

  async getTokenHoldings(
    tokenAccountPubkeys: PublicKey[],
    accountsDataMap: PkMap<Buffer>,
    tokenPricesMap: PkMap<TokenListItem>,
    tokenMintDecimalsMap: PkMap<number>,
    priceSource: string,
  ): Promise<Holding[]> {
    const holdings: Holding[] = [];
    if (tokenAccountPubkeys.length === 0) {
      return holdings;
    }

    for (const pubkey of tokenAccountPubkeys) {
      const data = accountsDataMap.get(pubkey)!;

      const { amount, mint } = AccountLayout.decode(data);

      const { usdPrice, decimals, slot } = await this.getHoldingTokenPrice(
        mint,
        tokenMintDecimalsMap.get(mint) ?? 0,
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

        const { usdPrice, slot } = await this.getHoldingTokenPrice(
          liquidity.mintPubkey,
          liquidity.mintDecimals.toNumber(),
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

        const { usdPrice, slot } = await this.getHoldingTokenPrice(
          liquidity.mintPubkey,
          liquidity.mintDecimals.toNumber(),
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
      const pendingFees = new Decimal(kvaultState.pendingFeesSf.toString()).div(
        FRACTION_SCALE,
      );
      let vaultAum = aumAndFees.sub(pendingFees);

      const sharesIssued = new Decimal(kvaultState.sharesIssued.toString());
      if (vaultAum.lte(0) || sharesIssued.lte(0)) {
        continue; // early return like Rust: if vault_aum == 0 || shares_issued == 0
      }

      // Management fee: prev_aum * from_bps(mgmt_fee_bps) * since_last / SECONDS_PER_YEAR
      const prevAum = new Decimal(kvaultState.prevAumSf.toString()).div(
        FRACTION_SCALE,
      );
      const sinceLast = Math.max(
        0,
        nowTs - kvaultState.lastFeeChargeTimestamp.toNumber(),
      );

      let mgmtCharge = new Decimal(0);
      if (sinceLast > 0) {
        const mgmtFeeRate = new Decimal(
          kvaultState.managementFeeBps.toString(),
        ).div(10_000);
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

      const { usdPrice, slot } = await this.getHoldingTokenPrice(
        kvaultState.tokenMint,
        kvaultState.tokenMintDecimals.toNumber(),
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

  private async categorizeExternalPositions(externalPositions: PublicKey[]) {
    const categorizer = new PositionCategorizer(this.base.connection);
    return await categorizer.categorizePositions(
      externalPositions,
      "confirmed",
    );
  }

  private addKaminoOracleReserve(
    kaminoReserves: PkSet,
    assetMeta: { oracle: PublicKey; oracleSource: string },
  ) {
    collectKaminoReserveOracles([assetMeta], kaminoReserves);
  }

  private async resolvePositionTokenAccount(
    positionMint: PublicKey,
  ): Promise<PublicKey> {
    const candidateAtas = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map(
      (programId) => ({
        programId,
        ata: this.base.getVaultAta(positionMint, programId),
      }),
    );
    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      candidateAtas.map(({ ata }) => ata),
    );

    for (let i = 0; i < candidateAtas.length; i++) {
      const accountInfo = accountsInfo[i];
      if (
        !accountInfo ||
        !accountInfo.owner.equals(candidateAtas[i].programId)
      ) {
        continue;
      }
      const tokenAccount = AccountLayout.decode(accountInfo.data);
      const mint = new PublicKey(tokenAccount.mint);
      if (mint.equals(positionMint) && tokenAccount.amount === 1n) {
        return candidateAtas[i].ata;
      }
    }

    throw new Error(
      `Jupiter Borrow position token account not found for mint ${positionMint.toBase58()}`,
    );
  }

  /**
   * Returns an instruction that prices Kamino obligations.
   * If there are no Kamino obligations, returns null.
   */
  async priceKaminoObligationsIxs(): Promise<PricingChunk> {
    const parsedObligations = await this.klend.findAndParseObligations(
      this.base.vaultPda,
    );
    if (parsedObligations.length === 0) {
      return { ixs: [], kaminoReserves: [] };
    }

    const { obligationReservesMap, reservesSet } =
      this.getKaminoObligationReserveSets(parsedObligations);

    const ixs: TransactionInstruction[] = [];

    // Refresh obligations
    parsedObligations.forEach((obligation) => {
      const { lendingMarket } = obligation;
      const address = obligation.getAddress();

      ixs.push(
        this.klend.txBuilder.refreshObligationIx({
          obligation: address,
          lendingMarket,
          reserves: obligationReservesMap.get(address) || [],
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
    const {
      solUsdOracle,
      baseAssetOracle,
      kaminoReserves: oracleReserves,
    } = await this.pricingOracleAccounts();
    for (const reserve of oracleReserves) {
      reservesSet.add(reserve);
    }

    const priceIx = await this.base.mintProgram.methods
      .priceKaminoObligations()
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle,
        baseAssetOracle,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();
    ixs.push(priceIx);

    return { ixs, kaminoReserves: Array.from(reservesSet) };
  }

  public async priceKaminoVaultSharesIx(): Promise<PricingChunk | null> {
    // Only share accounts the state tracks are priced, so a state that tracks
    // no external position needs no Kamino vault lookup.
    if (!this.cachedStateModel?.externalPositions?.length) {
      return null;
    }
    const allKvaultStates = await this.kvaults.findAndParseKaminoVaults();
    if (allKvaultStates.length === 0) {
      return null;
    }
    const allKvaultMints = allKvaultStates.map((kvault) => kvault.sharesMint);
    const assetMetas = await this.base.fetchAssetMetas();

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
    const depositTokenAssetMetas: {
      oracle?: PublicKey;
      oracleSource?: string;
    }[] = [];
    const newLookupTableKeys = new PkSet();
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
        const assetMeta = assetMetas.get(tokenMint.toBase58());
        if (!assetMeta || !assetMeta.oracle) {
          throw new Error(`Oracle unavailable for asset ${tokenMint}`);
        }
        oracles.push(assetMeta.oracle);
        depositTokenAssetMetas.push(assetMeta);
        newLookupTableKeys.add(vaultLookupTable);
      }
    });

    // No tracked share account belongs to a vault state the cluster returned.
    // A share account whose vault state is missing is left unpriced, and
    // glam_mint refuses the aum with ExternalPositionsNotPriced.
    if (shareAtas.length === 0) {
      return null;
    }

    // Resolve any newly-seen kvault lookup tables in a single batch so that
    // downstream callers (e.g. `intoVersionedTransaction`) can use them
    // directly without re-fetching account data.
    if (newLookupTableKeys.size > 0) {
      const resolved = await fetchAddressLookupTableAccounts(
        this.base.connection,
        Array.from(newLookupTableKeys),
      );
      resolved.forEach((alt) => this._lookupTables.set(alt.key, alt));
    }
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

    const {
      solUsdOracle,
      baseAssetOracle,
      kaminoReserves: oracleReserves,
    } = await this.pricingOracleAccounts();
    collectKaminoReserveOracles(depositTokenAssetMetas, oracleReserves);

    const priceIx = await this.base.mintProgram.methods
      .priceKaminoVaultShares(shareAtas.length)
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle,
        baseAssetOracle,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return {
      ixs: [priceIx],
      kaminoReserves: Array.from(new PkSet([...reserves, ...oracleReserves])),
    };
  }

  public async priceJupiterEarnPositionsIxs(
    stateModel: StateModel | null = this.cachedStateModel,
  ): Promise<PricingChunk> {
    const model = stateModel || (await this.base.fetchStateModel());
    const { jupiterEarnAtas } = await this.categorizeExternalPositions(
      model.externalPositions || [],
    );
    if (jupiterEarnAtas.length === 0) {
      return { ixs: [], kaminoReserves: [] };
    }

    const accountsInfo =
      await this.base.connection.getMultipleAccountsInfo(jupiterEarnAtas);
    const remainingAccounts: AccountMeta[] = [];
    const ixs: TransactionInstruction[] = [];
    const updatedLendings = new PkSet();
    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts({ baseAssetMint: model.baseAssetMint });

    for (let i = 0; i < jupiterEarnAtas.length; i++) {
      const accountInfo = accountsInfo[i];
      if (!accountInfo) {
        throw new Error(
          `Jupiter Earn fToken account not found: ${jupiterEarnAtas[i].toBase58()}`,
        );
      }
      const tokenAccount = AccountLayout.decode(accountInfo.data);
      const lending = await fetchLendingByFTokenMint(
        this.base.connection,
        new PublicKey(tokenAccount.mint),
      );
      if (!updatedLendings.has(lending.pubkey)) {
        ixs.push(buildUpdateRateIx(lending));
        updatedLendings.add(lending.pubkey);
      }

      const assetMeta = await this.base.getAssetMeta(lending.mint);
      this.addKaminoOracleReserve(kaminoReserves, assetMeta);
      remainingAccounts.push(
        { pubkey: jupiterEarnAtas[i], isSigner: false, isWritable: false },
        { pubkey: lending.pubkey, isSigner: false, isWritable: false },
        { pubkey: assetMeta.oracle, isSigner: false, isWritable: false },
      );
    }

    const priceIx = this.extPricerIx(
      this.base.extJupiterProgram,
      "price_jupiter_earn_positions",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );
    ixs.push(priceIx);

    return { ixs, kaminoReserves: Array.from(kaminoReserves) };
  }

  public async priceJupiterBorrowPositionsIxs(
    stateModel: StateModel | null = this.cachedStateModel,
  ): Promise<PricingChunk> {
    const model = stateModel || (await this.base.fetchStateModel());
    const { jupiterBorrowPositions } = await this.categorizeExternalPositions(
      model.externalPositions || [],
    );
    if (jupiterBorrowPositions.length === 0) {
      return { ixs: [], kaminoReserves: [] };
    }

    const remainingAccounts: AccountMeta[] = [];
    const ixs: TransactionInstruction[] = [];
    const updatedVaultStates = new PkSet();
    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts({ baseAssetMint: model.baseAssetMint });

    for (const positionPubkey of jupiterBorrowPositions) {
      const position = await fetchPositionInfo(
        this.base.connection,
        positionPubkey,
      );
      const vaultConfig = getVaultConfigPda(position.vaultId);
      const vaultState = getVaultStatePda(position.vaultId);
      const vaultConfigInfo = await fetchVaultConfigInfo(
        this.base.connection,
        vaultConfig,
      );
      const [
        positionTokenAccount,
        supplyReserveAndVault,
        borrowReserveAndVault,
        supplyAssetMeta,
        borrowAssetMeta,
      ] = await Promise.all([
        this.resolvePositionTokenAccount(position.positionMint),
        fetchLendingReserveAndVault(
          this.base.connection,
          vaultConfigInfo.supplyToken,
        ),
        fetchLendingReserveAndVault(
          this.base.connection,
          vaultConfigInfo.borrowToken,
        ),
        this.base.getAssetMeta(vaultConfigInfo.supplyToken),
        this.base.getAssetMeta(vaultConfigInfo.borrowToken),
      ]);

      this.addKaminoOracleReserve(kaminoReserves, supplyAssetMeta);
      this.addKaminoOracleReserve(kaminoReserves, borrowAssetMeta);

      if (!updatedVaultStates.has(vaultState)) {
        ixs.push(
          buildUpdateExchangePricesIx(
            position.vaultId,
            vaultConfig,
            vaultState,
            supplyReserveAndVault.reserve,
            borrowReserveAndVault.reserve,
          ),
        );
        updatedVaultStates.add(vaultState);
      }

      const currentTick = getTickPda(
        position.vaultId,
        position.isSupplyOnlyPosition ? MIN_TICK : position.tick,
      );
      remainingAccounts.push(
        { pubkey: positionPubkey, isSigner: false, isWritable: false },
        { pubkey: positionTokenAccount, isSigner: false, isWritable: false },
        { pubkey: vaultConfig, isSigner: false, isWritable: false },
        { pubkey: vaultState, isSigner: false, isWritable: false },
        { pubkey: currentTick, isSigner: false, isWritable: false },
        { pubkey: supplyAssetMeta.oracle, isSigner: false, isWritable: false },
        { pubkey: borrowAssetMeta.oracle, isSigner: false, isWritable: false },
      );
    }

    const priceIx = this.extPricerIx(
      this.base.extJupiterProgram,
      "price_jupiter_borrow_positions",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );
    ixs.push(priceIx);

    return { ixs, kaminoReserves: Array.from(kaminoReserves) };
  }

  /**
   * Returns an instruction that prices vault balance and tokens
   */
  async priceVaultTokensIx(): Promise<PricingChunk> {
    const [remainingAccounts, kaminoReserves] =
      await this.remainingAccountsForPricingVaultAssets();

    const [solUsdOracle, baseAssetOracle] = await Promise.all([
      this.base.getSolOracle(),
      this.getBaseAssetOracle(),
    ]);

    const aggIndexes: number[][] = [];
    for (let i = 0; i < remainingAccounts.length; i += 3) {
      aggIndexes.push([-1, -1, -1, -1]);
    }

    const priceVaultIx = await this.base.mintProgram.methods
      .priceVaultTokens(aggIndexes)
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle,
        baseAssetOracle,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return { ixs: [priceVaultIx], kaminoReserves };
  }

  /**
   * Returns an instruction that prices stake accounts.
   * If there are no stake accounts, returns null.
   * The instruction carries no list of the Kamino reserves among its oracles.
   * priceVaultIxs refreshes them ahead of it.
   */
  async priceStakeAccountsIx(): Promise<TransactionInstruction | null> {
    const chunk = await this.priceStakeAccountsChunk();
    return chunk ? chunk.ixs[0] : null;
  }

  /**
   * Prices stake accounts and reports the Kamino reserves among the
   * instruction's SOL/USD and base asset oracles.
   * If there are no stake accounts, returns null.
   */
  private async priceStakeAccountsChunk(): Promise<PricingChunk | null> {
    const stakes = await findStakeAccounts(
      this.base.connection,
      this.base.vaultPda,
    );
    if (stakes.length === 0) {
      return null;
    }
    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts();
    const priceStakesIx = await (this.base.mintProgram.methods as any)
      .priceStakeAccounts()
      .accounts({
        glamState: this.base.statePda,
        solUsdOracle,
        baseAssetOracle,
      })
      .remainingAccounts(
        stakes.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();
    return { ixs: [priceStakesIx], kaminoReserves: Array.from(kaminoReserves) };
  }

  private async findPhoenixTraderAccounts(
    externalPositions: PublicKey[],
  ): Promise<PublicKey[]> {
    if (externalPositions.length === 0) {
      return [];
    }

    const chunks: PublicKey[][] = [];
    for (let i = 0; i < externalPositions.length; i += 100) {
      chunks.push(externalPositions.slice(i, i + 100));
    }
    const accountsInfo = (
      await Promise.all(
        chunks.map((chunk) =>
          this.base.connection.getMultipleAccountsInfo(chunk),
        ),
      )
    ).flat();

    return externalPositions.filter((_, i) => {
      const accountInfo = accountsInfo[i];
      if (!accountInfo || !accountInfo.owner.equals(PHOENIX_PROGRAM_ID)) {
        return false;
      }

      return PHOENIX_TRADER_DISCRIMINATOR.every(
        (byte, offset) => accountInfo.data[offset] === byte,
      );
    });
  }

  private async getPhoenixPerpAssetMap(): Promise<PublicKey> {
    const accountInfo = await this.base.connection.getAccountInfo(
      PHOENIX_GLOBAL_CONFIG,
    );
    if (!accountInfo) {
      throw new Error(
        `Phoenix global config not found: ${PHOENIX_GLOBAL_CONFIG.toBase58()}`,
      );
    }
    if (!accountInfo.owner.equals(PHOENIX_PROGRAM_ID)) {
      throw new Error("Phoenix global config has unexpected owner");
    }

    const offset = PHOENIX_GLOBAL_CONFIG_PERP_ASSET_MAP_OFFSET;
    if (accountInfo.data.length < offset + PUBKEY_LEN) {
      throw new Error("Phoenix global config account data is too short");
    }

    return new PublicKey(
      accountInfo.data.subarray(offset, offset + PUBKEY_LEN),
    );
  }

  /**
   * Returns Phoenix trader pricing instructions with the required compute
   * budget pre-instruction, and the Kamino reserves behind the oracles the
   * pricing instruction reads. If there are no registered Phoenix trader
   * accounts, returns null.
   */
  public async pricePhoenixTradersIxs(
    stateModel: StateModel | null = this.cachedStateModel,
  ): Promise<PricingChunk | null> {
    const model = stateModel || (await this.base.fetchStateModel());
    const traderAccounts = await this.findPhoenixTraderAccounts(
      model.externalPositions || [],
    );
    if (traderAccounts.length === 0) {
      return null;
    }

    const [oracleAccounts, phoenixPerpAssetMap] = await Promise.all([
      this.pricingOracleAccounts({ baseAssetMint: model.baseAssetMint }),
      this.getPhoenixPerpAssetMap(),
    ]);
    const { solUsdOracle, baseAssetOracle, kaminoReserves } = oracleAccounts;

    const remainingAccounts: AccountMeta[] = [
      {
        pubkey: PHOENIX_GLOBAL_CONFIG,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: phoenixPerpAssetMap,
        isSigner: false,
        isWritable: false,
      },
      ...traderAccounts.map(
        (pubkey) =>
          ({
            pubkey,
            isSigner: false,
            isWritable: false,
          }) satisfies AccountMeta,
      ),
    ];

    // Phoenix quotes are USDC-denominated: a vault with another base asset
    // also reads the USDC oracle, which can be a Kamino reserve of its own.
    if (!model.baseAssetMint.equals(USDC)) {
      const usdcAssetMeta = await this.base.getAssetMeta(USDC);
      collectKaminoReserveOracles([usdcAssetMeta], kaminoReserves);
      remainingAccounts.push({
        pubkey: usdcAssetMeta.oracle,
        isSigner: false,
        isWritable: false,
      });
    }

    const priceIx = this.extPricerIx(
      this.base.extPhoenixProgram,
      "price_phoenix_traders",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );

    return {
      ixs: [
        ComputeBudgetProgram.requestHeapFrame({
          bytes: PHOENIX_REQUEST_HEAP_FRAME_BYTES,
        }),
        priceIx,
      ],
      kaminoReserves: Array.from(kaminoReserves),
    };
  }

  /**
   * Returns the program instruction that prices Loopscale loan external positions.
   * If there are no registered Loopscale loans, returns null.
   *
   * Remaining accounts are laid out as N loan accounts followed by the oracle
   * accounts needed to price the loans' collateral and debt.
   */
  public async priceLoopscaleLoansIxs(): Promise<PricingChunk | null> {
    const accounts = await this.loopscaleBorrow.getPriceLoansAccounts();
    if (!accounts) {
      return null;
    }

    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts(accounts);
    (accounts.kaminoReserves ?? []).forEach((reserve) =>
      kaminoReserves.add(reserve),
    );

    const remainingAccounts: AccountMeta[] = [
      ...accounts.loanAccounts,
      ...accounts.oracleAccounts,
    ].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    const ix = this.extPricerIx(
      this.base.extLoopscaleProgram,
      "price_loopscale_loans",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );

    return { ixs: [ix], kaminoReserves: Array.from(kaminoReserves) };
  }

  /**
   * Returns the program instruction that prices Loopscale strategy external positions.
   * If there are no registered Loopscale strategies, returns null.
   *
   * Remaining accounts are laid out as N strategy accounts followed by the
   * oracle accounts needed to price the strategies' principal mints.
   */
  public async priceLoopscaleStrategiesIxs(): Promise<PricingChunk | null> {
    const accounts = await this.loopscaleLend.getPriceStrategiesAccounts();
    if (!accounts) {
      return null;
    }

    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts(accounts);
    (accounts.kaminoReserves ?? []).forEach((reserve) =>
      kaminoReserves.add(reserve),
    );

    const remainingAccounts: AccountMeta[] = [
      ...accounts.strategyAccounts,
      ...accounts.oracleAccounts,
    ].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    const ix = this.extPricerIx(
      this.base.extLoopscaleProgram,
      "price_loopscale_strategies",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );

    return { ixs: [ix], kaminoReserves: Array.from(kaminoReserves) };
  }

  /**
   * Returns the program instruction that prices registered Loopscale vault LP
   * token accounts and registered staked LP positions.
   * If there are no registered Loopscale vault LP positions, returns null.
   *
   * Remaining accounts are laid out as N (vault, vault strategy, GLAM vault LP
   * ATA) groups for vaults with tracked LP or stake positions, followed by
   * VaultStake accounts, followed by oracle accounts.
   */
  public async priceLoopscaleVaultPositionsIxs(): Promise<PricingChunk | null> {
    const accounts = await this.loopscaleVault.getPriceVaultsAccounts();
    if (!accounts) {
      return null;
    }

    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts(accounts);
    (accounts.kaminoReserves ?? []).forEach((reserve) =>
      kaminoReserves.add(reserve),
    );

    const vaultAccountGroups = accounts.vaultAccounts.flatMap((vault, i) => [
      vault,
      accounts.strategyAccounts[i],
      accounts.userLpTokenAccounts[i],
    ]);
    const remainingAccounts: AccountMeta[] = [
      ...vaultAccountGroups,
      ...accounts.vaultStakeAccounts,
      ...accounts.oracleAccounts,
    ].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));

    const ix = this.extPricerIx(
      this.base.extLoopscaleProgram,
      "price_loopscale_vault_positions",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
      accounts.numVaults,
    );

    return { ixs: [ix], kaminoReserves: Array.from(kaminoReserves) };
  }

  public async priceOrcaWhirlpoolPositionsIxs(
    stateModel: StateModel | null = this.cachedStateModel,
  ): Promise<PricingChunk | null> {
    const model = stateModel || (await this.base.fetchStateModel());
    const categorizer = new PositionCategorizer(this.base.connection);
    const { orcaWhirlpoolPositions } = await categorizer.categorizePositions(
      model.externalPositions || [],
      "confirmed",
    );
    if (orcaWhirlpoolPositions.length === 0) {
      return null;
    }

    const accounts = await new OrcaWhirlpoolsClient(
      this.base,
    ).remainingAccountsForPricingWhirlpoolPositions(orcaWhirlpoolPositions);
    if (!accounts) {
      return null;
    }

    const {
      solUsdOracle,
      baseAssetOracle,
      kaminoReserves: oracleReserves,
    } = await this.pricingOracleAccounts({
      baseAssetMint: model.baseAssetMint,
    });

    const priceIx: TransactionInstruction = this.extPricerIx(
      this.base.extOrcaProgram,
      "price_orca_whirlpool_positions",
      { solUsdOracle, baseAssetOracle },
      accounts.remainingAccounts,
      accounts.numPositions,
    );

    const accountKeyCount = new PkSet([
      priceIx.programId,
      ...priceIx.keys.map(({ pubkey }) => pubkey),
    ]).size;
    if (accountKeyCount > ORCA_PRICING_MAX_ACCOUNT_KEYS) {
      throw new Error(
        `Orca Whirlpool pricing instruction needs ${accountKeyCount} account keys, exceeding the ${ORCA_PRICING_MAX_ACCOUNT_KEYS} account-key limit. ` +
          "GLAM stores one Orca Whirlpools priced-protocol record, so oversized Orca pricing cannot be spread across multiple instructions without replacing earlier positions. " +
          "Reduce the number of tracked Orca Whirlpool positions or reward assets.",
      );
    }

    return {
      ixs: [priceIx],
      kaminoReserves: Array.from(
        new PkSet([...accounts.kaminoReserves, ...oracleReserves]),
      ),
    };
  }

  public async priceVaultIxs(): Promise<TransactionInstruction[]> {
    return this.enqueuePriceVaultIxs(() => this._priceVaultIxsImpl());
  }

  private enqueuePriceVaultIxs(
    buildIxs: () => Promise<TransactionInstruction[]>,
  ): Promise<TransactionInstruction[]> {
    // Serialize concurrent callers so cache writes in _priceVaultIxsImpl
    // don't interleave. Errors don't poison the queue.
    const next = this._priceVaultIxsQueue.catch(() => undefined).then(buildIxs);
    this._priceVaultIxsQueue = next;
    return next;
  }

  private async priceManagedTransfersIxs(): Promise<PricingChunk> {
    const [stateAccount, registry] = await Promise.all([
      this.base.fetchStateAccount(),
      this.bridge.fetchRegistry(),
    ]);
    if (!registry) {
      return { ixs: [], kaminoReserves: [] };
    }

    const transfers = getActiveRegistryTransfers(registry);
    const [baseAssetMeta, assetMetas] = await Promise.all([
      this.base.getAssetMeta(stateAccount.baseAssetMint),
      Promise.all(
        transfers.map(async (transfer) => ({
          transfer,
          assetMeta: await this.base.getAssetMeta(transfer.sourceMint),
        })),
      ),
    ]);
    const integrationAuthority = getIntegrationAuthorityPda(
      this.base.extBridgeProgram.programId,
    );
    const kaminoReserves = collectKaminoReserveOracles([
      baseAssetMeta,
      ...assetMetas.map(({ assetMeta }) => assetMeta),
    ]);

    const remainingAccounts = assetMetas.map(
      ({ assetMeta }) =>
        ({
          pubkey: assetMeta.oracle,
          isSigner: false,
          isWritable: false,
        }) satisfies AccountMeta,
    );

    const ix = await this.base.extBridgeProgram.methods
      .priceManagedTransfers()
      .accountsPartial({
        glamState: this.base.statePda,
        bridgeRegistry: this.bridge.getRegistryPda(),
        integrationAuthority,
        glamProtocolProgram: this.base.protocolProgram.programId,
        glamConfig: getGlobalConfigPda(),
        baseAssetOracle: baseAssetMeta.oracle,
      })
      .remainingAccounts(remainingAccounts)
      .instruction();

    return { ixs: [ix], kaminoReserves: Array.from(kaminoReserves) };
  }

  private async priceNeutralBundleDepositorsIx(): Promise<PricingChunk> {
    const stateModel =
      this.cachedStateModel ?? (await this.base.fetchStateModel());
    const externalPositions = new PkSet(stateModel.externalPositions ?? []);
    if (externalPositions.size === 0) {
      return { ixs: [], kaminoReserves: [] };
    }

    // User bundle accounts do not store their parent bundle, so discover bundles and
    // intersect derived user bundle PDAs with the tracked external positions.
    const bundleAccounts = await getProgramAccounts(
      this.base.connection,
      NTBUNDLE_PROGRAM_ID,
      {
        commitment: "confirmed",
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: NT_BUNDLE_ACCOUNT_DISCRIMINATOR.toString("base64"),
              encoding: "base64",
            },
          },
        ],
      },
    );
    const positions = bundleAccounts
      .map(({ pubkey: bundle, account: bundleInfo }) => ({
        bundle,
        bundleInfo,
        userBundle: getNeutralUserBundlePda(this.base.vaultPda, bundle),
      }))
      .filter(({ userBundle }) => externalPositions.has(userBundle));

    if (positions.length === 0) {
      return { ixs: [], kaminoReserves: [] };
    }

    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts({
        baseAssetMint: stateModel.baseAssetMint,
      });

    const remainingAccounts: AccountMeta[] = [];
    for (let i = 0; i < positions.length; i++) {
      const { bundle, bundleInfo, userBundle } = positions[i];
      if (!bundleInfo.owner.equals(NTBUNDLE_PROGRAM_ID)) {
        throw new Error(
          `Neutral bundle ${bundle} is owned by ${bundleInfo.owner}, expected ${NTBUNDLE_PROGRAM_ID}`,
        );
      }

      const bundleAccount = NeutralBundleAccount.decode(
        bundle,
        bundleInfo.data,
      );
      const bundleAssetMeta = await this.base.getAssetMeta(
        bundleAccount.assetAddress,
      );
      collectKaminoReserveOracles([bundleAssetMeta], kaminoReserves);

      [
        userBundle,
        bundle,
        getNeutralOracleDataPda(bundle),
        bundleAssetMeta.oracle,
      ].forEach((pubkey) => {
        remainingAccounts.push({
          pubkey,
          isSigner: false,
          isWritable: false,
        });
      });
    }

    const ix = this.extPricerIx(
      this.base.extNeutralProgram,
      "price_neutral_bundle_depositors",
      { solUsdOracle, baseAssetOracle },
      remainingAccounts,
    );

    return { ixs: [ix], kaminoReserves: Array.from(kaminoReserves) };
  }

  private async priceRpiRegisteredPositionsIx(
    externalPositions: PublicKey[],
  ): Promise<TransactionInstruction | null> {
    const observationState = this.rpi.getObservationStatePda();
    if (
      !externalPositions.some((externalPosition) =>
        externalPosition.equals(observationState),
      )
    ) {
      return null;
    }

    return extRegisteredPositionsPricerIx({
      programId: this.base.extRpiProgram.programId,
      glamState: this.base.statePda,
      observationState,
      glamProtocolProgram: this.base.protocolProgram.programId,
    });
  }

  private async priceMarginfiAccountsIx(
    stateModel: StateModel,
  ): Promise<PricingChunk | null> {
    const externalPositions = stateModel.externalPositions || [];
    if (externalPositions.length === 0) {
      return null;
    }

    const accountInfos =
      await this.base.connection.getMultipleAccountsInfo(externalPositions);
    const marginfiAccounts = externalPositions.filter((_, index) =>
      accountInfos[index]?.owner.equals(MARGINFI_PROGRAM_ID),
    );
    if (marginfiAccounts.length === 0) {
      return null;
    }

    const { solUsdOracle, baseAssetOracle, kaminoReserves } =
      await this.pricingOracleAccounts({
        baseAssetMint: stateModel.baseAssetMint,
      });
    const preInstructions: TransactionInstruction[] = [];
    for (const marginfiAccount of marginfiAccounts) {
      const { ixs } = await this.marginfi.pulseHealthIx(marginfiAccount);
      preInstructions.push(...ixs);
    }

    const ix = this.extPricerIx(
      this.base.extMarginfiProgram,
      "price_marginfi_accounts",
      { solUsdOracle, baseAssetOracle },
      marginfiAccounts.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      })),
    );

    return {
      ixs: [...preInstructions, ix],
      kaminoReserves: Array.from(kaminoReserves),
    };
  }

  /**
   * A pricing instruction hosted by the integration program `program`, over
   * this vault, the two named oracles and the positions in `remainingAccounts`.
   */
  private extPricerIx(
    program: { programId: PublicKey },
    name: ExtPositionPricerName,
    oracles: { solUsdOracle: PublicKey; baseAssetOracle: PublicKey },
    remainingAccounts: AccountMeta[],
    count?: number,
  ): TransactionInstruction {
    return extPricerIx({
      programId: program.programId,
      name,
      accounts: {
        glamState: this.base.statePda,
        glamVault: this.base.vaultPda,
        solUsdOracle: oracles.solUsdOracle,
        baseAssetOracle: oracles.baseAssetOracle,
        glamProtocolProgram: this.base.protocolProgram.programId,
      },
      remainingAccounts,
      count,
    });
  }

  // Vault tokens, stake accounts, the single-asset profile and Kamino are
  // priced by glam_mint; every other integration's positions are priced by the
  // ext program that owns them, under its own integration authority
  // (anchor_v1/PRICING.md). One pricer per integration: the same key priced
  // twice in one slot is summed twice by `aum()`.
  private async _priceVaultIxsImpl(): Promise<TransactionInstruction[]> {
    const stateModel = await this.base.fetchStateModel();
    this.cachedStateModel = stateModel;
    // Populate BaseClient asset-meta cache for downstream helpers.
    await this.base.fetchAssetMetas();

    const {
      accountType,
      baseAssetMint,
      baseAssetTokenProgramId,
      externalPositions,
      integrationAcls,
    } = stateModel;

    // Single asset vault
    if (
      StateAccountType.equals(accountType, StateAccountType.SINGLE_ASSET_VAULT)
    ) {
      const baseAssetAta = this.base.getVaultAta(
        baseAssetMint,
        baseAssetTokenProgramId,
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

    const chunks: PricingChunk[] = [];
    chunks.push(await this.priceVaultTokensIx());

    if ((externalPositions || []).length > 0) {
      const kaminoIntegrationAcl = integrationAcls.find((acl) =>
        acl.integrationProgram.equals(this.base.extKaminoProgram.programId),
      );
      if (kaminoIntegrationAcl) {
        // kamino lending
        if (
          (kaminoIntegrationAcl.protocolsBitmask & KAMINO_LENDING_PROTOCOL) !==
          0
        ) {
          chunks.push(await this.priceKaminoObligationsIxs());
        }
        // kamino vaults
        if (
          (kaminoIntegrationAcl.protocolsBitmask & KAMINO_VAULTS_PROTOCOL) !==
          0
        ) {
          const chunk = await this.priceKaminoVaultSharesIx();
          if (chunk) chunks.push(chunk);
        }
      }

      const loopscaleIntegrationAcl = integrationAcls.find((acl) =>
        acl.integrationProgram.equals(this.base.extLoopscaleProgram.programId),
      );
      if (
        loopscaleIntegrationAcl &&
        ((loopscaleIntegrationAcl.protocolsBitmask &
          LOOPSCALE_BORROW_PROTOCOL) !==
          0 ||
          (loopscaleIntegrationAcl.protocolsBitmask &
            LOOPSCALE_LENDING_PROTOCOL) !==
            0 ||
          (loopscaleIntegrationAcl.protocolsBitmask &
            LOOPSCALE_VAULT_PROTOCOL) !==
            0)
      ) {
        const [loansChunk, strategiesChunk, vaultsChunk] = await Promise.all([
          (loopscaleIntegrationAcl.protocolsBitmask &
            LOOPSCALE_BORROW_PROTOCOL) !==
          0
            ? this.priceLoopscaleLoansIxs()
            : null,
          (loopscaleIntegrationAcl.protocolsBitmask &
            LOOPSCALE_LENDING_PROTOCOL) !==
          0
            ? this.priceLoopscaleStrategiesIxs()
            : null,
          (loopscaleIntegrationAcl.protocolsBitmask &
            LOOPSCALE_VAULT_PROTOCOL) !==
          0
            ? this.priceLoopscaleVaultPositionsIxs()
            : null,
        ]);
        if (loansChunk) chunks.push(loansChunk);
        if (strategiesChunk) chunks.push(strategiesChunk);
        if (vaultsChunk) chunks.push(vaultsChunk);
      }

      const nativeIntegrationAcl = integrationAcls.find((acl) =>
        acl.integrationProgram.equals(this.base.protocolProgram.programId),
      );
      if (
        nativeIntegrationAcl &&
        (nativeIntegrationAcl.protocolsBitmask & STAKE_PROTOCOL) !== 0
      ) {
        const chunk = await this.priceStakeAccountsChunk();
        if (chunk) chunks.push(chunk);
      }

      const rpiIntegrationAcl = integrationAcls.find(
        (acl) =>
          acl.integrationProgram.equals(this.base.extRpiProgram.programId) &&
          (acl.protocolsBitmask & RPI_PROTOCOL) !== 0,
      );
      if (rpiIntegrationAcl) {
        const ix = await this.priceRpiRegisteredPositionsIx(
          externalPositions || [],
        );
        if (ix) chunks.push({ ixs: [ix], kaminoReserves: [] });
      }

      const phoenixIntegrationAcl = integrationAcls.find(
        (acl) =>
          acl.integrationProgram.equals(
            this.base.extPhoenixProgram.programId,
          ) && (acl.protocolsBitmask & PHOENIX_PROTOCOL) !== 0,
      );
      if (phoenixIntegrationAcl) {
        const chunk = await this.pricePhoenixTradersIxs(stateModel);
        if (chunk) chunks.push(chunk);
      }

      const extOrcaProgramId = this.base.extOrcaProgram?.programId;
      const orcaIntegrationAcl =
        extOrcaProgramId &&
        integrationAcls.find(
          (acl) =>
            acl.integrationProgram.equals(extOrcaProgramId) &&
            (acl.protocolsBitmask & ORCA_WHIRLPOOLS_PROTOCOL) !== 0,
        );
      if (orcaIntegrationAcl) {
        const chunk = await this.priceOrcaWhirlpoolPositionsIxs(stateModel);
        if (chunk) chunks.push(chunk);
      }

      const extJupiterProgram = (this.base as any).extJupiterProgram;
      if (extJupiterProgram) {
        const jupiterIntegrationAcl = integrationAcls.find((acl) =>
          acl.integrationProgram.equals(extJupiterProgram.programId),
        );
        if (jupiterIntegrationAcl) {
          if (
            (jupiterIntegrationAcl.protocolsBitmask & JUPITER_EARN_PROTOCOL) !==
            0
          ) {
            chunks.push(await this.priceJupiterEarnPositionsIxs(stateModel));
          }
          if (
            (jupiterIntegrationAcl.protocolsBitmask &
              JUPITER_BORROW_PROTOCOL) !==
            0
          ) {
            chunks.push(await this.priceJupiterBorrowPositionsIxs(stateModel));
          }
        }
      }

      const bridgeIntegrationAcl = integrationAcls.find(
        (acl) =>
          acl.integrationProgram.equals(this.base.extBridgeProgram.programId) &&
          (acl.protocolsBitmask &
            (BRIDGE_CCTP_PROTOCOL | LAYERZERO_OFT_PROTOCOL)) !==
            0,
      );
      if (bridgeIntegrationAcl) {
        chunks.push(await this.priceManagedTransfersIxs());
      }

      const neutralIntegrationAcl = integrationAcls.find(
        (acl) =>
          acl.integrationProgram.equals(
            this.base.extNeutralProgram.programId,
          ) && (acl.protocolsBitmask & NT_BUNDLE_PROTOCOL) !== 0,
      );
      if (neutralIntegrationAcl) {
        chunks.push(await this.priceNeutralBundleDepositorsIx());
      }

      const marginfiIntegrationAcl = integrationAcls.find(
        (acl) =>
          acl.integrationProgram.equals(
            this.base.extMarginfiProgram.programId,
          ) && (acl.protocolsBitmask & MARGINFI_PROTOCOL) !== 0,
      );
      if (marginfiIntegrationAcl) {
        const chunk = await this.priceMarginfiAccountsIx(stateModel);
        if (chunk) chunks.push(chunk);
      }
    }

    // Coalesce all kamino reserve refreshes into a single front-loaded ix.
    const allReserves = new PkSet();
    chunks.forEach((c) => c.kaminoReserves.forEach((r) => allReserves.add(r)));

    const ixs: TransactionInstruction[] = [];
    const refreshIx = await kaminoReserveRefreshIx(this.klend, allReserves);
    if (refreshIx) {
      ixs.push(refreshIx);
    }
    chunks.forEach((c) => ixs.push(...c.ixs));
    return ixs;
  }

  public async validateAumIx(): Promise<TransactionInstruction> {
    return await this.base.mintProgram.methods
      .validateAum()
      .accounts({
        glamState: this.base.statePda,
      })
      .instruction();
  }

  /**
   * The one place a pricing builder takes its SOL/USD and base asset oracles
   * from. getSolOracle and getBaseAssetOracle return the bare address without
   * its source, so a builder that reads them cannot tell that an oracle is a
   * Kamino reserve, leaves that reserve out of the batch refresh, and the
   * program refuses it as stale. Every builder that passes both oracles as
   * named accounts takes them and their reserves from here and adds the
   * reserves its own positions read. The one exception is priceVaultTokensIx,
   * which passes the bare addresses because
   * remainingAccountsForPricingVaultAssets adds the reserves of both roles to
   * its own reserve list.
   *
   * Resolves the SOL/USD and base asset oracles a pricing instruction passes
   * as named accounts, together with the Kamino reserves among them. Callers
   * take both from here so the oracle and its source are read once.
   * A caller-supplied override is used as given, and its source is looked up
   * among every registration, deprecated ones included, because a reserve
   * reads the same whoever passed it.
   */
  private async pricingOracleAccounts(
    overrides: {
      solUsdOracle?: PublicKey | null;
      baseAssetOracle?: PublicKey | null;
      baseAssetMint?: PublicKey;
    } = {},
  ): Promise<{
    solUsdOracle: PublicKey;
    baseAssetOracle: PublicKey;
    kaminoReserves: PkSet;
  }> {
    const baseAssetMint =
      overrides.baseAssetMint ??
      (this.cachedStateModel ?? (await this.base.fetchStateModel()))
        .baseAssetMint;
    const [solAssetMeta, baseAssetMeta] = await Promise.all([
      overrides.solUsdOracle ? null : this.base.getAssetMeta(WSOL),
      overrides.baseAssetOracle ? null : this.base.getAssetMeta(baseAssetMint),
    ]);

    const kaminoReserves = collectKaminoReserveOracles([
      solAssetMeta,
      baseAssetMeta,
    ]);
    if (overrides.solUsdOracle || overrides.baseAssetOracle) {
      collectKaminoReserveOracleOverrides(
        [overrides.solUsdOracle, overrides.baseAssetOracle],
        await this.base.fetchRegisteredOracles(),
        kaminoReserves,
      );
    }

    return {
      solUsdOracle: overrides.solUsdOracle ?? solAssetMeta!.oracle,
      baseAssetOracle: overrides.baseAssetOracle ?? baseAssetMeta!.oracle,
      kaminoReserves,
    };
  }

  async getBaseAssetOracle() {
    const { baseAssetMint } =
      this.cachedStateModel || (await this.base.fetchStateModel());
    return (await this.base.getAssetMeta(baseAssetMint)).oracle;
  }

  /**
   * Resolves the pool state that prices each asset GlobalConfig does not register.
   * glam_protocol's validate_oracle accepts, before it reads GlobalConfig at all,
   * a stake pool account owned by one of the stake pool programs whose pool_mint
   * is the mint, or a Marinade state whose msol_mint is the mint. The same
   * predicate is checked here over one batch of [pool state, mint] reads, so a
   * liquid staking token the vault holds is priced without a registration.
   */
  private async lstPoolStateOracles(
    mints: PublicKey[],
  ): Promise<PkMap<{ ata: PublicKey; poolState: PublicKey }>> {
    const oracles = new PkMap<{ ata: PublicKey; poolState: PublicKey }>();
    // The static list supplies the candidate address only. Every fact the
    // program checks is read from the accounts themselves.
    const candidates = mints.map((mint) => {
      const poolState = STAKE_POOLS_MAP.get(mint.toBase58())?.poolState;
      if (!poolState) {
        throw new Error(
          `Asset meta not found for ${mint}. The mint is neither registered in GlobalConfig nor a known liquid staking token, so no pricing instruction was built. Register it in GlobalConfig before pricing this vault.`,
        );
      }
      return { mint, poolState };
    });
    if (candidates.length === 0) {
      return oracles;
    }

    const accountsInfo = await this.base.connection.getMultipleAccountsInfo(
      candidates.flatMap(({ mint, poolState }) => [poolState, mint]),
    );

    candidates.forEach(({ mint, poolState }, i) => {
      validateLstPoolState(mint, poolState, accountsInfo[2 * i]);
      const tokenProgram = lstMintTokenProgram(
        mint,
        poolState,
        accountsInfo[2 * i + 1],
      );
      oracles.set(mint, {
        ata: this.base.getVaultAta(mint, tokenProgram),
        poolState,
      });
    });

    return oracles;
  }

  async remainingAccountsForPricingVaultAssets(): Promise<
    [AccountMeta[], PublicKey[]]
  > {
    const stateModel =
      this.cachedStateModel ?? (await this.base.fetchStateModel());
    const assetMetas = await this.base.fetchAssetMetas();
    const kaminoReserves = new PkSet();
    const mayAddKaminoReserve = (assetMeta: {
      oracle: PublicKey;
      oracleSource: string;
    }) => {
      collectKaminoReserveOracles([assetMeta], kaminoReserves);
    };

    const lstOracles = await this.lstPoolStateOracles(
      stateModel.assetsForPricing.filter(
        (mint) => !assetMetas.get(mint.toBase58()),
      ),
    );

    // The program maps aggIndexes by position, so every mint keeps its place
    // whether it is priced by a registration or by a pool state.
    const accMetas = stateModel.assetsForPricing
      .map((mint) => {
        const assetMeta = assetMetas.get(mint.toBase58());
        if (!assetMeta) {
          const lstOracle = lstOracles.get(mint);
          if (!lstOracle) {
            throw new Error(
              `Pricing ${mint} stopped because its pool state lookup did not resolve. ` +
                `No pricing instruction was built, so the vault's pricing is unchanged. ` +
                `Register ${mint} in GlobalConfig or report this mismatch.`,
            );
          }
          const { ata, poolState } = lstOracle;
          return [ata, mint, poolState];
        }
        mayAddKaminoReserve(assetMeta);
        const ata = this.base.getVaultAta(mint, assetMeta.programId);
        return [ata, mint, assetMeta.oracle];
      })
      .flat()
      .map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      }));

    [
      await this.base.getAssetMeta(WSOL),
      await this.base.getAssetMeta(stateModel.baseAssetMint),
    ].forEach(mayAddKaminoReserve);

    return [accMetas, Array.from(kaminoReserves)];
  }
}
