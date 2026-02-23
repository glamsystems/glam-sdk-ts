"use client";

import { clusterApiUrl, Connection } from "@solana/web3.js";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";
import { ClusterNetwork } from "../clientConfig";

export interface Cluster {
  name: string;
  endpoint: string;
  network?: ClusterNetwork;
  active?: boolean;
}

const defaultClusters: Cluster[] = [
  {
    name: "mainnet-beta",
    endpoint:
      process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta"),
    network: ClusterNetwork.Mainnet,
  },
  {
    name: "devnet",
    endpoint:
      process.env.NEXT_PUBLIC_SOLANA_RPC?.replace("mainnet", "devnet") ||
      clusterApiUrl("devnet"),
    network: ClusterNetwork.Devnet,
  },
  // {
  //   name: "testnet",
  //   endpoint: clusterApiUrl("testnet"),
  //   network: ClusterNetwork.Testnet,
  // },
];

if (process.env.NODE_ENV === "development") {
  defaultClusters.push({
    name: "localnet",
    endpoint: "http://localhost:8899",
    network: ClusterNetwork.Custom,
  });
}

const clusterAtom = atomWithStorage<Cluster>(
  "solana-cluster",
  defaultClusters[0],
);
const clustersAtom = atomWithStorage<Cluster[]>(
  "solana-clusters",
  defaultClusters,
);

const activeClustersAtom = atom<Cluster[]>((get) => {
  const clusters = get(clustersAtom);
  const cluster = get(clusterAtom);
  return clusters.map((item) => ({
    ...item,
    active: item.name === cluster.name,
  }));
});

const activeClusterAtom = atom<Cluster>((get) => {
  const clusters = get(activeClustersAtom);

  return clusters.find((item) => item.active) || clusters[0];
});

interface ClusterProviderContext {
  cluster: Cluster;
  clusters: Cluster[];
  addCluster: (cluster: Cluster) => void;
  deleteCluster: (cluster: Cluster) => void;
  setCluster: (cluster: Cluster) => void;
  getExplorerUrl(path: string): string;
}

const Context = createContext<ClusterProviderContext>(
  {} as ClusterProviderContext,
);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const cluster = useAtomValue(activeClusterAtom);
  const clusters = useAtomValue(activeClustersAtom);
  const setCluster = useSetAtom(clusterAtom);
  const setClusters = useSetAtom(clustersAtom);

  const addCluster = useCallback(
    (c: Cluster) => {
      new Connection(c.endpoint); // validates endpoint
      setClusters([...clusters, c]);
    },
    [clusters, setClusters],
  );

  const deleteCluster = useCallback(
    (c: Cluster) => {
      setClusters(clusters.filter((item) => item.name !== c.name));
    },
    [clusters, setClusters],
  );

  const setClusterFn = useCallback(
    (c: Cluster) => {
      setCluster(c);
    },
    [setCluster],
  );

  const getExplorerUrl = useCallback(
    (path: string) =>
      `https://solscan.io/${path}${getClusterUrlParam(cluster)}`,
    [cluster],
  );

  const sortedClusters = useMemo(
    () => [...clusters].sort((a, b) => (a.name > b.name ? 1 : -1)),
    [clusters],
  );

  const value = useMemo<ClusterProviderContext>(
    () => ({
      cluster,
      clusters: sortedClusters,
      addCluster,
      deleteCluster,
      setCluster: setClusterFn,
      getExplorerUrl,
    }),
    [cluster, sortedClusters, addCluster, deleteCluster, setClusterFn, getExplorerUrl],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCluster() {
  return useContext(Context);
}

export function getClusterUrlParam(cluster: Cluster): string {
  let suffix = "";
  switch (cluster.network) {
    case ClusterNetwork.Devnet:
      suffix = "devnet";
      break;
    case ClusterNetwork.Mainnet:
      suffix = "";
      break;
    case ClusterNetwork.Testnet:
      suffix = "testnet";
      break;
    default:
      suffix = `custom&customUrl=${encodeURIComponent(cluster.endpoint)}`;
      break;
  }

  return suffix.length ? `?cluster=${suffix}` : "";
}
