import { PublicKey } from "@solana/web3.js";
import {
  KVaultState,
  Reserve,
  Obligation,
} from "../../src/deser/kaminoLayouts";

describe("kamino_deser", () => {
  const mainMarketUsdcReserve = JSON.parse(
    require("fs").readFileSync(
      "./anchor/fixtures/accounts/kamino/reserve_usdc_main_market.json",
      "utf-8",
    ),
  );

  const usdcVaultState = JSON.parse(
    require("fs").readFileSync(
      "./anchor/fixtures/accounts/kamino/kvUSDC_vault_state.json",
      "utf-8",
    ),
  );

  const mainMarketObligation = JSON.parse(
    require("fs").readFileSync(
      "./anchor/fixtures/accounts/kamino/obligation_main_market.json",
      "utf-8",
    ),
  );

  it("Deserialize main market USDC reserve", () => {
    const data = Buffer.from(mainMarketUsdcReserve.account.data[0], "base64");
    const address = new PublicKey(mainMarketUsdcReserve.pubkey);
    const reserve = Reserve.decode(address, data);

    console.log("collateralExchangeRate:", reserve.collateralExchangeRate);

    expect(reserve.config.tokenInfo.scopeConfiguration.priceFeed).toEqual(
      new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"),
    );
  });

  it("Deserialize vault state", () => {
    const data = Buffer.from(usdcVaultState.account.data[0], "base64");
    const address = new PublicKey(usdcVaultState.pubkey);
    const { tokenMint, sharesMint, vaultLookupTable, nameStr } =
      KVaultState.decode(address, data);

    expect(nameStr).toEqual("USDC Max Yield");
    expect(tokenMint).toEqual(
      new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    );
    expect(sharesMint).toEqual(
      new PublicKey("7D8C5pDFxug58L9zkwK7bCiDg4kD4AygzbcZUmf5usHS"),
    );
    expect(vaultLookupTable).toEqual(
      new PublicKey("9p2oT9J6BojHigd3V5qXzrwsQf4dtgMgLxtrzLVR3rwu"),
    );
  });

  it("Deserialize main market obligation", () => {
    const data = Buffer.from(mainMarketObligation.account.data[0], "base64");
    const address = new PublicKey(mainMarketObligation.pubkey);
    const obligation = Obligation.decode(address, data);

    // Verify the obligation was decoded successfully
    expect(obligation.lendingMarket).toEqual(
      new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"),
    );

    // Verify the structure is correct
    expect(obligation.deposits.length).toBe(8);
    expect(obligation.borrows.length).toBe(5);
  });
});
