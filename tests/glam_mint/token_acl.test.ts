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

    const listConfigInfo =
      await glamClient.connection.getAccountInfo(listConfigPda);
    expect(listConfigInfo).not.toBeNull();
    expect(listConfigInfo!.owner.equals(TOKEN_ACL_GATE_PROGRAM)).toBe(true);

    const listConfig = TokenAclListConfig.decode(
      listConfigPda,
      listConfigInfo!.data,
    );
    expect(listConfig.authority.equals(glamClient.signer)).toBe(true);
    expect(listConfig.mode).toBe(0);
    expect(listConfig.modeName).toBe("allow");
    expect(listConfig.seed.toBuffer()).toEqual(listSeed);

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
    const txSig = await glamClient.mint.setupTokenAclGateExtraMetas(
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

  it("Alice can permissionless thaw her token account", async () => {
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

  it("Bob (not allowlisted) cannot permissionless thaw", async () => {
    expect(
      await getTokenAccountState(glamClient, bob.publicKey, glamMint),
    ).toBe("frozen");

    const bobWalletEntryPda = getTokenAclGateWalletEntryPda(
      listConfigPda,
      bob.publicKey,
    );

    const glamClientBob = new GlamClient({
      wallet: new Wallet(bob),
    });
    glamClientBob.statePda = glamClient.statePda;

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
});
