import { BN } from "@coral-xyz/anchor";
import { GlamClient, nameToChars, USDC } from "../../src";
import {
  buildAndSendTx,
  createGlamStateForTest,
  defaultInitStateParams,
  mintUSDC,
} from "../glam_protocol/setup";
import { PublicKey } from "@solana/web3.js";
import { DriftVaultsPolicy } from "../../src/deser/integrationPolicies";

const LUCKY_VAULT_USDC = new PublicKey(
  "DvbTJb2YFUptM3bGRqe67Tw93QfQgrkjjVPkRqpppWTx",
);
const NEUTRAL_TRADE_HJLP = new PublicKey(
  "A1B9MVput3r1jS91iu8ckdDiMSugXbQeEtvJEQsUHsPi",
);
const KNIGHT_TRADE_JLP = new PublicKey(
  "FS9fJYRrQ2hQPcXJTFrC1zBskTE3z4WayzbYL8jFrQK7",
);
const NEUTRAL_TRADE_USDC = new PublicKey(
  "7ngzeBygEksaBvKzHEeihqoLpDpWqTNRMVh2wCyb6NP8",
);
const GAUNLET_HJLP = new PublicKey(
  "CoHd9JpwfcA76XQGA4AYfnjvAtWKoBQ6eWBkFzR1A2ui",
);

const txOptions = {
  simulate: true,
};

describe("glam_drift_vaults", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      baseAssetMint: USDC,
      name: nameToChars("Drift Vaults Tests"),
      integrationAcls: [
        {
          integrationProgram: glamClient.mintProgram.programId,
          protocolsBitmask: 0b01, // mint program is required for pricing to work
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.extDriftProgram.programId,
          protocolsBitmask: 0b10, // drift vaults
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: 0b01, // system program
          protocolPolicies: [],
        },
      ],
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const state = await glamClient.fetchStateAccount();
    expect(state.integrationAcls.length).toEqual(3);

    // Airdrop 1000 USDC to vault
    const connection = glamClient.provider.connection;
    await mintUSDC(connection, vaultPda, 1_000);
  }, 30_000);

  it("Set vaults policy", async () => {
    const vaultsPolicy = new DriftVaultsPolicy([]);
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.extDriftProgram.programId,
        0b10, // drift vaults
        vaultsPolicy.encode(),
        txOptions,
      );
      console.log("setProtocolPolicy", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Initialize vault depositor - fail due to policy violation", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        LUCKY_VAULT_USDC,
        txOptions,
      );
      expect(txSig).toBeDefined();
    } catch (e: any) {
      expect(e.message).toBe("Protocol policy violation");
    }
  });

  it("Update policy to allowlist vaults", async () => {
    const vaultsPolicy = new DriftVaultsPolicy([
      LUCKY_VAULT_USDC,
      NEUTRAL_TRADE_HJLP,
      KNIGHT_TRADE_JLP,
      NEUTRAL_TRADE_USDC,
      GAUNLET_HJLP,
    ]);
    try {
      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.extDriftProgram.programId,
        0b10, // drift vaults
        vaultsPolicy.encode(),
        txOptions,
      );
      console.log("setProtocolPolicy", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  /*
  it("Initialize vault depositor #0", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        LUCKY_VAULT_USDC,
        { simulate: true },
      );
      console.log("initializeVaultDepositor #0", txSig);

      // Skip deposit as we copy vault account from mainnet and vault is currently at capacity as of 2025-09-05
      const depositTxSig = await glamClient.driftVaults.deposit(
        LUCKY_VAULT_USDC,
        new BN(100_000_000),
        { simulate: true },
      );
      console.log("deposit #0", depositTxSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toEqual(1);
  }, 15_000);
  */

  it("Initialize vault depositor #1", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        NEUTRAL_TRADE_HJLP,
        txOptions,
      );
      console.log("initializeVaultDepositor #1", txSig);

      const depositTxSig = await glamClient.driftVaults.deposit(
        NEUTRAL_TRADE_HJLP,
        new BN(100_000_000),
        txOptions,
      );
      console.log("deposit #1", depositTxSig);

      const requestWithdrawTxSig = await glamClient.driftVaults.requestWithdraw(
        NEUTRAL_TRADE_HJLP,
        new BN(50_000_000),
        txOptions,
      );
      console.log("request withdraw #1", requestWithdrawTxSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 15_000);

  it("Initialize vault depositor #2", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        KNIGHT_TRADE_JLP,
        { simulate: true },
      );
      console.log("initializeVaultDepositor #2", txSig);

      const depositTxSig = await glamClient.driftVaults.deposit(
        KNIGHT_TRADE_JLP,
        new BN(100_000_000),
        { simulate: true },
      );
      console.log("deposit #2", depositTxSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 15_000);

  it("Initialize vault depositor #3", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        NEUTRAL_TRADE_USDC,
        { simulate: true },
      );
      console.log("initializeVaultDepositor #3", txSig);

      const depositTxSig = await glamClient.driftVaults.deposit(
        NEUTRAL_TRADE_USDC,
        new BN(100_000_000),
        { simulate: true },
      );
      console.log("deposit #3", depositTxSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 15_000);

  it("Initialize vault depositor #4", async () => {
    try {
      const txSig = await glamClient.driftVaults.initializeVaultDepositor(
        GAUNLET_HJLP,
        { simulate: true },
      );
      console.log("initializeVaultDepositor #4", txSig);

      const depositTxSig = await glamClient.driftVaults.deposit(
        GAUNLET_HJLP,
        new BN(100_000_000),
        { simulate: true },
      );
      console.log("deposit #4", depositTxSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, 15_000);

  it("Price vault depositors", async () => {
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.externalPositions?.length).toEqual(4);

    try {
      const priceTokensIx = await glamClient.price.priceVaultTokensIx();
      const priceDriftVaultIx =
        await glamClient.price.priceDriftVaultDepositorsIx();
      const validateAumIx = await glamClient.price.validateAumIx();
      const txSig = await buildAndSendTx(glamClient, [
        priceTokensIx!,
        priceDriftVaultIx!,
        validateAumIx,
      ]);

      console.log("priceDriftVaultDepositors", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const aum = await glamClient.price.getAum();
    console.log("AUM:", aum.toString());
    expect(aum.gte(new BN(1_000_000_000))).toBeTruthy();
    expect(aum.lte(new BN(1_100_000_000))).toBeTruthy();
  }, 15_000);
});
