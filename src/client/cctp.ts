import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  VersionedTransaction,
  TransactionSignature,
  Keypair,
  Commitment,
  Finality,
  AccountMeta,
  TransactionInstruction,
  SystemProgram,
  VersionedTransactionResponse,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import {
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_MINTER_V2,
  USDC,
  USDC_DEVNET,
} from "../constants";
import {
  hexToBytes,
  toUiAmount,
  getProgramAccounts,
  getTransactionsForAddress,
} from "../utils";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { struct, array, u8, vec } from "@coral-xyz/borsh";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const RECEIVE_MESSAGE_DISCM = Buffer.from([
  38, 144, 127, 225, 31, 225, 238, 25,
]);
const EMIT_CPI_IX_DISCM = new Uint8Array([
  0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d,
]);
const MESSAGE_RECEIVED_EVENT_DISCM = new Uint8Array([
  0xe7, 0x44, 0x2f, 0x4d, 0xad, 0xf1, 0x9d, 0xa6,
]);

const CCTP_DOMAIN_SOLANA = 5;

export class CctpBridgeEvent {
  readonly uiAmount!: number;
  slot?: number;

  constructor(
    readonly amount: BN,
    readonly sourceDomain: number,
    readonly sourceAddress: string,
    readonly destinationDomain: number,
    readonly destinationCaller: string,
    readonly destinationAddress: string,
    readonly attestation: string,
    readonly nonce: string,
    readonly status: string,
    readonly txHash: string,
  ) {
    this.uiAmount = toUiAmount(this.amount, 6);
  }
}

class TxBuilder extends BaseTxBuilder<CctpClient> {
  /**
   * Returns a transaction that calls CCTP's `depositForBurn` instruction that bridges USDC to another chain.
   * A keypair is generated for the message sent event account, which must be included as a transaction signer.
   */
  public async bridgeUsdcIx(
    amount: BN,
    domain: number,
    destinationAddress: PublicKey,
    params: {
      maxFee: BN;
      minFinalityThreshold: number;
      destinationCaller?: PublicKey;
    },
    glamSigner: PublicKey,
  ): Promise<[TransactionInstruction, Keypair]> {
    const usdcAddress = this.client.base.isMainnet ? USDC : USDC_DEVNET;
    const pdas = this.client.getDepositForBurnPdas(
      MESSAGE_TRANSMITTER_V2,
      TOKEN_MESSENGER_MINTER_V2,
      usdcAddress,
      domain,
    );

    const depositForBurnParams = {
      amount,
      destinationDomain: domain,
      mintRecipient: destinationAddress,
      destinationCaller: params.destinationCaller || PublicKey.default,
      ...params,
    };

    const denylistAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("denylist_account"), this.client.base.vaultPda.toBuffer()],
      TOKEN_MESSENGER_MINTER_V2,
    )[0];
    const messageSentEventAccountKeypair = Keypair.generate();

    const senderUsdcAta = this.client.base.getVaultAta(usdcAddress);

    const ix = await this.client.base.extCctpProgram.methods
      .depositForBurn(depositForBurnParams)
      .accounts({
        glamState: this.client.base.statePda,
        glamSigner,
        senderAuthorityPda: pdas.authorityPda,
        burnTokenAccount: senderUsdcAta,
        denylistAccount,
        messageTransmitter: pdas.messageTransmitterAccount,
        tokenMessenger: pdas.tokenMessengerAccount,
        remoteTokenMessenger: pdas.remoteTokenMessengerKey,
        tokenMinter: pdas.tokenMinterAccount,
        localToken: pdas.localToken,
        burnTokenMint: usdcAddress,
        messageSentEventData: messageSentEventAccountKeypair.publicKey,
        eventAuthority: pdas.tokenMessengerEventAuthority,
      })
      .instruction();
    return [ix, messageSentEventAccountKeypair];
  }

  public async bridgeUsdcTx(
    amount: BN,
    domain: number,
    destinationAddress: PublicKey,
    params: {
      maxFee: BN;
      minFinalityThreshold: number;
      destinationCaller?: PublicKey;
    },
    txOptions: TxOptions,
  ): Promise<[VersionedTransaction, Keypair]> {
    const signer = txOptions.signer || this.client.base.signer;
    const [ix, messageSentEventAccountKeypair] = await this.bridgeUsdcIx(
      amount,
      domain,
      destinationAddress,
      params,
      signer,
    );
    const tx = await this.buildVersionedTx([ix], txOptions);
    return [tx, messageSentEventAccountKeypair];
  }

  async receiveMessageIx(sourceDomain: number, messageObj: any) {
    const { message, attestation, eventNonce, decodedMessage, status } =
      messageObj;

    if (status !== "complete") {
      throw new Error(`Attestation status is ${status}, expected "complete"`);
    }
    if (
      !decodedMessage ||
      !decodedMessage?.decodedMessageBody ||
      !decodedMessage?.decodedMessageBody?.burnToken
    ) {
      throw new Error(
        "Invalid message object: missing burnToken in decodedMessage",
      );
    }

    const recipientUsdcAta = this.client.base.getVaultAta(USDC);

    // message, attestation, eventNonce, burnToken are hex strings
    const pdas = await this.client.getReceiveMessagePdas(
      MESSAGE_TRANSMITTER_V2,
      TOKEN_MESSENGER_MINTER_V2,
      USDC,
      decodedMessage.decodedMessageBody.burnToken,
      sourceDomain.toString(),
      eventNonce,
    );

    // raw ix data: [discriminator][message][attestation]
    const messageBuffer = Buffer.from(message.replace("0x", ""), "hex");
    const attestationBuffer = Buffer.from(attestation.replace("0x", ""), "hex");

    const keys: Array<AccountMeta> = [
      { pubkey: this.client.base.signer, isSigner: false, isWritable: true }, // payer
      { pubkey: this.client.base.signer, isSigner: false, isWritable: false }, // caller
      { pubkey: pdas.authorityPda, isSigner: false, isWritable: false }, // authority pda
      {
        pubkey: pdas.messageTransmitter,
        isSigner: false,
        isWritable: false,
      }, // messageTransmitter
      { pubkey: pdas.usedNonce, isSigner: false, isWritable: true }, // usedNonce
      {
        pubkey: TOKEN_MESSENGER_MINTER_V2,
        isSigner: false,
        isWritable: true,
      }, // receiver
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      }, // system program
      {
        pubkey: PublicKey.findProgramAddressSync(
          [Buffer.from("__event_authority")],
          MESSAGE_TRANSMITTER_V2,
        )[0],
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: MESSAGE_TRANSMITTER_V2,
        isSigner: false,
        isWritable: false,
      },
      { isSigner: false, isWritable: false, pubkey: pdas.tokenMessenger },
      {
        isSigner: false,
        isWritable: false,
        pubkey: pdas.remoteTokenMessengerKey,
      },
      {
        isSigner: false,
        isWritable: true,
        pubkey: pdas.tokenMinter,
      },
      {
        isSigner: false,
        isWritable: true,
        pubkey: pdas.localToken,
      },
      {
        isSigner: false,
        isWritable: false,
        pubkey: pdas.tokenPair,
      },
      {
        isSigner: false,
        isWritable: true,
        pubkey: pdas.feeRecipientTokenAccount,
      },
      {
        isSigner: false,
        isWritable: true,
        pubkey: recipientUsdcAta,
      },
      {
        isSigner: false,
        isWritable: true,
        pubkey: pdas.custodyTokenAccount,
      },
      {
        isSigner: false,
        isWritable: false,
        pubkey: TOKEN_PROGRAM_ID,
      },
      {
        isSigner: false,
        isWritable: false,
        pubkey: pdas.tokenMessengerEventAuthority,
      },
      {
        isSigner: false,
        isWritable: false,
        pubkey: TOKEN_MESSENGER_MINTER_V2,
      },
    ];

    const buffer = Buffer.alloc(2000);
    const layout = struct([
      array(u8(), 8, "discriminator"),
      vec(u8(), "message"),
      vec(u8(), "attestation"),
    ]);
    const len = layout.encode(
      {
        discriminator: RECEIVE_MESSAGE_DISCM,
        message: messageBuffer,
        attestation: attestationBuffer,
      },
      buffer,
    );
    const ixData = buffer.subarray(0, len);
    return new TransactionInstruction({
      keys,
      data: ixData,
      programId: MESSAGE_TRANSMITTER_V2,
    });
  }

  public async receiveUsdcTx(
    sourceDomain: number,
    params: {
      txHash?: string;
      nonce?: string;
    },
    txOptions: TxOptions = {},
  ) {
    const messages = await this.client.fetchV2Messages(sourceDomain, params);
    const receiveMessageIxs = [];
    for (const message of messages) {
      const ix = await this.receiveMessageIx(sourceDomain, message);
      receiveMessageIxs.push(ix);
    }

    const recipientWallet = this.client.base.vaultPda;
    const recipientUsdcAta = this.client.base.getVaultAta(USDC);
    const createUsdcAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      this.client.base.signer,
      recipientUsdcAta,
      recipientWallet,
      USDC,
    );
    return await this.buildVersionedTx(
      [createUsdcAtaIx, ...receiveMessageIxs],
      txOptions,
    );
  }
}

export class CctpClient {
  txBuilder: TxBuilder;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
  }

  /**
   * Bridge USDC to another chain using Circle's CCTP protocol
   *
   * @param amount Amount of USDC to bridge (in smallest units)
   * @param domain Destination domain (e.g., 0 for Ethereum, 1 for Avalanche)
   * @param destinationAddress Destination address on target chain (EVM address as PublicKey)
   * @param params Additional parameters (maxFee, minFinalityThreshold)
   * @param txOptions Transaction options
   */
  public async bridgeUsdc(
    amount: BN | number,
    domain: number,
    destinationAddress: PublicKey,
    params: {
      maxFee: BN;
      minFinalityThreshold: number;
      destinationCaller?: PublicKey;
    },
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const [tx, keypair] = await this.txBuilder.bridgeUsdcTx(
      new BN(amount),
      domain,
      destinationAddress,
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx, [keypair]);
  }

  /**
   * Receive USDC from another chain using Circle's CCTP protocol
   *
   * @param sourceDomain Source domain (e.g., 0 for Ethereum, 6 for Base)
   * @param params Additional parameters (txHash, nonce)
   * @param txOptions Transaction options
   */
  public async receiveUsdc(
    sourceDomain: number,
    params: {
      txHash?: string;
      nonce?: string;
    },
    txOptions: TxOptions = {},
  ) {
    const vTx = await this.txBuilder.receiveUsdcTx(
      sourceDomain,
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(vTx);
  }

  async getReceiveMessagePdas(
    messageTransmitterProgram: PublicKey,
    tokenMessengerMinterProgram: PublicKey,
    solUsdcMint: PublicKey,
    remoteUsdcAddressHex: string,
    remoteDomain: string,
    nonceHex: string,
  ) {
    const tokenMessenger = PublicKey.findProgramAddressSync(
      [Buffer.from("token_messenger")],
      tokenMessengerMinterProgram,
    )[0];
    const messageTransmitter = PublicKey.findProgramAddressSync(
      [Buffer.from("message_transmitter")],
      messageTransmitterProgram,
    )[0];
    const tokenMinter = PublicKey.findProgramAddressSync(
      [Buffer.from("token_minter")],
      tokenMessengerMinterProgram,
    )[0];
    const localToken = PublicKey.findProgramAddressSync(
      [Buffer.from("local_token"), solUsdcMint.toBuffer()],
      tokenMessengerMinterProgram,
    )[0];
    const remoteTokenMessengerKey = PublicKey.findProgramAddressSync(
      [Buffer.from("remote_token_messenger"), Buffer.from(remoteDomain)],
      tokenMessengerMinterProgram,
    )[0];
    const remoteTokenKey = new PublicKey(hexToBytes(remoteUsdcAddressHex));
    const tokenPair = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_pair"),
        Buffer.from(remoteDomain),
        remoteTokenKey.toBuffer(),
      ],
      tokenMessengerMinterProgram,
    )[0];
    const custodyTokenAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("custody"), solUsdcMint.toBuffer()],
      tokenMessengerMinterProgram,
    )[0];
    const authorityPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("message_transmitter_authority"),
        tokenMessengerMinterProgram.toBuffer(),
      ],
      messageTransmitterProgram,
    )[0];
    const tokenMessengerEventAuthority = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      tokenMessengerMinterProgram,
    )[0];

    const nonce = hexToBytes(nonceHex);
    const usedNonce = PublicKey.findProgramAddressSync(
      [Buffer.from("used_nonce"), Buffer.from(nonce)],
      messageTransmitterProgram,
    )[0];

    const accountInfo =
      await this.base.connection.getAccountInfo(tokenMessenger);
    if (!accountInfo) {
      throw new Error("Token messenger account not found");
    }

    const feeRecipient = new PublicKey(
      accountInfo.data.subarray(109, 109 + 32),
    );
    const feeRecipientTokenAccount = this.base.getAta(
      solUsdcMint,
      feeRecipient,
    );

    return {
      messageTransmitter,
      tokenMessenger,
      tokenMinter,
      localToken,
      remoteTokenMessengerKey,
      remoteTokenKey,
      tokenPair,
      custodyTokenAccount,
      authorityPda,
      tokenMessengerEventAuthority,
      usedNonce,
      feeRecipientTokenAccount,
    };
  }

  /**
   * Get all PDAs required for CCTP deposit for burn operation
   *
   * @param messageTransmitterProgram Message transmitter program ID
   * @param tokenMessengerMinterProgram Token messenger minter program ID
   * @param usdcAddress USDC mint address
   * @param destinationDomain Destination domain
   * @returns Object containing all required PDAs
   */
  getDepositForBurnPdas(
    messageTransmitterProgram: PublicKey,
    tokenMessengerMinterProgram: PublicKey,
    usdcAddress: PublicKey,
    destinationDomain: Number,
  ) {
    const messageTransmitterAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("message_transmitter")],
      messageTransmitterProgram,
    )[0];
    const tokenMessengerAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("token_messenger")],
      tokenMessengerMinterProgram,
    )[0];
    const tokenMinterAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("token_minter")],
      tokenMessengerMinterProgram,
    )[0];
    const localToken = PublicKey.findProgramAddressSync(
      [Buffer.from("local_token"), usdcAddress.toBuffer()],
      tokenMessengerMinterProgram,
    )[0];
    const remoteTokenMessengerKey = PublicKey.findProgramAddressSync(
      [
        Buffer.from("remote_token_messenger"),
        Buffer.from(destinationDomain.toString()),
      ],
      tokenMessengerMinterProgram,
    )[0];
    const authorityPda = PublicKey.findProgramAddressSync(
      [Buffer.from("sender_authority")],
      tokenMessengerMinterProgram,
    )[0];
    const tokenMessengerEventAuthority = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      tokenMessengerMinterProgram,
    )[0];

    return {
      messageTransmitterAccount,
      tokenMessengerAccount,
      tokenMinterAccount,
      localToken,
      remoteTokenMessengerKey,
      authorityPda,
      tokenMessengerEventAuthority,
    };
  }

  /**
   * Find all message accounts onchain for a given sender wallet
   *
   * TODO: filter by burned token mint
   */
  async findV2Messages(
    senderWallet: PublicKey,
    options: {
      commitment?: Commitment;
      minSlot?: number;
    },
  ) {
    const accounts = await getProgramAccounts(
      this.base.connection,
      MESSAGE_TRANSMITTER_V2,
      {
        ...(options.commitment ? { commitment: options.commitment } : {}),
        filters: [
          { dataSize: 428 },
          { memcmp: { offset: 300, bytes: senderWallet.toBase58() } },
        ],
      },
    );
    return accounts.map(({ pubkey }) => pubkey);
  }

  async fetchV2Messages(
    sourceDomain: number,
    params: { txHash?: string; nonce?: string },
  ): Promise<any[]> {
    const { txHash, nonce } = params;
    if (!txHash && !nonce) {
      throw new Error("txHash or nonce is required");
    }

    const queryParams = new URLSearchParams();
    if (nonce) {
      queryParams.set("nonce", nonce);
    } else if (txHash) {
      queryParams.set("transactionHash", txHash);
    }

    const resonse = await fetch(
      `https://iris-api.circle.com/v2/messages/${sourceDomain}?${queryParams}`,
    );
    if (!resonse.ok) {
      const { error } = await resonse.json();
      throw new Error(
        `Failed to fetch messages from Circle API: ${resonse.status} ${error}`,
      );
    }
    const { messages } = await resonse.json();
    if (!(messages instanceof Array)) {
      throw new Error("Invalid response from Circle API: messages not found");
    }
    return messages;
  }

  /**
   * Get bridge events from Circle API using either txHash or nonce
   *
   * @param sourceDomain Source domain
   * @param params Either txHash or nonce is required
   * @returns Array of bridge events
   */
  async parseEventsFromAttestion(
    sourceDomain: number,
    { txHash, nonce }: { txHash?: string; nonce?: string },
  ): Promise<CctpBridgeEvent[]> {
    const messages = await this.fetchV2Messages(sourceDomain, {
      txHash,
      nonce,
    });
    return messages.map((message) => {
      const attestation = message.attestation;
      const status = message.status;
      const nonce = message.decodedMessage.nonce;
      const destinationDomain = Number(
        message.decodedMessage.destinationDomain,
      );
      const destinationCaller = message.decodedMessage.destinationCaller;
      const destinationAddress =
        message.decodedMessage.decodedMessageBody.mintRecipient;
      const sourceAddress =
        message.decodedMessage.decodedMessageBody.messageSender;
      const amount = message.decodedMessage.decodedMessageBody.amount;
      const token = message.decodedMessage.decodedMessageBody.burnToken;

      if (sourceDomain === 5 && token !== USDC.toBase58()) {
        throw new Error("Invalid message, expected burn token to be USDC");
      }

      return new CctpBridgeEvent(
        new BN(amount),
        sourceDomain,
        sourceAddress,
        destinationDomain,
        destinationCaller,
        destinationAddress,
        attestation,
        nonce,
        status,
        txHash ?? "",
      );
    });
  }

  async getTransactions(
    signatures: string[],
    batchSize: number,
    commitment?: Finality,
  ) {
    const transactions: VersionedTransactionResponse[] = [];
    for (let i = 0; i < signatures.length; i += batchSize) {
      const promises = signatures.slice(i, i + batchSize).map((sig) =>
        this.base.connection.getTransaction(sig, {
          commitment,
          maxSupportedTransactionVersion: 0,
        }),
      );
      const batchTransactions = await Promise.all(promises);
      transactions.push(...batchTransactions.filter((tx) => tx !== null));
    }
    return transactions;
  }

  /**
   * Get incoming bridge events (EVM -> Solana)
   *
   * Unlike outgoing bridge events, incoming bridge events are not stored in Message accounts on Solana.
   * We need to examine all transactions to find the ones that contain the bridge events.
   * 1. Fetch all transactions involing the vault's USDC token account
   * 2. Filter transactions that contain the bridge events
   * 3. Parse the bridge events from the transactions
   */
  async getIncomingBridgeEvents(options: {
    batchSize?: number;
    commitment?: Finality;
    txHashes?: string[];
    minSlot?: number;
  }): Promise<CctpBridgeEvent[]> {
    const { batchSize = 1, commitment = "confirmed", minSlot = 0 } = options;

    const txHashes = new Set<string>(options.txHashes ?? []);
    let transactions: VersionedTransactionResponse[] = [];

    if (txHashes.size > 0) {
      transactions = await this.getTransactions(
        Array.from(txHashes),
        batchSize,
        commitment,
      );
    } else {
      transactions = await getTransactionsForAddress(
        this.base.connection,
        this.base.getVaultAta(USDC),
        { commitment },
      );
    }

    const sourcedNonceSlotSig: [number, string, number, string][] = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!tx || !tx.meta || tx.slot < minSlot) continue;

      // Look for CCTP program logs indicating incoming bridge
      const logs = tx.meta.logMessages || [];
      const cctpLogs = logs.filter(
        (log) =>
          log.includes(
            "Program CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC invoke",
          ) || log.includes("ReceiveMessage"),
      );

      if (cctpLogs.length === 0) {
        continue;
      }

      // This is a potential incoming bridge transaction
      // Parse the transaction data to extract bridge event details
      for (const innerInstruction of tx?.meta?.innerInstructions ?? []) {
        for (const { data } of innerInstruction.instructions) {
          const bytes = Buffer.from(bs58.decode(data));
          if (
            !bytes.subarray(0, 8).equals(EMIT_CPI_IX_DISCM) ||
            !bytes.subarray(8, 16).equals(MESSAGE_RECEIVED_EVENT_DISCM)
          ) {
            continue;
          }

          const sourceDomain = bytes.readUInt32LE(48);
          const nonce = "0x" + bytes.subarray(52, 84).toString("hex");

          sourcedNonceSlotSig.push([
            sourceDomain,
            nonce,
            tx.slot,
            tx.transaction.signatures[0],
          ]);
        }
      }
    }

    const allEvents: CctpBridgeEvent[] = [];
    for (let i = 0; i < sourcedNonceSlotSig.length; i += batchSize) {
      const events = await Promise.all(
        sourcedNonceSlotSig
          .slice(i, i + batchSize)
          .map(([source, nonce, slot, sig]) =>
            this.parseEventsFromAttestion(source, {
              nonce,
              txHash: sig,
            }).then((events) => {
              for (const event of events) {
                event.slot = slot;
              }
              return events;
            }),
          ),
      );
      allEvents.push(...events.flat());
    }
    return allEvents;
  }

  /**
   * Get outgoing bridge events (Solana -> EVM)
   *
   * Each transfer has a Message account on Solana. To get all events:
   * 1. Find all Message accounts for the vault
   * 2. Get the created transaction for each message account
   * 3. Call iris api to get the attestation status and parsed message using each tx hash
   */
  async getOutgoingBridgeEvents(options: {
    batchSize?: number;
    commitment?: Commitment;
    txHashes?: string[];
    minSlot?: number;
  }): Promise<CctpBridgeEvent[]> {
    const { batchSize = 1, commitment = "confirmed", minSlot = 0 } = options;

    const txHashes = new Set<string>(options.txHashes ?? []);
    const txSlots = new Map<string, number>();

    // If no txHashes are provided, find all message accounts for the vault
    if (txHashes.size === 0) {
      const messagePubkeys = await this.findV2Messages(this.base.vaultPda, {
        commitment,
      });

      if (messagePubkeys.length === 0) {
        return [];
      }

      // Get account creation transaction for each message account
      for (let i = 0; i < messagePubkeys.length; i += batchSize) {
        const batch = messagePubkeys.slice(i, i + batchSize);
        const signaturesPromises = batch.map((pubkey) =>
          this.base.connection.getSignaturesForAddress(pubkey),
        );
        const batchSignatures = await Promise.all(signaturesPromises);

        // Process batch results and collect transaction signatures
        for (let j = 0; j < batch.length; j++) {
          const sigs = batchSignatures[j].filter((s) => s.slot >= minSlot);
          if (sigs.length === 0) {
            continue;
          }
          const createdTx = sigs.sort((a, b) => a.slot - b.slot)[0];
          txHashes.add(createdTx.signature);
          txSlots.set(createdTx.signature, createdTx.slot);
        }
      }
    }

    const txHashesArray = Array.from(txHashes);
    const allEvents: CctpBridgeEvent[] = [];
    for (let i = 0; i < txHashesArray.length; i += batchSize) {
      const events = await Promise.all(
        txHashesArray.slice(i, i + batchSize).map((txHash) =>
          this.parseEventsFromAttestion(CCTP_DOMAIN_SOLANA, {
            txHash,
          }).then((events) => {
            for (const event of events) {
              event.slot = txSlots.get(event.txHash);
            }
            return events;
          }),
        ),
      );
      allEvents.push(...events.flat());
    }

    return allEvents;
  }
}
