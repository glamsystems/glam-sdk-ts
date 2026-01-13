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

  it("Extends account when adding many assets", async () => {
    // Add 15 assets to trigger account extension
    // Account starts with space for ~3-4 assets, extensions happen in chunks of 10
    for (let i = 0; i < 15; i++) {
      const assetKeypair = Keypair.generate();
      const oracleKeypair = Keypair.generate();

      await program.methods
        .upsertAssetMeta({
          asset: assetKeypair.publicKey,
          decimals: 9,
          oracle: oracleKeypair.publicKey,
          oracleSource: { pyth: {} },
          maxAgeSeconds: 30,
          priority: i,
          padding: [0, 0, 0],
        })
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    }

    // Verify all assets are accessible
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Should have SOL + USDC + 15 new = 17 total
    expect(globalConfig.assetMetas.length).toEqual(17);

    // Verify we can still find assets
    const solMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.SOL.toString(),
    );
    expect(solMeta).toBeDefined();
  }, 30_000);

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

  it("Upserting same asset+oracle updates instead of duplicating", async () => {
    // Get current count
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const countBefore = globalConfig.assetMetas.length;

    // Find existing SOL asset
    const solMetaBefore = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.SOL.toString(),
    );
    expect(solMetaBefore).toBeDefined();
    const originalPriority = solMetaBefore!.priority;

    // Upsert SOL with same oracle but different parameters
    await program.methods
      .upsertAssetMeta({
        asset: TEST_ASSETS.SOL,
        decimals: 9,
        oracle: TEST_ORACLES.SOL_PYTH,
        oracleSource: { switchboard: {} }, // Change oracle source
        maxAgeSeconds: 60, // Change max age
        priority: 99, // Change priority
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // Verify count stayed the same (update, not add)
    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBefore);

    // Verify parameters were updated
    const solMetaAfter = globalConfig.assetMetas.find(
      (meta) =>
        meta.asset.toString() === TEST_ASSETS.SOL.toString() &&
        meta.oracle.toString() === TEST_ORACLES.SOL_PYTH.toString(),
    );
    expect(solMetaAfter).toBeDefined();
    expect(Object.keys(solMetaAfter?.oracleSource || {})[0]).toEqual(
      "switchboard",
    );
    expect(solMetaAfter?.maxAgeSeconds).toEqual(60);
    expect(solMetaAfter?.priority).toEqual(99);
    expect(solMetaAfter?.priority).not.toEqual(originalPriority);
  });

  it("Can delete an asset meta", async () => {
    // Get current count before deletion
    const configBefore =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const countBefore = configBefore.assetMetas.length;

    // Delete the USDC asset meta
    const tx = await program.methods
      .deleteAssetMeta(TEST_ASSETS.USDC, TEST_ORACLES.USDC_PYTH)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log("Delete asset meta transaction:", tx);

    // Fetch the updated global config
    const globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);

    // Verify USDC asset meta was removed
    expect(globalConfig.assetMetas.length).toEqual(countBefore - 1);
    const usdcMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === TEST_ASSETS.USDC.toString(),
    );
    expect(usdcMeta).toBeUndefined();
  });

  it("Cannot delete non-existent asset", async () => {
    // Try to delete an asset that doesn't exist
    const nonExistentAsset = Keypair.generate().publicKey;
    const nonExistentOracle = Keypair.generate().publicKey;

    try {
      await program.methods
        .deleteAssetMeta(nonExistentAsset, nonExistentOracle)
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      fail("Should have thrown an error for deleting non-existent asset");
    } catch (error: any) {
      expect(error.toString()).toContain("InvalidAssetMeta");
    }
  });

  it("Can delete first asset and verify shift", async () => {
    // First, add 3 more assets (we have SOL already, USDC was deleted)
    const asset2 = Keypair.generate().publicKey;
    const asset3 = Keypair.generate().publicKey;
    const oracle2 = Keypair.generate().publicKey;
    const oracle3 = Keypair.generate().publicKey;

    await program.methods
      .upsertAssetMeta({
        asset: asset2,
        decimals: 6,
        oracle: oracle2,
        oracleSource: { pyth: {} },
        maxAgeSeconds: 0,
        priority: 1,
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    await program.methods
      .upsertAssetMeta({
        asset: asset3,
        decimals: 9,
        oracle: oracle3,
        oracleSource: { pyth: {} },
        maxAgeSeconds: 0,
        priority: 2,
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // Get initial state
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const countBefore = globalConfig.assetMetas.length;
    const firstAsset = globalConfig.assetMetas[0];
    const secondAssetBefore = globalConfig.assetMetas[1];

    // Delete first asset
    await program.methods
      .deleteAssetMeta(firstAsset.asset, firstAsset.oracle)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // Verify shift occurred
    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBefore - 1);

    // What was second should now be first
    expect(globalConfig.assetMetas[0].asset.toString()).toEqual(
      secondAssetBefore.asset.toString(),
    );
  });

  it("Can delete last asset", async () => {
    // Get current state
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const countBefore = globalConfig.assetMetas.length;
    const lastAsset = globalConfig.assetMetas[countBefore - 1];
    const secondToLast = globalConfig.assetMetas[countBefore - 2];

    // Delete last asset
    await program.methods
      .deleteAssetMeta(lastAsset.asset, lastAsset.oracle)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    // Verify deletion
    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBefore - 1);

    // Second to last should still be in same position
    expect(globalConfig.assetMetas[countBefore - 2].asset.toString()).toEqual(
      secondToLast.asset.toString(),
    );
  });

  it("Can update admin", async () => {
    // Create a new admin
    const newAdmin = Keypair.generate();

    // Update the admin
    const tx = await program.methods
      .updateAdmin(newAdmin.publicKey)
      .accounts({
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
          feeAuthority: feeAuthority.publicKey,
        })
        .signers([feeAuthority])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid fee values");
    } catch (error: any) {
      // Verify the error is about invalid parameters
      expect(error.toString()).toContain("InvalidParameters");
    }
  });

  it("Can update fees with boundary values", async () => {
    // Test baseFeeBps = 0 (valid minimum)
    await program.methods
      .updateProtocolFees(0, 5000)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.baseFeeBps).toEqual(0);
    expect(globalConfig.flowFeeBps).toEqual(5000);

    // Test baseFeeBps = 100 (valid maximum - 1%)
    await program.methods
      .updateProtocolFees(100, 5000)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.baseFeeBps).toEqual(100);

    // Test flowFeeBps = 0 (valid minimum)
    await program.methods
      .updateProtocolFees(50, 0)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.flowFeeBps).toEqual(0);

    // Test flowFeeBps = 10000 (valid maximum - 100%)
    await program.methods
      .updateProtocolFees(50, 10000)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.flowFeeBps).toEqual(10000);
  });

  it("Rejects fees at exact boundary invalid values", async () => {
    // Test baseFeeBps = 101 (min invalid)
    try {
      await program.methods
        .updateProtocolFees(101, 5000)
        .accounts({
          feeAuthority: feeAuthority.publicKey,
        })
        .signers([feeAuthority])
        .rpc();
      fail("Should have thrown an error for baseFeeBps > 100");
    } catch (error: any) {
      expect(error.toString()).toContain("InvalidParameters");
    }

    // Test flowFeeBps = 10001 (min invalid)
    try {
      await program.methods
        .updateProtocolFees(50, 10001)
        .accounts({
          feeAuthority: feeAuthority.publicKey,
        })
        .signers([feeAuthority])
        .rpc();
      fail("Should have thrown an error for flowFeeBps > 10000");
    } catch (error: any) {
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
          admin: feeAuthority.publicKey, // Using fee authority instead of admin
        })
        .signers([feeAuthority])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid authority");
    } catch (error: any) {
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
          feeAuthority: admin.publicKey, // Using admin instead of fee authority
        })
        .signers([admin])
        .rpc();

      // If we reach here, the test should fail
      fail("Should have thrown an error for invalid authority");
    } catch (error: any) {
      // Verify the error is about invalid authority
      expect(error.toString()).toContain("InvalidAuthority");
    }
  });

  // ========== Priority 2: Important Edge Cases ==========

  it("Verifies proper account extension beyond initial capacity", async () => {
    // Get initial account size
    const accountInfoBefore =
      await provider.connection.getAccountInfo(globalConfigPDA);
    const initialSize = accountInfoBefore?.data.length || 0;

    // Count current assets
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const assetCountBefore = globalConfig.assetMetas.length;

    // Add 20 more assets to ensure extension happens
    for (let i = 0; i < 20; i++) {
      const assetKeypair = Keypair.generate();
      const oracleKeypair = Keypair.generate();

      await program.methods
        .upsertAssetMeta({
          asset: assetKeypair.publicKey,
          decimals: 6,
          oracle: oracleKeypair.publicKey,
          oracleSource: { pyth: {} },
          maxAgeSeconds: 60,
          priority: 100 + i,
          padding: [0, 0, 0],
        })
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    }

    // Verify account was extended
    const accountInfoAfter =
      await provider.connection.getAccountInfo(globalConfigPDA);
    const finalSize = accountInfoAfter?.data.length || 0;
    expect(finalSize).toBeGreaterThan(initialSize);

    // Verify all assets are accessible
    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(assetCountBefore + 20);
  }, 20_000);

  it("Maintains data consistency through sequential state changes", async () => {
    // Perform a sequence of operations and verify state remains consistent

    // 1. Add an asset
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const countBeforeAdd = globalConfig.assetMetas.length;

    const testAsset = Keypair.generate().publicKey;
    const testOracle = Keypair.generate().publicKey;
    await program.methods
      .upsertAssetMeta({
        asset: testAsset,
        decimals: 9,
        oracle: testOracle,
        oracleSource: { pyth: {} },
        maxAgeSeconds: 30,
        priority: 200,
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBeforeAdd + 1);

    // 2. Update the same asset
    await program.methods
      .upsertAssetMeta({
        asset: testAsset,
        decimals: 9,
        oracle: testOracle,
        oracleSource: { switchboard: {} },
        maxAgeSeconds: 120,
        priority: 201,
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBeforeAdd + 1); // No increase
    const updatedMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === testAsset.toString(),
    );
    expect(updatedMeta?.priority).toEqual(201);
    expect(Object.keys(updatedMeta?.oracleSource || {})[0]).toEqual(
      "switchboard",
    );

    // 3. Delete the asset
    await program.methods
      .deleteAssetMeta(testAsset, testOracle)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(countBeforeAdd);

    // 4. Verify asset is truly gone
    const deletedMeta = globalConfig.assetMetas.find(
      (meta) => meta.asset.toString() === testAsset.toString(),
    );
    expect(deletedMeta).toBeUndefined();
  }, 20_000);

  it("Handles empty asset list after all deletions", async () => {
    // Get all current assets
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const allAssets = [...globalConfig.assetMetas];

    // Delete all assets one by one
    for (const assetMeta of allAssets) {
      await program.methods
        .deleteAssetMeta(assetMeta.asset, assetMeta.oracle)
        .accounts({
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    }

    // Verify empty asset list
    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(0);

    // Verify we can still add assets to empty list
    const newAsset = Keypair.generate().publicKey;
    const newOracle = Keypair.generate().publicKey;
    await program.methods
      .upsertAssetMeta({
        asset: newAsset,
        decimals: 6,
        oracle: newOracle,
        oracleSource: { pyth: {} },
        maxAgeSeconds: 30,
        priority: 1,
        padding: [0, 0, 0],
      })
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.assetMetas.length).toEqual(1);
    expect(globalConfig.assetMetas[0].asset.toString()).toEqual(
      newAsset.toString(),
    );
  }, 30000); // 30 second timeout for deleting many assets

  it("Supports multiple admin changes in sequence", async () => {
    // Get initial admin
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const originalAdmin = globalConfig.admin;

    // Create a chain of admins
    const admin1 = Keypair.generate();
    const admin2 = Keypair.generate();
    const admin3 = Keypair.generate();

    // Change to admin1
    await program.methods
      .updateAdmin(admin1.publicKey)
      .accounts({
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.admin.toString()).toEqual(admin1.publicKey.toString());

    // Change to admin2 (using admin1)
    await program.methods
      .updateAdmin(admin2.publicKey)
      .accounts({
        admin: admin1.publicKey,
      })
      .signers([admin1])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.admin.toString()).toEqual(admin2.publicKey.toString());

    // Change to admin3 (using admin2)
    await program.methods
      .updateAdmin(admin3.publicKey)
      .accounts({
        admin: admin2.publicKey,
      })
      .signers([admin2])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.admin.toString()).toEqual(admin3.publicKey.toString());

    // Restore original admin (using admin3)
    await program.methods
      .updateAdmin(originalAdmin)
      .accounts({
        admin: admin3.publicKey,
      })
      .signers([admin3])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.admin.toString()).toEqual(originalAdmin.toString());
  });

  it("Validates fee updates with various combinations", async () => {
    // Test various valid fee combinations
    const validCombinations = [
      { baseFeeBps: 0, flowFeeBps: 0 }, // Both zero
      { baseFeeBps: 100, flowFeeBps: 10000 }, // Both max
      { baseFeeBps: 50, flowFeeBps: 5000 }, // Both middle
      { baseFeeBps: 0, flowFeeBps: 10000 }, // Min base, max flow
      { baseFeeBps: 100, flowFeeBps: 0 }, // Max base, min flow
      { baseFeeBps: 25, flowFeeBps: 7500 }, // Quarter and 3/4
    ];

    for (const { baseFeeBps, flowFeeBps } of validCombinations) {
      await program.methods
        .updateProtocolFees(baseFeeBps, flowFeeBps)
        .accounts({
          feeAuthority: feeAuthority.publicKey,
        })
        .signers([feeAuthority])
        .rpc();

      const globalConfig =
        await program.account.globalConfig.fetch(globalConfigPDA);
      expect(globalConfig.baseFeeBps).toEqual(baseFeeBps);
      expect(globalConfig.flowFeeBps).toEqual(flowFeeBps);
    }

    // Reset to reasonable defaults
    await program.methods
      .updateProtocolFees(10, 1000)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();
  });

  it("Validates referrer updates and state", async () => {
    // Get initial referrer
    let globalConfig =
      await program.account.globalConfig.fetch(globalConfigPDA);
    const initialReferrer = globalConfig.referrer;

    // Update to new referrer
    const newReferrer = Keypair.generate().publicKey;
    await program.methods
      .updateReferrer(newReferrer)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.referrer.toString()).toEqual(newReferrer.toString());

    // Update to another referrer
    const anotherReferrer = Keypair.generate().publicKey;
    await program.methods
      .updateReferrer(anotherReferrer)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.referrer.toString()).toEqual(
      anotherReferrer.toString(),
    );

    // Restore original referrer
    await program.methods
      .updateReferrer(initialReferrer)
      .accounts({
        feeAuthority: feeAuthority.publicKey,
      })
      .signers([feeAuthority])
      .rpc();

    globalConfig = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfig.referrer.toString()).toEqual(
      initialReferrer.toString(),
    );
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
