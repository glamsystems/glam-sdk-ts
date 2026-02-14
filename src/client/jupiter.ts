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
import { STAKE_POOLS_MAP, SOL_ORACLE, getAssetMeta } from "../assets";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { isStaging } from "../glamExports";
import { getGlobalConfigPda } from "../utils/glamPDAs";
import { VaultClient } from "./vault";
import {
  JupiterApiClient,
  JupiterInstruction,
  QuoteParams,
  QuoteResponse,
  SwapInstructions,
} from "../utils/jupiterApi";

class TxBuilder extends BaseTxBuilder<JupiterSwapClient> {
  /**
   * Returns the instructions for a Jupiter swap and the lookup tables
   */
  async swapIxs(
    options: {
      quoteParams?: QuoteParams;
      quoteResponse?: QuoteResponse;
      swapInstructions?: SwapInstructions;
    },
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction[], PublicKey[]]> {
    const glamVault = this.client.base.vaultPda;

    const { quoteParams, quoteResponse } = options;
    let swapInstructions = options?.swapInstructions;
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

      inputMint = new PublicKey(
        quoteParams?.inputMint || resolvedQuoteResponse!.inputMint,
      );
      outputMint = new PublicKey(
        quoteParams?.outputMint || resolvedQuoteResponse!.outputMint,
      );
      amount = new BN(quoteParams?.amount || resolvedQuoteResponse!.inAmount);

      swapInstructions = await this.client.jupApi.getSwapInstructions(
        resolvedQuoteResponse,
        glamVault,
      );
    } else {
      // If swapInstructions is provided, we need to extract mints and amount from quoteParams or quoteResponse
      if (quoteParams) {
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
    }

    const { swapInstruction, addressLookupTableAddresses } = swapInstructions;

    const swapIx = this.toTransactionInstruction(swapInstruction);
    const lookupTables = addressLookupTableAddresses.map(
      (pubkey) => new PublicKey(pubkey),
    );

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
      // Only staging supports extra validations based on the oracle accounts
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        inputStakePool,
        outputStakePool,
        ...(isStaging()
          ? {
              glamConfig: getGlobalConfigPda(),
              solUsdOracle: SOL_ORACLE,
              inputTokenOracle: getAssetMeta(inputMint).oracle,
              outputTokenOracle: getAssetMeta(outputMint).oracle,
            }
          : {}),
      })
      .remainingAccounts(swapIx.keys)
      .instruction();
    return [[...preInstructions, ix], lookupTables];
  }

  async swapTx(
    options: {
      quoteParams?: QuoteParams;
      quoteResponse?: QuoteResponse;
      swapInstructions?: SwapInstructions;
    },
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const glamSigner = txOptions.signer || this.client.base.signer;
    const [ixs, lookupTables] = await this.swapIxs(options, glamSigner);
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
    options: {
      quoteParams?: QuoteParams;
      quoteResponse?: QuoteResponse;
      swapInstructions?: SwapInstructions;
    },
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.swapTx(options, txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
