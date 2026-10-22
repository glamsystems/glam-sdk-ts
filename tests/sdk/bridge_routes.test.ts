import * as fs from "fs";
import * as path from "path";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import {
  BRIDGE_ROUTES_HEAP_FRAME_BYTES,
  BridgeClient,
  BridgeRouteInput,
} from "../../src/client/bridge";
import { resolveCanonicalLayerzeroOftRouteProfile } from "../../src/client/bridgeRegistry";
import { GlamClient } from "../../src/client";
import { ClusterNetwork } from "../../src/clientConfig";
import { getExtBridgeProgramId } from "../../src/glamExports";
import {
  BridgeRoute,
  MAX_ROUTES_PER_SET,
  MAX_ROUTE_CHAINS,
  RouteLimits,
  RouteManagementMode,
  RouteSetCommitment,
  encodeBridgeRoutes,
  routeSetHash,
} from "../../src/deser/integrationPolicies";
import {
  BRIDGE_CCTP_PROTOCOL,
  LAYERZERO_OFT_PROTOCOL,
} from "../../src/protocols";
import { TOKEN_MESSENGER_MINTER_V2, USDC, USDT } from "../../src/constants";
import {
  V1Transaction,
  assertV1TransactionLimits,
  compileToV1Message,
} from "../../src/utils/messageV1";

const BLOCKHASH = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";

/** A client whose coder is the real ext_bridge IDL; nothing here reaches a network. */
function offlineClient(): GlamClient {
  const wallet = new anchor.Wallet(Keypair.generate());
  const connection = new Connection("http://127.0.0.1:1", "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  return new GlamClient({ provider, statePda: Keypair.generate().publicKey });
}

/** What the connection answers for the provider's routes address. */
function accountAtRoutesPda(
  glamClient: GlamClient,
  info: AccountInfo<Buffer> | null,
) {
  (glamClient.provider.connection as any).getAccountInfo = jest.fn(
    async () => info,
  );
}

/** An account the program initialized: ext_bridge's, starting with the BridgeRoutes discriminator. */
function initializedRoutesAccount(glamClient: GlamClient): AccountInfo<Buffer> {
  return {
    owner: glamClient.extBridgeProgram.programId,
    lamports: 1_000_000,
    executable: false,
    data: Buffer.concat([
      (
        glamClient.extBridgeProgram.coder.accounts as anchor.BorshAccountsCoder
      ).accountDiscriminator("bridgeRoutes"),
      Buffer.alloc(64),
    ]),
  };
}

/** The ext_bridge instruction coder; Anchor types `program.coder.instruction` without `decode`. */
function instructionCoder(glamClient: GlamClient) {
  return glamClient.extBridgeProgram.coder
    .instruction as anchor.BorshInstructionCoder;
}

function routeLimits(
  minAmount: number | string,
  maxAmount: number | string,
  maxCostBps: number,
): RouteLimits {
  return {
    minAmount: new BN(minAmount),
    maxAmount: new BN(maxAmount),
    maxCostBps,
  };
}

/**
 * A CCTP route at the caps a setter's transaction carries: eight chains on the route's limits
 * and the larger controls variant. Limits of its own on every chain add 144 bytes a route, and
 * sixteen such routes (5,956 bytes) fit no version 1 transaction: that set is built by edits.
 */
function fullRoute(index: number): BridgeRoute {
  return {
    sourceMint: USDC,
    destinationRecipient: new PublicKey(Buffer.alloc(32, 10 + index)),
    providerProgram: TOKEN_MESSENGER_MINTER_V2,
    managementMode: RouteManagementMode.Either,
    limits: routeLimits(1, "18446744073709551615", 100),
    controls: {
      cctp: {
        destinationCaller: new PublicKey(Buffer.alloc(32, 100 + index)),
        minFinalityThreshold: 2000,
      },
    },
    destinationChains: Array.from({ length: MAX_ROUTE_CHAINS }, (_, chain) => ({
      chain: new BN(chain),
    })),
  };
}

/** A route as the Anchor coder decodes it from the routes account: absent limits are null. */
function asAccountRoute(route: BridgeRoute) {
  return {
    ...route,
    managementMode: { either: {} },
    destinationChains: route.destinationChains.map((entry) => ({
      chain: entry.chain,
      limits: entry.limits ?? null,
    })),
  };
}

describe("Bridge routes", () => {
  it("a route at the caps, with the heap frame and the account's creation, fits a version 1 transaction", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    accountAtRoutesPda(glamClient, null);
    expect(MAX_ROUTES_PER_SET).toBe(16);
    const route = fullRoute(0);
    const addIx = await bridge.txBuilder.addRouteIx(
      BRIDGE_CCTP_PROTOCOL,
      route,
      glamClient.signer,
    );
    const ixs = await bridge.txBuilder.routeIxs(
      BRIDGE_CCTP_PROTOCOL,
      addIx,
      glamClient.signer,
    );

    // The heap frame first (the compute unit limit is the base client's, from its
    // simulation), the account's creation when it does not exist, then the edit.
    expect(ixs).toHaveLength(3);
    expect(ixs[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true);
    expect(ixs[0].data[0]).toBe(1);
    expect(Buffer.from(ixs[0].data).readUInt32LE(1)).toBe(
      BRIDGE_ROUTES_HEAP_FRAME_BYTES,
    );
    const coder = instructionCoder(glamClient);
    const init = coder.decode(ixs[1].data) as any;
    expect(init.name).toBe("initBridgeRoutes");
    expect(init.data.protocol).toBe(BRIDGE_CCTP_PROTOCOL);
    expect(ixs[1].keys[2].pubkey.toBase58()).toBe(
      bridge.getRoutesPda(BRIDGE_CCTP_PROTOCOL).toBase58(),
    );
    expect(ixs[2]).toBe(addIx);

    const message = compileToV1Message({
      payerKey: glamClient.signer,
      recentBlockhash: BLOCKHASH,
      instructions: ixs,
    });
    const tx = new V1Transaction(message);
    expect(() => assertV1TransactionLimits(tx)).not.toThrow();

    // The coder's bytes are what the program hashes: the argument carries the route's borsh,
    // the element encoding of the set the hash covers.
    const decoded = coder.decode(addIx.data) as any;
    expect(decoded.name).toBe("addBridgeRoute");
    expect(decoded.data.protocol).toBe(BRIDGE_CCTP_PROTOCOL);
    expect(decoded.data.route.destinationChains).toHaveLength(MAX_ROUTE_CHAINS);
    expect(
      addIx.data.subarray(10).equals(encodeBridgeRoutes([route]).subarray(4)),
    ).toBe(true);

    // Once the program's account exists the creation is left out.
    accountAtRoutesPda(glamClient, initializedRoutesAccount(glamClient));
    const again = await bridge.txBuilder.routeIxs(
      BRIDGE_CCTP_PROTOCOL,
      addIx,
      glamClient.signer,
    );
    expect(again).toHaveLength(2);
    expect(again[1]).toBe(addIx);
  });

  it("a funded address is no routes account: the edit still creates it and the reader sees none", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const addIx = await bridge.txBuilder.addRouteIx(
      BRIDGE_CCTP_PROTOCOL,
      fullRoute(0),
      glamClient.signer,
    );
    const creates = async () =>
      (
        await bridge.txBuilder.routeIxs(
          BRIDGE_CCTP_PROTOCOL,
          addIx,
          glamClient.signer,
        )
      ).length === 3;

    // Anyone can send lamports to the derived address: a system-owned account with no data.
    const funded: AccountInfo<Buffer> = {
      owner: SystemProgram.programId,
      lamports: 1_000_000,
      executable: false,
      data: Buffer.alloc(0),
    };
    accountAtRoutesPda(glamClient, funded);
    expect(await bridge.routesAccountInitialized(BRIDGE_CCTP_PROTOCOL)).toBe(
      false,
    );
    expect(await bridge.fetchRoutesAccount(BRIDGE_CCTP_PROTOCOL)).toBeNull();
    expect(await creates()).toBe(true);

    // Another program's account with the right bytes, and the program's account with other bytes.
    const initialized = initializedRoutesAccount(glamClient);
    accountAtRoutesPda(glamClient, {
      ...initialized,
      owner: SystemProgram.programId,
    });
    expect(await bridge.routesAccountInitialized(BRIDGE_CCTP_PROTOCOL)).toBe(
      false,
    );
    expect(await creates()).toBe(true);
    accountAtRoutesPda(glamClient, {
      ...initialized,
      data: Buffer.concat([Buffer.alloc(8, 1), Buffer.alloc(64)]),
    });
    expect(await bridge.routesAccountInitialized(BRIDGE_CCTP_PROTOCOL)).toBe(
      false,
    );
    expect(await creates()).toBe(true);

    // The program's own account is left alone.
    accountAtRoutesPda(glamClient, initialized);
    expect(await bridge.routesAccountInitialized(BRIDGE_CCTP_PROTOCOL)).toBe(
      true,
    );
    expect(await creates()).toBe(false);
  });

  it("the three edits encode what the program decodes, over the same accounts", async () => {
    const glamClient = offlineClient();
    const builder = glamClient.bridge.txBuilder;
    const coder = instructionCoder(glamClient);
    const route = fullRoute(3);
    const addIx = await builder.addRouteIx(
      LAYERZERO_OFT_PROTOCOL,
      route,
      glamClient.signer,
    );

    for (const [name, ix] of [
      ["addBridgeRoute", addIx],
      [
        "updateBridgeRoute",
        await builder.updateRouteIx(
          LAYERZERO_OFT_PROTOCOL,
          route,
          glamClient.signer,
        ),
      ],
    ] as const) {
      const decoded = coder.decode(ix.data) as any;
      expect(decoded.name).toBe(name);
      expect(decoded.data.protocol).toBe(LAYERZERO_OFT_PROTOCOL);
      expect(decoded.data.route.destinationRecipient.toBase58()).toBe(
        route.destinationRecipient.toBase58(),
      );
      expect(decoded.data.route.limits.maxAmount.toString()).toBe(
        route.limits.maxAmount.toString(),
      );
      expect(decoded.data.route.limits.maxCostBps).toBe(
        route.limits.maxCostBps,
      );
      expect(
        decoded.data.route.controls.cctp.destinationCaller.toBase58(),
      ).toBe((route.controls as any).cctp.destinationCaller.toBase58());
      expect(decoded.data.route.destinationChains).toHaveLength(
        MAX_ROUTE_CHAINS,
      );
      expect(ix.keys).toEqual(addIx.keys);
    }

    const removeIx = await builder.removeRouteIx(
      LAYERZERO_OFT_PROTOCOL,
      route,
      glamClient.signer,
    );
    const removed = coder.decode(removeIx.data) as any;
    expect(removed.name).toBe("removeBridgeRoute");
    expect(removed.data.identity.sourceMint.toBase58()).toBe(USDC.toBase58());
    expect(removed.data.identity.destinationRecipient.toBase58()).toBe(
      route.destinationRecipient.toBase58(),
    );
    expect(removed.data.identity.providerProgram.toBase58()).toBe(
      TOKEN_MESSENGER_MINTER_V2.toBase58(),
    );
    expect(removeIx.keys).toEqual(addIx.keys);

    // The pause names the state, the signer and the provider's account, none of them to pay.
    for (const [name, ix] of [
      [
        "pauseBridgeRoutes",
        await builder.pauseRoutesIx(BRIDGE_CCTP_PROTOCOL, glamClient.signer),
      ],
      [
        "unpauseBridgeRoutes",
        await builder.unpauseRoutesIx(BRIDGE_CCTP_PROTOCOL, glamClient.signer),
      ],
    ] as const) {
      const decoded = coder.decode(ix.data) as any;
      expect(decoded.name).toBe(name);
      expect(decoded.data.protocol).toBe(BRIDGE_CCTP_PROTOCOL);
      expect(ix.keys).toHaveLength(3);
      expect(ix.keys[0].pubkey.toBase58()).toBe(glamClient.statePda.toBase58());
      expect(ix.keys[1].isSigner).toBe(true);
      expect(ix.keys[2].pubkey.toBase58()).toBe(
        glamClient.bridge.getRoutesPda(BRIDGE_CCTP_PROTOCOL).toBase58(),
      );
      expect(ix.keys[2].isWritable).toBe(true);
    }
  });

  it("a chain with limits of its own round-trips through the encoder", async () => {
    const glamClient = offlineClient();
    const coder = instructionCoder(glamClient);
    const own = routeLimits(2, 500_000_000, 7);
    // A bare id takes the route's limits, as does an entry whose limits are null.
    const route: BridgeRouteInput = {
      ...fullRoute(0),
      managementMode: { managedOnly: {} },
      destinationChains: [
        0,
        { chain: 6, limits: own },
        { chain: new BN(3), limits: null },
      ],
    };
    const ix = await glamClient.bridge.txBuilder.updateRouteIx(
      BRIDGE_CCTP_PROTOCOL,
      route,
      glamClient.signer,
    );

    const decoded = coder.decode(ix.data) as any;
    expect(decoded.name).toBe("updateBridgeRoute");
    const chains = decoded.data.route.destinationChains;
    expect(chains.map((entry: any) => entry.chain.toNumber())).toEqual([
      0, 6, 3,
    ]);
    expect(chains[0].limits).toBeNull();
    expect(chains[1].limits.minAmount.toString()).toBe("2");
    expect(chains[1].limits.maxAmount.toString()).toBe("500000000");
    expect(chains[1].limits.maxCostBps).toBe(7);
    expect(chains[2].limits).toBeNull();
    expect(decoded.data.route.limits.maxAmount.toString()).toBe(
      fullRoute(0).limits.maxAmount.toString(),
    );
    expect(decoded.data.route.managementMode).toEqual({ managedOnly: {} });

    // The coder encodes what it decoded to the SDK's bytes, the chain limits included.
    expect(
      coder.encode("updateBridgeRoute", decoded.data).equals(ix.data),
    ).toBe(true);
  });

  it("the CCTP send declares the routes account with the vault's accounts, ahead of CCTP's", async () => {
    const glamClient = offlineClient();
    // Capture the instruction instead of building (and simulating) a transaction.
    const built: TransactionInstruction[][] = [];
    (glamClient.bridge.txBuilder as any).buildVersionedTx = jest.fn(
      async (ixs: TransactionInstruction[]) => {
        built.push(ixs);
        return {} as any;
      },
    );
    await glamClient.bridge.buildCctpBridgeUsdcTx({
      amount: new BN(1_000_000),
      domain: 0,
      destinationAddress: Keypair.generate().publicKey,
      maxFee: new BN(100),
      minFinalityThreshold: 2000,
    });
    expect(built).toHaveLength(1);
    // A send asks for no heap frame: it reads only the live set and runs on the default heap.
    expect(built[0]).toHaveLength(1);
    const [ix] = built[0];
    // The 22 declared accounts and nothing appended: the routes account follows the vault's
    // seven, where the IDL names it, and CCTP's sixteen follow in CCTP's order.
    const declared = glamClient.extBridgeProgram.idl.instructions.find(
      (candidate) => candidate.name === "cctpDepositForBurn",
    )!.accounts;
    expect(declared).toHaveLength(22);
    expect(declared[6].name).toBe("systemProgram");
    expect(declared[7].name).toBe("bridgeRoutes");
    expect(declared[8].name).toBe("senderAuthorityPda");
    expect(ix.keys).toHaveLength(22);
    expect(ix.keys[7].pubkey.toBase58()).toBe(
      glamClient.bridge.getRoutesPda(BRIDGE_CCTP_PROTOCOL).toBase58(),
    );
    expect(ix.keys[7].isWritable).toBe(false);
    expect(ix.keys[7].isSigner).toBe(false);
    // The managed burn places it after the registry.
    const managed = glamClient.extBridgeProgram.idl.instructions.find(
      (candidate) => candidate.name === "managedCctpDepositForBurn",
    )!.accounts;
    expect(managed[7].name).toBe("bridgeRegistry");
    expect(managed[8].name).toBe("bridgeRoutes");
  });

  it("the USDT0 OFT send places its accounts where the recorded mainnet send has them, credits writable at index 3", () => {
    const capture = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../../fixtures/transactions/layerzero_oft/5omzqdmCL84JCh8Z75qnFeAdWPtGoaU2v6r3Zwnr6N2mS5rcJ6FXhWALXf5yHvE32gsWkBmoK4nRC4p29kHwbHBP.json",
        ),
        "utf8",
      ),
    );
    const profile = resolveCanonicalLayerzeroOftRouteProfile({
      sourceMint: USDT,
      destinationChain: capture.args.dstEid,
      cluster: ClusterNetwork.Mainnet,
    })!;
    expect(profile).not.toBeNull();
    expect(
      [1, 2, 3, 5, 6, 8, 9].map((index) => capture.accounts[index].address),
    ).toEqual(
      [
        profile.peerConfig,
        profile.providerSender,
        profile.credits,
        profile.tokenEscrow,
        USDT,
        profile.eventAuthority,
        profile.providerProgram,
      ].map((key) => key.toBase58()),
    );
    // Kit roles: 0 readonly, 1 writable, 2 readonly signer, 3 writable signer.
    expect(profile.credits.toBase58()).toBe(capture.credits);
    expect(capture.accounts[3]).toEqual({ address: capture.credits, role: 1 });

    // Given the capture's token source, the builder's ten match the capture past the signer at 0.
    const glamClient = offlineClient();
    const metas: AccountMeta[] = (
      glamClient.bridge as any
    ).buildLayerzeroOftInstructionBaseAccounts({
      routeProfile: profile,
      tokenSource: new PublicKey(capture.tokenSource),
      tokenProgram: TOKEN_PROGRAM_ID,
      payerIsSigner: true,
    });
    expect(metas).toHaveLength(10);
    expect(
      metas.slice(1).map((meta) => ({
        address: meta.pubkey.toBase58(),
        role: (meta.isSigner ? 2 : 0) | (meta.isWritable ? 1 : 0),
      })),
    ).toEqual(capture.accounts.slice(1, 10));
  });

  it("resolves the live, committed and pending sets at their own generations, the tightening and the pause", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const committed = [fullRoute(0), fullRoute(1)];
    const pending = [fullRoute(0), fullRoute(1), fullRoute(2)];
    const tightened = [
      {
        ...fullRoute(0),
        limits: { ...fullRoute(0).limits, maxAmount: new BN(5) },
      },
    ];
    const hashOf = (generation: number, routes: BridgeRoute[]) =>
      routeSetHash(
        glamClient.statePda,
        BRIDGE_CCTP_PROTOCOL,
        generation,
        routes,
      );
    const stored = (generation: number, routes: BridgeRoute[]) => ({
      generation: new BN(generation),
      hash: Array.from(hashOf(generation, routes)),
      len: encodeBridgeRoutes(routes).length,
      routes: routes.map(asAccountRoute),
    });
    // The committed set was the account's first write and the pending set its second.
    const account = (overrides: Record<string, unknown> = {}) => ({
      paused: false,
      generation: new BN(2),
      tightened: null,
      sets: [stored(1, committed), stored(2, pending)],
      ...overrides,
    });
    const stub = (
      routesAccount: unknown,
      liveHash = hashOf(1, committed),
      stagedHash = hashOf(2, pending),
    ) => {
      (bridge as any).fetchRoutesAccount = jest.fn(async () => routesAccount);
      (bridge as any).fetchRoutesCommitment = jest.fn(async () => ({
        hash: liveHash,
      }));
      (bridge as any).fetchStagedRoutesCommitment = jest.fn(async () => ({
        hash: stagedHash,
      }));
      (bridge as any).fetchStagedRoutesClear = jest.fn(async () => false);
    };
    const recipients = (routes: BridgeRoute[] | null) =>
      routes?.map((route) => route.destinationRecipient.toBase58());

    // No tightening: the committed set is live.
    stub(account());
    let sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(recipients(sets.live)).toEqual(recipients(committed));
    expect(recipients(sets.committed)).toEqual(recipients(committed));
    expect(recipients(sets.pending)).toEqual(recipients(pending));
    expect(sets.generation?.toNumber()).toBe(2);
    expect(sets.committedGeneration?.toNumber()).toBe(1);
    expect(sets.pendingGeneration?.toNumber()).toBe(2);
    expect(sets.paused).toBe(false);

    // A tightening of the committed set is what a send uses; the committed set stays visible.
    stub(
      account({
        paused: true,
        tightened: {
          of: Array.from(hashOf(1, committed)),
          len: encodeBridgeRoutes(tightened).length,
          routes: tightened.map(asAccountRoute),
        },
      }),
    );
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(recipients(sets.live)).toEqual(recipients(tightened));
    expect(sets.live![0].limits.maxAmount.toString()).toBe("5");
    expect(recipients(sets.committed)).toEqual(recipients(committed));
    expect(sets.paused).toBe(true);

    // A tightening of the staged set leaves the live routes as committed.
    stub(
      account({
        tightened: {
          of: Array.from(hashOf(2, pending)),
          len: encodeBridgeRoutes(tightened).length,
          routes: tightened.map(asAccountRoute),
        },
      }),
    );
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(recipients(sets.live)).toEqual(recipients(committed));

    // The same routes written twice are two commitments, each resolved at its own generation.
    stub(
      account({ sets: [stored(1, committed), stored(2, committed)] }),
      hashOf(1, committed),
      hashOf(2, committed),
    );
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.liveHash!.equals(sets.pendingHash!)).toBe(false);
    expect(recipients(sets.committed)).toEqual(recipients(committed));
    expect(recipients(sets.pending)).toEqual(recipients(committed));
    expect(sets.committedGeneration?.toNumber()).toBe(1);
    expect(sets.pendingGeneration?.toNumber()).toBe(2);

    // A stored set is rehashed at the generation it records: one whose hash covers another
    // generation is not trusted, so nothing is live.
    stub(
      account({
        sets: [{ ...stored(1, committed), generation: new BN(2) }],
      }),
    );
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.live).toBe(null);
    expect(sets.committed).toBe(null);
    expect(sets.committedGeneration).toBe(null);

    // No account: nothing is live, nothing is paused.
    stub(null);
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.live).toBe(null);
    expect(sets.committed).toBe(null);
    expect(sets.pending).toBe(null);
    expect(sets.generation).toBe(null);
    expect(sets.paused).toBe(false);
  });

  it("resolves the staged set through a tightening cut from it, as the program edits the proposal", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const committed = [fullRoute(0)];
    const pending = [fullRoute(0), fullRoute(1)];
    const tightened = [
      {
        ...fullRoute(1),
        limits: { ...fullRoute(1).limits, maxAmount: new BN(5) },
      },
    ];
    const hashOf = (generation: number, routes: BridgeRoute[]) =>
      routeSetHash(
        glamClient.statePda,
        BRIDGE_CCTP_PROTOCOL,
        generation,
        routes,
      );
    const stored = (generation: number, routes: BridgeRoute[]) => ({
      generation: new BN(generation),
      hash: Array.from(hashOf(generation, routes)),
      len: encodeBridgeRoutes(routes).length,
      routes: routes.map(asAccountRoute),
    });
    // A staged copy of a hash that was live before, with the tightening cut from that copy.
    const stub = (pendingSet: ReturnType<typeof stored>) => {
      (bridge as any).fetchRoutesAccount = jest.fn(async () => ({
        paused: false,
        generation: new BN(2),
        tightened: {
          of: Array.from(hashOf(2, pending)),
          len: encodeBridgeRoutes(tightened).length,
          routes: tightened.map(asAccountRoute),
        },
        sets: [stored(1, committed), pendingSet],
      }));
      (bridge as any).fetchRoutesCommitment = jest.fn(async () => ({
        hash: hashOf(1, committed),
      }));
      (bridge as any).fetchStagedRoutesCommitment = jest.fn(async () => ({
        hash: hashOf(2, pending),
      }));
      (bridge as any).fetchStagedRoutesClear = jest.fn(async () => false);
    };
    const recipients = (routes: BridgeRoute[] | null) =>
      routes?.map((route) => route.destinationRecipient.toBase58());

    stub(stored(2, pending));
    let sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(recipients(sets.live)).toEqual(recipients(committed));
    expect(recipients(sets.pending)).toEqual(recipients(tightened));
    expect(sets.pending![0].limits.maxAmount.toString()).toBe("5");
    expect(sets.pendingHash!.equals(hashOf(2, pending))).toBe(true);
    expect(sets.pendingGeneration?.toNumber()).toBe(2);

    // A staged set that fails its rehash is not trusted, and neither is a tightening of it.
    stub({ ...stored(2, pending), generation: new BN(3) });
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.pending).toBe(null);
    expect(sets.pendingGeneration).toBe(null);
  });

  it("decodes the routes account as the program lays it out, the tightened set ahead of the sets", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const committed = [fullRoute(0)];
    const pending = [
      {
        ...fullRoute(1),
        destinationChains: [
          { chain: new BN(0) },
          { chain: new BN(6), limits: routeLimits(2, 500_000_000, 7) },
        ],
      },
    ];
    const tightened = [{ ...fullRoute(0), limits: routeLimits(1, 5, 100) }];
    const hashOf = (generation: number, routes: BridgeRoute[]) =>
      routeSetHash(
        glamClient.statePda,
        BRIDGE_CCTP_PROTOCOL,
        generation,
        routes,
      );
    const le = (value: number, bytes: number) =>
      new BN(value).toArrayLike(Buffer, "le", bytes);
    // A set's routes framed by their byte length.
    const framed = (routes: BridgeRoute[]) => {
      const bytes = encodeBridgeRoutes(routes);
      return Buffer.concat([le(bytes.length, 4), bytes]);
    };
    const discriminator = glamClient.extBridgeProgram.idl.accounts.find(
      (candidate) => candidate.name === "bridgeRoutes",
    )!.discriminator;
    // The header (vault, bit, bump, paused, generation), the tightened set, then the sets: the
    // committed set written first, the pending set second.
    const data = Buffer.concat([
      Buffer.from(discriminator),
      glamClient.statePda.toBuffer(),
      le(BRIDGE_CCTP_PROTOCOL, 2),
      Buffer.from([255, 1]),
      le(2, 8),
      Buffer.from([1]),
      hashOf(1, committed),
      framed(tightened),
      le(2, 4),
      le(1, 8),
      hashOf(1, committed),
      framed(committed),
      le(2, 8),
      hashOf(2, pending),
      framed(pending),
    ]);
    const account = glamClient.extBridgeProgram.coder.accounts.decode(
      "bridgeRoutes",
      data,
    );
    (bridge as any).fetchRoutesAccount = jest.fn(async () => account);
    (bridge as any).fetchRoutesCommitment = jest.fn(async () => ({
      hash: hashOf(1, committed),
    }));
    (bridge as any).fetchStagedRoutesCommitment = jest.fn(async () => ({
      hash: hashOf(2, pending),
    }));
    (bridge as any).fetchStagedRoutesClear = jest.fn(async () => false);

    const sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.paused).toBe(true);
    expect(sets.generation?.toNumber()).toBe(2);
    expect(sets.committedGeneration?.toNumber()).toBe(1);
    expect(sets.pendingGeneration?.toNumber()).toBe(2);
    expect(sets.live![0].limits.maxAmount.toNumber()).toBe(5);
    expect(sets.committed![0].limits.maxAmount.toString()).toBe(
      fullRoute(0).limits.maxAmount.toString(),
    );
    // A chain without limits of its own decodes as null, one with them as the SDK's type, and
    // both encode back to the stored bytes.
    expect(sets.pending![0].destinationChains[0].limits).toBeNull();
    expect(sets.pending![0].destinationChains[1].limits?.maxCostBps).toBe(7);
    expect(
      encodeBridgeRoutes(sets.pending!).equals(encodeBridgeRoutes(pending)),
    ).toBe(true);
  });

  it("reads a staged commitment out of the state's staged integration ACLs", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const extBridge = getExtBridgeProgramId(false);
    // The same routes written again: a proposal of its own, not the live hash.
    const live = routeSetHash(glamClient.statePda, LAYERZERO_OFT_PROTOCOL, 1, [
      fullRoute(0),
    ]);
    const staged = routeSetHash(
      glamClient.statePda,
      LAYERZERO_OFT_PROTOCOL,
      2,
      [fullRoute(0)],
    );
    const acl = (hash: Buffer) => ({
      integrationProgram: extBridge,
      protocolsBitmask: LAYERZERO_OFT_PROTOCOL,
      protocolPolicies: [
        { protocolBitflag: LAYERZERO_OFT_PROTOCOL, data: hash },
      ],
    });
    // params[2] is the staged state update: an EngineField list whose
    // integrationAcls entry carries the copy glam_protocol stages.
    const state = {
      integrationAcls: [acl(live)],
      params: [
        [],
        [],
        [
          {
            name: { integrationAcls: {} },
            value: { vecIntegrationAcl: { val: [acl(staged)] } },
          },
        ],
        [],
      ],
    };
    (glamClient as any).fetchStateAccount = jest.fn(async () => state);
    (glamClient as any).fetchProtocolPolicy = jest.fn(
      async (_program: PublicKey, _protocol: number, decoder: any) =>
        decoder.decode(live),
    );

    const stagedCommitment = await bridge.fetchStagedRoutesCommitment(
      LAYERZERO_OFT_PROTOCOL,
    );
    expect(stagedCommitment?.hash.equals(staged)).toBe(true);
    expect(await bridge.fetchStagedRoutesCommitment(BRIDGE_CCTP_PROTOCOL)).toBe(
      null,
    );

    // Without a staged change the pending set is absent.
    (glamClient as any).fetchStateAccount = jest.fn(async () => ({
      ...state,
      params: [[], [], [], []],
    }));
    expect(
      await bridge.fetchStagedRoutesCommitment(LAYERZERO_OFT_PROTOCOL),
    ).toBe(null);

    // A staged list that still names the live hash is glam_protocol's copy of the list (any
    // staged policy stages the whole list), not a proposal for this provider.
    (glamClient as any).fetchStateAccount = jest.fn(async () => ({
      ...state,
      params: [
        [],
        [],
        [
          {
            name: { integrationAcls: {} },
            value: { vecIntegrationAcl: { val: [acl(live)] } },
          },
        ],
        [],
      ],
    }));
    expect(
      await bridge.fetchStagedRoutesCommitment(LAYERZERO_OFT_PROTOCOL),
    ).toBe(null);

    // A live policy of another length is no commitment, as the program reads it.
    (glamClient as any).fetchProtocolPolicy = jest.fn(async () => {
      throw new Error("A route set commitment is 32 bytes, got 40");
    });
    expect(await bridge.fetchRoutesCommitment(LAYERZERO_OFT_PROTOCOL)).toBe(
      null,
    );
  });

  it("reads a staged list that holds no commitment for a provider, which the route sets report while a live one exists", async () => {
    const glamClient = offlineClient();
    const bridge: BridgeClient = glamClient.bridge;
    const extBridge = getExtBridgeProgramId(false);
    const committed = [fullRoute(0)];
    const live = routeSetHash(
      glamClient.statePda,
      BRIDGE_CCTP_PROTOCOL,
      1,
      committed,
    );
    const oft = routeSetHash(glamClient.statePda, LAYERZERO_OFT_PROTOCOL, 1, [
      fullRoute(1),
    ]);
    const policy = (protocolBitflag: number, data: Buffer) => ({
      protocolBitflag,
      data,
    });
    const acl = (...protocolPolicies: ReturnType<typeof policy>[]) => ({
      integrationProgram: extBridge,
      protocolsBitmask: BRIDGE_CCTP_PROTOCOL | LAYERZERO_OFT_PROTOCOL,
      protocolPolicies,
    });
    const bothCommitted = acl(
      policy(BRIDGE_CCTP_PROTOCOL, live),
      policy(LAYERZERO_OFT_PROTOCOL, oft),
    );
    const oftOnly = acl(policy(LAYERZERO_OFT_PROTOCOL, oft));
    // The live list, and the list params[2] stages, or no staged list when null.
    const stub = (
      staged: unknown[] | null,
      liveAcls: unknown[] = [bothCommitted],
    ) => {
      (glamClient as any).fetchStateAccount = jest.fn(async () => ({
        integrationAcls: liveAcls,
        params: [
          [],
          [],
          staged === null
            ? []
            : [
                {
                  name: { integrationAcls: {} },
                  value: { vecIntegrationAcl: { val: staged } },
                },
              ],
          [],
        ],
      }));
    };

    // A cleared policy is gone from the staged copy of the list; the other bit keeps its own.
    stub([oftOnly]);
    expect(await bridge.fetchStagedRoutesClear(BRIDGE_CCTP_PROTOCOL)).toBe(
      true,
    );
    expect(await bridge.fetchStagedRoutesClear(LAYERZERO_OFT_PROTOCOL)).toBe(
      false,
    );

    // An emptied policy, and a staged list without ext_bridge's entry, hold no commitment.
    stub([acl(policy(BRIDGE_CCTP_PROTOCOL, Buffer.alloc(0)))]);
    expect(await bridge.fetchStagedRoutesClear(BRIDGE_CCTP_PROTOCOL)).toBe(
      true,
    );
    stub([{ ...bothCommitted, integrationProgram: PublicKey.unique() }]);
    expect(await bridge.fetchStagedRoutesClear(BRIDGE_CCTP_PROTOCOL)).toBe(
      true,
    );

    // A staged copy that keeps the commitment, and no staged list, clear nothing.
    stub([bothCommitted]);
    expect(await bridge.fetchStagedRoutesClear(BRIDGE_CCTP_PROTOCOL)).toBe(
      false,
    );
    stub(null);
    expect(await bridge.fetchStagedRoutesClear(BRIDGE_CCTP_PROTOCOL)).toBe(
      false,
    );

    // The route sets report the clear beside the live routes it stops, with no staged hash.
    (bridge as any).fetchRoutesAccount = jest.fn(async () => ({
      paused: false,
      generation: new BN(1),
      tightened: null,
      sets: [
        {
          generation: new BN(1),
          hash: Array.from(live),
          len: encodeBridgeRoutes(committed).length,
          routes: committed.map(asAccountRoute),
        },
      ],
    }));
    stub([oftOnly]);
    let sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.pendingCleared).toBe(true);
    expect(sets.pendingHash).toBe(null);
    expect(sets.pending).toBe(null);
    expect(
      sets.live?.map((route) => route.destinationRecipient.toBase58()),
    ).toEqual([fullRoute(0).destinationRecipient.toBase58()]);

    stub([bothCommitted]);
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.pendingCleared).toBe(false);

    // Without a live commitment the staged list stops no send.
    stub([oftOnly], [oftOnly]);
    sets = await bridge.fetchRouteSets(BRIDGE_CCTP_PROTOCOL);
    expect(sets.liveHash).toBe(null);
    expect(sets.pendingCleared).toBe(false);
  });
});

describe("Bridge route-set hash", () => {
  // The vector ext_bridge's native test pins (state/route/tests.rs, `hash_vector`): the same two
  // routes, the same vault, the CCTP bit, generation 3.
  const glamState = new PublicKey(Buffer.alloc(32, 1));
  const cctp = new PublicKey("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
  const generation = 3;
  const routes: BridgeRoute[] = [
    {
      sourceMint: new PublicKey(Buffer.alloc(32, 2)),
      destinationRecipient: new PublicKey(Buffer.alloc(32, 3)),
      providerProgram: cctp,
      managementMode: RouteManagementMode.Either,
      limits: routeLimits(1, 1_000_000_000, 10),
      controls: {
        cctp: {
          destinationCaller: PublicKey.default,
          minFinalityThreshold: 2000,
        },
      },
      destinationChains: [
        { chain: new BN(0) },
        { chain: new BN(6), limits: routeLimits(2, 500_000_000, 7) },
      ],
    },
    {
      sourceMint: new PublicKey(Buffer.alloc(32, 2)),
      destinationRecipient: new PublicKey(Buffer.alloc(32, 4)),
      providerProgram: cctp,
      managementMode: RouteManagementMode.ManagedOnly,
      limits: routeLimits(5, 6, 100),
      controls: {
        cctp: {
          destinationCaller: new PublicKey(Buffer.alloc(32, 5)),
          minFinalityThreshold: 1000,
        },
      },
      destinationChains: [{ chain: new BN(3) }],
    },
  ];

  it("hashes a route set exactly as the program does", () => {
    const hash = routeSetHash(
      glamState,
      BRIDGE_CCTP_PROTOCOL,
      generation,
      routes,
    );
    expect(hash.toString("hex")).toBe(
      "2d74da018e38c0e87473e054c28c917a26aea93441a17b293cd01e156f604f61",
    );
    // The generation as the account decodes it, a BN, is the same preimage.
    expect(
      routeSetHash(
        glamState,
        BRIDGE_CCTP_PROTOCOL,
        new BN(generation),
        routes,
      ).equals(hash),
    ).toBe(true);
    expect(
      routeSetHash(
        glamState,
        LAYERZERO_OFT_PROTOCOL,
        generation,
        routes,
      ).equals(hash),
    ).toBe(false);
  });

  it("hashes the same routes under another generation as another commitment", () => {
    const hash = routeSetHash(
      glamState,
      BRIDGE_CCTP_PROTOCOL,
      generation,
      routes,
    );
    expect(
      routeSetHash(
        glamState,
        BRIDGE_CCTP_PROTOCOL,
        generation + 1,
        routes,
      ).equals(hash),
    ).toBe(false);
  });

  it("encodes the route layout the program reads", () => {
    const encoded = encodeBridgeRoutes(routes);
    // 4 (len) + route 0 (32 * 3 + 1 + 18 + 37 + 4 + 9 + 27) + route 1 (... + 4 + 9).
    expect(encoded.length).toBe(4 + 192 + 165);
    expect(encoded.readUInt32LE(0)).toBe(2);
    expect(
      encoded.subarray(4, 36).equals(routes[0].sourceMint.toBuffer()),
    ).toBe(true);
    // The management mode byte follows the three keys, and the route's limits follow it.
    expect(encoded[4 + 96]).toBe(RouteManagementMode.Either);
    expect(encoded.readBigUInt64LE(4 + 97)).toBe(1n);
    expect(encoded.readBigUInt64LE(4 + 105)).toBe(1_000_000_000n);
    expect(encoded.readUInt16LE(4 + 113)).toBe(10);
    // The controls variant byte follows the limits.
    expect(encoded[4 + 96 + 1 + 18]).toBe(0);
    // Then the chains: chain 0 without limits of its own (tag 0), chain 6 with them (tag 1,
    // then the minimum, the maximum and the cost bound).
    const chains = 4 + 96 + 1 + 18 + 37;
    expect(encoded.readUInt32LE(chains)).toBe(2);
    expect(encoded.readBigUInt64LE(chains + 4)).toBe(0n);
    expect(encoded[chains + 12]).toBe(0);
    expect(encoded.readBigUInt64LE(chains + 13)).toBe(6n);
    expect(encoded[chains + 21]).toBe(1);
    expect(encoded.readBigUInt64LE(chains + 22)).toBe(2n);
    expect(encoded.readBigUInt64LE(chains + 30)).toBe(500_000_000n);
    expect(encoded.readUInt16LE(chains + 38)).toBe(7);
    // Route 1 starts where route 0's last chain ends.
    expect(
      encoded
        .subarray(chains + 40, chains + 72)
        .equals(routes[1].sourceMint.toBuffer()),
    ).toBe(true);
  });

  it("round-trips a commitment", () => {
    const hash = routeSetHash(
      glamState,
      BRIDGE_CCTP_PROTOCOL,
      generation,
      routes,
    );
    const commitment = RouteSetCommitment.decode(hash);
    expect(commitment.encode().equals(hash)).toBe(true);
    expect(commitment.hex).toBe(hash.toString("hex"));
    expect(() => RouteSetCommitment.decode(Buffer.alloc(31))).toThrow();
  });
});
