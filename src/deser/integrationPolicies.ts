import { BN } from "@coral-xyz/anchor";
import {
  struct,
  u32,
  u64,
  vec,
  publicKey,
  option,
  u16,
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
    const data = MintPolicy._layout.decode(buffer);
    return data as MintPolicy;
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

  static _layout = struct([
    u16("maxSlippageBps"),
    option(vec(publicKey()), "swapAllowlist"),
  ]);

  constructor(maxSlippageBps: number, swapAllowlist: PublicKey[] | null) {
    this.maxSlippageBps = maxSlippageBps;
    this.swapAllowlist = swapAllowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): JupiterSwapPolicy {
    const policy = JupiterSwapPolicy._layout.decode(
      buffer,
    ) as JupiterSwapPolicy;
    return new JupiterSwapPolicy(policy.maxSlippageBps, policy.swapAllowlist);
  }

  public encode(): Buffer {
    const buf = Buffer.alloc(1000);
    const written = JupiterSwapPolicy._layout.encode(this, buf);
    return buf.subarray(0, written);
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

export class DriftVaultsPolicy {
  vaultsAllowlist: PublicKey[];

  static _layout = struct([vec(publicKey(), "vaultsAllowlist")]);

  constructor(allowlist: PublicKey[]) {
    this.vaultsAllowlist = allowlist;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): DriftVaultsPolicy {
    const { vaultsAllowlist } = DriftVaultsPolicy._layout.decode(
      buffer,
    ) as DriftVaultsPolicy;
    return new DriftVaultsPolicy(vaultsAllowlist);
  }

  public encode(): Buffer {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(this.vaultsAllowlist.length, 0);

    const buffer = Buffer.alloc(this.vaultsAllowlist.length * 32);
    for (let i = 0; i < this.vaultsAllowlist.length; i++) {
      this.vaultsAllowlist[i].toBuffer().copy(buffer, i * 32);
    }

    return Buffer.concat([header, buffer]);
  }
}

export class DriftProtocolPolicy {
  spotMarketsAllowlist: number[];
  perpMarketsAllowlist: number[];
  borrowAllowlist: PublicKey[];
  orderPriceToleranceBps: number;

  static _layout = struct([
    vec(u16(), "spotMarketsAllowlist"),
    vec(u16(), "perpMarketsAllowlist"),
    vec(publicKey(), "borrowAllowlist"),
    u16("orderPriceToleranceBps"),
  ]);

  static _legacyLayout = struct([
    vec(u16(), "spotMarketsAllowlist"),
    vec(u16(), "perpMarketsAllowlist"),
    vec(publicKey(), "borrowAllowlist"),
  ]);

  constructor(
    spotMarketsAllowlist: number[],
    perpMarketsAllowlist: number[],
    borrowAllowlist: PublicKey[],
    orderPriceToleranceBps: number = 0,
  ) {
    this.spotMarketsAllowlist = spotMarketsAllowlist;
    this.perpMarketsAllowlist = perpMarketsAllowlist;
    this.borrowAllowlist = borrowAllowlist;
    this.orderPriceToleranceBps = orderPriceToleranceBps;
  }

  public static decode(buffer: Buffer<ArrayBufferLike>): DriftProtocolPolicy {
    try {
      const data = DriftProtocolPolicy._layout.decode(
        buffer,
      ) as DriftProtocolPolicy;
      return new DriftProtocolPolicy(
        data.spotMarketsAllowlist,
        data.perpMarketsAllowlist,
        data.borrowAllowlist,
        data.orderPriceToleranceBps ?? 0,
      );
    } catch {
      // Legacy format without orderPriceToleranceBps
      const data = DriftProtocolPolicy._legacyLayout.decode(
        buffer,
      ) as DriftProtocolPolicy;
      return new DriftProtocolPolicy(
        data.spotMarketsAllowlist,
        data.perpMarketsAllowlist,
        data.borrowAllowlist,
        0,
      );
    }
  }

  public encode(): Buffer {
    // Calculate buffer size needed
    // 4 bytes for spot markets length + 2 bytes per spot market
    // 4 bytes for perp markets length + 2 bytes per perp market
    // 4 bytes for borrow allowlist length + 32 bytes per pubkey
    // 2 bytes for orderPriceToleranceBps
    const spotMarketsSize = 4 + this.spotMarketsAllowlist.length * 2;
    const perpMarketsSize = 4 + this.perpMarketsAllowlist.length * 2;
    const borrowAllowlistSize = 4 + this.borrowAllowlist.length * 32;
    const totalSize =
      spotMarketsSize + perpMarketsSize + borrowAllowlistSize + 2;

    const buffer = Buffer.alloc(totalSize);
    DriftProtocolPolicy._layout.encode(this, buffer);
    return buffer;
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
