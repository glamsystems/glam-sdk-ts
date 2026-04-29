import { BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import {
  AccountMeta,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import {
  LayerzeroOftRouteProfile,
  SerializableRouteAccountMeta,
  resolveCanonicalLayerzeroOftRouteProfile,
} from "./bridgeRegistry";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { fetchAddressLookupTableAccounts } from "../utils/lookupTables";
import {
  LayerzeroOftPolicy,
  LayerzeroOftRoute,
  RouteManagementMode,
} from "../deser/integrationPolicies";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import { SEED_BRIDGE_REGISTRY, SEED_BRIDGE_SESSION } from "../constants";

export const LAYERZERO_OFT_PROTOCOL = 1 << 2;

type BufferLike = Uint8Array | number[] | Buffer;

type RouteManagementModeArg =
  | RouteManagementMode
  | number
  | { unmanagedOnly: Record<string, never> }
  | { managedOnly: Record<string, never> }
  | { either: Record<string, never> };

export type LayerzeroOftRouteInput = Omit<
  LayerzeroOftRoute,
  "managementMode"
> & {
  managementMode: RouteManagementModeArg;
};

export type OftTransferParams = {
  transferId: PublicKey;
  sourceMint: PublicKey;
  sourceAmount: BN;
  providerInstructions: TransactionInstruction[];
  providerReceipt: PublicKey;
  managed?: boolean;
  providerSigners?: Keypair[];
};

export type LayerzeroOftSendParams = {
  transferId?: PublicKey;
  sourceMint: PublicKey;
  sourceAmount: BN;
  destinationChain: number;
  destinationRecipient: PublicKey;
  nativeFeeLamports: BN;
  minAmountLd?: BN;
  lzTokenFee?: BN;
  options?: BufferLike;
  composeMsg?: BufferLike | null;
  sourceTokenAccount?: PublicKey;
  nonceAccount?: PublicKey;
  managed?: boolean;
  providerProgram?: PublicKey;
};

type BridgeTransferStatusAccount =
  | { committed: Record<string, never> }
  | { validated: Record<string, never> }
  | { settled: Record<string, never> };

type BridgeTransferRecordAccount = {
  glamState: PublicKey;
  transferId: PublicKey;
  protocol: number;
  status: BridgeTransferStatusAccount;
  managed: true;
  receiptVerified: true;
  sourceMint: PublicKey;
  sourceDecimals: number;
  providerProgram: PublicKey;
  providerConfig: PublicKey;
  sourceAmount: BN;
  quotedOutAmount: BN;
  destinationChain: number;
  destinationRecipient: PublicKey;
  providerEmitter: PublicKey;
  providerSequence: BN;
  committedSlot: BN;
};

function appendU16Le(parts: Buffer[], value: number) {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value, 0);
  parts.push(out);
}

function appendU32Le(parts: Buffer[], value: number) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value, 0);
  parts.push(out);
}

function appendU64Le(parts: Buffer[], value: BN) {
  parts.push(value.toArrayLike(Buffer, "le", 8));
}

function appendBytes(parts: Buffer[], value: Buffer) {
  parts.push(Buffer.from(value));
}

function appendVec(parts: Buffer[], value: BufferLike) {
  const out = Buffer.from(value);
  appendU32Le(parts, out.length);
  parts.push(out);
}

function anchorInstructionDiscriminator(name: string): Buffer {
  const preimage = Buffer.from(`global:${name}`, "utf8");
  return createHash("sha256").update(preimage).digest().subarray(0, 8);
}

function optionBytesToBuffer(
  value: Uint8Array | number[] | Buffer | null | undefined,
): Buffer | null {
  if (value === undefined || value === null) {
    return null;
  }

  return Buffer.from(value);
}

function encodeLayerzeroOftV2SendData(args: {
  dstEid: number;
  to: PublicKey;
  amountLd: BN;
  minAmountLd: BN;
  options: BufferLike;
  composeMsg?: BufferLike | null;
  nativeFee: BN;
  lzTokenFee: BN;
}) {
  const parts = [anchorInstructionDiscriminator("send")];
  appendU32Le(parts, args.dstEid);
  appendBytes(parts, args.to.toBuffer());
  appendU64Le(parts, args.amountLd);
  appendU64Le(parts, args.minAmountLd);
  appendVec(parts, args.options);

  const composeMsg = optionBytesToBuffer(args.composeMsg);
  if (composeMsg === null) {
    parts.push(Buffer.from([0]));
  } else {
    parts.push(Buffer.from([1]));
    appendVec(parts, composeMsg);
  }

  appendU64Le(parts, args.nativeFee);
  appendU64Le(parts, args.lzTokenFee);
  return Buffer.concat(parts);
}

function resolveLayerzeroOftMinAmountLd(args: {
  sourceAmount: BN;
  minAmountLd?: BN;
  routeProfile: LayerzeroOftRouteProfile;
}) {
  if (args.minAmountLd) {
    return args.minAmountLd;
  }

  if (args.routeProfile.defaultMinAmountBps !== undefined) {
    return args.sourceAmount
      .muln(args.routeProfile.defaultMinAmountBps)
      .divn(10_000);
  }

  return args.sourceAmount;
}

async function sha256(bytes: Buffer): Promise<Buffer> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes));
}

async function hashMiddleInstructions(
  instructions: TransactionInstruction[],
): Promise<Buffer> {
  const parts: Buffer[] = [];
  appendU16Le(parts, instructions.length);

  for (const ix of instructions) {
    parts.push(ix.programId.toBuffer());
    appendU16Le(parts, ix.keys.length);
    for (const key of ix.keys) {
      parts.push(key.pubkey.toBuffer());
    }
    appendU32Le(parts, ix.data.length);
    parts.push(Buffer.from(ix.data));
  }

  return await sha256(Buffer.concat(parts));
}

function getBridgeRegistryPda(
  glamState: PublicKey,
  bridgeProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_BRIDGE_REGISTRY), glamState.toBuffer()],
    bridgeProgramId,
  )[0];
}

function getBridgeSessionPda(
  glamState: PublicKey,
  transferId: PublicKey,
  bridgeProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEED_BRIDGE_SESSION),
      glamState.toBuffer(),
      transferId.toBuffer(),
    ],
    bridgeProgramId,
  )[0];
}

function toCount(value: BN | number): number {
  return BN.isBN(value) ? value.toNumber() : value;
}

function toBridgeTransferStatus(status: number): BridgeTransferStatusAccount {
  switch (status) {
    case 0:
      return { committed: {} };
    case 1:
      return { validated: {} };
    case 2:
      return { settled: {} };
    default:
      throw new Error(`Unsupported bridge transfer status: ${status}`);
  }
}

export function getActiveRegistryTransfers(registry: {
  managedTransferCount: BN | number;
  transfers: any[];
}) {
  return registry.transfers.slice(0, toCount(registry.managedTransferCount));
}

function registryTransferToRecord(
  transfer: any,
  glamState: PublicKey,
): BridgeTransferRecordAccount {
  return {
    glamState,
    transferId: transfer.transferId,
    protocol: transfer.protocol,
    status: toBridgeTransferStatus(transfer.status),
    managed: true,
    receiptVerified: true,
    sourceMint: transfer.sourceMint,
    sourceDecimals: transfer.sourceDecimals,
    providerProgram: transfer.providerProgram,
    providerConfig: transfer.providerConfig,
    sourceAmount: transfer.sourceAmount,
    quotedOutAmount: transfer.quotedOutAmount,
    destinationChain: transfer.destinationChain,
    destinationRecipient: transfer.destinationRecipient,
    providerEmitter: transfer.providerEmitter,
    providerSequence: transfer.providerSequence,
    committedSlot: transfer.committedSlot,
  };
}

function toRouteManagementModeArg(managementMode: RouteManagementModeArg) {
  if (
    managementMode &&
    typeof managementMode === "object" &&
    ("unmanagedOnly" in managementMode ||
      "managedOnly" in managementMode ||
      "either" in managementMode)
  ) {
    return managementMode;
  }

  switch (managementMode) {
    case RouteManagementMode.UnmanagedOnly:
    case 0:
      return { unmanagedOnly: {} };
    case RouteManagementMode.ManagedOnly:
    case 1:
      return { managedOnly: {} };
    case RouteManagementMode.Either:
    case 2:
      return { either: {} };
    default:
      throw new Error(`Unsupported route management mode: ${managementMode}`);
  }
}

function normalizeRoute(route: LayerzeroOftRouteInput) {
  return {
    ...route,
    managementMode: toRouteManagementModeArg(route.managementMode),
  };
}

export function deriveLayerzeroNoncePda(
  endpointProgram: PublicKey,
  sender: PublicKey,
  destinationChain: number,
  destinationRecipient: PublicKey,
) {
  const dstEid = Buffer.alloc(4);
  dstEid.writeUInt32BE(destinationChain, 0);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("Nonce"),
      sender.toBuffer(),
      dstEid,
      destinationRecipient.toBuffer(),
    ],
    endpointProgram,
  )[0];
}

export async function deriveOftAuxiliaryAccountSeed(
  glamState: PublicKey,
  transferId: PublicKey,
) {
  const digest = await sha256(
    Buffer.concat([
      Buffer.from("oft-auxiliary-account"),
      glamState.toBuffer(),
      transferId.toBuffer(),
    ]),
  );
  return digest.subarray(0, 16).toString("hex");
}

export async function deriveOftAuxiliaryAccount(
  glamSigner: PublicKey,
  glamState: PublicKey,
  transferId: PublicKey,
  tokenProgram: PublicKey,
) {
  const seed = await deriveOftAuxiliaryAccountSeed(glamState, transferId);
  const address = await PublicKey.createWithSeed(
    glamSigner,
    seed,
    tokenProgram,
  );
  return { address, seed };
}

const DEFAULT_LZ_OFT_SEND_OPTIONS = Buffer.from([
  0x00, 0x03, 0x01, 0x00, 0x11, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x0d, 0x40,
]);

function resolveRouteAccountPubkey(
  meta: SerializableRouteAccountMeta,
  payer: PublicKey,
  nonce: PublicKey,
) {
  if (meta.pubkey) {
    return meta.pubkey;
  }

  if (meta.placeholder === "payer") {
    return payer;
  }

  if (meta.placeholder === "nonce") {
    return nonce;
  }

  throw new Error("Unsupported LayerZero OFT route account placeholder");
}

class TxBuilder extends BaseTxBuilder<BridgeClient> {
  async addLayerzeroOftRouteIx(
    route: LayerzeroOftRouteInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .addLayerzeroOftRoute(normalizeRoute(route))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async updateLayerzeroOftRouteIx(
    route: LayerzeroOftRouteInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .updateLayerzeroOftRoute(normalizeRoute(route))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async deleteLayerzeroOftRouteIx(
    route: LayerzeroOftRouteInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .deleteLayerzeroOftRoute(normalizeRoute(route))
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
      })
      .instruction();
  }

  async buildOftTransferTx(
    params: OftTransferParams,
    txOptions: TxOptions = {},
  ): Promise<{
    tx: VersionedTransaction;
    additionalSigners: Keypair[];
    sessionPda: PublicKey;
    auxiliaryTokenAccount: PublicKey;
    sourceTokenAccount: PublicKey;
  }> {
    if (params.providerInstructions.length !== 1) {
      throw new Error("OFT transfers require exactly one provider instruction");
    }

    const transferId = params.transferId;
    const registryPda = getBridgeRegistryPda(
      this.client.base.statePda,
      this.client.base.extBridgeProgram.programId,
    );
    const sessionPda = getBridgeSessionPda(
      this.client.base.statePda,
      transferId,
      this.client.base.extBridgeProgram.programId,
    );

    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.client.base.connection,
      params.sourceMint,
    );
    const sourceTokenAccount = this.client.base.getVaultAta(
      params.sourceMint,
      tokenProgram,
    );
    const { address: auxiliaryTokenAccount } = await deriveOftAuxiliaryAccount(
      txOptions.signer || this.client.base.signer,
      this.client.base.statePda,
      transferId,
      tokenProgram,
    );
    const middleInstructionHash = await hashMiddleInstructions(
      params.providerInstructions,
    );
    const prepareRemainingAccounts = [
      {
        pubkey: params.providerReceipt,
        isSigner: false,
        isWritable: false,
      } satisfies AccountMeta,
    ];
    const commitRemainingAccounts = [
      {
        pubkey: params.providerReceipt,
        isSigner: false,
        isWritable: false,
      } satisfies AccountMeta,
    ];

    const integrationAuthority = getIntegrationAuthorityPda(
      this.client.base.extBridgeProgram.programId,
    );

    const prepareMethod = this.client.base.extBridgeProgram.methods
      .prepareOftTransfer({
        transferId,
        middleInstructionHash: Array.from(middleInstructionHash),
        middleInstructionCount: params.providerInstructions.length,
        sourceAmount: params.sourceAmount,
        managed: params.managed ?? false,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: txOptions.signer || this.client.base.signer,
        integrationAuthority,
        bridgeRegistry: registryPda,
        bridgeSession: sessionPda,
        sourceTokenAccount,
        sourceMint: params.sourceMint,
        auxiliaryTokenAccount,
        cpiProgram: tokenProgram,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        systemProgram: SystemProgram.programId,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      });
    prepareMethod.remainingAccounts(prepareRemainingAccounts);
    const prepareIx = await prepareMethod.instruction();

    const commitMethod = this.client.base.extBridgeProgram.methods
      .commitOftTransfer({
        transferId,
      })
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamVault: this.client.base.vaultPda,
        glamSigner: txOptions.signer || this.client.base.signer,
        cpiProgram: tokenProgram,
        glamProtocolProgram: this.client.base.protocolProgram.programId,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        bridgeRegistry: registryPda,
        bridgeSession: sessionPda,
        sourceTokenAccount,
        sourceMint: params.sourceMint,
        auxiliaryTokenAccount,
        integrationAuthority,
        systemProgram: SystemProgram.programId,
      });
    commitMethod.remainingAccounts(commitRemainingAccounts);
    const commitIx = await commitMethod.instruction();

    const tx = await this.buildVersionedTx(
      [prepareIx, ...params.providerInstructions, commitIx],
      txOptions,
    );

    return {
      tx,
      additionalSigners: params.providerSigners || [],
      sessionPda,
      auxiliaryTokenAccount,
      sourceTokenAccount,
    };
  }
}

class LayerzeroOftBridgeProtocolClient {
  public constructor(readonly bridge: BridgeClient) {}

  async buildSendTx(params: LayerzeroOftSendParams, txOptions: TxOptions = {}) {
    return await this.bridge.buildLayerzeroOftSendTx(params, txOptions);
  }

  async send(
    params: LayerzeroOftSendParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { tx, additionalSigners } = await this.buildSendTx(params, txOptions);
    return await this.bridge.base.sendAndConfirm(tx, additionalSigners);
  }
}

export class BridgeClient {
  readonly txBuilder: TxBuilder;
  readonly oft: LayerzeroOftBridgeProtocolClient;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
    this.oft = new LayerzeroOftBridgeProtocolClient(this);
  }

  getRegistryPda(): PublicKey {
    return getBridgeRegistryPda(
      this.base.statePda,
      this.base.extBridgeProgram.programId,
    );
  }

  getSessionPda(transferId: PublicKey): PublicKey {
    return getBridgeSessionPda(
      this.base.statePda,
      transferId,
      this.base.extBridgeProgram.programId,
    );
  }

  getLayerzeroNoncePda(
    endpointProgram: PublicKey,
    sender: PublicKey,
    destinationChain: number,
    destinationRecipient: PublicKey,
  ): PublicKey {
    return deriveLayerzeroNoncePda(
      endpointProgram,
      sender,
      destinationChain,
      destinationRecipient,
    );
  }

  async deriveOftAuxiliaryTokenAccount(
    transferId: PublicKey,
    sourceMint: PublicKey,
    signer?: PublicKey,
  ) {
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      sourceMint,
    );
    return {
      ...(await deriveOftAuxiliaryAccount(
        signer || this.base.signer,
        this.base.statePda,
        transferId,
        tokenProgram,
      )),
      tokenProgram,
    };
  }

  private resolveLayerzeroOftRouteProfile(params: {
    sourceMint: PublicKey;
    destinationChain: number;
    providerProgram?: PublicKey;
  }) {
    const routeProfile = resolveCanonicalLayerzeroOftRouteProfile({
      sourceMint: params.sourceMint,
      destinationChain: params.destinationChain,
      providerProgram: params.providerProgram,
      cluster: this.base.cluster,
    });
    if (!routeProfile) {
      throw new Error(
        "No canonical LayerZero OFT route profile matched this send. Only the checked-in direct USDT0 route is supported by this builder.",
      );
    }

    return routeProfile;
  }

  private resolveLayerzeroOftNonceAccount(params: {
    routeProfile: LayerzeroOftRouteProfile;
    destinationChain: number;
    destinationRecipient: PublicKey;
    nonceAccount?: PublicKey;
  }) {
    if (params.nonceAccount) {
      return params.nonceAccount;
    }

    if (params.routeProfile.nonceAccount) {
      return params.routeProfile.nonceAccount;
    }

    return deriveLayerzeroNoncePda(
      params.routeProfile.providerConfig,
      params.routeProfile.providerSender,
      params.destinationChain,
      params.destinationRecipient,
    );
  }

  private materializeLayerzeroOftRemainingAccounts(
    routeProfile: LayerzeroOftRouteProfile,
    nonce: PublicKey,
  ) {
    return routeProfile.remainingAccounts.map((meta) => ({
      pubkey: resolveRouteAccountPubkey(meta, this.base.signer, nonce),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    }));
  }

  private buildLayerzeroOftInstructionBaseAccounts(args: {
    routeProfile: LayerzeroOftRouteProfile;
    tokenSource: PublicKey;
    tokenProgram: PublicKey;
    payerIsSigner: boolean;
  }) {
    return [
      {
        pubkey: this.base.signer,
        isSigner: args.payerIsSigner,
        isWritable: true,
      },
      {
        pubkey: args.routeProfile.peerConfig,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: args.routeProfile.providerSender,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: args.routeProfile.enforcedOptions,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: args.tokenSource, isSigner: false, isWritable: true },
      {
        pubkey: args.routeProfile.tokenEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: args.routeProfile.sourceMint,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: args.tokenProgram, isSigner: false, isWritable: false },
      {
        pubkey: args.routeProfile.eventAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: args.routeProfile.providerProgram,
        isSigner: false,
        isWritable: false,
      },
    ] satisfies AccountMeta[];
  }

  private async buildLayerzeroOftSendInstruction(params: {
    sourceMint: PublicKey;
    sourceAmount: BN;
    destinationChain: number;
    destinationRecipient: PublicKey;
    providerProgram?: PublicKey;
    tokenSource: PublicKey;
    minAmountLd?: BN;
    options?: BufferLike;
    composeMsg?: BufferLike | null;
    nativeFee: BN;
    lzTokenFee?: BN;
    nonceAccount?: PublicKey;
  }) {
    const routeProfile = this.resolveLayerzeroOftRouteProfile({
      sourceMint: params.sourceMint,
      destinationChain: params.destinationChain,
      providerProgram: params.providerProgram,
    });
    const { tokenProgram } = await fetchMintAndTokenProgram(
      this.base.connection,
      params.sourceMint,
    );
    const providerReceipt = this.resolveLayerzeroOftNonceAccount({
      routeProfile,
      destinationChain: params.destinationChain,
      destinationRecipient: params.destinationRecipient,
      nonceAccount: params.nonceAccount,
    });
    const options =
      optionBytesToBuffer(params.options) ||
      optionBytesToBuffer(routeProfile.defaultOptions) ||
      DEFAULT_LZ_OFT_SEND_OPTIONS;

    return {
      providerReceipt,
      routeProfile,
      instruction: new TransactionInstruction({
        programId: routeProfile.providerProgram,
        keys: [
          ...this.buildLayerzeroOftInstructionBaseAccounts({
            routeProfile,
            tokenSource: params.tokenSource,
            tokenProgram,
            payerIsSigner: true,
          }),
          ...this.materializeLayerzeroOftRemainingAccounts(
            routeProfile,
            providerReceipt,
          ),
        ],
        data: encodeLayerzeroOftV2SendData({
          dstEid: params.destinationChain,
          to: params.destinationRecipient,
          amountLd: params.sourceAmount,
          minAmountLd: resolveLayerzeroOftMinAmountLd({
            sourceAmount: params.sourceAmount,
            minAmountLd: params.minAmountLd,
            routeProfile,
          }),
          options,
          composeMsg: params.composeMsg,
          nativeFee: params.nativeFee,
          lzTokenFee: params.lzTokenFee || new BN(0),
        }),
      }),
    };
  }

  async fetchLayerzeroOftPolicy() {
    return await this.base.fetchProtocolPolicy(
      this.base.extBridgeProgram.programId,
      LAYERZERO_OFT_PROTOCOL,
      LayerzeroOftPolicy,
    );
  }

  async fetchRegistry() {
    return await this.base.extBridgeProgram.account.bridgeRegistry.fetchNullable(
      this.getRegistryPda(),
    );
  }

  async fetchSession(transferId: PublicKey) {
    return await this.base.extBridgeProgram.account.bridgeSession.fetchNullable(
      this.getSessionPda(transferId),
    );
  }

  async fetchTransferRecordNullable(transferId: PublicKey) {
    const registry = await this.fetchRegistry();
    if (!registry) {
      return null;
    }

    const transfer = getActiveRegistryTransfers(registry).find((candidate) =>
      candidate.transferId.equals(transferId),
    );
    return transfer
      ? registryTransferToRecord(transfer, this.base.statePda)
      : null;
  }

  async addLayerzeroOftRoute(
    route: LayerzeroOftRouteInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const glamSigner = txOptions.signer || this.base.signer;
    const ixs: TransactionInstruction[] = [];

    if (!(await this.fetchLayerzeroOftPolicy())) {
      ixs.push(
        await this.base.protocolProgram.methods
          .setProtocolPolicy(
            this.base.extBridgeProgram.programId,
            LAYERZERO_OFT_PROTOCOL,
            new LayerzeroOftPolicy([]).encode(),
          )
          .accounts({
            glamState: this.base.statePda,
            glamSigner,
          })
          .instruction(),
      );
    }

    ixs.push(await this.txBuilder.addLayerzeroOftRouteIx(route, glamSigner));
    const tx = await this.txBuilder.buildVersionedTx(ixs, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async updateLayerzeroOftRoute(
    route: LayerzeroOftRouteInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.updateLayerzeroOftRouteIx(
      route,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async deleteLayerzeroOftRoute(
    route: LayerzeroOftRouteInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.deleteLayerzeroOftRouteIx(
      route,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async buildOftTransferTx(
    params: OftTransferParams,
    txOptions: TxOptions = {},
  ) {
    return await this.txBuilder.buildOftTransferTx(params, txOptions);
  }

  async buildLayerzeroOftSendTx(
    params: LayerzeroOftSendParams,
    txOptions: TxOptions = {},
  ) {
    const resolvedTransferId =
      params.transferId || Keypair.generate().publicKey;

    const signer = txOptions.signer || this.base.signer;
    const auxiliaryTokenAccount = await this.deriveOftAuxiliaryTokenAccount(
      resolvedTransferId,
      params.sourceMint,
      signer,
    );
    const { providerReceipt, routeProfile, instruction } =
      await this.buildLayerzeroOftSendInstruction({
        sourceMint: params.sourceMint,
        sourceAmount: params.sourceAmount,
        destinationChain: params.destinationChain,
        destinationRecipient: params.destinationRecipient,
        providerProgram: params.providerProgram,
        tokenSource: auxiliaryTokenAccount.address,
        minAmountLd: params.minAmountLd,
        options: params.options,
        composeMsg: params.composeMsg,
        nativeFee: params.nativeFeeLamports,
        lzTokenFee: params.lzTokenFee,
        nonceAccount: params.nonceAccount,
      });
    const oftTxOptions = await this.extendLookupTables(
      txOptions,
      routeProfile.lookupTables || [],
    );
    const result = await this.buildOftTransferTx(
      {
        transferId: resolvedTransferId,
        sourceMint: params.sourceMint,
        sourceAmount: params.sourceAmount,
        providerInstructions: [instruction],
        providerReceipt,
        managed: params.managed,
      },
      oftTxOptions,
    );

    return {
      ...result,
      auxiliaryTokenAccount: auxiliaryTokenAccount.address,
      nonceAccount: providerReceipt,
      routeProfile,
      sendInstruction: instruction,
    };
  }

  async sendOft(
    params: OftTransferParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { tx, additionalSigners } = await this.buildOftTransferTx(
      params,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx, additionalSigners);
  }

  private async extendLookupTables(
    txOptions: TxOptions,
    lookupTables: PublicKey[],
  ): Promise<TxOptions> {
    if (lookupTables.length === 0) {
      return txOptions;
    }

    const existingTables = txOptions.lookupTables || [];
    if (existingTables.length === 0) {
      return { ...txOptions, lookupTables };
    }

    if (
      existingTables.every(
        (table) => table instanceof AddressLookupTableAccount,
      )
    ) {
      const fetchedTables = await fetchAddressLookupTableAccounts(
        this.base.connection,
        lookupTables,
      );
      return {
        ...txOptions,
        lookupTables: [...existingTables, ...fetchedTables],
      };
    }

    return {
      ...txOptions,
      lookupTables: [...existingTables, ...lookupTables],
    };
  }

  async settleManagedTransfer(
    transferId: PublicKey,
    txOptions: TxOptions = {},
  ) {
    const ix = await this.base.extBridgeProgram.methods
      .settleManagedTransfer({
        transferId,
      })
      .accountsPartial({
        glamState: this.base.statePda,
        glamVault: this.base.vaultPda,
        glamSigner: txOptions.signer || this.base.signer,
        glamProtocolProgram: this.base.protocolProgram.programId,
        bridgeRegistry: this.getRegistryPda(),
        integrationAuthority: getIntegrationAuthorityPda(
          this.base.extBridgeProgram.programId,
        ),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async validateManagedTransfer(
    transferId: PublicKey,
    txOptions: TxOptions = {},
  ) {
    const ix = await this.base.extBridgeProgram.methods
      .validateManagedTransfer({
        transferId,
      })
      .accounts({
        glamState: this.base.statePda,
        glamSigner: txOptions.signer || this.base.signer,
      })
      .instruction();
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
  }
}
