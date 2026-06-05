import { PublicKey } from "@solana/web3.js";
import {
  findGlamLookupTables,
  getStakeDelegationState,
} from "../../src/utils/accounts";

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

describe("getStakeDelegationState", () => {
  it("handles string epochs returned by parsed stake RPC responses", () => {
    expect(getStakeDelegationState("596", "982", 982)).toBe("deactivating");
    expect(getStakeDelegationState("596", "982", 983)).toBe("inactive");
    expect(getStakeDelegationState("596", "982", 981)).toBe("active");
    expect(getStakeDelegationState("982", "18446744073709551615", 982)).toBe(
      "activating",
    );
  });
});
