import { BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import {
  AccountInfo,
  AccountMeta,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

import { BaseClient, BaseTxBuilder, TxOptions } from "./base";
import { hashMiddleInstructions } from "./bridgeInstructionHash";
import {
  LayerzeroOftRouteProfile,
  SerializableRouteAccountMeta,
  resolveCanonicalLayerzeroOftRouteProfile,
} from "./bridgeRegistry";
import { CctpClient } from "./cctp";
import { fetchMintAndTokenProgram } from "../utils/accounts";
import { mergeLookupTables } from "../utils/lookupTables";
import {
  BridgeRoute,
  RouteChain,
  RouteLimits,
  RouteManagementMode,
  RouteSetCommitment,
  encodeBridgeRoute,
  encodeBridgeRouteIdentity,
  routeSetHash,
} from "../deser/integrationPolicies";
import { getIntegrationAuthorityPda } from "../utils/glamPDAs";
import {
  MESSAGE_TRANSMITTER_V2,
  SEED_BRIDGE_REGISTRY,
  SEED_BRIDGE_ROUTES,
  SEED_BRIDGE_SESSION,
  TOKEN_MESSENGER_MINTER_V2,
  USDC,
  USDC_DEVNET,
} from "../constants";
import { CCTP_PROTOCOL, LAYERZERO_OFT_PROTOCOL } from "../protocols";

type BufferLike = Uint8Array | number[] | Buffer;

type RouteManagementModeArg =
  | RouteManagementMode
  | number
  | { unmanagedOnly: Record<string, never> }
  | { managedOnly: Record<string, never> }
  | { either: Record<string, never> };

/** A destination chain as callers describe it: the id may be a number, the limits left out. */
export type RouteChainInput = {
  chain: BN | number;
  /** Limits of its own, which replace the route's for this chain. */
  limits?: RouteLimits | null;
};

/**
 * A route as callers describe it: the mode in any of its spellings, and each chain either as an
 * id (a number or a BN), which takes the route's limits, or as a `RouteChainInput`.
 */
export type BridgeRouteInput = Omit<
  BridgeRoute,
  "managementMode" | "destinationChains"
> & {
  managementMode: RouteManagementModeArg;
  destinationChains: (BN | number | RouteChainInput)[];
};

/** The fields that identify a route within a set; a change to any other field is an update. */
export type BridgeRouteIdentity = Pick<
  BridgeRoute,
  "sourceMint" | "destinationRecipient" | "providerProgram"
>;

/**
 * The heap frame a route instruction's transaction requests: ext_bridge's setter and edits
 * decode the stored sets beside the vault state, which a set at the caps does not fit into the
 * default 32 KiB. The pause, unpause and close instructions decode the whole account too, so
 * their transactions carry the frame as well. Sends decode only the set they use and run on the
 * default heap.
 */
export const BRIDGE_ROUTES_HEAP_FRAME_BYTES = 256 * 1024;

/**
 * The heap frame every owner-side route instruction's transaction starts with. The compute
 * unit limit is the base client's: it simulates the transaction and sets the limit from the
 * units it used, with its margin (a tightening beside two sets at the caps measured 208k units
 * on anchor_v1 and 238k on anchor). A limit instruction built here would be a second one in a
 * version 0 transaction, which the runtime refuses as a duplicate.
 */
function heapFrameIx(): TransactionInstruction {
  return ComputeBudgetProgram.requestHeapFrame({
    bytes: BRIDGE_ROUTES_HEAP_FRAME_BYTES,
  });
}

/** What a provider's routes account holds beside the state's commitment to one of its sets. */
export type RouteSets = {
  /**
   * The routes a send may use: the tightened set while it tightens the committed set, else
   * the committed set. Null when the state commits to no stored set.
   */
  live: BridgeRoute[] | null;
  /**
   * The set the state commits to, which the vault's timelock governs. An edit whose result
   * tightens the live routes applies at once; any other edit is staged.
   */
  committed: BridgeRoute[] | null;
  /**
   * The set a timelocked change has staged, if the account holds it, or the tightened set when it
   * was cut from that set.
   */
  pending: BridgeRoute[] | null;
  liveHash: Buffer | null;
  /** The staged set's hash, also when `pending` is the tightened set cut from it. */
  pendingHash: Buffer | null;
  /**
   * The staged list holds no commitment for the provider while the live one does, so applying
   * it stops every send.
   */
  pendingCleared: boolean;
  /**
   * The account's write count, null without an account. Every set written takes the next count
   * into its hash, so the same routes written twice are two commitments.
   */
  generation: BN | null;
  /** The count the committed set was written at, which its hash covers. */
  committedGeneration: BN | null;
  /** The staged set's count, which its hash covers, also when `pending` is the tightened set. */
  pendingGeneration: BN | null;
  /** True while the provider's sends are paused. */
  paused: boolean;
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

export type CctpBridgeSendParams = {
  transferId?: PublicKey;
  amount: BN;
  domain: number;
  destinationAddress: PublicKey;
  maxFee: BN;
  minFinalityThreshold: number;
  destinationCaller?: PublicKey;
  managed?: boolean;
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
  destinationChain: BN;
  destinationRecipient: PublicKey;
  providerEmitter: PublicKey;
  providerSequence: BN;
  committedSlot: BN;
};

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

/**
 * The least amount an OFT send quotes the recipient: `minAmountLd` when given; else, under a
 * route's cost bound, the amount less floor(amount * maxCostBps / 10_000), the lowest quote the
 * program's check `(amount - quote) * 10_000 <= amount * maxCostBps` admits; else the profile's
 * default share of the amount; else the amount.
 */
export function resolveLayerzeroOftMinAmountLd(args: {
  sourceAmount: BN;
  minAmountLd?: BN;
  routeProfile: LayerzeroOftRouteProfile;
  /** The cost bound the live route sets on the send's chain. */
  maxCostBps?: number;
}): BN {
  if (args.minAmountLd) {
    return args.minAmountLd;
  }

  if (args.maxCostBps !== undefined) {
    return args.sourceAmount.sub(
      args.sourceAmount.muln(args.maxCostBps).divn(10_000),
    );
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

function getBridgeRegistryPda(
  glamState: PublicKey,
  bridgeProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_BRIDGE_REGISTRY), glamState.toBuffer()],
    bridgeProgramId,
  )[0];
}

function getBridgeRoutesPda(
  glamState: PublicKey,
  protocol: number,
  bridgeProgramId: PublicKey,
): PublicKey {
  const protocolLe = Buffer.alloc(2);
  protocolLe.writeUInt16LE(protocol, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_BRIDGE_ROUTES), glamState.toBuffer(), protocolLe],
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

function toRouteManagementMode(
  managementMode: RouteManagementModeArg,
): RouteManagementMode {
  if (managementMode && typeof managementMode === "object") {
    if ("unmanagedOnly" in managementMode)
      return RouteManagementMode.UnmanagedOnly;
    if ("managedOnly" in managementMode) return RouteManagementMode.ManagedOnly;
    if ("either" in managementMode) return RouteManagementMode.Either;
  }
  switch (managementMode) {
    case RouteManagementMode.UnmanagedOnly:
    case RouteManagementMode.ManagedOnly:
    case RouteManagementMode.Either:
      return managementMode;
    default:
      throw new Error(`Unsupported route management mode: ${managementMode}`);
  }
}

function toRouteChain(entry: BN | number | RouteChainInput): RouteChain {
  if (BN.isBN(entry) || typeof entry === "number") {
    return { chain: new BN(entry) };
  }
  return entry.limits
    ? { chain: new BN(entry.chain), limits: entry.limits }
    : { chain: new BN(entry.chain) };
}

export function normalizeBridgeRoute(route: BridgeRouteInput): BridgeRoute {
  return {
    ...route,
    managementMode: toRouteManagementMode(route.managementMode),
    destinationChains: route.destinationChains.map(toRouteChain),
  };
}

/** A route as the Anchor coder decodes it, back into the SDK's type. */
function fromRouteAccount(route: any): BridgeRoute {
  return {
    sourceMint: route.sourceMint,
    destinationRecipient: route.destinationRecipient,
    providerProgram: route.providerProgram,
    managementMode: toRouteManagementMode(route.managementMode),
    limits: route.limits,
    controls: route.controls,
    destinationChains: route.destinationChains,
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
  /**
   * One of the owner's route instructions over the shared account list. The argument is encoded
   * by hand with the layout the program hashes: Anchor's instruction coder encodes into a
   * 1000-byte buffer, and a set at the caps is larger.
   */
  private routeIx(
    name: string,
    protocol: number,
    argument: Buffer,
    signer?: PublicKey,
  ): TransactionInstruction {
    const program = this.client.base.extBridgeProgram;
    const discriminator = program.idl.instructions.find(
      (ix) => ix.name === name,
    )?.discriminator;
    if (!discriminator) {
      throw new Error(`The ext_bridge IDL has no ${name} instruction`);
    }
    const protocolLe = Buffer.alloc(2);
    protocolLe.writeUInt16LE(protocol, 0);
    return new TransactionInstruction({
      programId: program.programId,
      keys: [
        {
          pubkey: this.client.base.statePda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: signer || this.client.base.signer,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: this.client.getRoutesPda(protocol),
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: this.client.base.protocolProgram.programId,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from(discriminator), protocolLe, argument]),
    });
  }

  /** Creates the provider's routes account, empty; the route instructions grow it. */
  async initRoutesIx(
    protocol: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .initBridgeRoutes(protocol)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        bridgeRoutes: this.client.getRoutesPda(protocol),
      })
      .instruction();
  }

  async addRouteIx(
    protocol: number,
    route: BridgeRouteInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.routeIx(
      "addBridgeRoute",
      protocol,
      encodeBridgeRoute(normalizeBridgeRoute(route)),
      signer,
    );
  }

  async updateRouteIx(
    protocol: number,
    route: BridgeRouteInput,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.routeIx(
      "updateBridgeRoute",
      protocol,
      encodeBridgeRoute(normalizeBridgeRoute(route)),
      signer,
    );
  }

  async removeRouteIx(
    protocol: number,
    identity: BridgeRouteIdentity,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.routeIx(
      "removeBridgeRoute",
      protocol,
      encodeBridgeRouteIdentity(identity),
      signer,
    );
  }

  /**
   * A route instruction's transaction: the heap frame, `init_bridge_routes` when the
   * provider's account does not exist yet, then the instruction.
   */
  async routeIxs(
    protocol: number,
    ix: TransactionInstruction,
    signer?: PublicKey,
  ): Promise<TransactionInstruction[]> {
    const ixs = [heapFrameIx()];
    if (!(await this.client.routesAccountInitialized(protocol))) {
      ixs.push(await this.initRoutesIx(protocol, signer));
    }
    ixs.push(ix);
    return ixs;
  }

  async addRouteTx(
    protocol: number,
    route: BridgeRouteInput,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.addRouteIx(protocol, route, txOptions.signer);
    return await this.buildVersionedTx(
      await this.routeIxs(protocol, ix, txOptions.signer),
      txOptions,
    );
  }

  async updateRouteTx(
    protocol: number,
    route: BridgeRouteInput,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.updateRouteIx(protocol, route, txOptions.signer);
    return await this.buildVersionedTx(
      await this.routeIxs(protocol, ix, txOptions.signer),
      txOptions,
    );
  }

  async removeRouteTx(
    protocol: number,
    identity: BridgeRouteIdentity,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.removeRouteIx(protocol, identity, txOptions.signer);
    return await this.buildVersionedTx(
      await this.routeIxs(protocol, ix, txOptions.signer),
      txOptions,
    );
  }

  /** Stops the provider's sends at once: the owner, or a delegate holding the Pause permission. */
  async pauseRoutesIx(
    protocol: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .pauseBridgeRoutes(protocol)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        bridgeRoutes: this.client.getRoutesPda(protocol),
      })
      .instruction();
  }

  /** Resumes the provider's sends at once: the owner only. */
  async unpauseRoutesIx(
    protocol: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .unpauseBridgeRoutes(protocol)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        bridgeRoutes: this.client.getRoutesPda(protocol),
      })
      .instruction();
  }

  async closeRoutesIx(
    protocol: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.client.base.extBridgeProgram.methods
      .closeBridgeRoutes(protocol)
      .accountsPartial({
        glamState: this.client.base.statePda,
        glamSigner: signer || this.client.base.signer,
        bridgeRoutes: this.client.getRoutesPda(protocol),
      })
      .instruction();
  }

  async closeRoutesTx(
    protocol: number,
    txOptions: TxOptions = {},
  ): Promise<VersionedTransaction> {
    const ix = await this.closeRoutesIx(protocol, txOptions.signer);
    return await this.buildVersionedTx([heapFrameIx(), ix], txOptions);
  }

  /** Deletes the provider's commitment; its routes account can then be closed. */
  async clearRoutesPolicyIx(
    protocol: number,
    signer?: PublicKey,
  ): Promise<TransactionInstruction> {
    return await this.clearProtocolPolicyIx(
      this.client.base.extBridgeProgram.programId,
      protocol,
      signer,
    );
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
        bridgeRoutes: this.client.getRoutesPda(LAYERZERO_OFT_PROTOCOL),
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

/** The route surface one provider bit shares: the live and pending sets, and edits over them. */
class BridgeProtocolRoutes {
  public constructor(
    readonly bridge: BridgeClient,
    readonly protocol: number,
  ) {}

  getRoutesPda(): PublicKey {
    return this.bridge.getRoutesPda(this.protocol);
  }

  /** The state's commitment for this provider, or null when none is set. */
  async fetchPolicy(): Promise<RouteSetCommitment | null> {
    return await this.bridge.fetchRoutesCommitment(this.protocol);
  }

  async fetchRouteSets(): Promise<RouteSets> {
    return await this.bridge.fetchRouteSets(this.protocol);
  }

  /** The routes a send uses today, or null when the state commits to no stored set. */
  async fetchRoutes(): Promise<BridgeRoute[] | null> {
    return (await this.fetchRouteSets()).live;
  }

  async closeRoutes(txOptions: TxOptions = {}) {
    return await this.bridge.closeRoutes(this.protocol, txOptions);
  }

  async clearPolicy(txOptions: TxOptions = {}) {
    return await this.bridge.clearRoutesPolicy(this.protocol, txOptions);
  }

  /**
   * Adds a route. Under a timelock it is staged, a removed route put back included: the live
   * routes admit nothing of its identity, so adding one always adds risk.
   */
  async addRoute(route: BridgeRouteInput, txOptions: TxOptions = {}) {
    return await this.bridge.addRoute(this.protocol, route, txOptions);
  }

  /**
   * Replaces the route with the same mint, recipient and provider. Under a timelock a change
   * that tightens the live route applies to the live routes at once and replaces the route in a
   * staged set when that set holds it. A change tightens when it adds no chain, widens no mode,
   * keeps the caller or store, lowers no finality floor, and leaves on every chain a maximum and
   * a cost bound no higher in the limits that apply there (the chain's own, else the route's);
   * the minimum moves either way. Any other change is staged and waits the window, a raise back
   * toward the committed terms included, as an edit of the staged set where one exists (if that
   * set does not hold the route, the program refuses and `addRoute` is the instruction that
   * puts it there). Touching a staged set restarts the vault's whole timelock window.
   */
  async updateRoute(route: BridgeRouteInput, txOptions: TxOptions = {}) {
    return await this.bridge.updateRoute(this.protocol, route, txOptions);
  }

  /** Removes the route at once, and from a staged set if one holds it. */
  async removeRoute(identity: BridgeRouteIdentity, txOptions: TxOptions = {}) {
    return await this.bridge.removeRoute(this.protocol, identity, txOptions);
  }

  /** Stops this provider's sends at once: the owner, or a delegate holding the Pause permission. */
  async pause(txOptions: TxOptions = {}) {
    return await this.bridge.pauseRoutes(this.protocol, txOptions);
  }

  /** Resumes this provider's sends at once: the owner only. */
  async unpause(txOptions: TxOptions = {}) {
    return await this.bridge.unpauseRoutes(this.protocol, txOptions);
  }
}

class LayerzeroOftBridgeProtocolClient extends BridgeProtocolRoutes {
  public constructor(bridge: BridgeClient) {
    super(bridge, LAYERZERO_OFT_PROTOCOL);
  }

  async buildSendTx(params: LayerzeroOftSendParams, txOptions: TxOptions = {}) {
    return await this.bridge.buildLayerzeroOftSendTx(params, txOptions);
  }

  /**
   * Without `minAmountLd` the quote concedes exactly the cost bound the live route of the send's
   * mint, recipient and program sets on its chain: the amount less
   * floor(amount * maxCostBps / 10_000), the lowest quote the program admits. With no such live
   * route on that chain it is the route profile's default, 99.5 % of the amount for USDT0.
   */
  async send(
    params: LayerzeroOftSendParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { tx, additionalSigners } = await this.buildSendTx(params, txOptions);
    return await this.bridge.base.sendAndConfirm(tx, additionalSigners);
  }
}

class CctpBridgeProtocolClient extends BridgeProtocolRoutes {
  public constructor(bridge: BridgeClient) {
    super(bridge, CCTP_PROTOCOL);
  }

  private cctpClient() {
    return new CctpClient(this.bridge.base);
  }

  async buildSendTx(params: CctpBridgeSendParams, txOptions: TxOptions = {}) {
    return await this.bridge.buildCctpBridgeUsdcTx(params, txOptions);
  }

  async send(
    params: CctpBridgeSendParams,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const { tx, additionalSigners } = await this.buildSendTx(params, txOptions);
    return await this.bridge.base.sendAndConfirm(tx, additionalSigners);
  }

  async receiveUsdc(
    ...args: Parameters<CctpClient["receiveUsdc"]>
  ): ReturnType<CctpClient["receiveUsdc"]> {
    return this.cctpClient().receiveUsdc(...args);
  }

  async getIncomingBridgeEvents(
    ...args: Parameters<CctpClient["getIncomingBridgeEvents"]>
  ): ReturnType<CctpClient["getIncomingBridgeEvents"]> {
    return this.cctpClient().getIncomingBridgeEvents(...args);
  }

  async getOutgoingBridgeEvents(
    ...args: Parameters<CctpClient["getOutgoingBridgeEvents"]>
  ): ReturnType<CctpClient["getOutgoingBridgeEvents"]> {
    return this.cctpClient().getOutgoingBridgeEvents(...args);
  }

  async findV2Messages(
    ...args: Parameters<CctpClient["findV2Messages"]>
  ): ReturnType<CctpClient["findV2Messages"]> {
    return this.cctpClient().findV2Messages(...args);
  }

  async fetchV2Messages(
    ...args: Parameters<CctpClient["fetchV2Messages"]>
  ): ReturnType<CctpClient["fetchV2Messages"]> {
    return this.cctpClient().fetchV2Messages(...args);
  }

  async parseEventsFromAttestion(
    ...args: Parameters<CctpClient["parseEventsFromAttestion"]>
  ): ReturnType<CctpClient["parseEventsFromAttestion"]> {
    return this.cctpClient().parseEventsFromAttestion(...args);
  }
}

export class BridgeClient {
  readonly txBuilder: TxBuilder;
  readonly cctp: CctpBridgeProtocolClient;
  readonly oft: LayerzeroOftBridgeProtocolClient;

  public constructor(readonly base: BaseClient) {
    this.txBuilder = new TxBuilder(this);
    this.cctp = new CctpBridgeProtocolClient(this);
    this.oft = new LayerzeroOftBridgeProtocolClient(this);
  }

  getRegistryPda(): PublicKey {
    return getBridgeRegistryPda(
      this.base.statePda,
      this.base.extBridgeProgram.programId,
    );
  }

  getRoutesPda(protocol: number): PublicKey {
    return getBridgeRoutesPda(
      this.base.statePda,
      protocol,
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
        pubkey: args.routeProfile.credits,
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

  /**
   * The cost bound the live OFT routes set for a send on `destinationChain`: the chain's own
   * limits, else its route's. Undefined when no live route has the send's mint, recipient and
   * program, or that route does not list the chain: a send the program refuses.
   */
  private async liveLayerzeroOftMaxCostBps(params: {
    sourceMint: PublicKey;
    destinationRecipient: PublicKey;
    providerProgram: PublicKey;
    destinationChain: number;
  }): Promise<number | undefined> {
    const { live } = await this.fetchRouteSets(LAYERZERO_OFT_PROTOCOL);
    const route = live?.find(
      (candidate) =>
        candidate.sourceMint.equals(params.sourceMint) &&
        candidate.destinationRecipient.equals(params.destinationRecipient) &&
        candidate.providerProgram.equals(params.providerProgram),
    );
    const chain = new BN(params.destinationChain);
    const entry = route?.destinationChains.find((candidate) =>
      candidate.chain.eq(chain),
    );
    if (!route || !entry) {
      return undefined;
    }
    return (entry.limits ?? route.limits).maxCostBps;
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
    const [{ tokenProgram }, maxCostBps] = await Promise.all([
      fetchMintAndTokenProgram(this.base.connection, params.sourceMint),
      params.minAmountLd
        ? undefined
        : this.liveLayerzeroOftMaxCostBps({
            sourceMint: params.sourceMint,
            destinationRecipient: params.destinationRecipient,
            providerProgram: routeProfile.providerProgram,
            destinationChain: params.destinationChain,
          }),
    ]);
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
            maxCostBps,
          }),
          options,
          composeMsg: params.composeMsg,
          nativeFee: params.nativeFee,
          lzTokenFee: params.lzTokenFee || new BN(0),
        }),
      }),
    };
  }

  /** The state's live commitment for a provider bit, or null when it holds none. */
  async fetchRoutesCommitment(
    protocol: number,
  ): Promise<RouteSetCommitment | null> {
    // A policy of another length is one the program reads as no commitment: a blob an earlier
    // release stored, or a raw write.
    try {
      return await this.base.fetchProtocolPolicy(
        this.base.extBridgeProgram.programId,
        protocol,
        RouteSetCommitment,
      );
    } catch (error) {
      if (error instanceof Error && /32 bytes/.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * The commitment a timelocked change has staged for a provider bit, if any. glam_protocol
   * stages a copy of the whole integration list whenever any policy is staged, so a staged hash
   * equal to the live one is that copy, not a proposal for this provider.
   */
  async fetchStagedRoutesCommitment(
    protocol: number,
  ): Promise<RouteSetCommitment | null> {
    const [state, live] = await Promise.all([
      this.base.fetchStateAccount(),
      this.fetchRoutesCommitment(protocol),
    ]);
    const staged = state.params?.[2]?.find(
      (field: any) => field.value?.vecIntegrationAcl !== undefined,
    );
    const acls: any[] | undefined = staged?.value?.vecIntegrationAcl?.val;
    const acl = acls?.find((candidate: any) =>
      candidate.integrationProgram.equals(this.base.extBridgeProgram.programId),
    );
    const policy = acl?.protocolPolicies?.find(
      (candidate: any) => Number(candidate.protocolBitflag) === protocol,
    );
    if (!policy || policy.data.length !== 32) {
      return null;
    }
    const commitment = RouteSetCommitment.decode(Buffer.from(policy.data));
    return live !== null && commitment.hash.equals(live.hash)
      ? null
      : commitment;
  }

  /**
   * Whether the integration list a timelocked change has staged holds no commitment for a
   * provider bit: no ext_bridge entry, or no 32-byte policy for the bit in it. A cleared policy
   * stages this way, as glam_protocol removes the bit's entry from its copy of the list.
   */
  async fetchStagedRoutesClear(protocol: number): Promise<boolean> {
    const state = await this.base.fetchStateAccount();
    const staged = state.params?.[2]?.find(
      (field: any) => field.value?.vecIntegrationAcl !== undefined,
    );
    if (!staged) {
      return false;
    }
    const acls: any[] = staged.value.vecIntegrationAcl?.val ?? [];
    const acl = acls.find((candidate: any) =>
      candidate.integrationProgram.equals(this.base.extBridgeProgram.programId),
    );
    const policy = acl?.protocolPolicies?.find(
      (candidate: any) => Number(candidate.protocolBitflag) === protocol,
    );
    return !policy || policy.data.length !== 32;
  }

  /**
   * The provider's routes account as the program wrote it, or null when nothing the program
   * initialized is at its address: no account, or one somebody funded there. Anyone can send
   * lamports to the derived address, which leaves a system-owned account with no data;
   * `init_bridge_routes` initializes that account as it does an empty address, so a reader treats
   * it as absent and a route edit still starts with the creation.
   */
  async fetchRoutesAccount(protocol: number) {
    const info = await this.base.connection.getAccountInfo(
      this.getRoutesPda(protocol),
    );
    if (!this.isInitializedRoutesAccount(info)) {
      return null;
    }
    return this.base.extBridgeProgram.coder.accounts.decode(
      "bridgeRoutes",
      info.data,
    );
  }

  /** Whether the program initialized the provider's routes account. */
  async routesAccountInitialized(protocol: number): Promise<boolean> {
    return this.isInitializedRoutesAccount(
      await this.base.connection.getAccountInfo(this.getRoutesPda(protocol)),
    );
  }

  /** Owned by ext_bridge and starting with the `BridgeRoutes` discriminator. */
  private isInitializedRoutesAccount(
    info: AccountInfo<Buffer> | null,
  ): info is AccountInfo<Buffer> {
    if (!info || !info.owner.equals(this.base.extBridgeProgram.programId)) {
      return false;
    }
    const discriminator = this.base.extBridgeProgram.idl.accounts?.find(
      (account) => account.name === "bridgeRoutes",
    )?.discriminator;
    if (!discriminator) {
      throw new Error("ext_bridge's IDL declares no BridgeRoutes account");
    }
    const prefix = Buffer.from(discriminator);
    return (
      info.data.length >= prefix.length &&
      info.data.subarray(0, prefix.length).equals(prefix)
    );
  }

  /**
   * The provider's stored sets, resolved against the state: the committed set is the one the
   * live commitment names, the pending set the one a staged commitment names, each rehashed
   * with the generation it was written at and checked against its hash as the program does
   * before trusting it. The live routes are the tightened set while it tightens the committed
   * set, else the committed set. The pending routes are the tightened set when it was cut from
   * the staged set, which is what the program edits a proposal from.
   */
  async fetchRouteSets(protocol: number): Promise<RouteSets> {
    const [account, live, staged, cleared] = await Promise.all([
      this.fetchRoutesAccount(protocol),
      this.fetchRoutesCommitment(protocol),
      this.fetchStagedRoutesCommitment(protocol),
      this.fetchStagedRoutesClear(protocol),
    ]);
    const resolve = (commitment: RouteSetCommitment | null) => {
      if (!account || !commitment) {
        return null;
      }
      const set = account.sets.find((candidate: any) =>
        Buffer.from(candidate.hash).equals(commitment.hash),
      );
      if (!set) {
        return null;
      }
      const routes = set.routes.map(fromRouteAccount);
      const hash = routeSetHash(
        this.base.statePda,
        protocol,
        set.generation,
        routes,
      );
      return hash.equals(commitment.hash)
        ? { generation: set.generation, routes }
        : null;
    };
    const committed = resolve(live);
    const pending = resolve(staged);
    const tightened: any = account?.tightened;
    const cutFrom = (commitment: RouteSetCommitment | null) =>
      commitment !== null &&
      tightened &&
      Buffer.from(tightened.of).equals(commitment.hash);
    const tightens = committed !== null && cutFrom(live);
    return {
      live: tightens
        ? tightened.routes.map(fromRouteAccount)
        : (committed?.routes ?? null),
      committed: committed?.routes ?? null,
      pending:
        pending !== null && cutFrom(staged)
          ? tightened.routes.map(fromRouteAccount)
          : (pending?.routes ?? null),
      liveHash: live?.hash ?? null,
      pendingHash: staged?.hash ?? null,
      pendingCleared: live !== null && cleared,
      generation: account?.generation ?? null,
      committedGeneration: committed?.generation ?? null,
      pendingGeneration: pending?.generation ?? null,
      paused: Boolean(account?.paused),
    };
  }

  async addRoute(
    protocol: number,
    route: BridgeRouteInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.addRouteTx(protocol, route, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async updateRoute(
    protocol: number,
    route: BridgeRouteInput,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.updateRouteTx(protocol, route, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async removeRoute(
    protocol: number,
    identity: BridgeRouteIdentity,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.removeRouteTx(
      protocol,
      identity,
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async pauseRoutes(
    protocol: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.pauseRoutesIx(protocol, txOptions.signer);
    const tx = await this.txBuilder.buildVersionedTx(
      [heapFrameIx(), ix],
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  async unpauseRoutes(
    protocol: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.unpauseRoutesIx(protocol, txOptions.signer);
    const tx = await this.txBuilder.buildVersionedTx(
      [heapFrameIx(), ix],
      txOptions,
    );
    return await this.base.sendAndConfirm(tx);
  }

  /**
   * Closes a provider's routes account once no policy references it. To tear a vault down
   * without stranding rent: clear the policy (under a timelock the clear is itself staged:
   * wait out the window and apply it) or emergency-remove the integration, make sure no staged
   * change still names the set, close each routes account, then close the state.
   */
  async closeRoutes(
    protocol: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const tx = await this.txBuilder.closeRoutesTx(protocol, txOptions);
    return await this.base.sendAndConfirm(tx);
  }

  async clearRoutesPolicy(
    protocol: number,
    txOptions: TxOptions = {},
  ): Promise<TransactionSignature> {
    const ix = await this.txBuilder.clearRoutesPolicyIx(
      protocol,
      txOptions.signer,
    );
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);
    return await this.base.sendAndConfirm(tx);
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

  async buildCctpBridgeUsdcTx(
    params: CctpBridgeSendParams,
    txOptions: TxOptions = {},
  ) {
    const cctpClient = new CctpClient(this.base);
    const usdcAddress = this.base.isMainnet ? USDC : USDC_DEVNET;
    const pdas = cctpClient.getDepositForBurnPdas(
      MESSAGE_TRANSMITTER_V2,
      TOKEN_MESSENGER_MINTER_V2,
      usdcAddress,
      params.domain,
    );
    const denylistAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("denylist_account"), this.base.vaultPda.toBuffer()],
      TOKEN_MESSENGER_MINTER_V2,
    )[0];
    const messageSentEventAccountKeypair = Keypair.generate();
    const depositForBurnParams = {
      amount: params.amount,
      destinationDomain: params.domain,
      mintRecipient: params.destinationAddress,
      destinationCaller: params.destinationCaller || PublicKey.default,
      maxFee: params.maxFee,
      minFinalityThreshold: params.minFinalityThreshold,
    };
    const bridgeRegistry = this.getRegistryPda();
    const transferId = params.transferId || Keypair.generate().publicKey;
    const method = params.managed
      ? this.base.extBridgeProgram.methods.managedCctpDepositForBurn({
          transferId,
          params: depositForBurnParams,
        })
      : this.base.extBridgeProgram.methods.cctpDepositForBurn({
          params: depositForBurnParams,
        });

    // accountsPartial: the routes account and the protocol program are resolvable from the IDL
    // (seeds, a fixed address) and so absent from the type `accounts` takes.
    const ix = await method
      .accountsPartial({
        glamState: this.base.statePda,
        glamSigner: txOptions.signer || this.base.signer,
        ...(params.managed ? { bridgeRegistry } : {}),
        senderAuthorityPda: pdas.authorityPda,
        burnTokenAccount: this.base.getVaultAta(usdcAddress),
        denylistAccount,
        messageTransmitter: pdas.messageTransmitterAccount,
        tokenMessenger: pdas.tokenMessengerAccount,
        remoteTokenMessenger: pdas.remoteTokenMessengerKey,
        tokenMinter: pdas.tokenMinterAccount,
        localToken: pdas.localToken,
        burnTokenMint: usdcAddress,
        messageSentEventData: messageSentEventAccountKeypair.publicKey,
        eventAuthority: pdas.tokenMessengerEventAuthority,
        bridgeRoutes: this.getRoutesPda(CCTP_PROTOCOL),
        // Named, not resolved from the IDL's constant: the staging IDL carries the mainnet id.
        glamProtocolProgram: this.base.protocolProgram.programId,
      })
      .instruction();
    const tx = await this.txBuilder.buildVersionedTx([ix], txOptions);

    return {
      tx,
      additionalSigners: [messageSentEventAccountKeypair],
      transferId,
    };
  }

  private async extendLookupTables(
    txOptions: TxOptions,
    lookupTables: PublicKey[],
  ): Promise<TxOptions> {
    if (lookupTables.length === 0) {
      return txOptions;
    }

    return {
      ...txOptions,
      lookupTables: mergeLookupTables(
        lookupTables,
        txOptions.lookupTables ?? [],
      ),
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
