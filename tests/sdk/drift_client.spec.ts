import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  ClusterNetwork,
  GlamClient,
  MarketType,
  OracleSource,
} from "../../src";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const glamClient = new GlamClient({
  provider: new AnchorProvider(
    new Connection("https://api.mainnet-beta.solana.com"),
    new NodeWallet(Keypair.generate()),
  ),
  cluster: ClusterNetwork.Mainnet,
});

const solSpotMarket = JSON.parse(
  require("fs").readFileSync(
    "./fixtures/accounts/drift/3x85u7SWkmmr7YQGYhtjARgxwegTLJgkSLRprfXod6rh.json",
    "utf-8",
  ),
);
const solPerpMarket = JSON.parse(
  require("fs").readFileSync(
    "./fixtures/accounts/drift/8UJgxaiQx5nTrdDgph5FiahMmzduuLTLf5WmsPegYA6W.json",
    "utf-8",
  ),
);

describe("drift_client", () => {
  it("Calculate drift PDAs", async () => {
    const solPerpMarket = glamClient.drift.getMarketPda(MarketType.PERP, 0);
    expect(solPerpMarket).toEqual(
      new PublicKey("8UJgxaiQx5nTrdDgph5FiahMmzduuLTLf5WmsPegYA6W"),
    );

    const usdcSpotMarket = glamClient.drift.getMarketPda(MarketType.SPOT, 0);
    expect(usdcSpotMarket).toEqual(
      new PublicKey("6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3"),
    );
  });

  it("Parse perp market", () => {
    // Decode the base64 encoded data into a buffer
    const perpMarketData = Buffer.from(solPerpMarket.account.data[0], "base64");

    const { name, marketPda, marketIndex, oracle, oracleSource } =
      glamClient.drift.parsePerpMarket(perpMarketData);
    expect(name).toEqual("SOL-PERP");
    expect(marketPda).toEqual(
      new PublicKey("8UJgxaiQx5nTrdDgph5FiahMmzduuLTLf5WmsPegYA6W"),
    );
    expect(oracle).toEqual(
      new PublicKey("3m6i4RFWEDw2Ft4tFHPJtYgmpPe21k56M3FHeWYrgGBz"),
    );
    expect(marketIndex).toEqual(0);
    expect(oracleSource).toEqual(OracleSource.PYTH_LAZER);
  });

  it("Parse spot market", () => {
    // Decode the base64 encoded data into a buffer
    const spotMarketData = Buffer.from(solSpotMarket.account.data[0], "base64");
    const {
      name,
      marketPda,
      marketIndex,
      oracle,
      oracleSource,
      mint,
      decimals,
      tokenProgram,
    } = glamClient.drift.parseSpotMarket(spotMarketData);

    expect(name).toEqual("SOL");
    expect(marketPda).toEqual(
      glamClient.drift.getMarketPda(MarketType.SPOT, 1),
    );
    expect(marketIndex).toEqual(1);
    expect(oracle).toEqual(
      new PublicKey("3m6i4RFWEDw2Ft4tFHPJtYgmpPe21k56M3FHeWYrgGBz"),
    );
    expect(oracleSource).toEqual(OracleSource.PYTH_LAZER);
    expect(mint).toEqual(
      new PublicKey("So11111111111111111111111111111111111111112"),
    );
    expect(decimals).toEqual(9);
    expect(tokenProgram).toEqual(TOKEN_PROGRAM_ID);
  });
});
