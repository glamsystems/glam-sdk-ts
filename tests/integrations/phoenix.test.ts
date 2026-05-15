import { readFileSync } from "fs";
import { resolve } from "path";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

import {
  GlamClient,
  PHOENIX_PROGRAM_ID,
  PHOENIX_PROTOCOL,
  USDC,
  nameToChars,
} from "../../src";
import {
  createGlamStateForTest,
  defaultInitStateParams,
  mintUSDC,
} from "../glam_protocol/setup";

const SNAPSHOT_FIXTURE = resolve(
  __dirname,
  "../../fixtures/accounts/phoenix/snapshot.json",
);

type PhoenixSnapshot = {
  exchange: {
    canonicalMint: string;
    usdcMint: string;
    perpAssetMap: string;
    globalTraderIndex: string[];
    activeTraderBuffer: string[];
  };
};

function loadSnapshot(): PhoenixSnapshot {
  return JSON.parse(readFileSync(SNAPSHOT_FIXTURE, "utf-8")) as PhoenixSnapshot;
}

describe("phoenix sdk integration", () => {
  const glamClient = new GlamClient();
  const snapshot = loadSnapshot();
  const canonicalMint = new PublicKey(snapshot.exchange.canonicalMint);
  const traderIndexes = {
    traderPdaIndex: 0,
    subaccountIndex: 0,
  };

  beforeAll(async () => {
    await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars(`Phoenix SDK ${Date.now()}`),
      baseAssetMint: USDC,
      assets: [USDC],
      integrationAcls: [
        {
          integrationProgram: glamClient.phoenix.programId,
          protocolsBitmask: PHOENIX_PROTOCOL,
          protocolPolicies: [],
        },
      ],
    });

    await mintUSDC(glamClient.connection, glamClient.vaultPda, 1_000);
  }, 60_000);

  it("registers the vault's Phoenix trader account", async () => {
    const traderAccount = glamClient.phoenix.getTraderPda(
      traderIndexes.traderPdaIndex,
      traderIndexes.subaccountIndex,
    );

    await glamClient.phoenix.registerTrader(
      {
        maxPositions: new BN(20),
        traderPdaIndex: traderIndexes.traderPdaIndex,
        traderSubaccountIndex: traderIndexes.subaccountIndex,
      },
      { traderAccount },
    );

    const traderAccountInfo =
      await glamClient.connection.getAccountInfo(traderAccount);
    expect(traderAccountInfo).not.toBeNull();
    expect(traderAccountInfo?.owner.toBase58()).toBe(
      PHOENIX_PROGRAM_ID.toBase58(),
    );
  }, 60_000);

  it("rejects a zero-amount Phoenix deposit", async () => {
    try {
      const txSig = await glamClient.phoenix.depositFunds(
        { amount: new BN(0) },
        { remainingAccounts: [] },
      );
      expect(txSig).toBeUndefined();
    } catch (error: any) {
      expect(error.message).toBe("Amount must be greater than zero");
    }
  }, 30_000);

  it("rejects a zero-amount Phoenix withdraw", async () => {
    try {
      const txSig = await glamClient.phoenix.withdrawFunds(
        { amount: new BN(0) },
        { remainingAccounts: [] },
      );
      expect(txSig).toBeUndefined();
    } catch (error: any) {
      expect(error.message).toBe("Amount must be greater than zero");
    }
  }, 30_000);

  it("ember deposit", async () => {
    const outputTokenAccount = glamClient.getVaultAta(canonicalMint);
    const preIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClient.signer,
      outputTokenAccount,
      glamClient.vaultPda,
      canonicalMint,
    );

    try {
      const ix = await glamClient.phoenix.txBuilder.emberDepositIx(
        { amount: new BN(100) },
        {
          inputMint: USDC,
          outputMint: canonicalMint,
          inputTokenAccount: glamClient.getVaultAta(USDC),
          outputTokenAccount,
        },
      );
      const tx = new Transaction().add(preIx, ix);
      const txSig = await glamClient.sendAndConfirm(tx);
      console.log("ember deposit:", txSig);
    } catch (error) {
      throw error;
    }
  });

  // These happy-path flows require a trader account with Phoenix collateral
  // capabilities enabled (aka activated). As of May 2026 Phoenix is still in
  // private beta activating trader accounts is permissioned and we cannot
  // currently test this end-to-end.
  it.skip("deposits USDC into Phoenix via Ember conversion", async () => {}, 60_000);

  // Same trader account limitation as the deposit test.
  it.skip("withdraws from Phoenix and converts back to USDC", async () => {});
});
