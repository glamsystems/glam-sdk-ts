import { BN, utils as anchorUtils } from "@coral-xyz/anchor";

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { BaseClient, BaseTxBuilder, TokenAccount, TxOptions } from "./base";
import { PriceClient } from "./price";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import {
  MintIdlModel,
  RequestType,
  StateAccountType,
  StateIdlModel,
} from "../models";
import { TRANSFER_HOOK_PROGRAM } from "../constants";
import { fetchMintAndTokenProgram, getProgramAccounts } from "../utils";
import {
  getAccountPolicyPda,
  getExtraMetasPda,
  getMintPda,
  getStatePda,
  getTokenAclMintConfigPda,
  getTokenAclFlagAccountPda,
  getTokenAclGateListConfigPda,
  getTokenAclGateWalletEntryPda,
  getTokenAclGateExtraMetasPda,
} from "../utils/glamPDAs";
import { TOKEN_ACL_GATE_PROGRAM, TOKEN_ACL_PROGRAM } from "../constants";
import { ClusterNetwork } from "../clientConfig";
import { charsToString } from "../utils/common";
import { UpdateStateParams } from "./state";

export type InitMintParams = {
  accountType: StateAccountType;
  name: number[];
  symbol: string;
  uri: string;
  baseAssetMint: PublicKey;
  decimals?: number;
} & Partial<MintIdlModel>;

export type UpdateMintParams = {
  permanentDelegate?: PublicKey;
  defaultAccountStateFrozen?: boolean;
  lockupPeriod?: number;
  maxCap?: BN;
  minSubscription?: BN;
  minRedemption?: BN;
  allowlist?: PublicKey[];
  blocklist?: PublicKey[];
};

class TxBuilder extends BaseTxBuilder<MintClient> {
  public async setTokenAccountsStatesIx(
    tokenAccounts: PublicKey[],
    frozen: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.mintProgram.methods
      .setTokenAccountsStates(frozen)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        glamMint: this.client.base.mintPda,
      })
      .remainingAccounts(
        tokenAccounts.map((account) => ({
          pubkey: account,
          isSigner: false,
          isWritable: true,
        })),
      )
      .instruction();
  }

  public async setTokenAccountsStatesTx(
    tokenAccounts: PublicKey[],
    frozen: boolean,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.setTokenAccountsStatesIx(
      tokenAccounts,
      frozen,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public async createTokenAccountIxs(
    owner: PublicKey,
    setFrozen: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const glamMint = this.client.base.mintPda;
    const ata = this.client.base.getMintAta(owner);
    const ixCreateAta = createAssociatedTokenAccountIdempotentInstruction(
      glamSigner,
      ata,
      owner,
      glamMint,
      TOKEN_2022_PROGRAM_ID,
    );
    const ix = await this.setTokenAccountsStatesIx(
      [ata],
      setFrozen,
      glamSigner,
    );
    return [ixCreateAta, ix];
  }

  public async createTokenAccountTx(
    owner: PublicKey,
    setFrozen: boolean = true,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.createTokenAccountIxs(owner, setFrozen, glamSigner);
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async mintIxs(
    recipient: PublicKey,
    amount: BN,
    forceThaw: boolean = false,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const mintTo = this.client.base.getMintAta(recipient);
    const glamState = this.client.base.statePda;
    const glamMint = this.client.base.mintPda;

    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        mintTo,
        recipient,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      ),
    ];
    if (forceThaw) {
      preInstructions.push(
        await this.client.base.mintProgram.methods
          .setTokenAccountsStates(false)
          .accounts({
            glamState,
            glamSigner,
            glamMint,
          })
          .remainingAccounts([
            { pubkey: mintTo, isSigner: false, isWritable: true },
          ])
          .instruction(),
      );
    }

    let policyAccount = (await this.client.base.isLockupEnabled())
      ? getAccountPolicyPda(mintTo)
      : null;

    const ix = await this.client.base.mintProgram.methods
      .mintTokens(amount)
      .accounts({
        glamState,
        glamSigner,
        glamMint,
        recipient,
        policyAccount,
      })
      .instruction();

    return [...preInstructions, ix];
  }

  public async mintTx(
    recipient: PublicKey,
    amount: BN,
    forceThaw: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.mintIxs(recipient, amount, forceThaw, glamSigner);
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async burnIxs(
    from: PublicKey,
    amount: BN,
    forceThaw: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const fromAta = this.client.base.getMintAta(from);
    const glamState = this.client.base.statePda;
    const glamMint = this.client.base.mintPda;

    const preInstructions = [];
    if (forceThaw) {
      preInstructions.push(
        await this.client.base.mintProgram.methods
          .setTokenAccountsStates(false)
          .accounts({
            glamState,
            glamSigner,
            glamMint,
          })
          .remainingAccounts([
            { pubkey: fromAta, isSigner: false, isWritable: true },
          ])
          .instruction(),
      );
    }

    const ix = await this.client.base.mintProgram.methods
      .burnTokens(amount)
      .accounts({
        glamState,
        glamSigner,
        glamMint,
        fromTokenAccount: fromAta,
        from,
      })
      .instruction();

    return [...preInstructions, ix];
  }

  public async burnTx(
    from: PublicKey,
    amount: BN,
    forceThaw: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.burnIxs(from, amount, forceThaw, glamSigner);
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async forceTransferIxs(
    from: PublicKey,
    to: PublicKey,
    amount: BN,
    forceThaw: boolean,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const fromAta = this.client.base.getMintAta(from);
    const toAta = this.client.base.getMintAta(to);
    const glamState = this.client.base.statePda;
    const glamMint = this.client.base.mintPda;

    const preInstructions = [];
    preInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        toAta,
        to,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    if (forceThaw) {
      preInstructions.push(
        await this.client.base.mintProgram.methods
          .setTokenAccountsStates(false)
          .accounts({
            glamState,
            glamSigner,
            glamMint,
          })
          .remainingAccounts([
            { pubkey: fromAta, isSigner: false, isWritable: true },
            { pubkey: toAta, isSigner: false, isWritable: true },
          ])
          .instruction(),
      );
    }

    const remainingAccounts: PublicKey[] = [];
    let toPolicyAccount = null;
    if (await this.client.base.isLockupEnabled()) {
      const extraMetasAccount = this.client.base.extraMetasPda;
      const fromPolicy = getAccountPolicyPda(fromAta);
      const toPolicy = getAccountPolicyPda(toAta);
      toPolicyAccount = toPolicy;
      remainingAccounts.push(
        ...[extraMetasAccount, fromPolicy, toPolicy, TRANSFER_HOOK_PROGRAM],
      );
    }
    const ix = await this.client.base.mintProgram.methods
      .forceTransferTokens(amount)
      .accounts({
        glamState,
        glamSigner,
        glamMint,
        fromTokenAccount: fromAta,
        from,
        to,
        toPolicyAccount,
      })
      .remainingAccounts(
        remainingAccounts.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();

    return [...preInstructions, ix];
  }

  public async forceTransferTx(
    from: PublicKey,
    to: PublicKey,
    amount: BN,
    forceThaw: boolean = false,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ixs = await this.forceTransferIxs(
      from,
      to,
      amount,
      forceThaw,
      glamSigner,
    );
    return this.buildVersionedTx(ixs, txOptions);
  }

  public async initializeIxs(
    initMintParams: InitMintParams,
    stateParams: UpdateStateParams | null,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey]> {
    const decimals: number | null =
      typeof initMintParams.decimals === "number"
        ? initMintParams.decimals
        : null;

    const stateInitKey = [
      ...Buffer.from(
        anchorUtils.sha256.hash(charsToString(initMintParams.name)),
      ).subarray(0, 8),
    ];
    const glamState = getStatePda(
      stateInitKey,
      glamSigner,
      this.client.base.protocolProgram.programId,
    );

    const postInstructions = [];

    // If stateParams is provided and is not empty, update the state account as a post instruction
    if (stateParams && Object.keys(stateParams).length > 0) {
      const updateStateIx = await this.client.base.protocolProgram.methods
        .updateState(new StateIdlModel(stateParams))
        .accounts({
          glamState,
          glamSigner,
        })
        .instruction();
      postInstructions.push(updateStateIx);
    }

    const mintProgram = this.client.base.mintProgram;
    const mintPda = getMintPda(glamState, 0, mintProgram.programId);
    const extraMetasPda = getExtraMetasPda(mintPda);

    // Use glam hosted metadata as a fallback if uri is not provided
    if (!initMintParams.uri) {
      initMintParams.uri = `https://static.glam.systems/v0/token/metadata?key=${mintPda}`;
    }

    const ix = await mintProgram.methods
      .initializeMint(
        new MintIdlModel(initMintParams), // accountType, baseAssetMint, and decimals are dropped,
        stateInitKey,
        initMintParams.accountType,
        decimals,
      )
      .accounts({
        glamState,
        signer: glamSigner,
        newMint: mintPda,
        extraMetasAccount: extraMetasPda,
        baseAssetMint: initMintParams.baseAssetMint,
      })
      .instruction();
    return [[ix, ...postInstructions], glamState];
  }

  public async initializeTx(
    initMintParams: InitMintParams,
    stateParams: UpdateStateParams | null,
    txOptions: TxOptions = {},
  ): Promise<[VersionedTransaction, PublicKey]> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, glamState] = await this.initializeIxs(
      initMintParams,
      stateParams,
      glamSigner,
    );
    const tx = await this.buildVersionedTx(ixs, txOptions);
    return [tx, glamState];
  }

  public async crystallizeFeesIxs(
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const glamState = this.client.base.statePda;
    const glamMint = this.client.base.mintPda;
    const escrowPda = this.client.base.escrowPda;
    const escrowMintAta = this.client.base.getMintAta(escrowPda);

    const priceVaultIxs = await this.client.price.priceVaultIxs();
    const createEscrowShareAtaIx =
      createAssociatedTokenAccountIdempotentInstruction(
        glamSigner,
        escrowMintAta,
        escrowPda,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      );

    const ix = await this.client.base.mintProgram.methods
      .crystallizeFees()
      .accounts({
        glamState,
        glamMint,
      })
      .instruction();
    return [...priceVaultIxs, createEscrowShareAtaIx, ix];
  }

  public async updateIx(
    mintModel: Partial<MintIdlModel>,
    glamSigner: PublicKey,
  ) {
    return await this.client.base.mintProgram.methods
      .updateMint(new MintIdlModel(mintModel))
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        glamSigner,
      })
      .instruction();
  }

  public async updateTx(
    mintModel: Partial<MintIdlModel>,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const preInstructions = mintModel.feeStructure
      ? await this.crystallizeFeesIxs(glamSigner)
      : [];
    const ix = await this.updateIx(mintModel, glamSigner);
    return this.buildVersionedTx([...preInstructions, ix], txOptions);
  }

  public async emergencyUpdateIx(
    requestType: RequestType,
    setPaused: boolean,
    glamSigner: PublicKey,
  ) {
    return await this.client.base.mintProgram.methods
      .emergencyUpdateMint({
        requestType,
        setPaused,
      })
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        glamSigner,
      })
      .instruction();
  }

  public async pauseSubscriptionTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.emergencyUpdateIx(
      RequestType.SUBSCRIPTION,
      true,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public async unpauseSubscriptionTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.emergencyUpdateIx(
      RequestType.SUBSCRIPTION,
      false,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public async pauseRedemptionTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.emergencyUpdateIx(
      RequestType.REDEMPTION,
      true,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public async unpauseRedemptionTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const is = await this.emergencyUpdateIx(
      RequestType.REDEMPTION,
      false,
      glamSigner,
    );
    return this.buildVersionedTx([is], txOptions);
  }

  public async closeMintIx(signer?: PublicKey) {
    return await this.client.base.mintProgram.methods
      .closeMint()
      .accounts({
        glamState: this.client.base.statePda,
        glamMint: this.client.base.mintPda,
        glamSigner: signer || this.client.base.signer,
        extraMetasAccount: this.client.base.extraMetasPda,
      })
      .instruction();
  }

  public async closeMintTx(txOptions: TxOptions = {}) {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.closeMintIx(glamSigner);
    return await this.buildVersionedTx([ix], txOptions);
  }

  public async enableTokenAclIx(
    tokenAclAuthority: PublicKey,
    gatingProgram: PublicKey | undefined,
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamMint = this.client.base.mintPda;
    const mintConfigPda = getTokenAclMintConfigPda(glamMint);
    return await (this.client.base.mintProgram.methods as any)
      .enableTokenAcl(tokenAclAuthority, gatingProgram ?? null)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        glamMint,
        mintConfig: mintConfigPda,
      })
      .instruction();
  }

  public async enableTokenAclTx(
    tokenAclAuthority: PublicKey,
    gatingProgram: PublicKey | undefined,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.enableTokenAclIx(
      tokenAclAuthority,
      gatingProgram,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public createTokenAclAllowlistIx(
    seed: Buffer,
    mode: number,
    glamSigner: PublicKey,
  ): TransactionInstruction {
    const listConfigPda = getTokenAclGateListConfigPda(glamSigner, seed);
    const data = Buffer.alloc(34);
    data.writeUInt8(0x01, 0); // discriminator
    data.writeUInt8(mode, 1);
    seed.copy(data, 2);

    return new TransactionInstruction({
      programId: TOKEN_ACL_GATE_PROGRAM,
      keys: [
        { pubkey: glamSigner, isSigner: true, isWritable: false },
        { pubkey: glamSigner, isSigner: true, isWritable: true },
        { pubkey: listConfigPda, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });
  }

  public async createTokenAclAllowlistTx(
    seed: Buffer,
    mode: number,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = this.createTokenAclAllowlistIx(seed, mode, glamSigner);
    return this.buildVersionedTx([ix], txOptions);
  }

  public addWalletToTokenAclAllowlistIx(
    seed: Buffer,
    wallet: PublicKey,
    glamSigner: PublicKey,
  ): TransactionInstruction {
    const listConfigPda = getTokenAclGateListConfigPda(glamSigner, seed);
    const walletEntryPda = getTokenAclGateWalletEntryPda(listConfigPda, wallet);

    return new TransactionInstruction({
      programId: TOKEN_ACL_GATE_PROGRAM,
      keys: [
        { pubkey: glamSigner, isSigner: true, isWritable: false },
        { pubkey: glamSigner, isSigner: true, isWritable: true },
        { pubkey: listConfigPda, isSigner: false, isWritable: true },
        { pubkey: wallet, isSigner: false, isWritable: false },
        { pubkey: walletEntryPda, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: Buffer.from([0x02]),
    });
  }

  public async addWalletToTokenAclAllowlistTx(
    seed: Buffer,
    wallet: PublicKey,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = this.addWalletToTokenAclAllowlistIx(seed, wallet, glamSigner);
    return this.buildVersionedTx([ix], txOptions);
  }

  public async setupTokenAclGateExtraMetasIx(
    listConfigs: PublicKey[],
    glamSigner: PublicKey,
  ): Promise<TransactionInstruction> {
    const glamMint = this.client.base.mintPda;
    const mintConfigPda = getTokenAclMintConfigPda(glamMint);
    const extraMetasPda = getTokenAclGateExtraMetasPda(glamMint);

    return await (this.client.base.mintProgram.methods as any)
      .setupTokenAclGateExtraMetas()
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        glamMint,
        mintConfig: mintConfigPda,
        extraMetas: extraMetasPda,
        tokenAclGateProgram: TOKEN_ACL_GATE_PROGRAM,
      })
      .remainingAccounts(
        listConfigs.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .instruction();
  }

  public async setupTokenAclGateExtraMetasTx(
    listConfigs: PublicKey[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const ix = await this.setupTokenAclGateExtraMetasIx(
      listConfigs,
      glamSigner,
    );
    return this.buildVersionedTx([ix], txOptions);
  }

  public thawPermissionlessIx(
    wallet: PublicKey,
    listAndWalletPairs: { listConfig: PublicKey; walletEntry: PublicKey }[],
    signer: PublicKey,
  ): TransactionInstruction {
    const glamMint = this.client.base.mintPda;
    const tokenAccount = this.client.base.getMintAta(wallet);
    const flagAccount = getTokenAclFlagAccountPda(tokenAccount);
    const mintConfigPda = getTokenAclMintConfigPda(glamMint);
    const extraMetasPda = getTokenAclGateExtraMetasPda(glamMint);

    const keys = [
      { pubkey: signer, isSigner: true, isWritable: false },
      { pubkey: glamMint, isSigner: false, isWritable: false },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: flagAccount, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: false, isWritable: false },
      { pubkey: mintConfigPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_ACL_GATE_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: extraMetasPda, isSigner: false, isWritable: false },
    ];

    for (const pair of listAndWalletPairs) {
      keys.push({
        pubkey: pair.listConfig,
        isSigner: false,
        isWritable: false,
      });
      keys.push({
        pubkey: pair.walletEntry,
        isSigner: false,
        isWritable: false,
      });
    }

    return new TransactionInstruction({
      programId: TOKEN_ACL_PROGRAM,
      keys,
      data: Buffer.from([0x06]),
    });
  }

  public async thawPermissionlessTx(
    wallet: PublicKey,
    listAndWalletPairs: { listConfig: PublicKey; walletEntry: PublicKey }[],
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const signer = txOptions.signer || this.client.base.signer;
    const glamMint = this.client.base.mintPda;
    const ata = this.client.base.getMintAta(wallet);
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      signer,
      ata,
      wallet,
      glamMint,
      TOKEN_2022_PROGRAM_ID,
    );
    const ix = this.thawPermissionlessIx(wallet, listAndWalletPairs, signer);
    return this.buildVersionedTx([createAtaIx, ix], txOptions);
  }
}

export class MintClient {
  readonly txBuilder: TxBuilder;

  public constructor(
    readonly base: BaseClient,
    private readonly getPrice?: () => PriceClient,
  ) {
    this.txBuilder = new TxBuilder(this);
  }

  get price(): PriceClient {
    if (!this.getPrice) {
      throw new Error("PriceClient not available");
    }
    return this.getPrice();
  }

  /**
   * Fetches token holders of the GLAM mint using helius RPC
   */
  public async fetchTokenHolders(
    showZeroBalance: boolean = true,
  ): Promise<TokenAccount[]> {
    // `getTokenAccounts` is a helius only RPC endpoint, we hardcode the URL here
    // in case users choose to use a non-helius RPC. Fall back to getHolders if
    // helius API key is not provided

    const heliusApiKey =
      process.env.NEXT_PUBLIC_HELIUS_API_KEY || process.env.HELIUS_API_KEY;
    if (!heliusApiKey || this.base.cluster !== ClusterNetwork.Mainnet) {
      return await this.getHolders(showZeroBalance);
    }

    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getTokenAccounts",
          params: {
            mint: this.base.mintPda.toBase58(),
            options: { showZeroBalance },
          },
        }),
      },
    );

    const data = await response.json();
    const { token_accounts: tokenAccounts } = data.result;

    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      this.base.mintPda,
    );

    return tokenAccounts.map((ta: any) => ({
      owner: new PublicKey(ta.owner),
      pubkey: new PublicKey(ta.address),
      mint: this.base.mintPda,
      programId: tokenProgram,
      decimals: mint.decimals,
      amount: ta.amount,
      uiAmount: Number(ta.amount) / 10 ** mint.decimals,
      frozen: ta.frozen,
    }));
  }

  // Can be very slow. Use fetchTokenHolders when possible.
  public async getHolders(
    showZeroBalance: boolean = true,
  ): Promise<TokenAccount[]> {
    const connection = this.base.connection;

    // FIXME: enable dataSize filter
    // dataSize varies due to different sets of extensions enabled
    // const dataSize = 175;
    const accounts = await getProgramAccounts(
      connection,
      TOKEN_2022_PROGRAM_ID,
      {
        filters: [
          // { dataSize },
          { memcmp: { offset: 0, bytes: this.base.mintPda.toBase58() } },
        ],
      },
    );
    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      this.base.mintPda,
    );
    return accounts
      .map((a) => {
        const { pubkey, account } = a;
        const tokenAccount = unpackAccount(
          pubkey,
          account,
          TOKEN_2022_PROGRAM_ID,
        );
        return {
          owner: tokenAccount.owner,
          pubkey: tokenAccount.address,
          mint: tokenAccount.mint,
          programId: tokenProgram,
          decimals: mint.decimals,
          amount: tokenAccount.amount.toString(),
          uiAmount: Number(tokenAccount.amount) / 10 ** mint.decimals,
          frozen: tokenAccount.isFrozen,
        } as TokenAccount;
      })
      .filter((ta) => showZeroBalance || ta.uiAmount > 0);
  }

  public async initialize(
    initMintParams: InitMintParams,
    txOptions: TxOptions = {},
  ) {
    const [vTx, statePda] = await this.txBuilder.initializeTx(
      initMintParams,
      null,
      txOptions,
    );
    this.base.statePda = statePda;
    return await this.base.sendAndConfirm(vTx);
  }

  public async initializeWithStateParams(
    initMintParams: InitMintParams,
    stateParams: UpdateStateParams,
    txOptions: TxOptions = {},
  ) {
    const [vTx, statePda] = await this.txBuilder.initializeTx(
      initMintParams,
      stateParams,
      txOptions,
    );
    this.base.statePda = statePda;
    return await this.base.sendAndConfirm(vTx);
  }

  public async update(
    mintModel: Partial<MintIdlModel>,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.updateTx(mintModel, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async pauseSubscription(txOptions: TxOptions = {}) {
    const vTx = await this.txBuilder.pauseSubscriptionTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async unpauseSubscription(txOptions: TxOptions = {}) {
    const vTx = await this.txBuilder.unpauseSubscriptionTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async pauseRedemption(txOptions: TxOptions = {}) {
    const vTx = await this.txBuilder.pauseRedemptionTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async unpauseRedemption(txOptions: TxOptions = {}) {
    const vTx = await this.txBuilder.unpauseRedemptionTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async close(txOptions: TxOptions = {}) {
    const vTx = await this.txBuilder.closeMintTx(txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async mint(
    to: PublicKey,
    amount: BN | number,
    unfreeze: boolean = false,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.mintTx(to, amount, unfreeze, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async burn(
    from: PublicKey,
    amount: BN | number,
    unfreeze: boolean = false,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.burnTx(from, amount, unfreeze, txOptions);
    return await this.base.sendAndConfirm(vTx);
  }

  public async createTokenAccount(
    owner: PublicKey,
    setFrozen: boolean,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.createTokenAccountTx(
      owner,
      setFrozen,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async setTokenAccountsStates(
    tokenAccounts: PublicKey[],
    frozen: boolean,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.setTokenAccountsStatesTx(
      tokenAccounts,
      frozen,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async enableTokenAcl(
    tokenAclAuthority: PublicKey,
    gatingProgram?: PublicKey,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.enableTokenAclTx(
      tokenAclAuthority,
      gatingProgram,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async forceTransfer(
    from: PublicKey,
    to: PublicKey,
    amount: BN | number,
    unfreeze: boolean = false,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.forceTransferTx(
      from,
      to,
      amount,
      unfreeze,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async createTokenAclAllowlist(
    seed: Buffer,
    mode: number = 0,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.createTokenAclAllowlistTx(
      seed,
      mode,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async addWalletToTokenAclAllowlist(
    seed: Buffer,
    wallet: PublicKey,
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.addWalletToTokenAclAllowlistTx(
      seed,
      wallet,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async setupTokenAclGateExtraMetas(
    listConfigs: PublicKey[],
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.setupTokenAclGateExtraMetasTx(
      listConfigs,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  public async thawPermissionless(
    wallet: PublicKey,
    listAndWalletPairs: { listConfig: PublicKey; walletEntry: PublicKey }[],
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.thawPermissionlessTx(
      wallet,
      listAndWalletPairs,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }
}
