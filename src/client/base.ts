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
  sendAndConfirmTransaction,
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
  getTokenAccountsByOwner,
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
  ExtCctpProgram,
  ExtDriftProgram,
  ExtKaminoProgram,
  ExtMarinadeProgram,
  ExtSplProgram,
  ExtStakePoolProgram,
  GlamMintProgram,
  GlamProtocolProgram,
  getExtCctpProgram,
  getExtDriftProgram,
  getExtKaminoProgram,
  getExtMarinadeProgram,
  getExtSplProgram,
  getExtStakePoolProgram,
  getGlamMintProgram,
  getGlamProtocolProgram,
} from "../glamExports";
import { ClusterNetwork, GlamClientConfig } from "../clientConfig";
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
import { fetchGlamLookupTableAccounts } from "../utils/glamApi";
import { JupiterApiClient, PkMap } from "../utils";

const LOOKUP_TABLES = [
  new PublicKey("284iwGtA9X9aLy3KsyV8uT2pXLARhYbiSi5SiM2g47M2"), // kamino lending
  new PublicKey("D9cnvzswDikQDf53k4HpQ3KJ9y1Fv3HGGDFYMXnK5T6c"), // drift
  new PublicKey("EiWSskK5HXnBTptiS5DH6gpAJRVNQ3cAhTKBGaiaysAb"), // drift
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
  public onSentListeners = new Set<(sig: string) => void>();

  private _protocolProgram?: GlamProtocolProgram;
  private _mintProgram?: GlamMintProgram;
  private _extSplProgram?: ExtSplProgram;
  private _extDriftProgram?: ExtDriftProgram;
  private _extKaminoProgram?: ExtKaminoProgram;
  private _extMarinadeProgram?: ExtMarinadeProgram;
  private _extStakePoolProgram?: ExtStakePoolProgram;
  private _extCctpProgram?: ExtCctpProgram;

  private _statePda?: PublicKey;

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
    this.jupiterApiKey = config?.jupiterApiKey;
    this.jupiterApiClient = config?.jupiterApiClient;
    this.blockhashWithCache = new BlockhashWithCache(this.provider);
  }

  get protocolProgram(): GlamProtocolProgram {
    if (!this._protocolProgram) {
      this._protocolProgram = getGlamProtocolProgram(this.provider);
    }
    return this._protocolProgram;
  }

  get mintProgram(): GlamMintProgram {
    if (!this._mintProgram) {
      this._mintProgram = getGlamMintProgram(this.provider);
    }
    return this._mintProgram;
  }

  get extSplProgram(): ExtSplProgram {
    if (!this._extSplProgram) {
      this._extSplProgram = getExtSplProgram(this.provider);
    }
    return this._extSplProgram;
  }

  get extDriftProgram(): ExtDriftProgram {
    if (!this._extDriftProgram) {
      this._extDriftProgram = getExtDriftProgram(this.provider);
    }
    return this._extDriftProgram;
  }

  get extKaminoProgram(): ExtKaminoProgram {
    if (!this._extKaminoProgram) {
      this._extKaminoProgram = getExtKaminoProgram(this.provider);
    }
    return this._extKaminoProgram;
  }

  get extMarinadeProgram(): ExtMarinadeProgram {
    if (!this._extMarinadeProgram) {
      this._extMarinadeProgram = getExtMarinadeProgram(this.provider);
    }
    return this._extMarinadeProgram;
  }

  get extStakePoolProgram(): ExtStakePoolProgram {
    if (!this._extStakePoolProgram) {
      this._extStakePoolProgram = getExtStakePoolProgram(this.provider);
    }
    return this._extStakePoolProgram;
  }

  get extCctpProgram(): ExtCctpProgram {
    if (!this._extCctpProgram) {
      this._extCctpProgram = getExtCctpProgram(this.provider);
    }
    return this._extCctpProgram;
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
    this._statePda = statePda;
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

    // Fetch custom lookup tables and default lookup tables
    if (lookupTables.every((t) => t instanceof AddressLookupTableAccount)) {
      const accounts = await fetchAddressLookupTableAccounts(
        this.connection,
        LOOKUP_TABLES,
      );
      lookupTableAccounts.push(...lookupTables, ...accounts);
    } else {
      const accounts = await fetchAddressLookupTableAccounts(this.connection, [
        ...lookupTables,
        ...LOOKUP_TABLES,
      ]);
      lookupTableAccounts.push(...accounts);
    }

    // Fetch GLAM specific lookup tables only if vault state has been set
    if (this.isVaultConnected) {
      const glamLookupTableAccounts = await fetchGlamLookupTableAccounts(
        this.statePda,
      );
      lookupTableAccounts.push(...glamLookupTableAccounts);
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

    // This is just a convenient method so that in tests we can send legacy
    // txs, for example transfer SOL, create ATA, etc.
    if (tx instanceof Transaction) {
      return await sendAndConfirmTransaction(
        txConnection,
        tx,
        [this.wallet.payer, ...additionalSigners],
        {
          skipPreflight: true,
        },
      );
    }

    // Anchor provider.sendAndConfirm forces a signature with the wallet, which we don't want
    // https://github.com/coral-xyz/anchor/blob/v0.30.0/ts/packages/anchor/src/provider.ts#L159
    const signedTx = await this.wallet.signTransaction(tx);
    if (additionalSigners && additionalSigners.length > 0) {
      signedTx.sign(additionalSigners);
    }
    const serializedTx = signedTx.serialize();

    // skip simulation since we just did it to compute CUs
    // however this means that we need to reconstruct the error, if
    // the tx fails onchain execution.
    const txSig = await txConnection.sendRawTransaction(serializedTx, {
      skipPreflight: true,
    });
    this.onSentListeners.forEach(fn => fn(txSig));

    if (process.env.NODE_ENV === "development") {
      console.log("Confirming tx:", txSig);
    }

    const res = await this.confirmTransaction(txSig);

    // if the tx fails, throw an error including logs
    if (res.value.err) {
      const errTx = await this.connection.getTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
      });
      throw new GlamError(
        parseProgramLogs(errTx?.meta?.logMessages),
        errTx?.meta?.err || undefined,
        errTx?.meta?.logMessages || [],
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

  public async fetchStateAccount(statePda?: PublicKey): Promise<StateAccount> {
    return await this.protocolProgram.account.stateAccount.fetch(
      statePda || this.statePda,
    );
  }

  public async fetchRequestQueue(
    requestQueuePda?: PublicKey,
  ): Promise<RequestQueue> {
    return this.mintProgram.account.requestQueue.fetch(
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
      const mintPubkey = glamStatePda.equals(this.statePda)
        ? this.mintPda
        : getMintPda(glamStatePda, 0, this.mintProgram.programId);
      const requestQueuePda = glamStatePda.equals(this.statePda)
        ? this.requestQueuePda
        : getRequestQueuePda(mintPubkey, this.mintProgram.programId);

      const { mint } = await fetchMintAndTokenProgram(
        this.provider.connection,
        mintPubkey,
      );

      // fetch request queue only if state account is a tokenized vault
      const requestQueue = StateAccountType.equals(
        stateAccount.accountType,
        StateAccountType.TOKENIZED_VAULT,
      )
        ? await this.fetchRequestQueue(requestQueuePda)
        : undefined;

      return StateModel.fromOnchainAccounts(
        glamStatePda,
        stateAccount,
        mint,
        requestQueue,
      );
    }

    return StateModel.fromOnchainAccounts(
      glamStatePda,
      stateAccount,
      undefined,
      undefined,
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
        mint,
        requestQueue,
      );
    });
  }

  public async fetchProtocolPolicy<T>(
    integProgramId: PublicKey,
    protocolBitflag: number,
    policyClass: { decode(buffer: Buffer): T },
  ): Promise<T | null> {
    const stateAccount = await this.fetchStateAccount();
    const integrationPolicy = stateAccount.integrationAcls?.find((acl) =>
      acl.integrationProgram.equals(integProgramId),
    );
    const policyData = integrationPolicy?.protocolPolicies?.find(
      (policy: any) => policy.protocolBitflag === protocolBitflag,
    )?.data;
    if (policyData) {
      return policyClass.decode(policyData);
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
