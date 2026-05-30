import { BN, Wallet } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  str2seed,
} from "../glam_protocol/setup";
import {
  GlamClient,
  JupiterSwapPolicy,
  JupiterApiClient,
  JUPITER_SWAP_PROTOCOL,
  MSOL,
  nameToChars,
  SYSTEM_PROTOCOL,
  USDC,
  WSOL,
} from "../../src";
import { getAccount } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import {
  solToMsolQuoteResponseForTest,
  solToMsolSwapInstructionsForTest,
  mSolToSolSwapInstructions,
} from "./setup";

const txOptions = { simulate: true };
const delegate = Keypair.fromSeed(str2seed("delegate"));
const jupiterApiClient = new JupiterApiClient({
  swapApiBaseUrl: "http://127.0.0.1/mock-jupiter",
});

describe("jupiter_swap", () => {
  const glamClient = new GlamClient({ jupiterApiClient });
  const glamClientDelegate = new GlamClient({
    wallet: new Wallet(delegate),
    jupiterApiClient,
  });

  beforeAll(async () => {
    await airdrop(
      glamClient.provider.connection,
      delegate.publicKey,
      10_000_000_000,
    );
  });

  it("Create vault and enable JupiterSwap protocol", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Jupiter Swap Tests"),
      assets: [WSOL],
    });
    glamClientDelegate.statePda = statePda;

    try {
      const txSig = await glamClient.access.enableProtocols(
        glamClient.protocolProgram.programId, // native integration
        JUPITER_SWAP_PROTOCOL | SYSTEM_PROTOCOL,
        txOptions,
      );
      console.log("Enable all natively supported protocols", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    await airdrop(
      glamClient.provider.connection,
      glamClient.vaultPda,
      10_000_000_000,
    );

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([WSOL]);
    expect(stateModel.baseAssetMint).toEqual(WSOL);
    expect(stateModel.baseAssetTokenProgram).toEqual(0);
    expect(stateModel.baseAssetDecimals).toEqual(9);
    expect(stateModel.integrationAcls?.length).toEqual(1);
    expect(stateModel.delegateAcls?.length).toEqual(0);
  }, 25_000);

  it("Set JupiterSwap policy", async () => {
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new JupiterSwapPolicy(50, [USDC, MSOL], 0).encode(),
      );
      console.log("Update jupiter swap policy", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("SOL->mSOL swap 0.05 SOL end to end", async () => {
    const inputVaultAta = glamClient.getVaultAta(WSOL);
    const outputVaultAta = glamClient.getVaultAta(MSOL);

    // Pre-checks
    const vaultBalanceBefore = await glamClient.getVaultBalance();
    expect(vaultBalanceBefore).toEqual(10);
    [inputVaultAta, outputVaultAta].forEach(async (account) => {
      try {
        const tokenAccount = await getAccount(
          glamClient.provider.connection,
          account,
          "confirmed",
        );
        expect(tokenAccount).toBeUndefined();
      } catch (e: any) {
        expect(e.name).toEqual("TokenAccountNotFoundError");
      }
    });

    // Swap
    const quoteResponse = solToMsolQuoteResponseForTest;
    const swapInstructions = solToMsolSwapInstructionsForTest(
      glamClient.vaultPda,
      inputVaultAta,
      outputVaultAta,
    );
    try {
      const txSig = await glamClient.jupiterSwap.swap({
        quoteResponse,
        swapInstructions,
      });
      console.log("SOL->mSOL swap", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Post-checks
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([WSOL, MSOL]); // MSOL is added to the asset list

    const acc = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(WSOL),
      "confirmed",
    );
    expect(acc.amount.toString()).toEqual("0");

    // less SOL
    const vaultBalanceAfter = await glamClient.getVaultBalance();
    expect(vaultBalanceAfter).toEqual(9.95); // minus 0.05

    // more mSOL
    const vaultMsol = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(MSOL),
    );
    expect(vaultMsol.amount.toString()).toEqual("41795954");
  }, 15_000);

  it("mSOL->SOL swap end to end", async () => {
    const vault = glamClient.vaultPda;
    const inputVaultAta = glamClient.getVaultAta(MSOL);
    const outputVaultAta = glamClient.getVaultAta(WSOL);

    const { amount: vaultMsolAmountBefore } = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(MSOL),
    );

    // Swap mSOL to SOL
    const amount = 41_000_000;
    try {
      const txId = await glamClient.jupiterSwap.swap({
        quoteParams: {
          inputMint: MSOL.toBase58(),
          outputMint: WSOL.toBase58(),
          amount,
          swapMode: "ExactIn",
          onlyDirectRoutes: true,
          instructionVersion: "V1",
          maxAccounts: 8,
        },
        swapInstructions: mSolToSolSwapInstructions(
          vault,
          inputVaultAta,
          outputVaultAta,
        ),
      });
      console.log("swap back e2e txId", txId);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // vault: less mSOL after swap
    const { amount: vaultMsolAmountAfter } = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(MSOL),
    );
    expect(Number(vaultMsolAmountAfter) + amount).toEqual(
      Number(vaultMsolAmountBefore),
    );
    // more wSOL
    const { amount: vaultWsolAmount } = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(WSOL),
    );
    expect(vaultWsolAmount.toString()).toEqual("49038010");
  });

  it("Swap access control #1", async () => {
    // Grant delegate permissions: only allowed to swap allowlisted assets
    try {
      const txSig = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new BN(0b100), // SWAP_ALLOWLISTED
      );
      console.log("Update delegate acl", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    let stateModel = await glamClient.fetchStateModel();
    expect(stateModel.delegateAcls?.length).toEqual(1);

    const inputVaultAta = glamClient.getVaultAta(WSOL);
    const outputVaultAta = glamClient.getVaultAta(MSOL);
    const quoteResponse = solToMsolQuoteResponseForTest;
    const swapInstructions = solToMsolSwapInstructionsForTest(
      glamClient.vaultPda,
      inputVaultAta,
      outputVaultAta,
    );

    // Current swapAllowlist: [USDC, MSOL], delegate has SWAP_ALLOWLISTED permission
    // 1st attempt should fail because MSOL is not allowlisted,
    // and delegate doesn't have swapAny or swapLst permission
    try {
      const txSig = await glamClientDelegate.jupiterSwap.swap(
        {
          quoteResponse,
          swapInstructions,
        },
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toBe("Signer is not authorized");
    }

    // Allow delegate to swap LST
    try {
      const txSig = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.protocolProgram.programId,
        SYSTEM_PROTOCOL,
        new BN(0b01), // WSOL
      );
      console.log("Grant delegate WSOL permission:", txSig);

      const txSig2 = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new BN(0b110), // SWAP_ALLOWLISTED + SWAP_LST
      );
      console.log("Grant delegate SWAP_ALLOWLISTED permission:", txSig2);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // 2nd attempt, should pass since delegate is now allowed to swap LST
    // and asset list should be updated accordingly to include MSOL
    try {
      const txSig = await glamClientDelegate.jupiterSwap.swap({
        quoteResponse,
        swapInstructions,
      });
      console.log("2nd attempt swap:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateAccount = await glamClientDelegate.fetchStateAccount();
    expect(stateAccount.assets).toEqual([WSOL, MSOL]);

    stateModel = await glamClientDelegate.fetchStateModel();
    expect(stateModel.assets).toEqual(stateAccount.assets);
  }, 30_000);
});
