export const queryKeys = {
  vault: {
    all: (pk: string, cluster: string) => ["vault", pk, cluster] as const,
    balances: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "balances"] as const,
    holdings: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "holdings"] as const,
    acls: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "acls"] as const,
    config: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "config"] as const,
    driftUsers: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "drift-users"] as const,
    stakes: (pk: string, cluster: string) =>
      ["vault", pk, cluster, "stakes"] as const,
    holders: (mint: string, cluster: string) =>
      ["vault", "holders", mint, cluster] as const,
  },
  wallet: {
    balances: (pk: string, cluster: string) =>
      ["wallet", pk, "balances", cluster] as const,
  },
  global: {
    allStates: (cluster: string) => ["global", "all-states", cluster] as const,
    jupTokens: (cluster: string) =>
      ["global", "jup-tokens", cluster] as const,
    jupDexes: (cluster: string) => ["global", "jup-dexes", cluster] as const,
    driftMarkets: (cluster: string) =>
      ["global", "drift-markets", cluster] as const,
    kaminoMarkets: (cluster: string) =>
      ["global", "kamino-markets", cluster] as const,
    kaminoVaults: (cluster: string) =>
      ["global", "kamino-vaults", cluster] as const,
    priorityFee: (cluster: string) =>
      ["global", "priority-fee", cluster] as const,
  },
  vaultGraph: {
    vault: (vaultId: string, cluster: string) =>
      ["vault-graph", "vault", vaultId, cluster] as const,
    tokenData: (mint: string, cluster: string) =>
      ["vault-graph", "token-data", mint, cluster] as const,
    availableIntegrations: (cluster: string) =>
      ["vault-graph", "available-integrations", cluster] as const,
  },
  tx: {
    status: (sig: string) => ["tx", sig] as const,
  },
} as const;

export type InvalidationScope =
  | "balance" // vault token/SOL balances + priced holdings
  | "drift" // drift user accounts
  | "acls" // delegate + integration ACLs + global state list
  | "wallet" // connected wallet balances
  | "graph" // vault graph visualization
  | "stakes" // stake accounts
  | "all"; // everything

export interface InvalidationContext {
  vaultPk: string;
  walletPk: string;
  cluster: string;
}

/** Maps invalidation scopes to the query keys that need to be invalidated. */
export function getInvalidationKeys(
  scopes: InvalidationScope[],
  ctx: InvalidationContext,
): readonly (readonly string[])[] {
  const result: (readonly string[])[] = [];
  const seen = new Set<string>();

  const add = (key: readonly string[]) => {
    const k = key.join("\0");
    if (!seen.has(k)) {
      seen.add(k);
      result.push(key);
    }
  };

  for (const scope of scopes) {
    switch (scope) {
      case "balance":
        add(queryKeys.vault.balances(ctx.vaultPk, ctx.cluster));
        add(queryKeys.vault.holdings(ctx.vaultPk, ctx.cluster));
        break;
      case "drift":
        add(queryKeys.vault.driftUsers(ctx.vaultPk, ctx.cluster));
        break;
      case "acls":
        add(queryKeys.vault.acls(ctx.vaultPk, ctx.cluster));
        add(["global", "all-states"]); // prefix match — any cluster
        break;
      case "wallet":
        add(queryKeys.wallet.balances(ctx.walletPk, ctx.cluster));
        break;
      case "graph":
        add(queryKeys.vaultGraph.vault(ctx.vaultPk, ctx.cluster));
        break;
      case "stakes":
        add(queryKeys.vault.stakes(ctx.vaultPk, ctx.cluster));
        break;
      case "all":
        add(queryKeys.vault.all(ctx.vaultPk, ctx.cluster));
        add(queryKeys.wallet.balances(ctx.walletPk, ctx.cluster));
        add(["global", "all-states"]);
        break;
    }
  }

  return result;
}
