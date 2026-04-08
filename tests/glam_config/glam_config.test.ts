import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { GlamConfig } from "../../target/types/glam_config";
import { initGlamConfigForTest, TEST_ASSETS, TEST_ORACLES } from "./setup";

describe("glam_config", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.GlamConfig as Program<GlamConfig>;
  let globalConfigPDA: PublicKey;
  let admin: Keypair;
  let feeAuthority: Keypair;
  let referrer: Keypair;

  it("Initialize global config", async () => {
    const testSetup = await initGlamConfigForTest(provider);
    globalConfigPDA = testSetup.globalConfigPDA;
    admin = testSetup.admin;
    feeAuthority = testSetup.feeAuthority;
    referrer = testSetup.referrer;

    // Validate global config's initial values
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.admin).toEqual(admin.publicKey);
    expect(globalConfig.feeAuthority).toEqual(feeAuthority.publicKey);
    expect(globalConfig.referrer).toEqual(referrer.publicKey);
    expect(globalConfig.baseFeeBps).toEqual(1);
    expect(globalConfig.flowFeeBps).toEqual(2000);
    expect(globalConfig.assetMetas.length).toEqual(0);
  });

  it("Can add an asset meta", async () => {
    // Add SOL asset meta
    const tx = await program.methods
      .upsertAssetMeta({
        asset: TEST_ASSETS.SOL,
        decimals: 9,
        oracle: TEST_ORACLES.SOL_PYTH,
        oracleSource: { pyth: {} },
        maxAgeSeconds: 0,
        priority: 0,
        padding: [0, 0, 0],
      })
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Add asset meta transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify the asset meta was added
    expect(globalConfig.assetMetas.length).toEqual(1);
    expect(globalConfig.assetMetas[0].asset.toString()).toEqual(
      TEST_ASSETS.SOL.toString(),
    );
    expect(globalConfig.assetMetas[0].decimals).toEqual(9);
    expect(globalConfig.assetMetas[0].oracle.toString()).toEqual(
      TEST_ORACLES.SOL_PYTH.toString(),
    );
    // Verify the oracle source is Pyth
    expect(Object.keys(globalConfig.assetMetas[0].oracleSource)[0]).toEqual(
      "pyth",
    );
  });

  it("Can add multiple asset metas", async () => {
    // Add USDC asset meta
    const tx = await program.methods
      .upsertAssetMeta({
        asset: TEST_ASSETS.USDC,
        decimals: 6, // USDC decimals
        oracle: TEST_ORACLES.USDC_PYTH,
        oracleSource: { pyth: {} }, // OracleSource enum variant
        maxAgeSeconds: 0,
        priority: 0,
        padding: [0, 0, 0],
      })
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Add USDC asset meta transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify both asset metas exist
    expect(globalConfig.assetMetas.length).toEqual(2);

    // Verify the second asset meta is USDC
    const usdcMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.USDC.toString(),
    );
    expect(usdcMeta).toBeDefined();
    expect(usdcMeta?.decimals).toEqual(6);
    expect(usdcMeta?.oracle.toString()).toEqual(
      TEST_ORACLES.USDC_PYTH.toString(),
    );
  });

  it("Can update an asset meta", async () => {
    // Update SOL asset meta with new oracle
    const tx = await program.methods
      .upsertAssetMeta({
        asset: TEST_ASSETS.SOL,
        decimals: 9,
        oracle: TEST_ORACLES.SOL_PYTH,
        oracleSource: { pyth1K: {} }, // Different oracle source
        maxAgeSeconds: 0,
        priority: 0,
        padding: [0, 0, 0],
      })
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Update asset meta transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Find the SOL asset meta
    const solMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.SOL.toString(),
    );
    expect(Object.keys(solMeta?.oracleSource || {})[0]).toEqual("pyth1K");
  });

  it("Can delete an asset meta", async () => {
    // Delete the USDC asset meta
    const tx = await program.methods
      .deleteAssetMeta(TEST_ASSETS.USDC, TEST_ORACLES.USDC_PYTH)
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Delete asset meta transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify USDC asset meta was removed
    expect(globalConfig.assetMetas.length).toEqual(1);
    const usdcMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.USDC.toString(),
    );
    expect(usdcMeta).toBeUndefined();
  });

  it("Can update admin", async () => {
    // Create a new admin
    const newAdmin = Keypair.generate();

    // Update the admin
    const tx = await program.methods
      .updateAdmin(newAdmin.publicKey)
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Update admin transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify the admin was updated
    expect(globalConfig.admin.toString()).toEqual(
      newAdmin.publicKey.toString(),
    );

    // Update admin back to original for remaining tests
    await program.methods
      .updateAdmin(admin.publicKey)
      .accounts({
        globalConfig: globalConfigPDA,
        admin: newAdmin.publicKey,
      })
      .signers([newAdmin])
      .rpc();
  });

  it("Can update protocol fees", async () => {
    // Update protocol fees
    const newBaseFee = 2; // 0.02%
    const newFlowFee = 1500; // 15%

    const tx = await program.methods
      .updateProtocolFees(newBaseFee, newFlowFee)
      .accounts({
        globalConfig: globalConfigPDA,
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    console.log("Update protocol fees transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify the fees were updated
    expect(globalConfig.baseFeeBps).toEqual(newBaseFee);
    expect(globalConfig.flowFeeBps).toEqual(newFlowFee);
  });

  it("Cannot update protocol fees with invalid values", async () => {
    try {
      // Try to update with invalid fee values
      await program.methods
        .updateProtocolFees(101, 20000) // > 1% base fee, > 100% flow fee
        .accounts({
          globalConfig: globalConfigPDA,
          feeAuthority: feeAuthority.publicKey,
        })
        .signers([feeAuthority])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid fee values");
    } catch (error) {
      // Verify the error is about invalid parameters
      expect(error.toString()).toContain("InvalidParameters");
    }
  });

  it("Can update referrer", async () => {
    // Create a new referrer
    const newReferrer = Keypair.generate();

    // Update the referrer
    const tx = await program.methods
      .updateReferrer(newReferrer.publicKey)
      .accounts({
        globalConfig: globalConfigPDA,
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    console.log("Update referrer transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify the referrer was updated
    expect(globalConfig.referrer.toString()).toEqual(
      newReferrer.publicKey.toString(),
    );
  });

  it("Cannot perform admin operations without admin authority", async () => {
    try {
      // Try to add asset meta with fee authority instead of admin
      await program.methods
        .upsertAssetMeta({
          asset: TEST_ASSETS.MSOL,
          decimals: 9,
          oracle: TEST_ORACLES.SOL_PYTH,
          oracleSource: { pyth: {} },
          maxAgeSeconds: 0,
          priority: 0,
          padding: [0, 0, 0],
        })
        .accounts({
          globalConfig: globalConfigPDA,
          admin: feeAuthority.publicKey, // Using fee authority instead of admin
        })
        .signers([feeAuthority])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid authority");
    } catch (error) {
      // Verify the error is about invalid authority
      expect(error.toString()).toContain("InvalidAuthority");
    }
  });

  it("Cannot perform fee operations without fee authority", async () => {
    try {
      // Try to update protocol fees with admin instead of fee authority
      await program.methods
        .updateProtocolFees(3, 1800)
        .accounts({
          globalConfig: globalConfigPDA,
          feeAuthority: admin.publicKey, // Using admin instead of fee authority
        })
        .signers([admin])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid authority");
    } catch (error) {
      // Verify the error is about invalid authority
      expect(error.toString()).toContain("InvalidAuthority");
    }
  });

  it("Close global config", async () => {
    const tx = await program.methods
      .close()
      .accounts({
        globalConfig: globalConfigPDA,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Close global config transaction:", tx);
  });
});
