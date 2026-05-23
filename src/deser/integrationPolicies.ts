import { BN } from "@coral-xyz/anchor";
import {
  struct,
  i16,
  u8,
  u32,
  u64,
  vec,
  publicKey,
  option,
} from "@coral-xyz/borsh";
import { PublicKey } from "@solana/web3.js";

export class MintPolicy {
  lockupPeriod: number;
  maxCap: BN;
  minSubscription: BN;
  minRedemption: BN;
  reserved: BN;
  allowlist: PublicKey[] | null;
  blocklist: PublicKey[] | null;

  static _layout = struct([
    u32("lockupPeriod"),
    u64("maxCap"),
    u64("minSubscription"),
    u64("minRedemption"),
    u64("reserved"),
    option(vec(publicKey()), "allowlist"),
    option(vec(publicKey()), "blocklist"),
  ]);

  constructor(
    lockupPeriod: number,
    maxCap: BN,
    minSubscription: BN,
    minRedemption: BN,
    reserved: BN,
    allowlist: PublicKey[] | null,
    blocklist: PublicKey[] | null,
  ) {
    this.lockupPeriod = lockupPeriod;
    this.maxCap = maxCap;
    this.minSubscription = minSubscription;
    this.minRedemption = minRedemption;
    this.reserved = reserved;
    this.allowlist = allowlist;
    this.blocklist = blocklist;
  }

  public static decode(buffer: Buffer): MintPolicy {
    const data = MintPolicy._layout.decode(buffer) as MintPolicy;
    return new MintPolicy(
      data.lockupPeriod,
      data.maxCap,
      data.minSubscription,
      data.minRedemption,
      data.reserved,
      data.allowlist,
      data.blocklist,
    );
  }

  public encode(): Buffer {
    // Calculate the required buffer size
    // Fixed fields: 4 + 8 + 8 + 8 + 8 = 36 bytes
    // Variable fields: allowlist and blocklist (1 byte option flag + 4 bytes length + 32 bytes per pubkey)
    const allowlistSize = this.allowlist
      ? 1 + 4 + this.allowlist.length * 32
      : 1;
    const blocklistSize = this.blocklist
      ? 1 + 4 + this.blocklist.length * 32
      : 1;
    const totalSize = 36 + allowlistSize + blocklistSize;

    const buffer = Buffer.alloc(totalSize);
    MintPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class JupiterSwapPolicy {
  maxSlippageBps: number;
  swapAllowlist: PublicKey[] | null;
  maxDeviationBps: number;

  constructor(
    maxSlippageBps: number,
    swapAllowlist: PublicKey[] | null,
    maxDeviationBps: number = 0,
  ) {
    this.maxSlippageBps = maxSlippageBps;
    this.swapAllowlist = swapAllowlist;
    this.maxDeviationBps = maxDeviationBps;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): JupiterSwapPolicy {
    if (buffer.length < 3) {
      throw new Error("Invalid Jupiter swap policy");
    }

    let offset = 0;
    const maxSlippageBps = buffer.readUInt16LE(offset);
    offset += 2;

    const hasAllowlist = buffer.readUInt8(offset) === 1;
    offset += 1;

    let swapAllowlist: PublicKey[] | null = null;
    if (hasAllowlist) {
      if (buffer.length < offset + 4) {
        throw new Error("Invalid Jupiter swap allowlist");
      }

      const allowlistLen = buffer.readUInt32LE(offset);
      offset += 4;

      swapAllowlist = [];
      for (let i = 0; i < allowlistLen; i++) {
        const nextOffset = offset + 32;
        if (buffer.length < nextOffset) {
          throw new Error("Invalid Jupiter swap allowlist entry");
        }

        swapAllowlist.push(new PublicKey(buffer.subarray(offset, nextOffset)));
        offset = nextOffset;
      }
    }

    const maxDeviationBps =
      buffer.length >= offset + 2 ? buffer.readInt16LE(offset) : 0;

    return new JupiterSwapPolicy(
      maxSlippageBps,
      swapAllowlist,
      maxDeviationBps,
    );
  }

  public encode(): Buffer {
    const maxSlippageBps = Buffer.alloc(2);
    maxSlippageBps.writeUInt16LE(this.maxSlippageBps, 0);

    const hasAllowlist = this.swapAllowlist !== null;
    const allowlistFlag = Buffer.from([hasAllowlist ? 1 : 0]);
    let allowlist: Buffer;
    if (this.swapAllowlist === null) {
      allowlist = Buffer.alloc(0);
    } else {
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(this.swapAllowlist.length, 0);
      allowlist = Buffer.concat([
        lenBuf,
        ...this.swapAllowlist.map((pubkey) => pubkey.toBuffer()),
      ]);
    }

    const maxDeviationBps = Buffer.alloc(2);
    maxDeviationBps.writeInt16LE(this.maxDeviationBps, 0);

    return Buffer.concat([
      maxSlippageBps,
      allowlistFlag,
      allowlist,
      maxDeviationBps,
    ]);
  }
}

// System Program and Token Program use the same TransferPolicy struct
export class TransferPolicy {
  allowlist: PublicKey[];

  static _layout = struct([vec(publicKey(), "allowlist")]);

  constructor(allowlist: PublicKey[]) {
    this.allowlist = allowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): TransferPolicy {
    const { allowlist } = TransferPolicy._layout.decode(
      buffer,
    ) as TransferPolicy;
    return new TransferPolicy(allowlist);
  }

  public encode(): Buffer {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(this.allowlist.length, 0);

    const buffer = Buffer.alloc(this.allowlist.length * 32);
    for (let i = 0; i < this.allowlist.length; i++) {
      this.allowlist[i].toBuffer().copy(buffer, i * 32);
    }

    return Buffer.concat([header, buffer]);
  }
}

export class KaminoLendingPolicy {
  marketsAllowlist: PublicKey[];
  borrowAllowlist: PublicKey[];

  static _layout = struct([
    vec(publicKey(), "marketsAllowlist"),
    vec(publicKey(), "borrowAllowlist"),
  ]);

  constructor(marketsAllowlist: PublicKey[], borrowAllowlist: PublicKey[]) {
    this.marketsAllowlist = marketsAllowlist;
    this.borrowAllowlist = borrowAllowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): KaminoLendingPolicy {
    const { marketsAllowlist, borrowAllowlist } =
      KaminoLendingPolicy._layout.decode(buffer) as KaminoLendingPolicy;
    return new KaminoLendingPolicy(marketsAllowlist, borrowAllowlist);
  }

  public encode(): Buffer {
    const marketsAllowlistSize = 4 + this.marketsAllowlist.length * 32;
    const borrowAllowlistSize = 4 + this.borrowAllowlist.length * 32;
    const totalSize = marketsAllowlistSize + borrowAllowlistSize;

    const buffer = Buffer.alloc(totalSize);
    KaminoLendingPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class KaminoVaultsPolicy {
  vaultsAllowlist: PublicKey[];

  static _layout = struct([vec(publicKey(), "vaultsAllowlist")]);

  constructor(vaultsAllowlist: PublicKey[]) {
    this.vaultsAllowlist = vaultsAllowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): KaminoVaultsPolicy {
    const { vaultsAllowlist } = KaminoVaultsPolicy._layout.decode(
      buffer,
    ) as KaminoVaultsPolicy;
    return new KaminoVaultsPolicy(vaultsAllowlist);
  }

  public encode(): Buffer {
    const vaultsAllowlistSize = 4 + this.vaultsAllowlist.length * 32;
    const totalSize = vaultsAllowlistSize;

    const buffer = Buffer.alloc(totalSize);
    KaminoVaultsPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class JupiterEarnPolicy {
  mintsAllowlist: PublicKey[];

  static _layout = struct([vec(publicKey(), "mintsAllowlist")]);

  constructor(mintsAllowlist: PublicKey[]) {
    this.mintsAllowlist = mintsAllowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): JupiterEarnPolicy {
    const { mintsAllowlist } = JupiterEarnPolicy._layout.decode(
      buffer,
    ) as JupiterEarnPolicy;
    return new JupiterEarnPolicy(mintsAllowlist);
  }

  public encode(): Buffer {
    const mintsAllowlistSize = 4 + this.mintsAllowlist.length * 32;
    const buffer = Buffer.alloc(mintsAllowlistSize);
    JupiterEarnPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class JupiterBorrowPolicy {
  vaultsAllowlist: PublicKey[];
  collateralMintsAllowlist: PublicKey[];
  borrowMintsAllowlist: PublicKey[];

  static _layout = struct([
    vec(publicKey(), "vaultsAllowlist"),
    vec(publicKey(), "collateralMintsAllowlist"),
    vec(publicKey(), "borrowMintsAllowlist"),
  ]);

  constructor(
    vaultsAllowlist: PublicKey[],
    collateralMintsAllowlist: PublicKey[],
    borrowMintsAllowlist: PublicKey[],
  ) {
    this.vaultsAllowlist = vaultsAllowlist;
    this.collateralMintsAllowlist = collateralMintsAllowlist;
    this.borrowMintsAllowlist = borrowMintsAllowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): JupiterBorrowPolicy {
    const { vaultsAllowlist, collateralMintsAllowlist, borrowMintsAllowlist } =
      JupiterBorrowPolicy._layout.decode(buffer) as JupiterBorrowPolicy;
    return new JupiterBorrowPolicy(
      vaultsAllowlist,
      collateralMintsAllowlist,
      borrowMintsAllowlist,
    );
  }

  public encode(): Buffer {
    const vaultsAllowlistSize = 4 + this.vaultsAllowlist.length * 32;
    const collateralMintsAllowlistSize =
      4 + this.collateralMintsAllowlist.length * 32;
    const borrowMintsAllowlistSize = 4 + this.borrowMintsAllowlist.length * 32;
    const buffer = Buffer.alloc(
      vaultsAllowlistSize +
        collateralMintsAllowlistSize +
        borrowMintsAllowlistSize,
    );
    JupiterBorrowPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class PhoenixPolicy {
  marketsAllowlist: PublicKey[];
  allowedOrderTypes: number[];
  requireReduceOnlyOrders: boolean;
  maxPriceDeviationBps: number;
  maxReferencePriceAgeSecs: number;

  constructor(
    marketsAllowlist: PublicKey[],
    allowedOrderTypes: number[],
    requireReduceOnlyOrders: boolean,
    maxPriceDeviationBps: number,
    maxReferencePriceAgeSecs = 0,
  ) {
    this.marketsAllowlist = marketsAllowlist;
    this.allowedOrderTypes = allowedOrderTypes;
    this.requireReduceOnlyOrders = requireReduceOnlyOrders;
    this.maxPriceDeviationBps = maxPriceDeviationBps;
    this.maxReferencePriceAgeSecs = maxReferencePriceAgeSecs;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): PhoenixPolicy {
    let offset = 0;
    const len = buffer.readUInt32LE(offset);
    offset += 4;
    const marketsAllowlist: PublicKey[] = [];
    for (let i = 0; i < len; i++) {
      marketsAllowlist.push(
        new PublicKey(buffer.subarray(offset, offset + 32)),
      );
      offset += 32;
    }
    const allowedOrderTypesLen = buffer.readUInt32LE(offset);
    offset += 4;
    const allowedOrderTypes: number[] = [];
    for (let i = 0; i < allowedOrderTypesLen; i++) {
      allowedOrderTypes.push(buffer.readUInt8(offset));
      offset += 1;
    }
    const requireReduceOnlyOrders = buffer.readUInt8(offset) !== 0;
    offset += 1;
    const maxPriceDeviationBps = buffer.readUInt16LE(offset);
    offset += 2;
    const maxReferencePriceAgeSecs =
      buffer.length >= offset + 4 ? buffer.readUInt32LE(offset) : 0;
    return new PhoenixPolicy(
      marketsAllowlist,
      allowedOrderTypes,
      requireReduceOnlyOrders,
      maxPriceDeviationBps,
      maxReferencePriceAgeSecs,
    );
  }

  public encode(): Buffer {
    const allowlistHeader = Buffer.alloc(4);
    allowlistHeader.writeUInt32LE(this.marketsAllowlist.length, 0);
    const allowlistBody = Buffer.alloc(this.marketsAllowlist.length * 32);
    for (let i = 0; i < this.marketsAllowlist.length; i++) {
      this.marketsAllowlist[i].toBuffer().copy(allowlistBody, i * 32);
    }
    const tail = Buffer.alloc(2 + 1 + 4 + 4 + this.allowedOrderTypes.length);
    let off = 0;
    tail.writeUInt32LE(this.allowedOrderTypes.length, off);
    off += 4;
    for (const orderType of this.allowedOrderTypes) {
      tail.writeUInt8(orderType, off);
      off += 1;
    }
    tail.writeUInt8(this.requireReduceOnlyOrders ? 1 : 0, off);
    off += 1;
    tail.writeUInt16LE(this.maxPriceDeviationBps, off);
    off += 2;
    tail.writeUInt32LE(this.maxReferencePriceAgeSecs, off);
    return Buffer.concat([allowlistHeader, allowlistBody, tail]);
  }
}

export class WhirlpoolsPolicy {
  whirlpoolsAllowlist: PublicKey[];
  tokenMintsAllowlist: PublicKey[];
  maxDeviationBps: number;

  static _layout = struct([
    vec(publicKey(), "whirlpoolsAllowlist"),
    vec(publicKey(), "tokenMintsAllowlist"),
    i16("maxDeviationBps"),
  ]);

  constructor(
    whirlpoolsAllowlist: PublicKey[],
    tokenMintsAllowlist: PublicKey[],
    maxDeviationBps: number = 0,
  ) {
    this.whirlpoolsAllowlist = whirlpoolsAllowlist;
    this.tokenMintsAllowlist = tokenMintsAllowlist;
    this.maxDeviationBps = maxDeviationBps;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): WhirlpoolsPolicy {
    let offset = 0;
    if (buffer.length < 4) {
      throw new Error("Invalid Whirlpools policy");
    }

    const whirlpoolsAllowlistLen = buffer.readUInt32LE(offset);
    offset += 4;
    const whirlpoolsAllowlist: PublicKey[] = [];
    for (let i = 0; i < whirlpoolsAllowlistLen; i++) {
      const nextOffset = offset + 32;
      if (buffer.length < nextOffset) {
        throw new Error("Invalid Whirlpools allowlist entry");
      }
      whirlpoolsAllowlist.push(
        new PublicKey(buffer.subarray(offset, nextOffset)),
      );
      offset = nextOffset;
    }

    if (buffer.length < offset + 4) {
      throw new Error("Invalid Whirlpools token mint allowlist");
    }
    const tokenMintsAllowlistLen = buffer.readUInt32LE(offset);
    offset += 4;
    const tokenMintsAllowlist: PublicKey[] = [];
    for (let i = 0; i < tokenMintsAllowlistLen; i++) {
      const nextOffset = offset + 32;
      if (buffer.length < nextOffset) {
        throw new Error("Invalid Whirlpools token mint allowlist entry");
      }
      tokenMintsAllowlist.push(
        new PublicKey(buffer.subarray(offset, nextOffset)),
      );
      offset = nextOffset;
    }

    if (buffer.length - offset !== 2) {
      throw new Error("Invalid Whirlpools policy bounds");
    }
    const maxDeviationBps = buffer.readInt16LE(offset);

    return new WhirlpoolsPolicy(
      whirlpoolsAllowlist,
      tokenMintsAllowlist,
      maxDeviationBps,
    );
  }

  public encode(): Buffer {
    const whirlpoolsAllowlistSize = 4 + this.whirlpoolsAllowlist.length * 32;
    const tokenMintsAllowlistSize = 4 + this.tokenMintsAllowlist.length * 32;
    const buffer = Buffer.alloc(
      whirlpoolsAllowlistSize + tokenMintsAllowlistSize + 2,
    );
    WhirlpoolsPolicy._layout.encode(this, buffer);
    return buffer;
  }
}

export class CctpPolicy {
  allowedDestinations: { domain: number; address: PublicKey }[];

  static _layout = struct([
    vec(struct([u32("domain"), publicKey("address")]), "allowedDestinations"),
  ]);

  constructor(allowedDestinations: { domain: number; address: PublicKey }[]) {
    this.allowedDestinations = allowedDestinations;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): CctpPolicy {
    const data = CctpPolicy._layout.decode(buffer) as CctpPolicy;
    return new CctpPolicy(data.allowedDestinations);
  }

  public encode(): Buffer {
    const allowedDestinationsSize = 4 + this.allowedDestinations.length * 36; // 4 bytes (u32) + 32 bytes (Pubkey) = 36 bytes per destination
    const totalSize = allowedDestinationsSize;

    const buffer = Buffer.alloc(totalSize);
    CctpPolicy._layout.encode(this, buffer);
    return buffer;
  }

  get domainToAddressesMap(): Map<number, PublicKey[]> {
    const map = new Map<number, PublicKey[]>();
    for (const { domain, address } of this.allowedDestinations) {
      const keys = map.get(domain) || [];
      keys.push(address);
      map.set(domain, keys);
    }
    return map;
  }
}

export enum RouteManagementMode {
  UnmanagedOnly = 0,
  ManagedOnly = 1,
  Either = 2,
}

export type LayerzeroOftRoute = {
  sourceMint: PublicKey;
  destinationChain: number;
  destinationRecipient: PublicKey;
  providerProgram: PublicKey;
  managementMode: RouteManagementMode;
  minAmount: BN;
  maxAmount: BN;
};

const layerzeroOftRouteLayout = struct<LayerzeroOftRoute>([
  publicKey("sourceMint"),
  u32("destinationChain"),
  publicKey("destinationRecipient"),
  publicKey("providerProgram"),
  u8("managementMode"),
  u64("minAmount"),
  u64("maxAmount"),
]);

export class LayerzeroOftPolicy {
  routes: LayerzeroOftRoute[];

  static _layout = struct([vec(layerzeroOftRouteLayout, "routes")]);

  constructor(routes: LayerzeroOftRoute[]) {
    this.routes = routes;
  }

  public static decode(
    buffer: Buffer<ArrayBufferLike>,
    _staging?: boolean,
  ): LayerzeroOftPolicy {
    const data = LayerzeroOftPolicy._layout.decode(
      buffer,
    ) as LayerzeroOftPolicy;
    return new LayerzeroOftPolicy(data.routes);
  }

  public encode(): Buffer {
    const buf = Buffer.alloc(4096);
    const written = LayerzeroOftPolicy._layout.encode(this, buf);
    return buf.subarray(0, written);
  }
}

// PeriodType enum: 0=Day, 1=Week, 2=Month
export enum PeriodType {
  Day = 0,
  Week = 1,
  Month = 2,
}

export interface AssetRateLimit {
  mint: PublicKey;
  periodType: number; // PeriodType enum value
  amount: BN;
}

export interface DelegateRateLimit {
  delegate: PublicKey;
  limits: AssetRateLimit[];
}

const assetRateLimitLayout = struct<AssetRateLimit>([
  publicKey("mint"),
  u8("periodType"),
  u64("amount"),
]);

const delegateRateLimitLayout = struct<DelegateRateLimit>([
  publicKey("delegate"),
  vec(assetRateLimitLayout, "limits"),
]);

export class TransferRateLimitPolicy {
  vaultDefaults: AssetRateLimit[];
  delegateOverrides: DelegateRateLimit[];

  static _layout = struct([
    vec(assetRateLimitLayout, "vaultDefaults"),
    vec(delegateRateLimitLayout, "delegateOverrides"),
  ]);

  constructor(
    vaultDefaults: AssetRateLimit[],
    delegateOverrides: DelegateRateLimit[],
  ) {
    this.vaultDefaults = vaultDefaults;
    this.delegateOverrides = delegateOverrides;
  }

  public static decode(
    buffer: Buffer<ArrayBufferLike>,
  ): TransferRateLimitPolicy {
    const data = TransferRateLimitPolicy._layout.decode(
      buffer,
    ) as TransferRateLimitPolicy;
    return new TransferRateLimitPolicy(
      data.vaultDefaults,
      data.delegateOverrides,
    );
  }

  public encode(): Buffer {
    const buf = Buffer.alloc(4096);
    const written = TransferRateLimitPolicy._layout.encode(this, buf);
    return buf.subarray(0, written);
  }

  /**
   * Derive the TransferTracker PDA address for a given vault state, signer, and mint.
   */
  static getTransferTrackerPda(
    glamState: PublicKey,
    signer: PublicKey,
    mint: PublicKey,
    programId: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("transfer-tracker"),
        glamState.toBuffer(),
        signer.toBuffer(),
        mint.toBuffer(),
      ],
      programId,
    );
  }
}
