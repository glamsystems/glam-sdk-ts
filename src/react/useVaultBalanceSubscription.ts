"use client";

import { useEffect, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { QueryClient } from "@tanstack/react-query";
import { TokenAccount } from "../client/base";
import { queryKeys } from "./query-keys";

const MAX_SUBSCRIPTIONS = 20; // 1 vault PDA + up to 19 token accounts
const DEBOUNCE_MS = 2000;

const LOG_PREFIX = "[ws-sub]";

function isWebSocketDisabled(): boolean {
  const val =
    process.env.NEXT_PUBLIC_WEBSOCKET_DISABLED ||
    process.env.WEBSOCKET_DISABLED;
  return !!val && val !== "0" && val !== "false";
}

export interface UseVaultBalanceSubscriptionOptions {
  connection: Connection;
  queryClient: QueryClient;
  vaultPda: PublicKey | undefined;
  /** Base58 string of the active vault state pubkey (used for query key scoping) */
  pk: string;
  /** Cluster network string for query key scoping */
  cluster: string;
  tokenAccounts: TokenAccount[];
  enabled: boolean;
  /** Called when WebSocket connection status changes (for polling fallback) */
  onWsStatusChange: (connected: boolean) => void;
}

export function useVaultBalanceSubscription({
  connection,
  queryClient,
  vaultPda,
  pk,
  cluster,
  tokenAccounts,
  enabled,
  onWsStatusChange,
}: UseVaultBalanceSubscriptionOptions): void {
  const onStatusChangeRef = useRef(onWsStatusChange);
  onStatusChangeRef.current = onWsStatusChange;

  const subscriptionIds = useRef<number[]>([]);
  const currentFingerprint = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidation = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !vaultPda || !pk || isWebSocketDisabled()) {
      onStatusChangeRef.current(false);
      return;
    }

    // Build the list of pubkeys to subscribe to
    const targets: PublicKey[] = [vaultPda];
    const tokenPubkeys = tokenAccounts
      .slice(0, MAX_SUBSCRIPTIONS - 1)
      .map((ta) => ta.pubkey);
    targets.push(...tokenPubkeys);

    // Fingerprint: sorted base58 joined — only re-subscribe when the set changes
    const fingerprint = targets
      .map((t) => t.toBase58())
      .sort()
      .join(",");

    if (fingerprint === currentFingerprint.current) {
      return;
    }

    // Teardown previous subscriptions (ref-only, safe to call before local vars)
    teardownSubscriptions();

    currentFingerprint.current = fingerprint;

    let subscribed = true;

    const invalidateBalances = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vault.balances(pk, cluster),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vault.holdings(pk, cluster),
      });
    };

    // Leading-edge + trailing coalesce debounce:
    // First notification after ≥DEBOUNCE_MS fires immediately.
    // Subsequent notifications within the window coalesce into one trailing fire.
    const debouncedInvalidate = () => {
      const now = Date.now();
      const elapsed = now - lastInvalidation.current;

      if (elapsed >= DEBOUNCE_MS) {
        // Leading edge: fire immediately
        lastInvalidation.current = now;
        invalidateBalances();
      } else {
        // Within debounce window: schedule trailing
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        const remaining = DEBOUNCE_MS - elapsed;
        debounceTimer.current = setTimeout(() => {
          lastInvalidation.current = Date.now();
          debounceTimer.current = null;
          invalidateBalances();
        }, remaining);
      }
    };

    // Subscribe to all targets
    const ids: number[] = [];

    try {
      for (const pubkey of targets) {
        const id = connection.onAccountChange(
          pubkey,
          () => {
            if (subscribed) {
              debouncedInvalidate();
            }
          },
          "confirmed",
        );
        ids.push(id);
      }

      subscriptionIds.current = ids;
      onStatusChangeRef.current(true);

      if (process.env.NODE_ENV === "development") {
        console.log(
          `${LOG_PREFIX} Subscribed to ${targets.length} accounts for vault ${pk.slice(0, 8)}...`,
        );
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to subscribe:`, err);
      onStatusChangeRef.current(false);
    }

    // Removes all WS listeners and clears refs. Does NOT touch local `subscribed`.
    function teardownSubscriptions() {
      for (const id of subscriptionIds.current) {
        try {
          connection.removeAccountChangeListener(id);
        } catch {
          // Listener may already be removed
        }
      }
      subscriptionIds.current = [];
      currentFingerprint.current = "";

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    }

    return () => {
      subscribed = false;
      teardownSubscriptions();
    };
  }, [connection, queryClient, vaultPda, pk, cluster, tokenAccounts, enabled]);
}
