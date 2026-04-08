import { BN, Wallet } from "@coral-xyz/anchor";

import {
  airdrop,
  createGlamStateForTest,
  stateModelForTest,
  str2seed,
} from "../glam_protocol/setup";
import { GlamClient, MSOL, nameToChars, WSOL } from "../../src";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { Keypair, Transaction } from "@solana/web3.js";
import { TransferPolicy } from "../../src/deser/integrationPolicies";

const txOptions = { simulate: true };
const delegate = Keypair.fromSeed(str2seed("delegate"));
const alice = Keypair.fromSeed(str2seed("alice"));
const bob = Keypair.fromSeed(str2seed("bob"));

describe("spl", () => {
  const glamClient = new GlamClient();
  const glamClientDelegate = new GlamClient({ wallet: new Wallet(delegate) });

  beforeAll(async () => {
    await airdrop(
      glamClient.provider.connection,
      delegate.publicKey,
      10_000_000_000,
    );
  });

  it("Create vault", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...stateModelForTest,
      name: nameToChars("Spl Tests"),
      integrationAcls: [
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: 0b00000001, // system program
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.extSplProgram.programId,
          protocolsBitmask: 0b00000001, // token program
          protocolPolicies: [],
        },
      ],
    });

    glamClientDelegate.statePda = statePda;

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());
  }, 25_000);

  it("Manager deposits 2 SOL to vault", async () => {
    try {
      const txSig = await glamClient.vault.depositSol(
        2_000_000_000,
        false,
        txOptions,
      );
      console.log("Deposit 2 SOL:", txSig);
    } catch (error) {
      throw error;
    }

    // 2 SOL, 0 wSOL
    const vaultLamports = await glamClient.getVaultLamports();
    const vaultWsol = await glamClient.getVaultTokenBalance(WSOL);
    expect(vaultLamports).toEqual(2_000_000_000);
    expect(vaultWsol.amount).toEqual(new BN(0));
  });

  it("Manager deposits 2 SOL that gets auto wrapped to wSOL", async () => {
    try {
      const txSig = await glamClient.vault.depositSol(
        2_000_000_000,
        true,
        txOptions,
      );
      console.log("Deposit and wrap 2 SOL:", txSig);
    } catch (error) {
      throw error;
    }

    // 2 SOL, 2 wSOL
    const { uiAmount: wSolBalance } =
      await glamClient.getVaultTokenBalance(WSOL);
    expect(wSolBalance).toEqual(2);
  });

  it("Manager unwraps 2 wSOL", async () => {
    try {
      const txSig = await glamClient.vault.unwrap(txOptions);
      console.log("Unwrap 2 wSOL:", txSig);
    } catch (error) {
      throw error;
    }

    // 4 SOL, 0 wSOL
    const { uiAmount: wSolBalance } =
      await glamClient.getVaultTokenBalance(WSOL);
    expect(wSolBalance).toEqual(0);
  });

  it("Manager wraps 2 SOL", async () => {
    try {
      const txSig = await glamClient.vault.wrap(2_000_000_000, txOptions);
      console.log("Wrap 2 SOL:", txSig);
    } catch (error) {
      throw error;
    }

    // 2 SOL, 2 wSOL
    const { uiAmount: wSolBalance } =
      await glamClient.getVaultTokenBalance(WSOL);
    expect(wSolBalance).toEqual(2);
  });

  it("Manager grants delegate TransferToAllowlisted permission and allowlists alice", async () => {
    try {
      const txSig = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.protocolProgram.programId,
        0b01, // system program
        new BN(0b10), // TRANSFER_TO_ALLOWLISTED
      );
      console.log(
        "Grant delegate system TransferToAllowlisted permission:",
        txSig,
      );

      const txSig2 = await glamClient.access.grantDelegatePermissions(
        delegate.publicKey,
        glamClient.extSplProgram.programId,
        0b01, // token program
        new BN(0b01), // TRANSFER_TO_ALLOWLISTED
      );
      console.log(
        "Grant delegate token TransferToAllowlisted permission:",
        txSig2,
      );
    } catch (error) {
      throw error;
    }

    try {
      // Same policy data for both integration programs
      const transferPolicyData = new TransferPolicy([alice.publicKey]).encode();

      const txSig = await glamClient.access.setProtocolPolicy(
        glamClient.protocolProgram.programId,
        0b01, // system program
        transferPolicyData,
      );
      console.log("Update system transfer allowlist:", txSig);

      const txSig2 = await glamClient.access.setProtocolPolicy(
        glamClient.extSplProgram.programId,
        0b01, // token program
        transferPolicyData,
      );
      console.log("Update token transfer allowlist:", txSig2);
    } catch (error) {
      throw error;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.delegateAcls?.length).toEqual(1);
    expect(stateModel.delegateAcls![0].pubkey).toEqual(delegate.publicKey);

    // Verify system transfer policy
    const integrationAcl = stateModel.integrationAcls?.find((acl) =>
      acl.integrationProgram.equals(glamClient.protocolProgram.programId),
    );
    const transferPolicyData = integrationAcl?.protocolPolicies![0].data!;
    const transferPolicy = TransferPolicy.decode(transferPolicyData);
    expect(transferPolicy.allowlist).toEqual([alice.publicKey]);

    // Verify token transfer policy
    const splIntegrationAcl = stateModel.integrationAcls?.find((acl) =>
      acl.integrationProgram.equals(glamClient.extSplProgram.programId),
    );
    const splTransferPolicyData = splIntegrationAcl?.protocolPolicies![0].data!;
    const splTransferPolicy = TransferPolicy.decode(splTransferPolicyData);
    expect(splTransferPolicy.allowlist).toEqual([alice.publicKey]);
  });

  it("Delegate transfers 1 wSOL + 1 SOL from vault to alice", async () => {
    try {
      const txSig = await glamClientDelegate.vault.tokenTransfer(
        WSOL,
        1_000_000_000,
        alice.publicKey,
        txOptions,
      );
      console.log("Delegate transferred 1 wSOL from vault to alice:", txSig);
    } catch (error) {
      throw error;
    }

    try {
      const txSig = await glamClientDelegate.vault.systemTransfer(
        1_000_000_000,
        alice.publicKey,
        txOptions,
      );
      console.log("Delegate transferred 1 SOL from vault to alice:", txSig);
    } catch (error) {
      throw error;
    }

    // 1 wSOL, 1 SOL left
    const { uiAmount: wSolBalance } =
      await glamClient.getVaultTokenBalance(WSOL);
    const solBalance = await glamClient.getVaultBalance();
    expect(wSolBalance).toEqual(1);
    expect(solBalance).toEqual(1);
  });

  it("Delegate fails to transfer 1 wSOL from vault to bob", async () => {
    try {
      const txSig = await glamClientDelegate.vault.tokenTransfer(
        WSOL,
        1_000_000_000,
        bob.publicKey,
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe("Signer is not authorized");
    }

    try {
      const txSig = await glamClientDelegate.vault.systemTransfer(
        1_000_000_000,
        bob.publicKey,
        txOptions,
      );
      expect(txSig).toBeUndefined();
    } catch (error) {
      expect(error.message).toBe("Signer is not authorized");
    }
  });

  it("Delegate closes vault token accounts", async () => {
    const tx = new Transaction();
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        glamClient.signer,
        glamClient.getVaultAta(MSOL),
        glamClient.vaultPda,
        MSOL,
      ),
    );
    const txCreateAta = await glamClient.sendAndConfirm(tx);
    console.log("Create vault MSOL ata:", txCreateAta);

    try {
      const txSig = await glamClientDelegate.vault.closeTokenAccounts(
        [
          glamClientDelegate.getVaultAta(WSOL),
          glamClientDelegate.getVaultAta(MSOL),
        ],
        txOptions,
      );
      console.log("Closed vault token accounts:", txSig);
    } catch (error) {
      throw error;
    }
  });
});
