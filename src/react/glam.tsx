"use client";

import { AnchorProvider, BN } from "@coral-xyz/anchor";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { atomWithStorage } from "jotai/utils";

import type { DelegateAcl, StateModel, IntegrationAcl } from "../models";
import { GlamClient } from "../client";
import { useAtomValue, useSetAtom } from "jotai";
import { PublicKey } from "@solana/web3.js";
import { DriftMarketConfigs } from "../client/drift";
import { TokenAccount } from "../client/base";
import { useCluster } from "./cluster-provider";
import { JupiterApiClient, JupTokenList } from "../utils/jupiterApi";
import { ClusterNetwork } from "../clientConfig";
import { VaultHoldings } from "../client/price";
import { DriftUser } from "../deser";

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
  driftMarketConfigs?: DriftMarketConfigs;
  setActiveGlamState: (f: GlamStateCache) => void;
  refresh: () => Promise<void>; // refresh active glam vault from onchain data
  refetchGlamStates: () => Promise<void>;
}

export interface Vault {
  pubkey: PublicKey;
  balanceLamports: number; // TODO: this should be a BN or string, it works until ~9M SOL
  uiAmount: number;
  tokenAccounts: TokenAccount[];
  driftUsers?: DriftUser[];
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

  const [delegateAcls, setDelegateAcls] = useState([] as DelegateAcl[]);
  const [integrationAcls, setIntegrationAcls] = useState(
    [] as IntegrationAcl[],
  );
  const [vault, setVault] = useState({} as Vault);
  const [vaultHoldings, setVaultHoldings] = useState<VaultHoldings | undefined>(
    undefined,
  );
  const wallet = useWallet();
  const { connection } = useConnection();
  const { cluster } = useCluster();

  const [allGlamStates, setAllGlamStates] = useState([] as StateModel[]);

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
  }, [connection, wallet, cluster, activeGlamState]);

  //
  // Fetch all glam states
  //
  const refreshVaultHoldings = async () => {
    if (activeGlamState?.pubkey && wallet?.publicKey) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "fetching vault data for active glam state:",
          activeGlamState.address,
        );
      }

      // Note: We fetch both datasets in parallel:
      // - getVaultHoldings: Comprehensive holdings with pricing
      // - getSolAndTokenBalances: Basic token accounts
      // While there's some overlap, both are needed for backward compatibility until all forms are migrated to use vaultHoldings
      const [balances, holdings] = await Promise.all([
        glamClient.getSolAndTokenBalances(glamClient.vaultPda),
        glamClient.price.getVaultHoldings("confirmed").catch((err) => {
          console.warn("Failed to fetch vault holdings:", err);
          return undefined;
        }),
      ]);

      setVault((prev) => ({
        ...prev,
        ...balances,
        pubkey: glamClient.vaultPda,
      }));

      if (holdings) {
        setVaultHoldings(holdings);
      }
    }
  };

  const { data: glamStateModels, refetch: refetchGlamStates } = useQuery({
    queryKey: ["/all-glam-states", activeGlamState?.pubkey, cluster.network],
    queryFn: () => glamClient.fetchGlamStates(),
  });
  useEffect(() => {
    if (!glamStateModels || !wallet?.publicKey) return;

    if (process.env.NODE_ENV === "development") {
      console.log(`[${cluster.network}] all glam states:`, glamStateModels);
    }

    setAllGlamStates(glamStateModels);

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

    refreshVaultHoldings();
  }, [glamStateModels, wallet, cluster]);

  const refreshVaultAcls = async () => {
    try {
      const glamState = await glamClient.fetchStateAccount();
      setDelegateAcls(glamState.delegateAcls || []);
      setIntegrationAcls(glamState.integrationAcls || []);
    } catch (error) {
      setDelegateAcls([]);
      setIntegrationAcls([]);
    }
  };

  useEffect(() => {
    if (activeGlamState?.pubkey) {
      refreshVaultAcls();
    }
  }, [activeGlamState]);

  //
  // Fetch token list from jupiter api. The returned data includes token metadata (e.g., name, symbol, decimals, logoURI, etc.) and token prices.
  //
  const { data: jupTokenList } = useQuery({
    queryKey: ["jupiter-tokens-list"],
    enabled: cluster.network === ClusterNetwork.Mainnet,
    queryFn: () => new JupiterApiClient().fetchTokensList(true),
    staleTime: 1000 * 30, // 30 seconds
  });

  //
  // Fetch drift market configs
  //
  const { data: driftMarketConfigs } = useQuery({
    queryKey: ["drift-market-configs"],
    enabled: cluster.network === ClusterNetwork.Mainnet,
    queryFn: () => glamClient.drift.fetchMarketConfigs(),
    staleTime: 1000 * 60, // 60 seconds
  });

  //
  // Fetch drift users
  //
  const {
    data: driftUsersData,
    error: driftUsersError,
    refetch: refetchDriftUser,
  } = useQuery({
    queryKey: ["drift-users", activeGlamState?.pubkey],
    enabled:
      !!activeGlamState?.pubkey && cluster.network === ClusterNetwork.Mainnet,
    queryFn: () => glamClient.drift.fetchAndParseDriftUsers(),
    refetchInterval: 30 * 1000, // 30 seconds
  });
  useEffect(() => {
    if (!driftUsersError && driftUsersData) {
      setVault((prev) => ({
        ...prev,
        driftUsers: driftUsersData,
      }));
    }
  }, [driftUsersData, driftUsersError]);

  const value: GlamProviderContext = {
    glamClient,
    vault,
    vaultHoldings,
    activeGlamState,
    glamStatesList: useAtomValue(glamStatesListAtom),
    delegateAcls,
    integrationAcls,
    allGlamStates,
    jupTokenList,
    driftMarketConfigs,
    setActiveGlamState,
    refresh: async () => {
      refreshVaultHoldings();
      refreshVaultAcls();
      refetchDriftUser();
    },
    refetchGlamStates: async () => {
      refetchGlamStates();
    },
  };

  return <GlamContext.Provider value={value}>{children}</GlamContext.Provider>;
}

export const useGlam = () => useContext(GlamContext);
