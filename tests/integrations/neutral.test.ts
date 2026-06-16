import { BN, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  GlamClient,
  NT_BUNDLE_PROTOCOL,
  NtBundlePolicy,
  USDC,
  USDT,
  nameToChars,
} from "../../src";
import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
  str2seed,
} from "../glam_protocol/setup";
import {
  expectPublicKeyArrayEqual,
  expectRejects,
  mintUSDC,
} from "../test-utils";

const PERM_INIT_BUNDLE_DEPOSITOR = new BN(1 << 0);
const PERM_REQUEST_DEPOSIT = new BN(1 << 1);

const TEST_BUNDLE_ALLOWLISTED = new PublicKey(
  "HWjMfYfc7KoPchoEDa5UFyVSpJxY3aV1RAccKvABYb9z",
);

async function setNtBundlePolicy(
  client: GlamClient,
  bundlesAllowlist: PublicKey[],
) {
  return client.neutral.setPolicy(new NtBundlePolicy(bundlesAllowlist), {
    simulate: true,
  });
}

// Initialize a GLAM vault with NtBundle integration enabled
async function initGlamVault(client: GlamClient, name: string) {
  await createGlamStateForTest(client, {
    ...defaultInitStateParams,
    name: nameToChars(name),
    baseAssetMint: USDC,
    assets: [USDC, USDT],
    integrationAcls: [
      {
        integrationProgram: client.extNeutralProgram.programId,
        protocolsBitmask: NT_BUNDLE_PROTOCOL,
        protocolPolicies: [],
      },
    ],
  });
}

const delegateKeypair = Keypair.fromSeed(str2seed("neutral-delegate"));
const txOptions = { simulate: true };

describe("ntbundle", () => {
  const glamClient = new GlamClient();
  const delegateGlamClient = new GlamClient({
    wallet: new Wallet(delegateKeypair),
  });

  beforeAll(async () => {
    await airdrop(
      glamClient.connection,
      delegateKeypair.publicKey,
      1_000_000_000,
    );

    await initGlamVault(glamClient, `GLAM <> NtBundle ${Date.now()}`);
    await mintUSDC(glamClient.connection, glamClient.vaultPda, 200_000_000);

    delegateGlamClient.statePda = glamClient.statePda;
  }, 60_000);

  it("sets a ntbundle policy", async () => {
    await setNtBundlePolicy(glamClient, [TEST_BUNDLE_ALLOWLISTED]);

    const policy = await glamClient.neutral.fetchPolicy();
    expect(policy).not.toBeNull();
    expectPublicKeyArrayEqual(policy!.bundlesAllowlist, [
      TEST_BUNDLE_ALLOWLISTED,
    ]);
  });

  it("fails closed for deny-all and non-allowlisted bundle policies", async () => {
    const denyClient = new GlamClient();
    await initGlamVault(denyClient, `Neutral Deny ${Date.now()}`);
    await setNtBundlePolicy(denyClient, []);

    await expectRejects(
      () =>
        denyClient.neutral.initializeBundleDepositor(
          TEST_BUNDLE_ALLOWLISTED,
          txOptions,
        ),
      "Protocol policy violation",
    );

    await setNtBundlePolicy(denyClient, [PublicKey.default]);
    await expectRejects(
      () =>
        denyClient.neutral.initializeBundleDepositor(
          TEST_BUNDLE_ALLOWLISTED,
          txOptions,
        ),
      "Protocol policy violation",
    );
  }, 45_000);

  it("fails closed for unauthorized signer, missing delegate permission, and wrong permission bit", async () => {
    // Delegate cannot set policy
    await expectRejects(() =>
      setNtBundlePolicy(delegateGlamClient, [TEST_BUNDLE_ALLOWLISTED]),
    );

    // Delegate cannot initialize bundle depositor without proper permission
    await expectRejects(() =>
      delegateGlamClient.neutral.initializeBundleDepositor(
        TEST_BUNDLE_ALLOWLISTED,
        txOptions,
      ),
    );

    // Grant delegate permission for REQUEST_DEPOSIT
    await glamClient.access.grantDelegatePermissions(
      delegateKeypair.publicKey,
      glamClient.extNeutralProgram.programId,
      NT_BUNDLE_PROTOCOL,
      PERM_REQUEST_DEPOSIT,
      { simulate: true },
    );

    // Still cannot initialize bundle depositor without INIT_BUNDLE_DEPOSITOR permission
    await expectRejects(() =>
      delegateGlamClient.neutral.initializeBundleDepositor(
        TEST_BUNDLE_ALLOWLISTED,
        txOptions,
      ),
    );

    // Now grant the correct permission
    await glamClient.access.grantDelegatePermissions(
      delegateKeypair.publicKey,
      glamClient.extNeutralProgram.programId,
      NT_BUNDLE_PROTOCOL,
      PERM_INIT_BUNDLE_DEPOSITOR,
      txOptions,
    );
  }, 45_000);

  it("initializes a bundle depositor", async () => {
    await glamClient.neutral.initializeBundleDepositor(
      TEST_BUNDLE_ALLOWLISTED,
      txOptions,
    );

    const userBundle = glamClient.neutral.getUserBundlePda(
      TEST_BUNDLE_ALLOWLISTED,
    );

    expectPublicKeyArrayEqual(
      (await glamClient.fetchStateModel()).externalPositions,
      [userBundle],
    );
  }, 45_000);

  it("fails closed for invalid deposit accounts and requests a deposit with valid accounts", async () => {
    await expectRejects(
      () =>
        glamClient.neutral.requestDeposit(
          TEST_BUNDLE_ALLOWLISTED,
          new BN(0),
          txOptions,
        ),
      "Invalid amount",
    );

    await glamClient.neutral.requestDeposit(
      TEST_BUNDLE_ALLOWLISTED,
      new BN(100_000_000),
      txOptions,
    );
  }, 45_000);

  it("fails closed for invalid withdrawal amounts and excessive min_estimated_value", async () => {
    await expectRejects(
      () =>
        glamClient.neutral.requestWithdrawal(
          TEST_BUNDLE_ALLOWLISTED,
          new BN(0),
          new BN(0),
          txOptions,
        ),
      "Invalid amount",
    );
  }, 45_000);

  it("closes an empty user bundle", async () => {
    const glamClient = new GlamClient();
    await initGlamVault(glamClient, `Neutral Close ${Date.now()}`);
    await setNtBundlePolicy(glamClient, [TEST_BUNDLE_ALLOWLISTED]);

    // Create an empty user bundle
    await glamClient.neutral.initializeBundleDepositor(
      TEST_BUNDLE_ALLOWLISTED,
      txOptions,
    );
    const emptyUserBundle = glamClient.neutral.getUserBundlePda(
      TEST_BUNDLE_ALLOWLISTED,
    );
    expectPublicKeyArrayEqual(
      (await glamClient.fetchStateModel()).externalPositions,
      [emptyUserBundle],
    );

    await glamClient.neutral.closeUserBundleAccount(
      TEST_BUNDLE_ALLOWLISTED,
      txOptions,
    );

    expect(await glamClient.connection.getAccountInfo(emptyUserBundle)).toBe(
      null,
    );
    expectPublicKeyArrayEqual(
      (await glamClient.fetchStateModel()).externalPositions,
      [],
    );
  }, 45_000);
});
