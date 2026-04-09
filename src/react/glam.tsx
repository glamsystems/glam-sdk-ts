"use client";

import { AnchorProvider, BN } from "@coral-xyz/anchor";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { atomWithStorage } from "jotai/utils";

import type { DelegateAcl, StateModel, IntegrationAcl } from "../models";
import { GlamClient } from "../client";
import { useAtomValue, useSetAtom } from "jotai";
import { PublicKey } from "@solana/web3.js";
import { TokenAccount } from "../client/base";
import { useCluster } from "./cluster-provider";
import { JupiterApiClient, JupTokenList } from "../utils/jupiterApi";
import { ClusterNetwork } from "../clientConfig";
import { VaultHoldings } from "../client/price";
import { queryKeys } from "./query-keys";
import { useVaultBalanceSubscription } from "./useVaultBalanceSubscription";

declare global {
  interface Window {
    glam: GlamClient;
    PublicKey: any;
    BN: any;
  }
}

interface GlamProviderContext {
  glamClient: GlamClient;
  vault: Vault;
  vaultHoldings?: VaultHoldings;
  activeGlamState?: GlamStateCache;
  glamStatesList: GlamStateCache[];
  delegateAcls: DelegateAcl[];
  integrationAcls: IntegrationAcl[];
  allGlamStates: StateModel[];
  jupTokenList?: JupTokenList;
  wsConnected: boolean;
  setActiveGlamState: (f: GlamStateCache) => void;
  refresh: () => Promise<void>; // refresh active glam vault from onchain data
  refetchGlamStates: () => Promise<void>;
}

export interface Vault {
  pubkey: PublicKey;
  balanceLamports: number; // TODO: this should be a BN or string, it works until ~9M SOL
  uiAmount: number;
  tokenAccounts: TokenAccount[];
}

interface GlamStateCache {
  address: string;
  pubkey: PublicKey;
  owner: PublicKey;
  sparkleKey: string;
  name: string;
  product: "Mint" | "Vault" | "TokenizedVault" | "SingleAssetVault";
}

const GlamContext = createContext<GlamProviderContext>(
  {} as GlamProviderContext,
);

const activeGlamStateAtom = atomWithStorage<GlamStateCache>(
  "active-glam-state",
  {} as GlamStateCache,
);
const glamStatesListAtom = atomWithStorage<GlamStateCache[]>(
  "glam-states-list",
  [] as GlamStateCache[],
);

// In order to properly deser states, we need to
// convert string -> pubkey (and maybe more in future)
const deserializeGlamStateCache = (s: any) => {
  if (!s) {
    return undefined;
  }
  if (typeof s.pubkey === "string") {
    s.address = s.pubkey;
    s.pubkey = new PublicKey(s.pubkey);
  }
  if (typeof s.owner === "string") {
    s.owner = new PublicKey(s.owner);
  }
  return s as GlamStateCache;
};

const toStateCache = (s: StateModel) => {
  return {
    pubkey: s.id,
    owner: s.owner,
    sparkleKey: s.sparkleKey,
    address: s.idStr,
    name: s.nameStr,
    product: s.productType,
  } as GlamStateCache;
};

export function GlamProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const setActiveGlamState = useSetAtom(activeGlamStateAtom);
  const setGlamStatesList = useSetAtom(glamStatesListAtom);

  const wallet = useWallet();
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const queryClient = useQueryClient();

  const activeGlamState = deserializeGlamStateCache(
    useAtomValue(activeGlamStateAtom),
  ) as GlamStateCache;

  const glamClient = useMemo(() => {
    const glamClient = new GlamClient({
      provider: new AnchorProvider(connection, wallet as AnchorWallet, {
        commitment: "confirmed",
      }),
      cluster: cluster.network,
      statePda: activeGlamState?.pubkey,
    });
    if (typeof window !== "undefined") {
      window.glam = glamClient;
      window.PublicKey = PublicKey;
      window.BN = BN;
    }
    return glamClient;
  }, [connection, wallet?.publicKey, cluster, activeGlamState?.pubkey]);

  const pk = activeGlamState?.pubkey?.toBase58() ?? "";
  const [wsConnected, setWsConnected] = useState(false);

  //
  // Fetch all glam states
  //
  const { data: glamStateModels, refetch: refetchGlamStates } = useQuery({
    queryKey: queryKeys.global.allStates(cluster.network ?? ""),
    queryFn: () => glamClient.fetchGlamStates(),
  });
  useEffect(() => {
    if (!glamStateModels || !wallet?.publicKey) return;

    if (process.env.NODE_ENV === "development") {
      console.log(`[${cluster.network}] all glam states:`, glamStateModels);
    }

    // Find a list of glam states that the wallet has access to
    const glamStatesList = [] as GlamStateCache[];
    glamStateModels.forEach((s: StateModel) => {
      const isOwner = s.owner && wallet?.publicKey?.equals(s.owner);
      const isDelegate = (s.delegateAcls || []).some((acl) =>
        wallet?.publicKey?.equals(acl.pubkey),
      );
      if (isOwner || isDelegate) {
        glamStatesList.push(toStateCache(s));
      }
    });
    setGlamStatesList(glamStatesList);

    if (glamStatesList.length > 0) {
      // If no active glam state, or the cached active glam state is not in the list, set the first one
      if (
        !activeGlamState ||
        !glamStatesList.find(
          (state) =>
            state.pubkey &&
            activeGlamState.pubkey &&
            state.pubkey.equals(activeGlamState.pubkey),
        )
      ) {
        setActiveGlamState(glamStatesList[0]);
      }
    } else {
      setActiveGlamState({} as GlamStateCache);
    }
  }, [glamStateModels, wallet?.publicKey, cluster]);

  //
  // Vault balances (SOL + token accounts)
  //
  const clusterKey = cluster.network ?? "";

  const { data: vaultBalancesData } = useQuery({
    queryKey: queryKeys.vault.balances(pk, clusterKey),
    queryFn: () => glamClient.getSolAndTokenBalances(glamClient.vaultPda),
    enabled: !!activeGlamState?.pubkey && !!wallet?.publicKey,
    refetchInterval: wsConnected ? 60_000 : 30_000,
  });

  //
  // Vault holdings (priced positions)
  //
  const { data: vaultHoldings } = useQuery({
    queryKey: queryKeys.vault.holdings(pk, clusterKey),
    queryFn: () =>
      glamClient.price.getVaultHoldings("confirmed").catch((err) => {
        console.warn("Failed to fetch vault holdings:", err);
        return undefined;
      }),
    enabled: !!activeGlamState?.pubkey && !!wallet?.publicKey,
  });

  //
  // WebSocket subscriptions for vault balance changes.
  // When WS is connected, balance query stops polling (refetchInterval: 0).
  // When WS is unavailable, balance query polls every 30s as fallback.
  //
  useVaultBalanceSubscription({
    connection,
    queryClient,
    vaultPda: activeGlamState?.pubkey ? glamClient.vaultPda : undefined,
    pk,
    cluster: clusterKey,
    tokenAccounts: vaultBalancesData?.tokenAccounts ?? [],
    enabled: !!activeGlamState?.pubkey && !!wallet?.publicKey,
    onWsStatusChange: setWsConnected,
  });

  //
  // Vault ACLs (delegates + integrations)
  //
  const { data: vaultAclsData } = useQuery({
    queryKey: queryKeys.vault.acls(pk, clusterKey),
    queryFn: async () => {
      const glamState = await glamClient.fetchStateAccount();
      return {
        delegateAcls: glamState.delegateAcls || [],
        integrationAcls: glamState.integrationAcls || [],
      };
    },
    enabled: !!activeGlamState?.pubkey,
  });

  //
  // Fetch token list from jupiter api. The returned data includes token metadata (e.g., name, symbol, decimals, logoURI, etc.) and token prices.
  //
  const { data: jupTokenList } = useQuery({
    queryKey: queryKeys.global.jupTokens(clusterKey),
    enabled: cluster.network === ClusterNetwork.Mainnet,
    queryFn: () => new JupiterApiClient().fetchTokensList(true),
    staleTime: 1000 * 30, // 30 seconds
  });

  // Compose vault object from query data.
  // Guard glamClient.vaultPda — the getter throws if statePda is not set
  const vault = useMemo<Vault>(
    () =>
      ({
        ...(vaultBalancesData ?? ({} as Vault)),
        ...(activeGlamState?.pubkey ? { pubkey: glamClient.vaultPda } : {}),
      }) as Vault,
    [vaultBalancesData, activeGlamState?.pubkey, glamClient],
  );

  const delegateAcls = vaultAclsData?.delegateAcls ?? [];
  const integrationAcls = vaultAclsData?.integrationAcls ?? [];
  const allGlamStates = glamStateModels ?? [];

  const glamStatesList = useAtomValue(glamStatesListAtom);

  // Invalidates all vault-scoped queries (["vault", pk, ...] prefix match),
  // triggering background refetches for balances, holdings, and ACLs.
  const refresh = useCallback(async () => {
    if (!pk) return;

    // Clear stale vault graph cache when not viewing studio,
    // so navigating to studio shows fresh data instead of a stale→fresh transition.
    const vaultGraphKey = queryKeys.vaultGraph.vault(pk, clusterKey);
    const vaultGraphQuery = queryClient
      .getQueryCache()
      .find({ queryKey: vaultGraphKey, exact: true });
    if (vaultGraphQuery && vaultGraphQuery.getObserversCount() === 0) {
      queryClient.removeQueries({ queryKey: vaultGraphKey, exact: true });
    } else {
      queryClient.invalidateQueries({ queryKey: vaultGraphKey });
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.vault.all(pk, clusterKey),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.global.allStates(clusterKey),
      }),
    ]);
  }, [queryClient, pk, clusterKey]);

  const stableRefetchGlamStates = useCallback(async () => {
    refetchGlamStates();
  }, [refetchGlamStates]);

  const value = useMemo<GlamProviderContext>(
    () => ({
      glamClient,
      vault,
      vaultHoldings,
      activeGlamState,
      glamStatesList,
      delegateAcls,
      integrationAcls,
      allGlamStates,
      jupTokenList,
      wsConnected,
      setActiveGlamState,
      refresh,
      refetchGlamStates: stableRefetchGlamStates,
    }),
    [
      glamClient,
      vault,
      vaultHoldings,
      activeGlamState,
      glamStatesList,
      delegateAcls,
      integrationAcls,
      allGlamStates,
      jupTokenList,
      wsConnected,
      setActiveGlamState,
      refresh,
      stableRefetchGlamStates,
    ],
  );

  return <GlamContext.Provider value={value}>{children}</GlamContext.Provider>;
}

export const useGlam = () => useContext(GlamContext);
