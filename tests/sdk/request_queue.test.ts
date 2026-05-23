import { StateAccountType } from "../../src/models";

describe("StateAccountType.hasRequestQueue", () => {
  it("includes vault types that initialize a request queue", () => {
    expect(
      StateAccountType.hasRequestQueue(StateAccountType.TOKENIZED_VAULT),
    ).toBe(true);
    expect(
      StateAccountType.hasRequestQueue(StateAccountType.SINGLE_ASSET_VAULT),
    ).toBe(true);
  });

  it("excludes account types without a request queue", () => {
    expect(StateAccountType.hasRequestQueue(StateAccountType.VAULT)).toBe(
      false,
    );
    expect(StateAccountType.hasRequestQueue(StateAccountType.MINT)).toBe(false);
  });
});
