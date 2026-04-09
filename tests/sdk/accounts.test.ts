import { PublicKey } from "@solana/web3.js";
import { findGlamLookupTables } from "../../src/utils/accounts";

describe("findGlamLookupTables", () => {
  it("propagates RPC errors so callers can decide how to handle them", async () => {
    const statePda = new PublicKey("11111111111111111111111111111112");
    const vaultPda = new PublicKey("11111111111111111111111111111113");
    const rpcError = new Error("account index service overloaded");
    const getProgramAccounts = jest.fn().mockRejectedValue(rpcError);
    const connection = {
      getProgramAccounts,
      rpcEndpoint: "https://rpc.example.com",
    } as any;

    await expect(
      findGlamLookupTables(statePda, vaultPda, connection),
    ).rejects.toThrow(/account index service overloaded/);
    expect(getProgramAccounts).toHaveBeenCalled();
  });
});
