import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  GlamClient,
  nameToChars,
  StateAccountType,
  WSOL,
  getTokenAccountsByOwner,
  charsToName,
  fetchMintAndTokenProgram,
} from "../../src";
import { expectPublicKeyArrayEqual, sleep, str2seed } from "../test-utils";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { InitMintParams } from "../../src/client/mint";

const txOptions = {
  simulate: true,
};

const alice = Keypair.fromSeed(str2seed("alice"));
const bob = Keypair.fromSeed(str2seed("bob"));

describe("setup_and_ops", () => {
  const glamClient = new GlamClient();

  it("Initialize mint (no permanent delegate, no lockup, default_account_state_frozen=false)", async () => {
    const params = {
      name: nameToChars("GLAM Mint Test #0 No PD"),
      symbol: "GMT",
      uri: "https://glam.systems",
      defaultAccountStateFrozen: false,
      accountType: StateAccountType.MINT,
      baseAssetMint: WSOL,
      decimals: 0,
    };

    try {
      const txSig = await glamClient.mint.initialize(params, txOptions);
      console.log("Initialize mint #0", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual(charsToName(params.name));
    expect(stateModel.integrationAcls?.length).toEqual(1); // mint program is an integration
    expect(stateModel.mintModel?.nameStr).toEqual(charsToName(params.name));
    expect(stateModel.mintModel?.symbol).toEqual(params.symbol);
    expect(stateModel.mintModel?.baseAssetMint).toEqual(WSOL);
    expect(stateModel.mintModel?.defaultAccountStateFrozen).toEqual(false);
    expect(stateModel.mintModel?.permanentDelegate).toBeNull();
    expect(stateModel.mintModel?.lockupPeriod).toEqual(0);
    expect(stateModel.mintModel?.minSubscription.toNumber()).toEqual(0);
    expect(stateModel.mintModel?.minRedemption.toNumber()).toEqual(0);
    expect(stateModel.mintModel?.allowlist).toBeNull();
    expect(stateModel.mintModel?.blocklist).toBeNull();

    expect(stateModel.mint).toEqual(glamClient.mintPda);
    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      glamClient.connection,
      stateModel.mint!,
    );
    expect(tokenProgram).toEqual(TOKEN_2022_PROGRAM_ID);
    expect(mint.decimals).toBe(params.decimals);
  }, 25_000);

  it("Initialize mint (permanent delegate, lockup, default_account_state_frozen=true)", async () => {
    const name = "GLAM Mint Test #1";

    const params = {
      accountType: StateAccountType.MINT,
      name: nameToChars(name),
      symbol: "GMT",
      uri: "https://glam.systems",
      defaultAccountStateFrozen: true,
      permanentDelegate: PublicKey.unique(),
      baseAssetMint: WSOL,
      lockupPeriod: 3600,
      maxCap: new BN(1_000_000_000),
      minSubscription: new BN(1_000_000),
      minRedemption: new BN(2_000_000),
      allowlist: [PublicKey.unique()],
      blocklist: [PublicKey.unique()],
    };

    try {
      const txSig = await glamClient.mint.initialize(params, txOptions);
      console.log("Initialize mint #1", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.nameStr).toEqual(name);
    expect(stateModel.integrationAcls?.length).toEqual(1);

    expect(stateModel.mintModel?.nameStr).toEqual(name);
    expect(stateModel.mintModel?.symbol).toEqual("GMT");
    expect(stateModel.mintModel?.baseAssetMint).toEqual(WSOL);
    expect(stateModel.mintModel?.defaultAccountStateFrozen).toEqual(true);
    expect(stateModel.mintModel?.permanentDelegate).toEqual(
      params.permanentDelegate,
    );
    expect(stateModel.mintModel?.lockupPeriod).toEqual(params.lockupPeriod);
    expect(stateModel.mintModel?.maxCap.toNumber()).toEqual(
      params.maxCap.toNumber(),
    );
    expect(stateModel.mintModel?.minSubscription.toNumber()).toEqual(
      params.minSubscription.toNumber(),
    );
    expect(stateModel.mintModel?.minRedemption.toNumber()).toEqual(
      params.minRedemption.toNumber(),
    );
    expect(stateModel.mintModel?.allowlist).toEqual(params.allowlist);
    expect(stateModel.mintModel?.blocklist).toEqual(params.blocklist);
  }, 25_000);

  it("Initialize mint self permanent delegate", async () => {
    const name = "GLAM Mint Test #2";
    const params = {
      accountType: StateAccountType.MINT,
      name: nameToChars(name),
      symbol: "GMT",
      uri: "https://glam.systems",
      defaultAccountStateFrozen: true,
      permanentDelegate: new PublicKey(0), // set permanent delegate to the mint itself
      lockupPeriod: 3600,
      baseAssetMint: WSOL,
    };

    try {
      const txSig = await glamClient.mint.initialize(params, txOptions);
      console.log("Initialize mint #2", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.mintModel?.permanentDelegate).toEqual(glamClient.mintPda);
  }, 25_000);

  it("Create glam mint token account alice and check its state is frozen", async () => {
    const ixCreateAta = createAssociatedTokenAccountIdempotentInstruction(
      glamClient.signer, // payer
      glamClient.getMintAta(alice.publicKey),
      alice.publicKey,
      glamClient.mintPda,
      TOKEN_2022_PROGRAM_ID,
    );
    const tx = new Transaction().add(ixCreateAta);
    const txSig = await glamClient.sendAndConfirm(tx);
    console.log(
      `Create glam mint token account for ${alice.publicKey}:`,
      txSig,
    );
    const tokenAccount = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        alice.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccount?.frozen).toBe(true);
  });

  it("Update mint (no timelock)", async () => {
    try {
      const txSig = await glamClient.mint.update(
        {
          allowlist: [new PublicKey(0)],
          blocklist: [new PublicKey(1)],
          lockupPeriod: 5,
        },
        txOptions,
      );
      console.log("Update mint txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.mintModel?.lockupPeriod).toEqual(5);
    expectPublicKeyArrayEqual(stateModel.mintModel?.allowlist!, [
      new PublicKey(0),
    ]);
    expectPublicKeyArrayEqual(stateModel.mintModel?.blocklist!, [
      new PublicKey(1),
    ]);
  });

  it("Minting tokens to bob fails due to default state frozen", async () => {
    try {
      const txSig = await glamClient.mint.mint(
        bob.publicKey,
        new BN(1_000_000_000),
      );
      expect(txSig).toBeUndefined();
    } catch (e: any) {
      expect(e.programLogs).toContain("Program log: Error: Account is frozen");
    }
  }, 15_000);

  it("Unfreeze bob's token account before minting tokens", async () => {
    const amount = new BN(1_000_000_000);
    try {
      const txSig = await glamClient.mint.mint(
        bob.publicKey,
        amount,
        true,
        txOptions,
      );
      console.log("mint txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const tokenAccount = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        bob.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccount?.frozen).toBe(false);
    expect(tokenAccount?.amount).toBe(amount.toString());
  });

  it("Freeze bob's token account", async () => {
    // Before: token account is not frozen
    const tokenAccount = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        bob.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccount?.frozen).toBe(false);

    // Freeze token account using Token ACL (since defaultAccountStateFrozen enables Token ACL)
    const ata = glamClient.getMintAta(bob.publicKey);
    try {
      const txSig = await glamClient.mint.tokenAclFreeze([ata]);
      console.log("tokenAclFreeze txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // After: token account is frozen
    const tokenAccountAfter = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        bob.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccountAfter?.frozen).toBe(true);
  });

  it("Force transfer 0.5 share from bob to alice", async () => {
    await sleep(5000); // wait for lockup period to expire

    const from = bob.publicKey;
    const to = alice.publicKey;

    const amount = new BN(500_000_000);
    try {
      const txSig = await glamClient.mint.forceTransfer(from, to, amount, true);
      console.log("forceTransfer txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const tokenAccountAlice = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        alice.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    const tokenAccountBob = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        bob.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));

    expect(tokenAccountAlice?.amount).toBe(amount.toString()); // 0 + 0.5 = 0.5
    expect(tokenAccountBob?.amount).toBe(amount.toString()); // 1 - 0.5 = 0.5
  }, 10_000);

  it("Burn 0.5 share from alice and bob", async () => {
    const amount = new BN(500_000_000);
    try {
      const txSigAlice = await glamClient.mint.burn(alice.publicKey, amount);
      const txSigBob = await glamClient.mint.burn(bob.publicKey, amount);
      console.log("burn alice's share txSig", txSigAlice);
      console.log("burn bob's share txSig", txSigBob);
    } catch (e) {
      console.error(e);
      throw e;
    }

    const tokenAccountAlice = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        alice.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccountAlice?.amount).toEqual("0");

    const tokenAccountBob = (
      await getTokenAccountsByOwner(
        glamClient.provider.connection,
        alice.publicKey,
      )
    ).find((ta) => ta.mint.equals(glamClient.mintPda));
    expect(tokenAccountBob?.amount).toEqual("0");
  });

  it("Close mint", async () => {
    try {
      const txSig = await glamClient.mint.close(txOptions);
      console.log("Close mint txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Verify mint, extra metas, and request queue accounts are closed
    const accountsInfo =
      await glamClient.provider.connection.getMultipleAccountsInfo([
        glamClient.mintPda,
        glamClient.extraMetasPda,
        glamClient.requestQueuePda,
      ]);
    expect(accountsInfo[0]).toBeNull();
    expect(accountsInfo[1]).toBeNull();
    expect(accountsInfo[2]).toBeNull();

    // Verify glam state is updated
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.mint).toBeNull();
  });
});
