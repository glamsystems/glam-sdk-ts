import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  GlamClient,
  stringToChars,
  StateAccountType,
  WSOL,
  fetchMintAndTokenProgram,
  isTokenAclEnabled,
  TOKEN_ACL_PROGRAM,
  TOKEN_ACL_GATE_PROGRAM,
  getTokenAclMintConfigPda,
  getTokenAclGateListConfigPda,
  getTokenAclGateWalletEntryPda,
  getTokenAclGateExtraMetasPda,
} from "../../src";
import { str2seed, airdrop } from "../test-utils";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Wallet } from "@coral-xyz/anchor";

const txOptions = {
  simulate: true,
};

const alice = Keypair.fromSeed(str2seed("token_acl_alice"));
const bob = Keypair.fromSeed(str2seed("token_acl_bob"));

describe("token_acl", () => {
  const glamClient = new GlamClient();
  const glamClientAlice = new GlamClient({
    wallet: new Wallet(alice),
  });

  // Shared state across tests
  let glamMint: PublicKey;
  let mintConfigPda: PublicKey;
  let listSeed: Buffer;
  let listConfigPda: PublicKey;

  beforeAll(async () => {
    const connection = glamClient.provider.connection;
    await airdrop(connection, alice.publicKey, 10_000_000_000);
    await airdrop(connection, bob.publicKey, 10_000_000_000);
  }, 15_000);

  it("Initialize mint with defaultAccountStateFrozen=true", async () => {
    const params = {
      name: stringToChars("Token ACL Test"),
      symbol: "TACL",
      uri: "https://glam.systems",
      defaultAccountStateFrozen: true,
      accountType: StateAccountType.MINT,
      baseAssetMint: WSOL,
      decimals: 6,
    };

    try {
      const txSig = await glamClient.mint.initialize(params, txOptions);
      console.log("Initialize mint for Token ACL test:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    glamMint = glamClient.mintPda;
    mintConfigPda = getTokenAclMintConfigPda(glamMint);

    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      glamClient.connection,
      glamMint,
    );
    expect(tokenProgram).toEqual(TOKEN_2022_PROGRAM_ID);
    expect(mint.decimals).toBe(6);

    // Before Token ACL: freeze authority should be the mint PDA itself
    expect(mint.freezeAuthority?.toBase58()).toEqual(glamMint.toBase58());

    // Token ACL should not be enabled yet
    const aclEnabled = await isTokenAclEnabled(glamClient.connection, glamMint);
    expect(aclEnabled).toBe(false);
  }, 25_000);

  it("Enable Token ACL", async () => {
    const txSig = await glamClient.mint.enableTokenAcl(
      glamClient.mintPda, // authority = mint PDA
      undefined, // default gating program (Token ACL Gate)
      txOptions,
    );
    console.log("Enable Token ACL:", txSig);

    // Verify freeze authority transferred to Token ACL program (MintConfig PDA)
    const { mint } = await fetchMintAndTokenProgram(
      glamClient.connection,
      glamMint,
    );
    // After Token ACL: freeze authority should be the MintConfig PDA
    expect(mint.freezeAuthority?.toBase58()).toEqual(mintConfigPda.toBase58());

    // isTokenAclEnabled should return true
    const aclEnabled = await isTokenAclEnabled(glamClient.connection, glamMint);
    expect(aclEnabled).toBe(true);
  }, 25_000);

  it("Verify MintConfig PDA was created", async () => {
    const accountInfo =
      await glamClient.connection.getAccountInfo(mintConfigPda);
    expect(accountInfo).not.toBeNull();
    expect(accountInfo!.owner.toBase58()).toEqual(TOKEN_ACL_PROGRAM.toBase58());
  });

  it("setTokenAccountsStates should fail when Token ACL is active", async () => {
    glamClientAlice.statePda = glamClient.statePda;

    try {
      await glamClient.mint.setTokenAccountsStates(
        [alice.publicKey],
        true,
        txOptions,
      );
      throw new Error("Expected setTokenAccountsStates to fail");
    } catch (e: any) {
      expect(e.toString()).toContain("Token ACL is enabled");
    }
  }, 15_000);

  it("New token accounts are created frozen (DefaultAccountState)", async () => {
    // Create ATAs for alice and bob — they should be auto-frozen
    const aliceAta = getAssociatedTokenAddressSync(
      glamMint,
      alice.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const bobAta = getAssociatedTokenAddressSync(
      glamMint,
      bob.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    const createAliceAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClient.signer,
      aliceAta,
      alice.publicKey,
      glamMint,
      TOKEN_2022_PROGRAM_ID,
    );
    const createBobAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      glamClient.signer,
      bobAta,
      bob.publicKey,
      glamMint,
      TOKEN_2022_PROGRAM_ID,
    );

    const tx = new Transaction().add(createAliceAtaIx, createBobAtaIx);
    await glamClient.sendAndConfirm(tx);
    console.log("Alice ATA:", aliceAta.toBase58());
    console.log("Bob ATA:", bobAta.toBase58());

    // Verify both are frozen
    const aliceTokenAccounts =
      await glamClient.connection.getParsedTokenAccountsByOwner(
        alice.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID },
      );
    const aliceAccount = aliceTokenAccounts.value.find(
      (ta) => ta.account.data.parsed.info.mint === glamMint.toBase58(),
    );
    expect(aliceAccount?.account.data.parsed.info.state).toBe("frozen");

    const bobTokenAccounts =
      await glamClient.connection.getParsedTokenAccountsByOwner(bob.publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      });
    const bobAccount = bobTokenAccounts.value.find(
      (ta) => ta.account.data.parsed.info.mint === glamMint.toBase58(),
    );
    expect(bobAccount?.account.data.parsed.info.state).toBe("frozen");
  }, 25_000);

  it("Manager creates allowlist and adds alice", async () => {
    listSeed = Buffer.alloc(32);
    Buffer.from("glam-acl-test-list-1").copy(listSeed);

    listConfigPda = getTokenAclGateListConfigPda(glamClient.signer, listSeed);

    // Create an allowlist (mode=0 = Allow) and add alice
    const txSig1 = await glamClient.mint.createTokenAclAllowlist(
      listSeed,
      0,
      txOptions,
    );
    console.log("Create allowlist:", txSig1);

    const txSig2 = await glamClient.mint.addWalletToTokenAclAllowlist(
      listSeed,
      alice.publicKey,
      txOptions,
    );
    console.log("Add alice to allowlist:", txSig2);

    // Verify list config was created
    const listConfigInfo =
      await glamClient.connection.getAccountInfo(listConfigPda);
    expect(listConfigInfo).not.toBeNull();
    expect(listConfigInfo!.owner.toBase58()).toEqual(
      TOKEN_ACL_GATE_PROGRAM.toBase58(),
    );

    // Verify wallet entry was created
    const walletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      alice.publicKey,
    );
    const walletEntryInfo =
      await glamClient.connection.getAccountInfo(walletEntryPda);
    expect(walletEntryInfo).not.toBeNull();
    expect(walletEntryInfo!.owner.toBase58()).toEqual(
      TOKEN_ACL_GATE_PROGRAM.toBase58(),
    );
  }, 25_000);

  it("Manager sets up gate extra metas (via GLAM)", async () => {
    const txSig = await glamClient.mint.setupTokenAclGateExtraMetas(
      [listConfigPda],
      txOptions,
    );
    console.log("Setup gate extra metas:", txSig);

    // Verify extra metas account was created
    const extraMetasPda = getTokenAclGateExtraMetasPda(glamMint);
    const extraMetasInfo =
      await glamClient.connection.getAccountInfo(extraMetasPda);
    expect(extraMetasInfo).not.toBeNull();
    expect(extraMetasInfo!.owner.toBase58()).toEqual(
      TOKEN_ACL_GATE_PROGRAM.toBase58(),
    );
  }, 25_000);

  it("Alice can permissionless thaw her token account", async () => {
    const walletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      alice.publicKey,
    );

    // Use SDK thawPermissionless with alice as signer
    const txSig = await glamClientAlice.mint.thawPermissionless(
      alice.publicKey,
      [{ listConfig: listConfigPda, walletEntry: walletEntryPda }],
      txOptions,
    );
    console.log("Alice thaw permissionless:", txSig);

    // Verify alice's token account is now unfrozen
    const aliceTokenAccounts =
      await glamClient.connection.getParsedTokenAccountsByOwner(
        alice.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID },
      );
    const aliceAccount = aliceTokenAccounts.value.find(
      (ta) => ta.account.data.parsed.info.mint === glamMint.toBase58(),
    );
    expect(aliceAccount?.account.data.parsed.info.state).toBe("initialized");
  }, 25_000);

  it("Bob (not allowlisted) cannot permissionless thaw", async () => {
    // Verify bob's token account is still frozen
    const bobTokenAccounts =
      await glamClient.connection.getParsedTokenAccountsByOwner(bob.publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      });
    const bobAccount = bobTokenAccounts.value.find(
      (ta) => ta.account.data.parsed.info.mint === glamMint.toBase58(),
    );
    expect(bobAccount?.account.data.parsed.info.state).toBe("frozen");

    // Bob is NOT in the allowlist, so the gate program should reject
    const bobWalletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      bob.publicKey,
    );

    const glamClientBob = new GlamClient({
      wallet: new Wallet(bob),
    });
    glamClientBob.statePda = glamClient.statePda;

    try {
      await glamClientBob.mint.thawPermissionless(
        bob.publicKey,
        [{ listConfig: listConfigPda, walletEntry: bobWalletEntryPda }],
        txOptions,
      );
      throw new Error("Expected bob's thaw to fail");
    } catch (e: any) {
      // Bob is not allowlisted, so the gate program should reject
      expect(e.toString()).toContain("Error");
    }

    // Verify bob's token account is still frozen
    const bobTokenAccountsAfter =
      await glamClient.connection.getParsedTokenAccountsByOwner(bob.publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      });
    const bobAccountAfter = bobTokenAccountsAfter.value.find(
      (ta) => ta.account.data.parsed.info.mint === glamMint.toBase58(),
    );
    expect(bobAccountAfter?.account.data.parsed.info.state).toBe("frozen");
  }, 25_000);
});
