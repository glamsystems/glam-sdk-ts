import { Provider, Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { TransactionVersion } from "./utils/messageV1";
import { JupiterApiClient } from "./utils";
import type { PhoenixRiseClient } from "./utils/phoenixRise";

export enum ClusterNetwork {
  Mainnet = "mainnet-beta",
  Testnet = "testnet",
  Devnet = "devnet",
  Localnet = "localnet",
  Custom = "custom",
}

export namespace ClusterNetwork {
  export function fromStr(cluster: string) {
    switch (cluster) {
      case "mainnet-beta":
        return ClusterNetwork.Mainnet;
      case "testnet":
        return ClusterNetwork.Testnet;
      case "devnet":
        return ClusterNetwork.Devnet;
      case "localnet":
        return ClusterNetwork.Localnet;
      case "custom":
        return ClusterNetwork.Custom;
    }
    throw new Error("Unrecognized cluster");
  }

  /**
   * Detects the Solana cluster network from an RPC endpoint URL
   *
   * @param rpcUrl The RPC endpoint URL
   * @returns The detected cluster network
   */
  export function fromUrl(rpcUrl: string): ClusterNetwork {
    if (rpcUrl.includes("devnet")) {
      return ClusterNetwork.Devnet;
    }
    if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) {
      return ClusterNetwork.Localnet;
    }
    if (rpcUrl.includes("mainnet")) {
      return ClusterNetwork.Mainnet;
    }
    throw new Error(
      `Cannot infer cluster network from RPC endpoint: ${rpcUrl}`,
    );
  }
}

export type GlamClientConfig = {
  provider?: Provider;
  wallet?: Wallet;
  cluster?: ClusterNetwork;
  statePda?: PublicKey;
  jupiterApiKey?: string;
  jupiterApiClient?: JupiterApiClient;
  phoenixRiseClient?: PhoenixRiseClient;
  useStaging?: boolean;
  /**
   * The transaction version this host builds, for every transaction it does
   * not state one for. Absent, GLAM_TRANSACTION_VERSION decides, and under
   * that the cluster: version 1 everywhere but localnet.
   */
  transactionVersion?: TransactionVersion;
};
