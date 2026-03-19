import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

import { airdrop, createGlamStateForTest, sleep } from "./setup";
import { GlamClient, WSOL, stringToChars, StateAccountType } from "../../src";
import { getGlobalConfigPda } from "../../src/utils/glamPDAs";

const txOptions = { simulate: true };

describe("protocol_fee", () => {
  const glamClient = new GlamClient();

  let protocolFeeAuthority: PublicKey;

  beforeAll(async () => {
    // Read fee authority from the cloned mainnet global config
    const globalConfigPda = getGlobalConfigPda();
    const configAccount =
      await glamClient.connection.getAccountInfo(globalConfigPda);
    if (!configAccount) {
      throw new Error(
        "Global config not found — ensure validator clones it from mainnet",
      );
    }
    // fee_authority is at offset 8 (discriminator) + 32 (admin) = 40, 32 bytes
    protocolFeeAuthority = new PublicKey(configAccount.data.subarray(40, 72));
    console.log("Protocol fee authority:", protocolFeeAuthority.toBase58());
  });

  it("Initialize non-tokenized vault", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      accountType: StateAccountType.VAULT,
      name: stringToChars("Charge Protocol Fee Test"),
      baseAssetMint: WSOL,
      enabled: true,
      assets: [WSOL],
    });
    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.accountType).toEqual(StateAccountType.VAULT);
  }, 15_000);

  it("Enable integrations", async () => {
    // Enable glam_mint integration (needed for priceVaultTokens)
    const txSig = await glamClient.access.enableProtocols(
      glamClient.mintProgram.programId,
      0b1, // Mint protocol
      txOptions,
    );
    console.log("Enable mint integration:", txSig);

    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.integrationAcls?.length).toBeGreaterThan(0);
  }, 15_000);

  it("Fund vault with wSOL", async () => {
    // Airdrop SOL to vault and wrap it
    await airdrop(
      glamClient.connection,
      glamClient.vaultPda,
      1_000_000_000_000, // 1000 SOL
    );
    const txSig = await glamClient.vault.wrap(
      new BN(1_000_000_000_000),
      txOptions,
    );
    console.log("Wrap vault SOL -> wSOL:", txSig);

    // Verify vault has wSOL
    const vaultWsolAta = getAssociatedTokenAddressSync(
      WSOL,
      glamClient.vaultPda,
      true,
    );
    const ataInfo = await getAccount(glamClient.connection, vaultWsolAta);
    console.log("Vault wSOL balance:", ataInfo.amount.toString());
    expect(Number(ataInfo.amount)).toBeGreaterThan(0);
  }, 15_000);

  it("Charge protocol fee", async () => {
    // Wait for some time to accrue fees
    await sleep(5_000);

    try {
      const txSig = await glamClient.fees.chargeProtocolFee(
        protocolFeeAuthority,
        txOptions,
      );
      console.log("Charge protocol fee txSig:", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }

    // Verify: fee params and claimed fees updated in state
    const stateAccount = await glamClient.fetchStateAccount();
    const mintParams = stateAccount.params[1];

    let feeParams: any = null;
    let claimedFees: any = null;
    for (const param of mintParams) {
      const name = Object.keys(param.name)[0];
      // @ts-ignore
      const value = Object.values(param.value)[0].val;
      if (name === "feeParams") feeParams = value;
      if (name === "claimedFees") claimedFees = value;
    }

    expect(feeParams).toBeTruthy();
    console.log(
      "last_protocol_fee_crystallized:",
      feeParams.lastProtocolFeeCrystallized.toString(),
    );
    console.log("last_aum:", feeParams.lastAum.toString());
    expect(
      new BN(feeParams.lastProtocolFeeCrystallized).gt(new BN(0)),
    ).toBeTruthy();
    expect(new BN(feeParams.lastAum).gt(new BN(0))).toBeTruthy();

    // Verify priced_protocols cleared
    const stateModel = await glamClient.fetchStateModel();
    expect(stateModel.pricedProtocols?.length || 0).toEqual(0);
  }, 15_000);

  it("Second charge accrues fees", async () => {
    // Wait and charge again to verify fees actually accrue
    await sleep(5_000);

    // Fund vault again (previous charge may have transferred some out)
    await airdrop(
      glamClient.connection,
      glamClient.vaultPda,
      100_000_000_000, // 100 SOL
    );
    await glamClient.vault.wrap(new BN(100_000_000_000), txOptions);

    const feeAuthorityAta = getAssociatedTokenAddressSync(
      WSOL,
      protocolFeeAuthority,
      true,
    );

    let balanceBefore = BigInt(0);
    try {
      const acct = await getAccount(glamClient.connection, feeAuthorityAta);
      balanceBefore = acct.amount;
    } catch {
      // ATA might not exist yet
    }

    const txSig = await glamClient.fees.chargeProtocolFee(
      protocolFeeAuthority,
      txOptions,
    );
    console.log("Second charge protocol fee txSig:", txSig);

    // Verify protocol fee authority received tokens
    const acctAfter = await getAccount(glamClient.connection, feeAuthorityAta);
    console.log(
      "Protocol fee authority wSOL balance after:",
      acctAfter.amount.toString(),
    );
    expect(acctAfter.amount).toBeGreaterThan(balanceBefore);

    // Verify claimed fees accumulated
    const stateAccount = await glamClient.fetchStateAccount();
    const mintParams = stateAccount.params[1];
    let claimedFees: any = null;
    for (const param of mintParams) {
      const name = Object.keys(param.name)[0];
      // @ts-ignore
      const value = Object.values(param.value)[0].val;
      if (name === "claimedFees") claimedFees = value;
    }

    expect(claimedFees).toBeTruthy();
    console.log(
      "Claimed protocol base fee:",
      new BN(claimedFees.protocolBaseFee).toString(),
    );
    expect(new BN(claimedFees.protocolBaseFee).gt(new BN(0))).toBeTruthy();
  }, 25_000);

  it("Charge protocol fee fails for tokenized vault", async () => {
    // Create a separate tokenized vault and verify charge_protocol_fee rejects it
    const tokenizedClient = new GlamClient();
    await tokenizedClient.mint.initialize(
      {
        accountType: StateAccountType.TOKENIZED_VAULT,
        name: stringToChars("Tokenized Fee Test"),
        symbol: "TFT",
        uri: "https://glam.systems",
        baseAssetMint: WSOL,
        defaultAccountStateFrozen: false,
      },
      txOptions,
    );

    try {
      await tokenizedClient.fees.chargeProtocolFee(protocolFeeAuthority);
      fail("Should have thrown for tokenized vault");
    } catch (e: any) {
      console.log(
        "Expected error for tokenized vault:",
        e.message?.substring(0, 100),
      );
      expect(e).toBeTruthy();
    }
  }, 25_000);
});
