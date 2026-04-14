import { PublicKey } from "@solana/web3.js";

import { ClusterNetwork } from "../clientConfig";
import { USDT } from "../constants";

export type RouteAccountPlaceholder = "payer" | "nonce";

export type SerializableRouteAccountMeta = {
  pubkey?: PublicKey;
  placeholder?: RouteAccountPlaceholder;
  isSigner: boolean;
  isWritable: boolean;
};

export type LayerzeroOftRouteProfile = {
  sourceMint: PublicKey;
  destinationChain: number;
  providerProgram: PublicKey;
  providerConfig: PublicKey;
  nonceAccount?: PublicKey;
  peerConfig: PublicKey;
  providerSender: PublicKey;
  enforcedOptions: PublicKey;
  tokenEscrow: PublicKey;
  eventAuthority: PublicKey;
  lookupTables?: PublicKey[];
  defaultOptions?: Uint8Array | number[] | Buffer;
  defaultMinAmountBps?: number;
  remainingAccounts: SerializableRouteAccountMeta[];
  quoteRemainingAccounts?: SerializableRouteAccountMeta[];
};

function cloneSerializableRouteAccountMeta(
  meta: SerializableRouteAccountMeta,
  overrides?: Partial<SerializableRouteAccountMeta>,
): SerializableRouteAccountMeta {
  return {
    pubkey: meta.pubkey,
    placeholder: meta.placeholder,
    isSigner: meta.isSigner,
    isWritable: meta.isWritable,
    ...overrides,
  };
}

const MAINNET_USDT0_OFT_PROGRAM = new PublicKey(
  "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
);
const MAINNET_USDT0_OFT_LOOKUP_TABLE = new PublicKey(
  "6zcTrmdkiQp6dZHYUxVr6A2XVDSYi44X1rcPtvwNcrXi",
);
const MAINNET_LAYERZERO_ENDPOINT = new PublicKey(
  "76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6",
);
const MAINNET_USDT0_DEFAULT_OPTIONS = Buffer.from(
  "000301001101000000000000000000000000000186a00100230300000000000000000000000000000007a120000000000000000000001202e803365c",
  "hex",
);

// Decoded from a live mainnet USDT0 -> Arbitrum transfer:
// 5omzqdmCL84JCh8Z75qnFeAdWPtGoaU2v6r3Zwnr6N2mS5rcJ6FXhWALXf5yHvE32gsWkBmoK4nRC4p29kHwbHBP
const MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE: LayerzeroOftRouteProfile = {
  sourceMint: USDT,
  destinationChain: 30110,
  providerProgram: MAINNET_USDT0_OFT_PROGRAM,
  providerConfig: MAINNET_LAYERZERO_ENDPOINT,
  nonceAccount: new PublicKey("uZ8xA3LGpAJ5GHkTLqyvvrBVZa5XjCCRwc2qNvZJKci"),
  peerConfig: new PublicKey("5FEMXXjueR7y6Z1uVDxTm4ZZXFp6XnxR1Xu1WmvwjxBF"),
  providerSender: new PublicKey("HyXJcgYpURfDhgzuyRL7zxP4FhLg7LZQMeDrR4MXZcMN"),
  enforcedOptions: new PublicKey(
    "6trV82jqtcqrsMd5ZXKvR6QzLX6bHstBK4wZFx1qrffC",
  ),
  tokenEscrow: new PublicKey("F1YkdxaiLA1eJt12y3uMAQef48Td3zdJfYhzjphma8hG"),
  eventAuthority: new PublicKey("B981t4zrZf3HCgtFFcw32D7Ukoa6saGMomeJcYNRwsQd"),
  lookupTables: [MAINNET_USDT0_OFT_LOOKUP_TABLE],
  defaultOptions: MAINNET_USDT0_DEFAULT_OPTIONS,
  defaultMinAmountBps: 9950,
  remainingAccounts: [
    {
      pubkey: MAINNET_LAYERZERO_ENDPOINT,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("HyXJcgYpURfDhgzuyRL7zxP4FhLg7LZQMeDrR4MXZcMN"),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("xrbATgBr5WadPQZBqeH1FkHrK44FrgoB7QGvqQazESh"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("6eBJZSdwWri24KFWEGWX2WkWCCQCB89sTqi66MaBgnn5"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("526PeNZfw8kSnDU4nmzJFVJzJWNhwmZykEyJr5XWz5Fv"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("2uk9pQh3tB5ErV7LGQJcbWjb4KeJ2UJki5qJZ8QG56G3"),
      isSigner: false,
      isWritable: false,
    },
    {
      placeholder: "nonce",
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("F8E8QGhKmHEx2esh5LpVizzcP4cHYhzXdXTwg9w3YYY2"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: MAINNET_LAYERZERO_ENDPOINT,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("EDCciRXYGE9ZSCCr9SZFiGtwNLbLHnzzFmf3oCRthCfN"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("ArJGQF5NpgYLCXrLjmzJBPhh4p3vkdRRbWsr3CADRa2g"),
      isSigner: false,
      isWritable: false,
    },
    {
      placeholder: "payer",
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("11111111111111111111111111111111"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("7n1YeBMVEUCJ4DscKAcpVQd6KXU7VpcEcc15ZuMcL4U3"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("7a4WjyR8VZ7yZz5XJAKm39BUGn5iT9CKcv2pmG9tdXVH"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("AwrbHeCyniXaQhiJZkLhgWdUCteeWSGaSN1sTfLiY7xK"),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("HtEYV4xB4wvsj5fgTkcfuChYpvGYzgzwvNhgDZQNh7wW"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("4VDjp6XQaxoZf5RGwiPU9NR1EXSZn2TP4ATMmiSzLfhb"),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("3T7waVnx1W54ZA7XuRmXngoua4hEkRXciNL8stBJAUR4"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("JBt34GkVns6VSoP2dCPpViW28eqE4GNgKaoZPRP63wZs"),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey("8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP"),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey("CSFsUupvJEQQd1F4SsXGACJaxQX4eropQMkGV2696eeQ"),
      isSigner: false,
      isWritable: false,
    },
  ],
  quoteRemainingAccounts: [],
};

MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.quoteRemainingAccounts = [
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[0],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[2],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[3],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[4],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[5],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[6],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[7],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[10],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[11],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[12],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[18],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[19],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[20],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[21],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[22],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[23],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[24],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[25],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[26],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[27],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[28],
    { isWritable: false },
  ),
  cloneSerializableRouteAccountMeta(
    MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE.remainingAccounts[29],
    { isWritable: false },
  ),
];

const LAYERZERO_OFT_ROUTE_PROFILES: Partial<
  Record<ClusterNetwork, LayerzeroOftRouteProfile[]>
> = {
  [ClusterNetwork.Mainnet]: [MAINNET_USDT0_ARBITRUM_ROUTE_PROFILE],
};

export function resolveCanonicalLayerzeroOftRouteProfile(params: {
  sourceMint: PublicKey;
  destinationChain: number;
  cluster: ClusterNetwork;
  providerProgram?: PublicKey;
}) {
  const profiles = LAYERZERO_OFT_ROUTE_PROFILES[params.cluster] || [];
  return (
    profiles.find(
      (profile) =>
        profile.sourceMint.equals(params.sourceMint) &&
        profile.destinationChain === params.destinationChain &&
        (!params.providerProgram ||
          profile.providerProgram.equals(params.providerProgram)),
    ) || null
  );
}
