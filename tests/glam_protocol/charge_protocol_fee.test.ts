import { BN } from "@coral-xyz/anchor";
import {
  GlamClient,
  stringToChars,
  StateAccountType,
  WSOL,
} from "../../src";
import { getGlamMintProgramId } from "../../src/glamExports";
import { airdrop, sleep } from "../test-utils";

const txOptions = {
  simulate: true,
};

describe("charge_protocol_fee", () => {
  const glamClient = new GlamClient({ jupiterApiKey: "jupiter-api-key-mock" });

  it("Initialize non-tokenized vault with fee_structure", async () => {
    const name = "Vault Protocol Fee Test";
    const params = {
      accountType: StateAccountType.VAULT,
      name: stringToChars(name),
      baseAssetMint: WSOL,
      assets: [WSOL],
      feeStructure: {
        vault: {
          subscriptionFeeBps: 0,
          redemptionFeeBps: 0,
        },
        manager: {
          subscriptionFeeBps: 0,
          redemptionFeeBps: 0,
        },
        management: {
          feeBps: 0,
        },
        performance: {
          feeBps: 0,
          hurdleRateBps: 0,
          hurdleType: { hard: {} },
        },
        protocol: {
          baseFeeBps: 0, // overwritten by program to 20
          flowFeeBps: 0,
        },
      },
    };

    try {
      const txSig = await glamClient.state.initialize(params, txOptions);
      console.log("Initialize vault txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    console.log("State PDA:", glamClient.statePda.toBase58());
    console.log("Vault PDA:", glamClient.vaultPda.toBase58());

    // Verify fee params were initialized in params[1]
    const stateAccount = await glamClient.fetchStateAccount();
    expect(stateAccount.params[1].length).toBeGreaterThan(0);

    // Check fee structure was set with protocol defaults
    const feeStructureParam = stateAccount.params[1].find(
      (p: any) => Object.keys(p.name)[0] === "feeStructure",
    );
    expect(feeStructureParam).toBeDefined();
    const feeStructure = (Object.values(feeStructureParam.value)[0] as any)
      .val;
    expect(feeStructure.protocol.baseFeeBps).toEqual(20);

    // Check fee params initialized
    const feeParamsParam = stateAccount.params[1].find(
      (p: any) => Object.keys(p.name)[0] === "feeParams",
    );
    expect(feeParamsParam).toBeDefined();
  }, 25_000);

  it("Enable glam_mint integration for pricing", async () => {
    // Non-tokenized vaults don't have glam_mint in their integrationAcls by default.
    // We need to authorize glam_mint so priceVaultTokens can call update_priced_protocol.
    try {
      const txSig = await glamClient.access.enableProtocols(
        getGlamMintProgramId(),
        1, // SupportedProtocols::Mint bitmask
        txOptions,
      );
      console.log("Enable glam_mint integration:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Airdrop and wrap SOL in vault", async () => {
    // Airdrop SOL to vault
    await airdrop(
      glamClient.provider.connection,
      glamClient.vaultPda,
      1_000_000_000_000, // 1000 SOL
    );

    // Wrap SOL to wSOL
    const txSig = await glamClient.vault.wrap(
      new BN(1_000_000_000_000),
      txOptions,
    );
    console.log("Wrap vault SOL -> wSOL:", txSig);
  }, 15_000);

  it("First charge_protocol_fee: should set last_crystallized, fee = 0", async () => {
    try {
      const txSig = await glamClient.fees.chargeProtocolFee(txOptions);
      console.log("First charge_protocol_fee txSig:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // After first call, last_protocol_fee_crystallized should be set
    // but no fee should have been charged (since last_crystallized was 0)
    const stateAccount = await glamClient.fetchStateAccount();
    const feeParamsParam = stateAccount.params[1].find(
      (p: any) => Object.keys(p.name)[0] === "feeParams",
    );
    const feeParams = (Object.values(feeParamsParam.value)[0] as any).val;
    expect(
      new BN(feeParams.lastProtocolFeeCrystallized).gt(new BN(0)),
    ).toBeTruthy();

    // Claimed fees should still be 0
    const claimedFeesParam = stateAccount.params[1].find(
      (p: any) => Object.keys(p.name)[0] === "claimedFees",
    );
    const claimedFees = (Object.values(claimedFeesParam.value)[0] as any).val;
    expect(new BN(claimedFees.protocolBaseFee).eq(new BN(0))).toBeTruthy();
  }, 30_000);

  it("Second charge_protocol_fee: should charge fee > 0", async () => {
    // Wait for time to elapse so fee accrues
    await sleep(10_000);

    try {
      const txSig = await glamClient.fees.chargeProtocolFee(txOptions);
      console.log("Second charge_protocol_fee txSig:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Claimed fees should now be > 0
    const claimedFees = await glamClient.fees.getClaimedFees();
    expect(new BN(claimedFees.protocolBaseFee).gt(new BN(0))).toBeTruthy();
    console.log(
      "Protocol base fee claimed:",
      new BN(claimedFees.protocolBaseFee).toString(),
    );
  }, 30_000);

  it("Disable and close state account", async () => {
    try {
      const txSigDisable = await glamClient.access.emergencyAccessUpdate({
        stateEnabled: false,
      });
      console.log("State disabled", txSigDisable);

      const txSigClose = await glamClient.state.close();
      console.log("State closed", txSigClose);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const ret = await glamClient.provider.connection.getMultipleAccountsInfo([
      glamClient.statePda,
      glamClient.vaultPda,
    ]);
    expect(ret).toEqual([null, null]);
  }, 15_000);
});
