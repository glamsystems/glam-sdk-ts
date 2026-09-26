import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  airdrop,
  createGlamStateForTest,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import {
  GLAM_MINT_PROTOCOL,
  GlamClient,
  KAMINO_FARMS_PROTOCOL,
  KAMINO_LENDING_PROTOCOL,
  KAMINO_VAULTS_PROTOCOL,
  KaminoLendingPolicy,
  nameToChars,
  SYSTEM_PROTOCOL,
  WSOL,
} from "../../src";

const MAIN_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
);
const KLEND = new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
// klend's refresh_reserves_batch discriminator, as KaminoLendingTxBuilder.refreshReservesBatchIx writes it
const REFRESH_RESERVES_BATCH = Buffer.from([
  144, 110, 26, 103, 162, 204, 252, 147,
]);

describe("kamino_lending", () => {
  const glamClient = new GlamClient();

  it("Initialize glam state", async () => {
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Kamino Lending Tests"),
      assets: [WSOL],
      integrationAcls: [
        {
          integrationProgram: glamClient.extKaminoProgram.programId,
          protocolsBitmask:
            KAMINO_LENDING_PROTOCOL |
            KAMINO_VAULTS_PROTOCOL |
            KAMINO_FARMS_PROTOCOL,
          protocolPolicies: [],
        },
        {
          integrationProgram: glamClient.protocolProgram.programId,
          protocolsBitmask: SYSTEM_PROTOCOL,
          protocolPolicies: [],
        },
        // Lets glam_mint's pricing instructions record what they price.
        {
          integrationProgram: glamClient.mintProgram.programId,
          protocolsBitmask: GLAM_MINT_PROTOCOL,
          protocolPolicies: [],
        },
      ],
    });

    console.log("State PDA:", statePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    await airdrop(
      glamClient.provider.connection,
      glamClient.vaultPda,
      10_000_000_000,
    );

    await glamClient.vault.wrap(new BN(1_000_000_000));
  }, 30_000);

  it("Init kamino user metadata", async () => {
    try {
      const txSig = await glamClient.kaminoLending.initUserMetadata();
      console.log("init Kamino txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("Deposit wSOL", async () => {
    // ext_kamino refuses lending operations until a policy allowlists the market.
    await glamClient.kaminoLending.setPolicy(
      new KaminoLendingPolicy([MAIN_MARKET], []),
    );
    try {
      const txSig = await glamClient.kaminoLending.deposit(
        MAIN_MARKET,
        WSOL,
        new BN(500_000_000),
      );
      console.log("deposit txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    const obligations = await glamClient.kaminoLending.findAndParseObligations(
      glamClient.vaultPda,
    );
    expect(obligations.length).toEqual(1);
  }, 30_000);

  // Runs right after the deposit, which left the wSOL reserve marked stale. That reserve is the
  // vault's wSOL oracle, so without klend's refreshes the token pricing refuses first.
  it("Pricing without any refresh is refused", async () => {
    const ixs = (await glamClient.price.priceVaultIxs()).filter(
      (ix) => !ix.programId.equals(KLEND),
    );
    await expectRefusal(ixs, 52008); // ReserveStale
  }, 30_000);

  // The SDK's pricing transaction refreshes every reserve and the obligation ahead of
  // price_kamino_obligations, which is what the program requires.
  it("Price the vault with the obligation", async () => {
    const ixs = await glamClient.price.priceVaultIxs();
    const klendIxs = ixs.filter((ix) => ix.programId.equals(KLEND));
    expect(klendIxs.length).toBeGreaterThanOrEqual(2);

    await priceVault(ixs);

    // The base asset is wSOL, so the 0.5 SOL deposit is priced at itself, give or take klend's
    // rounding and the interest of the seconds since the deposit.
    const amount = await pricedLendingAmount();
    expect(amount).toBeGreaterThan(499_500_000);
    expect(amount).toBeLessThan(500_500_000);
  }, 30_000);

  // With the reserves refreshed but not the obligation, the obligation pricing refuses.
  it("Pricing without the obligation refresh is refused", async () => {
    const ixs = (await glamClient.price.priceVaultIxs()).filter(
      (ix) =>
        !ix.programId.equals(KLEND) ||
        ix.data.subarray(0, 8).equals(REFRESH_RESERVES_BATCH),
    );
    await expectRefusal(ixs, 52007); // ObligationStale
  }, 30_000);

  // klend lets an obligation borrow the asset it deposited, so the borrow needs no second
  // reserve in the validator. Borrowing is refused until the mint is in the state's borrowable
  // list and in the policy's borrow allowlist.
  it("Borrow wSOL and price the obligation net of the debt", async () => {
    await glamClient.state.update({ borrowable: [WSOL] });
    await glamClient.kaminoLending.setPolicy(
      new KaminoLendingPolicy([MAIN_MARKET], [WSOL]),
    );
    const vaultWsol = glamClient.getVaultAta(WSOL);
    const before = await tokenAmount(vaultWsol);
    try {
      const txSig = await glamClient.kaminoLending.borrow(
        MAIN_MARKET,
        WSOL,
        new BN(100_000_000),
      );
      console.log("borrow txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
    expect((await tokenAmount(vaultWsol)) - before).toEqual(100_000_000);

    await priceVault(await glamClient.price.priceVaultIxs());
    // 0.5 SOL deposited, 0.1 SOL owed, both in the base asset; any origination fee adds to the
    // debt. The obligation lists the wSOL reserve twice, as a deposit and as a borrow.
    const amount = await pricedLendingAmount();
    expect(amount).toBeGreaterThan(397_000_000);
    expect(amount).toBeLessThan(400_500_000);
  }, 30_000);

  async function tokenAmount(account: PublicKey): Promise<number> {
    const balance =
      await glamClient.provider.connection.getTokenAccountBalance(account);
    return Number(balance.value.amount);
  }

  async function priceVault(ixs: TransactionInstruction[]) {
    const vTx = await glamClient.intoVersionedTransaction(
      new Transaction().add(...ixs),
      {},
    );
    try {
      const txSig = await glamClient.sendAndConfirm(vTx);
      console.log("price txSig", txSig);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  // The base-asset amount price_kamino_obligations last recorded on the state.
  async function pricedLendingAmount(): Promise<number> {
    const state = await glamClient.fetchStateAccount();
    const lending = state.pricedProtocols.find(
      (p: any) =>
        p.integrationProgram.equals(glamClient.extKaminoProgram.programId) &&
        p.protocolBitflag === KAMINO_LENDING_PROTOCOL,
    );
    expect(lending).toBeDefined();
    return Number(lending.amount.toString());
  }

  async function expectRefusal(ixs: TransactionInstruction[], code: number) {
    const vTx = await glamClient.intoVersionedTransaction(
      new Transaction().add(...ixs),
      {},
    );
    let refusal: any;
    try {
      await glamClient.sendAndConfirm(vTx);
    } catch (e: any) {
      refusal = e;
    }
    expect(refusal).toBeDefined();
    expect(JSON.stringify(refusal)).toContain(`"Custom":${code}`);
  }
});
