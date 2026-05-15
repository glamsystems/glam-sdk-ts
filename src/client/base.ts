import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { getSimulationResult, parseProgramLogs } from "../utils/transaction";
import {
  buildComputeBudgetInstructions,
  ComputeBudgetOptions,
} from "../utils/computeBudget";
import { fetchAddressLookupTableAccounts } from "../utils/lookupTables";
import {
  fetchMintAndTokenProgram,
  fetchMintsAndTokenPrograms,
  findGlamLookupTables,
  getTokenAccountsByOwner,
  parseMintAccountInfo,
} from "../utils/accounts";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  getAccount,
  getAssociatedTokenAddressSync,
  Mint,
  getExtensionData,
  ExtensionType,
} from "@solana/spl-token";

import {
  ExtBridgeProgram,
  ExtEpiProgram,
  ExtCctpProgram,
  ExtKaminoProgram,
  ExtMarinadeProgram,
  ExtLoopscaleProgram,
  ExtPhoenixProgram,
  ExtSplProgram,
  ExtStakePoolProgram,
  GlamMintProgram,
  GlamProtocolProgram,
  getExtBridgeProgram,
  getExtEpiProgram,
  getExtCctpProgram,
  getExtKaminoProgram,
  getExtLoopscaleProgram,
  getExtMarinadeProgram,
  getExtPhoenixProgram,
  getExtSplProgram,
  getExtStakePoolProgram,
  getGlamMintProgramId,
  getGlamMintProgram,
  getGlamProtocolProgram,
  resolveStaging,
} from "../glamExports";
import { ClusterNetwork, GlamClientConfig } from "../clientConfig";
import {
  fetchGlobalConfig as fetchGlobalConfigAccount,
  getOracleName,
  GlobalConfig,
} from "../globalConfig";
import {
  RequestQueue,
  StateAccount,
  StateAccountType,
  StateModel,
} from "../models";
import { GlamError } from "../error";
import { BlockhashWithCache } from "../utils/blockhash";
import {
  getEscrowPda,
  getExtraMetasPda,
  getMintPda,
  getRequestQueuePda,
  getVaultPda,
} from "../utils/glamPDAs";
import { TokenMetadata, unpack } from "@solana/spl-token-metadata";
import { JupiterApiClient, PhoenixApiClient, PkMap } from "../utils";
import { WSOL } from "../constants";
import { AssetMeta, ASSETS_MAINNET } from "../assets";

const LOOKUP_TABLES = [
  new PublicKey("284iwGtA9X9aLy3KsyV8uT2pXLARhYbiSi5SiM2g47M2"), // kamino lending
  new PublicKey("HGmknUTUmeovMc9ryERNWG6UFZDFDVr9xrum3ZhyL4fC"), // loopscale
];

export type TxOptions = {
  signer?: PublicKey;
  computeUnitLimit?: number;
  getPriorityFeeMicroLamports?: (tx: VersionedTransaction) => Promise<number>;
  maxFeeLamports?: number;
  useMaxFee?: boolean;
  preInstructions?: TransactionInstruction[];
  postInstructions?: TransactionInstruction[];
  lookupTables?: PublicKey[] | AddressLookupTableAccount[];
  simulate?: boolean;
};

export type TokenAccount = {
  owner: PublicKey;
  pubkey: PublicKey; // ata
  mint: PublicKey;
  programId: PublicKey;
  decimals: number;
  amount: string;
  uiAmount: number;
  frozen: boolean;
};

export class BaseClient {
  cluster: ClusterNetwork;
  provider: anchor.Provider;
  blockhashWithCache: BlockhashWithCache;
  jupiterApiKey?: string;
  jupiterApiClient?: JupiterApiClient;
  phoenixApiUrl?: string;
  phoenixApiClient?: PhoenixApiClient;
  public onSentListeners = new Set<(sig: string) => void>();
  readonly staging: boolean;

  private _protocolProgram?: GlamProtocolProgram;
  private _mintProgram?: GlamMintProgram;
  private _extSplProgram?: ExtSplProgram;
  private _extKaminoProgram?: ExtKaminoProgram;
  private _extMarinadeProgram?: ExtMarinadeProgram;
  private _extStakePoolProgram?: ExtStakePoolProgram;
  private _extCctpProgram?: ExtCctpProgram;
  private _extBridgeProgram?: ExtBridgeProgram;
  private _extEpiProgram?: ExtEpiProgram;
  private _extLoopscaleProgram?: ExtLoopscaleProgram;
  private _extPhoenixProgram?: ExtPhoenixProgram;

  private _statePda?: PublicKey;
  private _globalConfig?: GlobalConfig;
  private _globalConfigPromise?: Promise<GlobalConfig>;
  private _assetMetas?: PkMap<AssetMeta>;
  private _assetMetasPromise?: Promise<PkMap<AssetMeta>>;

  private _defaultLookupTablesPromise?: Promise<AddressLookupTableAccount[]>;
  private _glamLookupTablesPromise?: Promise<AddressLookupTableAccount[]>;
  private _glamLookupTablesCacheKey?: string;

  public constructor(config?: GlamClientConfig) {
    if (config?.provider) {
      this.provider = config?.provider;
    } else {
      const defaultProvider = anchor.AnchorProvider.env();
      const url = defaultProvider.connection.rpcEndpoint;
      const connection = new Connection(url, { commitment: "confirmed" });
      this.provider = new anchor.AnchorProvider(
        connection,
        config?.wallet || defaultProvider.wallet,
        {
          ...defaultProvider.opts,
          commitment: "confirmed",
          preflightCommitment: "confirmed",
        },
      );
      anchor.setProvider(this.provider);
    }

    if (config?.statePda) {
      this.statePda = config.statePda;
    }

    this.cluster =
      config?.cluster ||
      ClusterNetwork.fromUrl(this.provider.connection.rpcEndpoint);
    this.staging = resolveStaging(config?.useStaging);
    this.jupiterApiKey = config?.jupiterApiKey;
    this.jupiterApiClient = config?.jupiterApiClient;
    this.phoenixApiUrl = config?.phoenixApiUrl;
    this.phoenixApiClient = config?.phoenixApiClient;
    this.blockhashWithCache = new BlockhashWithCache(this.provider);
  }

  get protocolProgram(): GlamProtocolProgram {
    if (!this._protocolProgram) {
      this._protocolProgram = getGlamProtocolProgram(
        this.provider,
        this.staging,
      );
    }
    return this._protocolProgram;
  }

  get mintProgram(): GlamMintProgram {
    if (!this._mintProgram) {
      this._mintProgram = getGlamMintProgram(this.provider, this.staging);
    }
    return this._mintProgram;
  }

  get extSplProgram(): ExtSplProgram {
    if (!this._extSplProgram) {
      this._extSplProgram = getExtSplProgram(this.provider, this.staging);
    }
    return this._extSplProgram;
  }

  get extKaminoProgram(): ExtKaminoProgram {
    if (!this._extKaminoProgram) {
      this._extKaminoProgram = getExtKaminoProgram(this.provider, this.staging);
    }
    return this._extKaminoProgram;
  }

  get extMarinadeProgram(): ExtMarinadeProgram {
    if (!this._extMarinadeProgram) {
      this._extMarinadeProgram = getExtMarinadeProgram(
        this.provider,
        this.staging,
      );
    }
    return this._extMarinadeProgram;
  }

  get extStakePoolProgram(): ExtStakePoolProgram {
    if (!this._extStakePoolProgram) {
      this._extStakePoolProgram = getExtStakePoolProgram(
        this.provider,
        this.staging,
      );
    }
    return this._extStakePoolProgram;
  }

  get extCctpProgram(): ExtCctpProgram {
    if (!this._extCctpProgram) {
      this._extCctpProgram = getExtCctpProgram(this.provider, this.staging);
    }
    return this._extCctpProgram;
  }

  get extBridgeProgram(): ExtBridgeProgram {
    if (!this._extBridgeProgram) {
      this._extBridgeProgram = getExtBridgeProgram(this.provider, this.staging);
    }
    return this._extBridgeProgram;
  }

  get extEpiProgram(): ExtEpiProgram {
    if (!this._extEpiProgram) {
      this._extEpiProgram = getExtEpiProgram(this.provider, this.staging);
    }
    return this._extEpiProgram;
  }

  get extLoopscaleProgram(): ExtLoopscaleProgram {
    if (!this._extLoopscaleProgram) {
      this._extLoopscaleProgram = getExtLoopscaleProgram(
        this.provider,
        this.staging,
      );
    }
    return this._extLoopscaleProgram;
  }

  get extPhoenixProgram(): ExtPhoenixProgram {
    if (!this._extPhoenixProgram) {
      this._extPhoenixProgram = getExtPhoenixProgram(
        this.provider,
        this.staging,
      );
    }
    return this._extPhoenixProgram;
  }

  get isVaultConnected(): boolean {
    return !!this._statePda;
  }

  get statePda(): PublicKey {
    if (!this._statePda) {
      throw new Error("State PDA is not specified");
    }
    return this._statePda;
  }

  set statePda(statePda: PublicKey) {
    if (this._statePda && !this._statePda.equals(statePda)) {
      this._glamLookupTablesPromise = undefined;
      this._glamLookupTablesCacheKey = undefined;
    }
    this._statePda = statePda;
  }

  /**
   * Mainnet-only default lookup tables (Kamino lending, Loopscale).
   * Cached for the session; safe to assume static contents.
   */
  private getDefaultLookupTables(): Promise<AddressLookupTableAccount[]> {
    if (!this.isMainnet) {
      return Promise.resolve([]);
    }
    if (!this._defaultLookupTablesPromise) {
      this._defaultLookupTablesPromise = fetchAddressLookupTableAccounts(
        this.connection,
        LOOKUP_TABLES,
      ).catch((error) => {
        this._defaultLookupTablesPromise = undefined;
        throw error;
      });
    }
    return this._defaultLookupTablesPromise;
  }

  /**
   * Discovers GLAM ALTs for the connected vault and caches the result for the
   * session.
   *
   * Call `invalidateGlamLookupTablesCache()` after creating or extending an ALT
   * to force a re-discovery on the next tx.
   */
  private getGlamLookupTablesCached(): Promise<AddressLookupTableAccount[]> {
    const key = this.statePda.toBase58();
    if (
      this._glamLookupTablesPromise &&
      this._glamLookupTablesCacheKey === key
    ) {
      return this._glamLookupTablesPromise;
    }
    this._glamLookupTablesCacheKey = key;
    this._glamLookupTablesPromise = findGlamLookupTables(
      this.statePda,
      this.vaultPda,
      this.connection,
    ).catch((error) => {
      this._glamLookupTablesPromise = undefined;
      this._glamLookupTablesCacheKey = undefined;
      throw error;
    });
    return this._glamLookupTablesPromise;
  }

  public invalidateGlamLookupTablesCache(): void {
    this._glamLookupTablesPromise = undefined;
    this._glamLookupTablesCacheKey = undefined;
  }

  get isMainnet(): boolean {
    return this.cluster === ClusterNetwork.Mainnet;
  }

  /**
   * Converts a legacy transaction into a versioned transaction.
   */
  public async intoVersionedTransaction(
    tx: Transaction,
    {
      lookupTables = [],
      signer,
      computeUnitLimit,
      getPriorityFeeMicroLamports,
      maxFeeLamports,
      useMaxFee = false,
      simulate = false,
    }: TxOptions,
  ): Promise<VersionedTransaction> {
    signer = signer || this.signer;

    const instructions = tx.instructions;
    const lookupTableAccounts: AddressLookupTableAccount[] = [];

    // Default (mainnet-only) lookup tables are cached for the session. Start
    // the fetch in parallel with caller-provided lookups; swallow failures so
    // an RPC hiccup doesn't fail tx building (same fallback policy used for
    // GLAM ALT discovery below). Attaching `.catch` also keeps the cached
    // promise from surfacing as an unhandled rejection if caller-key fetch
    // throws first.
    const defaultLookupTablesPromise = this.getDefaultLookupTables().catch(
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `Failed to fetch default address lookup tables. Continuing without them: ${message}`,
        );
        return [] as AddressLookupTableAccount[];
      },
    );

    // Fetch caller-provided lookup tables. If already resolved, use as-is;
    // otherwise batch-fetch their account data.
    if (lookupTables.every((t) => t instanceof AddressLookupTableAccount)) {
      lookupTableAccounts.push(...lookupTables);
    } else if (lookupTables.length > 0) {
      const accounts = await fetchAddressLookupTableAccounts(
        this.connection,
        lookupTables as PublicKey[] | string[],
      );
      lookupTableAccounts.push(...accounts);
    }

    lookupTableAccounts.push(...(await defaultLookupTablesPromise));

    // Fetch GLAM specific lookup tables only if vault state has been set.
    // Discovery is cached per-statePda for the session; if it fails (e.g., RPC
    // deprioritization) we fall back to an empty list so tx building continues.
    if (this.isVaultConnected) {
      try {
        const glamLookupTableAccounts = await this.getGlamLookupTablesCached();
        lookupTableAccounts.push(...glamLookupTableAccounts);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `Failed to discover GLAM address lookup tables for ${this.statePda.toBase58()}. Continuing without them: ${message}`,
        );
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "Lookup tables:",
        lookupTableAccounts.map((a) => a.key.toBase58()),
      );
    }

    const recentBlockhash = (await this.blockhashWithCache.get()).blockhash;

    const { unitsConsumed, error, serializedTx } = await getSimulationResult(
      this.provider.connection,
      instructions,
      signer,
      lookupTableAccounts,
      this.staging,
    );
    computeUnitLimit = unitsConsumed;

    // by default, a simulation error doesn't prevent the tx from being sent
    // - gui: wallet apps usually do the simulation themselves, we should ignore the simulation error here by default
    // - cli: we should set simulate=true
    if (error && simulate) {
      console.log("Tx (base64):", serializedTx);
      console.error("Simulation failed:", error.message);
      console.error(
        "If error message is too obscure, inspect and simulate the tx in explorer: https://explorer.solana.com/tx/inspector",
      );
      throw error;
    }

    // Add CU instructions if computeUnitLimit is provided
    if (computeUnitLimit) {
      let cuOptions = { maxFeeLamports, useMaxFee } as ComputeBudgetOptions;
      if (getPriorityFeeMicroLamports) {
        const vTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: signer,
            recentBlockhash,
            instructions,
          }).compileToV0Message(lookupTableAccounts),
        );
        cuOptions = {
          ...cuOptions,
          vTx,
          getPriorityFeeMicroLamports,
        };
      }
      const cuIxs = await buildComputeBudgetInstructions(
        computeUnitLimit,
        cuOptions,
      );
      instructions.unshift(...cuIxs);
    }

    return new VersionedTransaction(
      new TransactionMessage({
        payerKey: signer,
        recentBlockhash,
        instructions,
      }).compileToV0Message(lookupTableAccounts),
    );
  }

  public async sendAndConfirm(
    tx: VersionedTransaction | Transaction,
    additionalSigners: Keypair[] = [],
  ): Promise<TransactionSignature> {
    // Mainnet only: use dedicated connection for sending transactions if available
    const txConnection =
      this.cluster === ClusterNetwork.Mainnet
        ? new Connection(
            process.env.NEXT_PUBLIC_TX_RPC ||
              process.env.TX_RPC ||
              this.connection.rpcEndpoint,
            { commitment: this.connection.commitment },
          )
        : this.connection;

    // Anchor provider.sendAndConfirm forces a signature with the wallet, which we don't want
    // https://github.com/coral-xyz/anchor/blob/v0.30.0/ts/packages/anchor/src/provider.ts#L159
    if (tx instanceof Transaction) {
      tx.feePayer = tx.feePayer || this.signer;
      tx.recentBlockhash =
        tx.recentBlockhash || (await this.blockhashWithCache.get()).blockhash;
      if (additionalSigners.length > 0) {
        tx.partialSign(...additionalSigners);
      }
    }

    const signedTx = await this.wallet.signTransaction(tx);
    if (
      signedTx instanceof VersionedTransaction &&
      additionalSigners.length > 0
    ) {
      signedTx.sign(additionalSigners);
    }
    const serializedTx = signedTx.serialize();

    // skip simulation since we just did it to compute CUs
    // however this means that we need to reconstruct the error, if
    // the tx fails onchain execution.
    const txSig = await txConnection.sendRawTransaction(serializedTx, {
      skipPreflight: true,
    });
    this.onSentListeners.forEach((fn) => fn(txSig));

    if (process.env.NODE_ENV === "development") {
      console.log("Confirming tx:", txSig);
    }

    const res = await this.confirmTransaction(txSig);

    // if the tx fails, throw an error including logs
    if (res.value.err) {
      const errTx = await this.connection.getTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
      });
      const logs = errTx?.meta?.logMessages || [];
      throw new GlamError(
        parseProgramLogs(logs, this.staging),
        errTx?.meta?.err,
        logs,
      );
    }
    return txSig;
  }

  private async confirmTransaction(
    txSig: string,
  ): Promise<{ value: { err: any } }> {
    const websocketDisabled =
      process.env.NEXT_PUBLIC_WEBSOCKET_DISABLED ||
      process.env.WEBSOCKET_DISABLED;
    // Treat "0", "false", "", undefined, null as false
    // Treat "1", "true", or any other truthy string as true
    const useWebSocket = !(
      websocketDisabled &&
      websocketDisabled !== "0" &&
      websocketDisabled !== "false"
    );

    if (useWebSocket) {
      const latestBlockhash = await this.blockhashWithCache.get();
      try {
        return await this.connection.confirmTransaction({
          ...latestBlockhash,
          signature: txSig,
        });
      } catch (err) {
        if (typeof Event !== "undefined" && err instanceof Event) {
          throw new Error(
            `WebSocket error during transaction confirmation: ${(err as Event).type}`,
          );
        }
        throw err;
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "WebSocket disabled, falling back to polling signature status",
      );
    }

    const maxRetries = 60;
    const retryDelayMs = 1000;
    for (let i = 0; i < maxRetries; i++) {
      const status = await this.connection.getSignatureStatus(txSig);
      if (
        status?.value?.confirmationStatus === "confirmed" ||
        status?.value?.confirmationStatus === "finalized" ||
        status?.value?.err
      ) {
        return { value: { err: status.value.err } };
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    const expiry = (maxRetries * retryDelayMs) / 1000;
    throw new Error(
      `Transaction confirmation timeout after ${expiry} seconds.`,
    );
  }

  get connection(): Connection {
    return this.provider.connection;
  }

  get signer(): PublicKey {
    const publicKey = this.provider?.publicKey;
    if (!publicKey) {
      throw new Error(
        "Signer public key cannot be retrieved from anchor provider",
      );
    }
    return publicKey;
  }

  get wallet(): Wallet {
    const anchorProvider = this.provider as AnchorProvider;
    if (!anchorProvider?.wallet) {
      throw new Error("Wallet cannot be retrieved from anchor provider");
    }
    return anchorProvider.wallet as Wallet;
  }

  // derived from state pda
  get vaultPda(): PublicKey {
    return getVaultPda(this.statePda, this.protocolProgram.programId);
  }

  // derived from state pda
  get mintPda(): PublicKey {
    return getMintPda(this.statePda, 0, this.mintProgram.programId);
  }

  // derived from mint pda
  get escrowPda(): PublicKey {
    return getEscrowPda(this.mintPda, this.mintProgram.programId);
  }

  // derived from mint pda
  get extraMetasPda(): PublicKey {
    return getExtraMetasPda(this.mintPda);
  }

  // derived from mint pda
  get requestQueuePda(): PublicKey {
    return getRequestQueuePda(this.mintPda, this.mintProgram.programId);
  }

  /**
   * Returns SOL and token balances of the given owner pubkey
   */
  public async getSolAndTokenBalances(owner: PublicKey) {
    const balanceLamports = await this.provider.connection.getBalance(owner);
    const tokenAccounts = await getTokenAccountsByOwner(
      this.provider.connection,
      owner,
    );
    const uiAmount = balanceLamports / LAMPORTS_PER_SOL;

    return {
      balanceLamports,
      uiAmount, // SOL amount
      tokenAccounts,
    };
  }

  /**
   * Returns user's token account for the given mint and token program ID
   */
  public getAta(
    mint: PublicKey,
    owner: PublicKey,
    tokenProgram = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
  }

  /**
   * Returns glam vault's token account for the given mint and token program ID
   */
  public getVaultAta(mint: PublicKey, tokenProgramId?: PublicKey): PublicKey {
    return this.getAta(mint, this.vaultPda, tokenProgramId);
  }

  /**
   * Returns user's glam mint token account
   */
  public getMintAta(user?: PublicKey): PublicKey {
    return this.getAta(
      this.mintPda,
      user || this.signer,
      TOKEN_2022_PROGRAM_ID,
    );
  }

  /**
   * Returns glam vault's SOL balance
   */
  public async getVaultBalance(): Promise<number> {
    const lamports = await this.getVaultLamports();
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Returns glam vault's SOL balance in lamports
   */
  public async getVaultLamports(): Promise<number> {
    return await this.provider.connection.getBalance(this.vaultPda);
  }

  /**
   * Returns glam vault's token balance for the given mint
   */
  public async getVaultTokenBalance(
    mintPubkey: PublicKey,
  ): Promise<{ amount: BN; uiAmount: number }> {
    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      this.provider.connection,
      mintPubkey,
    );
    const ata = this.getVaultAta(mintPubkey, tokenProgram);

    try {
      const account = await getAccount(
        this.provider.connection,
        ata,
        "confirmed",
        tokenProgram,
      );
      return {
        amount: new BN(account.amount.toString()),
        uiAmount: Number(account.amount) / Math.pow(10, mint.decimals),
      };
    } catch (e) {
      if (e instanceof TokenAccountNotFoundError) {
        return { amount: new BN(0), uiAmount: 0 };
      }
      throw e;
    }
  }

  /**
   * Returns user's glam mint token balance
   */
  public async getMintTokenBalance(
    owner?: PublicKey,
  ): Promise<{ amount: BN; uiAmount: number }> {
    const account = await getAccount(
      this.provider.connection,
      this.getMintAta(owner), // glam mint ata
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    return {
      amount: new BN(account.amount.toString()),
      uiAmount: Number(account.amount) / 10 ** 9,
    };
  }

  async isLockupEnabled(): Promise<boolean> {
    if (!this.statePda) {
      throw new Error("State PDA is not specified");
    }

    const { mint } = await fetchMintAndTokenProgram(
      this.provider.connection,
      this.mintPda,
    );
    const extMetadata = getExtensionData(
      ExtensionType.TokenMetadata,
      mint.tlvData,
    );
    const tokenMetadata = extMetadata
      ? unpack(extMetadata)
      : ({} as TokenMetadata);
    for (const [k, v] of tokenMetadata?.additionalMetadata) {
      if (k === "LockupPeriodSeconds") {
        return parseInt(v) > 0;
      }
    }
    return false;
  }

  public async fetchGlobalConfig(options?: {
    refresh?: boolean;
  }): Promise<GlobalConfig> {
    const useCache = !options?.refresh;

    if (options?.refresh) {
      this._globalConfig = undefined;
      this._globalConfigPromise = undefined;
      this._assetMetas = undefined;
      this._assetMetasPromise = undefined;
    }

    if (useCache) {
      if (this._globalConfig) {
        return this._globalConfig;
      }
      if (this._globalConfigPromise) {
        return this._globalConfigPromise;
      }
    }

    const fetchPromise = fetchGlobalConfigAccount(this.connection)
      .then((globalConfig) => {
        if (useCache) {
          this._globalConfig = globalConfig;
        }
        return globalConfig;
      })
      .finally(() => {
        if (useCache) {
          this._globalConfigPromise = undefined;
        }
      });

    if (useCache) {
      this._globalConfigPromise = fetchPromise;
    }

    return await fetchPromise;
  }

  public async fetchAssetMetas(options?: {
    refresh?: boolean;
  }): Promise<PkMap<AssetMeta>> {
    const useCache = !options?.refresh;

    if (useCache) {
      if (this._assetMetas) {
        return this._assetMetas;
      }
      if (this._assetMetasPromise) {
        return this._assetMetasPromise;
      }
    } else {
      this._assetMetas = undefined;
      this._assetMetasPromise = undefined;
    }

    const fetchPromise = this.fetchGlobalConfig(options)
      .then(async (globalConfig) => {
        const assets = globalConfig.assetMetas.map((am) => am.asset);
        const tokenProgramsByAsset = new PkMap<PublicKey>();

        try {
          // Fast path when every global-config mint account is available.
          const mintInfos = await fetchMintsAndTokenPrograms(
            this.connection,
            assets,
          );
          assets.forEach((asset, i) => {
            tokenProgramsByAsset.set(asset, mintInfos[i].tokenProgram);
          });
        } catch {
          // Local validators may clone a newer global config than the set of
          // mint accounts they have available. Resolve what we can and let
          // downstream callers request only the assets they actually use.
          const accountsInfo = await this.connection.getMultipleAccountsInfo(
            assets,
            "confirmed",
          );
          accountsInfo.forEach((accountInfo, i) => {
            const asset = assets[i];
            if (accountInfo) {
              tokenProgramsByAsset.set(
                asset,
                parseMintAccountInfo(accountInfo, asset).tokenProgram,
              );
              return;
            }
          });
        }

        // Transforms onchain asset meta to client asset meta
        const assetMetaEntries: [PublicKey, AssetMeta][] = [];
        globalConfig.assetMetas.forEach(
          ({ asset, decimals, oracle, oracleSourceOrdinal }) => {
            const programId = tokenProgramsByAsset.get(asset);
            if (!programId) {
              return;
            }

            assetMetaEntries.push([
              asset,
              {
                asset,
                decimals,
                oracle,
                oracleSource: getOracleName(oracleSourceOrdinal),
                programId,
              },
            ]);
          },
        );

        const assetMetaMap = new PkMap<AssetMeta>(assetMetaEntries);

        if (useCache) {
          this._assetMetas = assetMetaMap;
        }

        return assetMetaMap;
      })
      .finally(() => {
        if (useCache) {
          this._assetMetasPromise = undefined;
        }
      });

    return await fetchPromise;
  }

  public async refreshAssetMetaCache(): Promise<PkMap<AssetMeta>> {
    this._globalConfig = undefined;
    this._globalConfigPromise = undefined;
    this._assetMetas = undefined;
    this._assetMetasPromise = undefined;

    return await this.fetchAssetMetas({ refresh: true });
  }

  public async getAssetMeta(
    assetMint: string | PublicKey,
    options?: { refresh?: boolean },
  ): Promise<AssetMeta> {
    const mint = new PublicKey(assetMint);
    const assetMetas = await this.fetchAssetMetas(options);
    const assetMeta = assetMetas.get(mint) || ASSETS_MAINNET.get(mint);

    if (!assetMeta) {
      throw new Error(`Asset not supported: ${assetMint.toString()}`);
    }

    return assetMeta;
  }

  public async getSolOracle(options?: {
    refresh?: boolean;
  }): Promise<PublicKey> {
    return (await this.getAssetMeta(WSOL, options)).oracle;
  }

  public async fetchStateAccount(statePda?: PublicKey): Promise<StateAccount> {
    return await this.protocolProgram.account.stateAccount.fetch(
      statePda || this.statePda,
    );
  }

  private getMintProgramIdForStateAccount(
    stateAccount: StateAccount,
  ): PublicKey {
    const prodMintProgramId = getGlamMintProgramId(false);
    const stagingMintProgramId = getGlamMintProgramId(true);
    const mintIntegrationProgram = stateAccount.integrationAcls?.find(
      (acl) =>
        acl.integrationProgram.equals(prodMintProgramId) ||
        acl.integrationProgram.equals(stagingMintProgramId),
    )?.integrationProgram;

    return mintIntegrationProgram ?? this.mintProgram.programId;
  }

  private getMintProgramForStateAccount(
    stateAccount: StateAccount,
  ): GlamMintProgram {
    const mintProgramId = this.getMintProgramIdForStateAccount(stateAccount);
    if (mintProgramId.equals(this.mintProgram.programId)) {
      return this.mintProgram;
    }

    if (mintProgramId.equals(getGlamMintProgramId(true))) {
      return getGlamMintProgram(this.provider, true);
    }

    if (mintProgramId.equals(getGlamMintProgramId(false))) {
      return getGlamMintProgram(this.provider, false);
    }

    return this.mintProgram;
  }

  public async fetchRequestQueue(
    requestQueuePda?: PublicKey,
    mintProgram: GlamMintProgram = this.mintProgram,
  ): Promise<RequestQueue> {
    return mintProgram.account.requestQueue.fetch(
      requestQueuePda || this.requestQueuePda,
    );
  }

  /**
   * Builds a StateModel from onchain accounts (state, mint, etc)
   *
   * @param statePda Optional state PDA
   */
  public async fetchStateModel(statePda?: PublicKey): Promise<StateModel> {
    const glamStatePda = statePda || this.statePda;
    const stateAccount = await this.fetchStateAccount(glamStatePda);

    if (!stateAccount.mint.equals(PublicKey.default)) {
      const mintProgram = this.getMintProgramForStateAccount(stateAccount);
      const mintPubkey = stateAccount.mint;
      const requestQueuePda = getRequestQueuePda(
        stateAccount.mint,
        mintProgram.programId,
      );

      const { mint } = await fetchMintAndTokenProgram(
        this.provider.connection,
        mintPubkey,
      );

      // fetch request queue only if state account is a tokenized vault
      const requestQueue = StateAccountType.equals(
        stateAccount.accountType,
        StateAccountType.TOKENIZED_VAULT,
      )
        ? await this.fetchRequestQueue(requestQueuePda, mintProgram)
        : undefined;

      return StateModel.fromOnchainAccounts(
        glamStatePda,
        stateAccount,
        this.staging,
        mint,
        requestQueue,
      );
    }

    return StateModel.fromOnchainAccounts(
      glamStatePda,
      stateAccount,
      this.staging,
    );
  }

  /**
   * Fetches glam state models and applies filters
   *
   * @param filterOptions Filter options
   */
  public async fetchGlamStates(filterOptions?: {
    owner?: PublicKey;
    delegate?: PublicKey;
    type?: string;
  }): Promise<StateModel[]> {
    const { owner, delegate, type } = filterOptions || {};

    const stateAccounts = await this.protocolProgram.account.stateAccount.all();
    const filteredStateAccounts = stateAccounts
      .filter(
        (s) =>
          !type ||
          Object.keys(s.account.accountType)[0].toLowerCase() ===
            type.toLowerCase(),
      )
      .filter(
        (s) =>
          // if neither owner nor delegate is set, return all
          // if owner is set, return states owned by the owner
          // if delegate is set, return states with the delegate
          (!owner && !delegate) ||
          (owner && s.account.owner.equals(owner)) ||
          (delegate &&
            s.account.delegateAcls.some((acl) => acl.pubkey.equals(delegate))),
      );

    const mintsCache = new PkMap<Mint>();
    const mintPubkeys = filteredStateAccounts
      .map((s) => s.account.mint)
      .filter((p) => !p.equals(PublicKey.default));
    const mints = await fetchMintsAndTokenPrograms(
      this.provider.connection,
      mintPubkeys,
    );
    for (let i = 0; i < mintPubkeys.length; i++) {
      mintsCache.set(mintPubkeys[i], mints[i].mint);
    }

    // { publicKey, account: RequestQueue }[]
    const requestQueues = await this.mintProgram.account.requestQueue.all();
    const requestQueueMap = new PkMap(
      requestQueues.map((r) => [r.publicKey, r.account]),
    );

    return filteredStateAccounts.map(({ publicKey, account: stateAccount }) => {
      const mint = mintsCache.get(stateAccount.mint);
      const requestQueuePda = mint
        ? getRequestQueuePda(stateAccount.mint, this.mintProgram.programId)
        : PublicKey.default;
      const requestQueue = requestQueueMap.get(requestQueuePda);

      return StateModel.fromOnchainAccounts(
        publicKey,
        stateAccount,
        this.staging,
        mint,
        requestQueue,
      );
    });
  }

  public async fetchProtocolPolicy<T>(
    integProgramId: PublicKey,
    protocolBitflag: number,
    policyClass: { decode(buffer: Buffer, staging?: boolean): T },
  ): Promise<T | null> {
    const stateAccount = await this.fetchStateAccount();
    const integrationPolicy = stateAccount.integrationAcls?.find((acl) =>
      acl.integrationProgram.equals(integProgramId),
    );
    const policyData = integrationPolicy?.protocolPolicies?.find(
      (policy: any) => policy.protocolBitflag === protocolBitflag,
    )?.data;
    if (policyData) {
      return policyClass.decode(policyData, this.staging);
    }
    return null;
  }
}

/**
 * Base transaction builder for sub-clients
 */
export class BaseTxBuilder<T extends { base: BaseClient }> {
  constructor(readonly client: T) {}

  /**
   * Build a legacy transaction with the given instructions.
   * Pre and post instructions in txOptions are preserved.
   */
  build(ixs: TransactionInstruction[], txOptions: TxOptions = {}): Transaction {
    return new Transaction().add(
      ...(txOptions.preInstructions || []),
      ...ixs,
      ...(txOptions.postInstructions || []),
    );
  }

  /**
   * Build a versioned transaction that is ready to be sent.
   */
  async buildVersionedTx(
    ixs: TransactionInstruction[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const tx = this.build(ixs, txOptions);
    return await this.client.base.intoVersionedTransaction(tx, txOptions);
  }
}
