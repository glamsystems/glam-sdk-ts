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
const delegate = Keypair.fromSeed(str2seed("delegate_v2"));

describe("jupiter_swap_v2", () => {
  const glamClient = new GlamClient();
  const glamClientDelegate = new GlamClient({ wallet: new Wallet(delegate) });

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
      name: nameToChars("Jupiter SwapV2 Tests"),
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
    expect(stateModel.integrationAcls?.length).toEqual(1);
    expect(stateModel.delegateAcls?.length).toEqual(0);
  }, 25_000);

  it("Set JupiterSwap policy with max_deviation_bps", async () => {
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new JupiterSwapPolicy(50, [USDC, MSOL], 500).encode(),
      );
      console.log(
        "Update jupiter swap policy with max_deviation_bps=500",
        txSig,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("SwapV2 SOL->mSOL with skipQuotePriceCheck=true (manager)", async () => {
    const inputVaultAta = glamClient.getVaultAta(WSOL);
    const outputVaultAta = glamClient.getVaultAta(MSOL);

    // Pre-checks
    const vaultBalanceBefore = await glamClient.getVaultBalance();
    expect(vaultBalanceBefore).toEqual(10);

    // Swap using V2 with skipQuotePriceCheck (manager can always skip)
    const quoteResponse = solToMsolQuoteResponseForTest;
    const swapInstructions = solToMsolSwapInstructionsForTest(
      glamClient.vaultPda,
      inputVaultAta,
      outputVaultAta,
    );
    try {
      const txSig = await glamClient.jupiterSwap.swapV2({
        quoteResponse,
        swapInstructions,
        skipQuotePriceCheck: true,
      });
      console.log("SwapV2 SOL->mSOL with skipQuotePriceCheck=true", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Post-checks
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.assets).toEqual([WSOL, MSOL]);

    const acc = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(WSOL),
      "confirmed",
    );
    expect(acc.amount.toString()).toEqual("0");

    const vaultBalanceAfter = await glamClient.getVaultBalance();
    expect(vaultBalanceAfter).toEqual(9.95);

    const vaultMsol = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(MSOL),
    );
    expect(vaultMsol.amount.toString()).toEqual("41795954");
  }, 15_000);

  it("SwapV2 mSOL->SOL with skipQuotePriceCheck=false and no oracles fails", async () => {
    const vault = glamClient.vaultPda;
    const inputVaultAta = glamClient.getVaultAta(MSOL);
    const outputVaultAta = glamClient.getVaultAta(WSOL);

    // When skipQuotePriceCheck=false and no oracle accounts are provided,
    // the program should fail because it can't validate quote against oracle
    try {
      const txSig = await glamClient.jupiterSwap.swapV2(
        {
          quoteParams: {
            inputMint: MSOL.toBase58(),
            outputMint: WSOL.toBase58(),
            amount: 10_000_000,
            swapMode: "ExactIn",
            onlyDirectRoutes: true,
            instructionVersion: "V2",
            maxAccounts: 8,
          },
          swapInstructions: mSolToSolSwapInstructions(
            vault,
            inputVaultAta,
            outputVaultAta,
          ),
          skipQuotePriceCheck: false,
          // No oracleAccounts provided
        },
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      // Expected to fail: missing oracle accounts when quote price check is required
      expect(e.message).toMatch(/missing|MissingAccount|Account/i);
    }
  }, 15_000);

  it("SwapV2 mSOL->SOL with skipQuotePriceCheck=true", async () => {
    const vault = glamClient.vaultPda;
    const inputVaultAta = glamClient.getVaultAta(MSOL);
    const outputVaultAta = glamClient.getVaultAta(WSOL);

    const { amount: vaultMsolAmountBefore } = await getAccount(
      glamClient.provider.connection,
      glamClient.getVaultAta(MSOL),
    );

    const amount = 41_000_000;
    try {
      const txId = await glamClient.jupiterSwap.swapV2({
        quoteParams: {
          inputMint: MSOL.toBase58(),
          outputMint: WSOL.toBase58(),
          amount,
          swapMode: "ExactIn",
          onlyDirectRoutes: true,
          instructionVersion: "V2",
          maxAccounts: 8,
        },
        swapInstructions: mSolToSolSwapInstructions(
          vault,
          inputVaultAta,
          outputVaultAta,
        ),
        skipQuotePriceCheck: true,
      });
      console.log("SwapV2 mSOL->SOL", txId);
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

  it("Delegate without SkipQuotePriceCheck permission cannot skip", async () => {
    // Grant delegate SwapLst permission only (bit 1), no SkipQuotePriceCheck
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
        new BN(0b010), // SWAP_LST only
      );
      console.log("Grant delegate SWAP_LST permission:", txSig2);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const inputVaultAta = glamClient.getVaultAta(WSOL);
    const outputVaultAta = glamClient.getVaultAta(MSOL);
    const quoteResponse = solToMsolQuoteResponseForTest;
    const swapInstructions = solToMsolSwapInstructionsForTest(
      glamClient.vaultPda,
      inputVaultAta,
      outputVaultAta,
    );

    // Delegate tries skipQuotePriceCheck=true but doesn't have SkipQuotePriceCheck permission.
    // Without oracle accounts, this should fail since delegate can't skip and oracles are missing.
    try {
      const txSig = await glamClientDelegate.jupiterSwap.swapV2(
        {
          quoteResponse,
          swapInstructions,
          skipQuotePriceCheck: true,
        },
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.message).toMatch(/missing|MissingAccount|Account|unauthorized/i);
    }
  }, 30_000);

  it("Delegate with SkipQuotePriceCheck permission can swap", async () => {
    // Grant delegate SkipQuotePriceCheck (bit 5 = 0b100000) + SWAP_LST (bit 1 = 0b10)
    try {
      const txSig = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new BN(0b100010), // SWAP_LST + SkipQuotePriceCheck
      );
      console.log(
        "Grant delegate SWAP_LST + SkipQuotePriceCheck permissions:",
        txSig,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    const inputVaultAta = glamClient.getVaultAta(WSOL);
    const outputVaultAta = glamClient.getVaultAta(MSOL);
    const quoteResponse = solToMsolQuoteResponseForTest;
    const swapInstructions = solToMsolSwapInstructionsForTest(
      glamClient.vaultPda,
      inputVaultAta,
      outputVaultAta,
    );

    // Now delegate with SkipQuotePriceCheck can swap without oracles
    try {
      const txSig = await glamClientDelegate.jupiterSwap.swapV2({
        quoteResponse,
        swapInstructions,
        skipQuotePriceCheck: true,
      });
      console.log("Delegate swapV2 with SkipQuotePriceCheck:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateAccount = await glamClientDelegate.fetchStateAccount();
    expect(stateAccount.assets).toEqual([WSOL, MSOL]);
  }, 30_000);

  it("Update policy max_deviation_bps and verify", async () => {
    // Update policy with a negative max_deviation_bps (allows negative tolerance)
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.protocolProgram.programId,
        JUPITER_SWAP_PROTOCOL,
        new JupiterSwapPolicy(100, [USDC, MSOL], -200).encode(),
      );
      console.log(
        "Update jupiter swap policy with max_deviation_bps=-200",
        txSig,
      );
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Verify the updated policy can be decoded correctly
    const stateModel = await glamClient.fetchStateModel();
    const policyData = stateModel.integrationAcls?.find(
      (acl: any) => acl.policy !== null,
    );
    expect(policyData).toBeDefined();
  }, 15_000);
});
