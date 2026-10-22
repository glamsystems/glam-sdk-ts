import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { MINT_SIZE, MintLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountInfo, Connection, Keypair, PublicKey } from "@solana/web3.js";

import {
  RouteSets,
  resolveLayerzeroOftMinAmountLd,
} from "../../src/client/bridge";
import { resolveCanonicalLayerzeroOftRouteProfile } from "../../src/client/bridgeRegistry";
import { GlamClient } from "../../src/client";
import { ClusterNetwork } from "../../src/clientConfig";
import { USDT } from "../../src/constants";
import {
  BridgeRoute,
  RouteChain,
  RouteLimits,
  RouteManagementMode,
} from "../../src/deser/integrationPolicies";
import { LAYERZERO_OFT_PROTOCOL } from "../../src/protocols";

/** The LayerZero endpoint id of Arbitrum, the chain of the checked-in USDT0 profile. */
const ARBITRUM = 30110;
/** The cost bound `allow-route` writes when `--max-cost-bps` is omitted. */
const CLI_DEFAULT_MAX_COST_BPS = 10;

const profile = resolveCanonicalLayerzeroOftRouteProfile({
  sourceMint: USDT,
  destinationChain: ARBITRUM,
  cluster: ClusterNetwork.Mainnet,
})!;

/** The program's cost check, RouteLimits::admits: (amount - quote) * 10_000 <= amount * bps. */
function admits(amount: BN, quote: BN, maxCostBps: number): boolean {
  return amount.sub(quote).muln(10_000).lte(amount.muln(maxCostBps));
}

/** Amounts in USDT's base units and the quote a route at the CLI's default bound gives each. */
const QUOTES_AT_CLI_DEFAULT: [number, number][] = [
  [1_000_000, 999_000],
  [1_000_001, 999_001],
  [999, 999],
  [1, 1],
];

function routeLimits(maxCostBps: number): RouteLimits {
  return {
    minAmount: new BN(0),
    maxAmount: new BN(1_000_000_000),
    maxCostBps,
  };
}

/** A USDT0 route to `recipient` through the profile's program, on the CLI's default limits. */
function oftRoute(
  recipient: PublicKey,
  destinationChains: RouteChain[],
): BridgeRoute {
  return {
    sourceMint: USDT,
    destinationRecipient: recipient,
    providerProgram: profile.providerProgram,
    managementMode: RouteManagementMode.UnmanagedOnly,
    limits: routeLimits(CLI_DEFAULT_MAX_COST_BPS),
    controls: { layerzeroOft: { oftStore: profile.providerSender } },
    destinationChains,
  };
}

function routeSets(live: BridgeRoute[] | null): RouteSets {
  return {
    live,
    committed: live,
    pending: null,
    liveHash: live ? Buffer.alloc(32, 1) : null,
    pendingHash: null,
    pendingCleared: false,
    generation: live ? new BN(1) : null,
    committedGeneration: live ? new BN(1) : null,
    pendingGeneration: null,
    paused: false,
  };
}

/** A classic SPL mint of six decimals, as USDT is. */
function mintAccount(): AccountInfo<Buffer> {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: 0n,
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  );
  return {
    data,
    executable: false,
    lamports: 0,
    owner: TOKEN_PROGRAM_ID,
    rentEpoch: 0,
  };
}

/**
 * A mainnet client, so the USDT0 profile resolves; nothing here reaches a network. Every account
 * read answers a USDT-like mint, the only account the send reads besides the routes, which
 * `fetchRouteSets` answers.
 */
function offlineMainnetClient(fetchRouteSets: jest.Mock): GlamClient {
  const wallet = new anchor.Wallet(Keypair.generate());
  const connection = new Connection("http://127.0.0.1:1", "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const glamClient = new GlamClient({
    provider,
    cluster: ClusterNetwork.Mainnet,
    statePda: Keypair.generate().publicKey,
  });
  (connection as any).getAccountInfo = jest.fn(async () => mintAccount());
  // Return the instructions' transaction unbuilt instead of compiling (and simulating) it.
  (glamClient.bridge.txBuilder as any).buildVersionedTx = jest.fn(
    async () => ({}),
  );
  (glamClient.bridge as any).fetchRouteSets = fetchRouteSets;
  return glamClient;
}

/** The send's leading fields: the discriminator, then u32 dst_eid, 32-byte to, u64 amounts. */
function sendAmounts(data: Buffer) {
  return {
    dstEid: data.readUInt32LE(8),
    to: new PublicKey(data.subarray(12, 44)),
    amountLd: new BN(data.subarray(44, 52), "le").toString(),
    minAmountLd: new BN(data.subarray(52, 60), "le").toString(),
  };
}

describe("LayerZero OFT default quote", () => {
  it("concedes exactly a route's cost bound: the CLI's default 10 bps admits each quote", () => {
    for (const [amount, quote] of QUOTES_AT_CLI_DEFAULT) {
      const resolved = resolveLayerzeroOftMinAmountLd({
        sourceAmount: new BN(amount),
        routeProfile: profile,
        maxCostBps: CLI_DEFAULT_MAX_COST_BPS,
      });
      expect(resolved.toString()).toBe(quote.toString());
      expect(admits(new BN(amount), resolved, CLI_DEFAULT_MAX_COST_BPS)).toBe(
        true,
      );
    }
  });

  it("is the lowest quote the route admits: one unit less costs more than its bound", () => {
    for (const [amount, quote] of QUOTES_AT_CLI_DEFAULT) {
      expect(
        admits(new BN(amount), new BN(quote - 1), CLI_DEFAULT_MAX_COST_BPS),
      ).toBe(false);
    }
  });

  it("without a route takes the profile's 99.5 %, which a route at the CLI's default refuses", () => {
    const resolved = resolveLayerzeroOftMinAmountLd({
      sourceAmount: new BN(1_000_000),
      routeProfile: profile,
    });
    expect(resolved.toString()).toBe("995000");
    expect(admits(new BN(1_000_000), resolved, CLI_DEFAULT_MAX_COST_BPS)).toBe(
      false,
    );

    // A profile without a default share quotes the whole amount.
    expect(
      resolveLayerzeroOftMinAmountLd({
        sourceAmount: new BN(1_000_000),
        routeProfile: { ...profile, defaultMinAmountBps: undefined },
      }).toString(),
    ).toBe("1000000");
  });

  it("takes an explicit minAmountLd over the route's bound and the profile", () => {
    expect(
      resolveLayerzeroOftMinAmountLd({
        sourceAmount: new BN(1_000_000),
        minAmountLd: new BN(900_000),
        routeProfile: profile,
        maxCostBps: CLI_DEFAULT_MAX_COST_BPS,
      }).toString(),
    ).toBe("900000");
  });

  it("a send without minAmountLd quotes under the live route on its chain, else under the profile", async () => {
    const recipient = Keypair.generate().publicKey;
    const fetchRouteSets = jest.fn();
    const glamClient = offlineMainnetClient(fetchRouteSets);
    const sendOneUsdt = async (minAmountLd?: BN) => {
      fetchRouteSets.mockClear();
      const { sendInstruction } = await glamClient.bridge.oft.buildSendTx({
        sourceMint: USDT,
        sourceAmount: new BN(1_000_000),
        destinationChain: ARBITRUM,
        destinationRecipient: recipient,
        nativeFeeLamports: new BN(1),
        minAmountLd,
      });
      expect(sendInstruction.programId.equals(profile.providerProgram)).toBe(
        true,
      );
      return sendAmounts(sendInstruction.data);
    };

    // A live route at the CLI's defaults on the send's chain: the quote concedes its 10 bps.
    const onArbitrum = oftRoute(recipient, [
      { chain: new BN(ARBITRUM), limits: null },
    ]);
    fetchRouteSets.mockResolvedValue(routeSets([onArbitrum]));
    const send = await sendOneUsdt();
    expect(send.dstEid).toBe(ARBITRUM);
    expect(send.to.equals(recipient)).toBe(true);
    expect(send.amountLd).toBe("1000000");
    expect(send.minAmountLd).toBe("999000");
    expect(fetchRouteSets).toHaveBeenCalledTimes(1);
    expect(fetchRouteSets).toHaveBeenCalledWith(LAYERZERO_OFT_PROTOCOL);

    // The chain's own limits replace the route's.
    fetchRouteSets.mockResolvedValue(
      routeSets([
        oftRoute(recipient, [
          { chain: new BN(ARBITRUM), limits: routeLimits(5) },
        ]),
      ]),
    );
    expect((await sendOneUsdt()).minAmountLd).toBe("999500");

    // No live route holds the send's identity on its chain: the profile's 99.5 %.
    for (const live of [
      null,
      [oftRoute(recipient, [{ chain: new BN(30101), limits: null }])],
      [
        oftRoute(Keypair.generate().publicKey, [
          { chain: new BN(ARBITRUM), limits: null },
        ]),
      ],
    ]) {
      fetchRouteSets.mockResolvedValue(routeSets(live));
      expect((await sendOneUsdt()).minAmountLd).toBe("995000");
    }

    // An explicit quote is sent as given, without reading the routes.
    fetchRouteSets.mockResolvedValue(routeSets([onArbitrum]));
    expect((await sendOneUsdt(new BN(990_000))).minAmountLd).toBe("990000");
    expect(fetchRouteSets).not.toHaveBeenCalled();
  });
});
