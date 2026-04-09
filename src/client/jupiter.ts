import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { WSOL } from "../constants";
import { STAKE_POOLS_MAP } from "../assets";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { VaultClient } from "./vault";
import {
  JupiterApiClient,
  JupiterInstruction,
  QuoteParams,
  QuoteResponse,
  SwapInstructions,
} from "../utils/jupiterApi";

export type JupiterSwapOptions = {
  quoteParams?: QuoteParams;
  quoteResponse?: QuoteResponse;
  swapInstructions?: SwapInstructions;
  trackingAccount?: PublicKey;
};

export type JupiterSwapV2OracleAccounts = {
  solUsdOracle?: PublicKey;
  inputTokenOracle?: PublicKey;
  outputTokenOracle?: PublicKey;
};

export type JupiterSwapV2Options = JupiterSwapOptions & {
  skipQuotePriceCheck?: boolean;
  oracleAccounts?: JupiterSwapV2OracleAccounts;
};

class TxBuilder extends BaseTxBuilder<JupiterSwapClient> {
  private async resolveSwapInstructionContext(
    options: JupiterSwapOptions,
  ): Promise<{
    inputMint: PublicKey;
    outputMint: PublicKey;
    amount: BN;
    swapIx: TransactionInstruction;
    lookupTables: PublicKey[];
  }> {
    const glamVault = this.client.base.vaultPda;
    const { quoteParams, quoteResponse } = options;
    let swapInstructions = options.swapInstructions;
    let inputMint: PublicKey;
    let outputMint: PublicKey;
    let amount: BN;

    if (!swapInstructions) {
      let resolvedQuoteResponse = quoteResponse;
      if (resolvedQuoteResponse === undefined) {
        if (quoteParams === undefined) {
          throw new Error(
            "quoteParams must be specified when quoteResponse and swapInstructions are not specified.",
          );
        }
        resolvedQuoteResponse =
          await this.client.jupApi.getQuoteResponse(quoteParams);
      }
      const finalQuoteResponse = resolvedQuoteResponse!;

      inputMint = new PublicKey(
        quoteParams?.inputMint || finalQuoteResponse.inputMint,
      );
      outputMint = new PublicKey(
        quoteParams?.outputMint || finalQuoteResponse.outputMint,
      );
      amount = new BN(quoteParams?.amount || finalQuoteResponse.inAmount);

      swapInstructions = await this.client.jupApi.getSwapInstructions(
        finalQuoteResponse,
        glamVault,
        options.trackingAccount,
      );
    } else if (quoteParams) {
      inputMint = new PublicKey(quoteParams.inputMint);
      outputMint = new PublicKey(quoteParams.outputMint);
      amount = new BN(quoteParams.amount);
    } else if (quoteResponse) {
      inputMint = new PublicKey(quoteResponse.inputMint);
      outputMint = new PublicKey(quoteResponse.outputMint);
      amount = new BN(quoteResponse.inAmount);
    } else {
      throw new Error(
        "Either quoteParams or quoteResponse must be specified when using swapInstructions.",
      );
    }

    return {
      inputMint,
      outputMint,
      amount,
      swapIx: this.toTransactionInstruction(swapInstructions.swapInstruction),
      lookupTables: swapInstructions.addressLookupTableAddresses.map(
        (pubkey) => new PublicKey(pubkey),
      ),
    };
  }

  /**
   * Returns the instructions for a Jupiter swap and the lookup tables
   */
  async swapIxs(
    options: JupiterSwapOptions,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey[]]> {
    const { inputMint, outputMint, amount, swapIx, lookupTables } =
      await this.resolveSwapInstructionContext(options);

    const { tokenProgram: outputTokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      outputMint,
    );
    const inputStakePool =
      STAKE_POOLS_MAP.get(inputMint.toBase58())?.poolState || null;
    const outputStakePool =
      STAKE_POOLS_MAP.get(outputMint.toBase58())?.poolState || null;

    const preInstructions = await this.getPreInstructions(
      glamSigner,
      inputMint,
      outputMint,
      amount,
      outputTokenProgram,
    );
    const ix = await this.client.base.protocolProgram.methods
      .jupiterSwap(swapIx.data)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        inputStakePool,
        outputStakePool,
      })
      .remainingAccounts(swapIx.keys)
      .instruction();
    return [[...preInstructions, ix], lookupTables];
  }

  async swapV2Ixs(
    options: JupiterSwapV2Options,
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey[]]> {
    const { inputMint, outputMint, amount, swapIx, lookupTables } =
      await this.resolveSwapInstructionContext(options);
    const { skipQuotePriceCheck = false, oracleAccounts } = options;

    const { tokenProgram: outputTokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      outputMint,
    );
    const inputStakePool =
      STAKE_POOLS_MAP.get(inputMint.toBase58())?.poolState || null;
    const outputStakePool =
      STAKE_POOLS_MAP.get(outputMint.toBase58())?.poolState || null;

    const preInstructions = await this.getPreInstructions(
      glamSigner,
      inputMint,
      outputMint,
      amount,
      outputTokenProgram,
    );
    // glam_config is auto-resolved by Anchor via its PDA seeds declaration.
    const ix = await this.client.base.protocolProgram.methods
      .jupiterSwapV2(skipQuotePriceCheck, swapIx.data)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        inputStakePool,
        outputStakePool,
        solUsdOracle: oracleAccounts?.solUsdOracle || null,
        inputTokenOracle: oracleAccounts?.inputTokenOracle || null,
        outputTokenOracle: oracleAccounts?.outputTokenOracle || null,
      })
      .remainingAccounts(swapIx.keys)
      .instruction();
    return [[...preInstructions, ix], lookupTables];
  }

  async swapTx(
    options: JupiterSwapOptions,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, lookupTables] = await this.swapIxs(options, glamSigner);
    return await this.buildVersionedTx(ixs, { lookupTables, ...txOptions });
  }

  async swapV2Tx(
    options: JupiterSwapV2Options,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, lookupTables] = await this.swapV2Ixs(options, glamSigner);
    return await this.buildVersionedTx(ixs, { lookupTables, ...txOptions });
  }

  getPreInstructions = async (
    signer: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: BN,
    outputTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
  ): Promise<TransactionInstruction[]> => {
    const preInstructions = [
      createAssociatedTokenAccountIdempotentInstruction(
        signer,
        this.client.base.getVaultAta(outputMint, outputTokenProgram),
        this.client.base.vaultPda,
        outputMint,
        outputTokenProgram,
      ),
    ];

    // Transfer SOL to wSOL ATA if needed for the vault
    if (inputMint.equals(WSOL)) {
      const wrapSolIxs = await this.client.vault.maybeWrapSol(amount, signer);
      preInstructions.push(...wrapSolIxs);
    }

    return preInstructions;
  };

  toTransactionInstruction = (ix: JupiterInstruction) => {
    if (ix === null) {
      throw new Error("Cannot parse a null instruction");
    }

    return new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.accounts.map(({ pubkey, isWritable }) => ({
        pubkey: new PublicKey(pubkey),
        isSigner: false, // No additional signer needed
        isWritable,
      })),
      data: Buffer.from(ix.data, "base64"),
    });
  };
}

export class JupiterSwapClient {
  public readonly txBuilder: TxBuilder;
  public readonly jupApi: JupiterApiClient;

  public constructor(
    readonly base: BaseClient,
    readonly vault: VaultClient,
  ) {
    this.txBuilder = new TxBuilder(this);
    this.jupApi =
      this.base.jupiterApiClient ||
      new JupiterApiClient({ apiKey: this.base.jupiterApiKey });
  }

  public async swap(
    options: JupiterSwapOptions,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.swapTx(options, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  public async swapV2(
    options: JupiterSwapV2Options,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.swapV2Tx(options, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
