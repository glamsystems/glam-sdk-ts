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
import { useAtomValue, useSetAtom } from "jotai/react";
import { PublicKey } from "@solana/web3.js";
import { WSOL } from "../constants";
import { DriftMarketConfigs } from "../client/drift";
import { TokenAccount } from "../client/base";
import { useCluster } from "./cluster-provider";
import {
  TokenListItem,
  TokenPrice,
  JupiterApiClient,
} from "../utils/jupiterApi";
import { DriftUser } from "../deser";
import { ClusterNetwork } from "../clientConfig";

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
  activeGlamState?: GlamStateCache;
  glamStatesList: GlamStateCache[];
  delegateAcls: DelegateAcl[];
  integrationAcls: IntegrationAcl[];
  allGlamStates: StateModel[];
  prices: TokenPrice[];
  jupTokenList: TokenListItem[];
  driftMarketConfigs?: DriftMarketConfigs;
  setActiveGlamState: (f: GlamStateCache) => void;
  refresh: () => Promise<void>; // refresh active glam state
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
  product: "Mint" | "Vault" | "TokenizedVault";
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
  console.log("toStateCache", s);
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
      console.log(
        "fetching vault data for active glam state:",
        activeGlamState.address,
      );
      const balances = await glamClient.getSolAndTokenBalances(
        glamClient.vaultPda,
      );
      setVault((prevVault) => ({
        ...prevVault,
        ...balances,
        pubkey: glamClient.vaultPda,
      }));
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
      if (s.owner && wallet?.publicKey?.equals(s.owner)) {
        const stateCache = toStateCache(s);
        glamStatesList.push(stateCache);
      } else {
        (s.delegateAcls || []).forEach((acl) => {
          if (wallet?.publicKey?.equals(acl.pubkey)) {
            glamStatesList.push(toStateCache(s));
          }
        });
      }
    });
    setGlamStatesList(glamStatesList);

    if (glamStatesList.length > 0) {
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

  const refreshDelegateAcls = async () => {
    if (activeGlamState?.pubkey) {
      try {
        const glamState = await glamClient.fetchStateModel();
        console.log(
          `${activeGlamState.address} delegate acls:`,
          glamState.delegateAcls,
        );
        setDelegateAcls(glamState.delegateAcls || []);
      } catch (error) {
        setDelegateAcls([]);
      }
    }
  };

  const refreshIntegrationAcls = async () => {
    if (activeGlamState?.pubkey) {
      try {
        const glamState = await glamClient.fetchStateModel();
        console.log(
          `${activeGlamState.address} integration acls:`,
          glamState.integrationAcls,
        );
        setIntegrationAcls(glamState.integrationAcls || []);
      } catch (error) {
        setIntegrationAcls([]);
      }
    }
  };

  useEffect(() => {
    refreshDelegateAcls();
    refreshIntegrationAcls();
  }, [activeGlamState]);

  //
  // Fetch token list from jupiter api
  //
  const { data: jupTokenList } = useQuery({
    queryKey: ["jupiter-tokens-list"],
    queryFn: () => new JupiterApiClient().fetchTokensList(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  //
  // Fetch drift market configs
  //
  const { data: driftMarketConfigs } = useQuery({
    queryKey: ["drift-market-configs"],
    enabled: cluster.network === ClusterNetwork.Mainnet,
    queryFn: () => glamClient.drift.fetchMarketConfigs(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  //
  // Fetch drift user
  //
  const {
    data: driftUsersData,
    error: driftUsersError,
    refetch: refetchDriftUser,
  } = useQuery({
    queryKey: ["/drift-users", activeGlamState?.pubkey],
    enabled:
      !!activeGlamState?.pubkey && cluster.network === ClusterNetwork.Mainnet,
    refetchInterval: 30 * 1000,
    queryFn: () => glamClient.drift.fetchAndParseDriftUsers(),
  });
  useEffect(() => {
    if (!driftUsersError && driftUsersData) {
      setVault((prevVault) => ({
        ...prevVault,
        driftUsers: driftUsersData,
      }));
    }
  }, [driftUsersData, driftUsersError]);

  //
  // Fetch token prices
  //
  const { data: tokenPrices } = useQuery({
    queryKey: ["/jup-token-prices", vault?.pubkey],
    enabled: cluster.network === ClusterNetwork.Mainnet && !!driftMarketConfigs,
    refetchInterval: 30_000,
    queryFn: () => {
      const tokenMints = new Set<string>([WSOL.toBase58()]); // Always add wSOL feed so that we can price SOL

      // Token accounts owned by the vault
      (vault.tokenAccounts || []).forEach((ta: TokenAccount) => {
        tokenMints.add(ta.mint.toBase58());
      });

      // Collect spot positions from all drift users
      (vault?.driftUsers || [])
        .map((user) => user.spotPositions)
        .flat()
        .forEach((position) => {
          const marketConfig = driftMarketConfigs?.spotMarkets.find(
            (m) => position.marketIndex === m.marketIndex,
          );
          if (marketConfig) {
            tokenMints.add(marketConfig.mint.toBase58());
          }
        });

      const tokens = Array.from(tokenMints);
      return new JupiterApiClient().fetchTokenPrices(tokens);
    },
  });

  const value: GlamProviderContext = {
    glamClient,
    vault,
    activeGlamState,
    glamStatesList: useAtomValue(glamStatesListAtom),
    delegateAcls,
    integrationAcls,
    allGlamStates,
    jupTokenList: jupTokenList || [],
    prices: tokenPrices || [],
    driftMarketConfigs,
    setActiveGlamState,
    refresh: async () => {
      refreshVaultHoldings();
      refreshDelegateAcls();
      refreshIntegrationAcls();
      refetchDriftUser();
    },
    refetchGlamStates: async () => {
      refetchGlamStates();
    },
  };

  return <GlamContext.Provider value={value}>{children}</GlamContext.Provider>;
}

export const useGlam = () => useContext(GlamContext);
