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
import {
  TokenAclListConfig,
  TokenAclWalletEntry,
  TokenAclMintConfig,
} from "../../src/deser/tokenAclLayouts";
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

async function getTokenAccountState(
  glamClient: GlamClient,
  owner: PublicKey,
  mint: PublicKey,
): Promise<string | undefined> {
  const tokenAccounts =
    await glamClient.connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    });
  const account = tokenAccounts.value.find(
    (ta) => ta.account.data.parsed.info.mint === mint.toBase58(),
  );
  return account?.account.data.parsed.info.state;
}

describe("token_acl", () => {
  const glamClient = new GlamClient();
  const glamClientAlice = new GlamClient({
    wallet: new Wallet(alice),
  });
  const glamClientBob = new GlamClient({
    wallet: new Wallet(bob),
  });

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

    const txSig = await glamClient.mint.initialize(params, txOptions);
    console.log("Initialize mint for Token ACL test:", txSig);

    glamMint = glamClient.mintPda;
    mintConfigPda = getTokenAclMintConfigPda(glamMint);

    const { mint, tokenProgram } = await fetchMintAndTokenProgram(
      glamClient.connection,
      glamMint,
    );
    expect(tokenProgram).toEqual(TOKEN_2022_PROGRAM_ID);
    expect(mint.decimals).toBe(6);
    expect(mint.freezeAuthority).toEqual(mintConfigPda);
    expect(await isTokenAclEnabled(glamClient.connection, glamMint)).toBe(true);
  }, 25_000);

  it("Verify MintConfig PDA was created", async () => {
    const accountInfo =
      await glamClient.connection.getAccountInfo(mintConfigPda);
    expect(accountInfo).not.toBeNull();
    expect(accountInfo!.owner.equals(TOKEN_ACL_PROGRAM)).toBe(true);

    const mintConfig = TokenAclMintConfig.decode(
      mintConfigPda,
      accountInfo!.data,
    );
    expect(mintConfig.freezeAuthority.equals(glamMint)).toBe(true);
    expect(mintConfig.gatingProgram.equals(TOKEN_ACL_GATE_PROGRAM)).toBe(true);
    expect(mintConfig.bump).toBeGreaterThan(0);
  });

  it("setTokenAccountsStates should fail when Token ACL is active", async () => {
    glamClientAlice.statePda = glamClient.statePda;
    glamClientBob.statePda = glamClient.statePda;

    await expect(
      glamClient.mint.setTokenAccountsStates(
        [alice.publicKey],
        true,
        txOptions,
      ),
    ).rejects.toThrow("Token ACL is enabled");
  }, 15_000);

  it("New token accounts are created frozen (DefaultAccountState)", async () => {
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

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        glamClient.signer,
        aliceAta,
        alice.publicKey,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        glamClient.signer,
        bobAta,
        bob.publicKey,
        glamMint,
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    await glamClient.sendAndConfirm(tx);

    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("frozen");
    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");
  }, 25_000);

  //
  // ACL Gate list management via GLAM (mint PDA as authority)
  //

  it("Manager creates allowlist via GLAM (mint PDA as authority)", async () => {
    listSeed = Buffer.alloc(32);
    Buffer.from("glam-acl-test-list-1").copy(listSeed);

    // ListConfig PDA is derived with glamMint as authority
    listConfigPda = getTokenAclGateListConfigPda(glamMint, listSeed);

    const txSig = await glamClient.mint.aclGateCreateList(
      listSeed,
      0, // mode = Allow
      txOptions,
    );
    console.log("ACL Gate create list:", txSig);

    const listConfigInfo =
      await glamClient.connection.getAccountInfo(listConfigPda);
    expect(listConfigInfo).not.toBeNull();
    expect(listConfigInfo!.owner.equals(TOKEN_ACL_GATE_PROGRAM)).toBe(true);

    const listConfig = TokenAclListConfig.decode(
      listConfigPda,
      listConfigInfo!.data,
    );
    expect(listConfig.authority.equals(glamMint)).toBe(true);
    expect(listConfig.mode).toBe(0);
    expect(listConfig.modeName).toBe("allow");
  }, 25_000);

  it("Manager adds alice to allowlist via GLAM", async () => {
    const txSig = await glamClient.mint.aclGateAddWallet(
      listConfigPda,
      alice.publicKey,
      txOptions,
    );
    console.log("ACL Gate add alice:", txSig);

    const walletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      alice.publicKey,
    );
    const walletEntryInfo =
      await glamClient.connection.getAccountInfo(walletEntryPda);
    expect(walletEntryInfo).not.toBeNull();
    expect(walletEntryInfo!.owner.equals(TOKEN_ACL_GATE_PROGRAM)).toBe(true);

    const walletEntry = TokenAclWalletEntry.decode(
      walletEntryPda,
      walletEntryInfo!.data,
    );
    expect(walletEntry.listConfig.equals(listConfigPda)).toBe(true);
    expect(walletEntry.wallet.equals(alice.publicKey)).toBe(true);
  }, 25_000);

  it("Manager sets up gate extra metas (via GLAM)", async () => {
    const txSig = await glamClient.mint.aclGateSetupExtraMetas(
      [listConfigPda],
      txOptions,
    );
    console.log("Setup gate extra metas:", txSig);

    const extraMetasPda = getTokenAclGateExtraMetasPda(glamMint);
    const extraMetasInfo =
      await glamClient.connection.getAccountInfo(extraMetasPda);
    expect(extraMetasInfo).not.toBeNull();
    expect(extraMetasInfo!.owner.equals(TOKEN_ACL_GATE_PROGRAM)).toBe(true);
  }, 25_000);

  it("Alice (allowlisted) can permissionless thaw her token account", async () => {
    const walletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      alice.publicKey,
    );

    const txSig = await glamClientAlice.mint.thawPermissionless(
      alice.publicKey,
      [{ listConfig: listConfigPda, walletEntry: walletEntryPda }],
      txOptions,
    );
    console.log("Alice thaw permissionless:", txSig);

    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("initialized");
  }, 25_000);

  //
  // Authority-based freeze/thaw via Token ACL (token_acl_freeze / token_acl_thaw)
  //

  it("Manager can freeze alice's thawed account via token_acl_freeze", async () => {
    // Alice's account was thawed in the previous test
    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("initialized");

    const aliceAta = getAssociatedTokenAddressSync(
      glamMint,
      alice.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    const txSig = await glamClient.mint.tokenAclFreeze([aliceAta], txOptions);
    console.log("ACL freeze alice:", txSig);

    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("frozen");
  }, 25_000);

  it("Manager can thaw alice's frozen account via token_acl_thaw", async () => {
    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("frozen");

    const aliceAta = getAssociatedTokenAddressSync(
      glamMint,
      alice.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    const txSig = await glamClient.mint.tokenAclThaw([aliceAta], txOptions);
    console.log("ACL thaw alice:", txSig);

    expect(
      await getTokenAccountState(glamClient, alice.publicKey, glamMint),
    ).toBe("initialized");
  }, 25_000);

  it("Manager can freeze and thaw bob (frozen) via token_acl_thaw then token_acl_freeze", async () => {
    const bobAta = getAssociatedTokenAddressSync(
      glamMint,
      bob.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    // Bob is still frozen from DefaultAccountState
    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");

    // Thaw bob via token_acl_thaw
    const thawTxSig = await glamClient.mint.tokenAclThaw([bobAta], txOptions);
    console.log("ACL thaw bob:", thawTxSig);

    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("initialized");

    // Re-freeze bob via token_acl_freeze
    const freezeTxSig = await glamClient.mint.tokenAclFreeze([bobAta], txOptions);
    console.log("ACL freeze bob:", freezeTxSig);

    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");
  }, 25_000);

  it("Non-manager cannot use token_acl_freeze", async () => {
    glamClientAlice.statePda = glamClient.statePda;
    const aliceAta = getAssociatedTokenAddressSync(
      glamMint,
      alice.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    await expect(
      glamClientAlice.mint.tokenAclFreeze([aliceAta], txOptions),
    ).rejects.toThrow();
  }, 25_000);

  it("Non-manager cannot use token_acl_thaw", async () => {
    // Bob is frozen from the previous test
    glamClientBob.statePda = glamClient.statePda;
    const bobAta = getAssociatedTokenAddressSync(
      glamMint,
      bob.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    await expect(
      glamClientBob.mint.tokenAclThaw([bobAta], txOptions),
    ).rejects.toThrow();

    // Verify bob is still frozen
    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");
  }, 25_000);

  it("Bob (not allowlisted) cannot permissionless thaw", async () => {
    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");

    const bobWalletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      bob.publicKey,
    );

    await expect(
      glamClientBob.mint.thawPermissionless(
        bob.publicKey,
        [{ listConfig: listConfigPda, walletEntry: bobWalletEntryPda }],
        txOptions,
      ),
    ).rejects.toThrow();

    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");
  }, 25_000);

  //
  // ACL Gate list management: remove wallet and delete list
  //

  it("Manager removes alice from allowlist via GLAM", async () => {
    const walletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      alice.publicKey,
    );

    const txSig = await glamClient.mint.aclGateRemoveWallet(
      listConfigPda,
      walletEntryPda,
      txOptions,
    );
    console.log("ACL Gate remove alice:", txSig);

    const walletEntryInfo =
      await glamClient.connection.getAccountInfo(walletEntryPda);
    expect(walletEntryInfo).toBeNull();
  }, 25_000);

  it("Manager deletes empty allowlist via GLAM", async () => {
    const txSig = await glamClient.mint.aclGateDeleteList(
      listConfigPda,
      txOptions,
    );
    console.log("ACL Gate delete list:", txSig);

    const listConfigInfo =
      await glamClient.connection.getAccountInfo(listConfigPda);
    expect(listConfigInfo).toBeNull();
  }, 25_000);

  it("Cannot delete a non-empty list", async () => {
    // Recreate list and add a wallet
    const newSeed = Buffer.alloc(32);
    Buffer.from("acl-gate-nonempty-del").copy(newSeed);
    const newListConfigPda = getTokenAclGateListConfigPda(glamMint, newSeed);

    await glamClient.mint.aclGateCreateList(newSeed, 0, txOptions);
    await glamClient.mint.aclGateAddWallet(
      newListConfigPda,
      alice.publicKey,
      txOptions,
    );

    // Attempt to delete non-empty list should fail
    await expect(
      glamClient.mint.aclGateDeleteList(newListConfigPda, txOptions),
    ).rejects.toThrow();

    // Clean up: remove wallet then delete list
    const walletEntryPda = getTokenAclGateWalletEntryPda(
      newListConfigPda,
      alice.publicKey,
    );
    await glamClient.mint.aclGateRemoveWallet(
      newListConfigPda,
      walletEntryPda,
      txOptions,
    );
    await glamClient.mint.aclGateDeleteList(newListConfigPda, txOptions);
  }, 60_000);
});
