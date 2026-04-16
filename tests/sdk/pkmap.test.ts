import { PublicKey } from "@solana/web3.js";
import { PkMap } from "../../src/utils";

const ASSET = new PublicKey("So11111111111111111111111111111111111111112");
const ORACLE = new PublicKey("9xQeWvG816bUx9EPfEZ6dM4cY4bCY1dU4b1hW6dZkRr");
const SYSTEM = new PublicKey("11111111111111111111111111111111");

describe("PkMap", () => {
  it("normalizes constructor entries and lookups across strings and PublicKeys", () => {
    const map = new PkMap<string>([
      [ASSET.toBase58(), "asset"],
      [ORACLE, "oracle"],
    ]);

    expect(map.get(ASSET)).toBe("asset");
    expect(map.get(ASSET.toBase58())).toBe("asset");
    expect(map.get(ORACLE)).toBe("oracle");
    expect(map.get(ORACLE.toBase58())).toBe("oracle");
    expect(map.has(ASSET.toBase58())).toBe(true);

    map.set(ASSET, "updated");
    expect(map.get(ASSET.toBase58())).toBe("updated");

    map.delete(ORACLE.toBase58());
    expect(map.has(ORACLE)).toBe(false);
  });

  it("constructs an empty map when called with no arguments", () => {
    const map = new PkMap<number>();
    expect(map.size).toBe(0);
    expect(map.get(ASSET)).toBeUndefined();
    expect(map.has(ASSET)).toBe(false);
  });

  it("constructs from a Map iterable", () => {
    const source = new Map<PublicKey, string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const map = new PkMap<string>(source);
    expect(map.size).toBe(2);
    expect(map.get(ASSET)).toBe("a");
    expect(map.get(ORACLE)).toBe("b");
  });

  it("deduplicates keys that normalize to the same base58 string", () => {
    const map = new PkMap<string>([
      [ASSET, "first"],
      [ASSET.toBase58(), "second"],
      [new PublicKey(ASSET.toBase58()), "third"],
    ]);
    expect(map.size).toBe(1);
    expect(map.get(ASSET)).toBe("third");
  });

  it("set returns this for chaining", () => {
    const map = new PkMap<number>();
    const result = map.set(ASSET, 1).set(ORACLE, 2).set(SYSTEM, 3);
    expect(result).toBe(map);
    expect(map.size).toBe(3);
  });

  it("get returns undefined for missing keys", () => {
    const map = new PkMap<string>([[ASSET, "a"]]);
    expect(map.get(ORACLE)).toBeUndefined();
  });

  it("delete returns false for missing keys", () => {
    const map = new PkMap<string>();
    expect(map.delete(ASSET)).toBe(false);
  });

  it("delete returns true and removes existing keys", () => {
    const map = new PkMap<string>([[ASSET, "a"]]);
    expect(map.delete(ASSET)).toBe(true);
    expect(map.size).toBe(0);
    expect(map.has(ASSET)).toBe(false);
  });

  it("size reflects mutations", () => {
    const map = new PkMap<string>();
    expect(map.size).toBe(0);
    map.set(ASSET, "a");
    expect(map.size).toBe(1);
    map.set(ORACLE, "b");
    expect(map.size).toBe(2);
    map.set(ASSET, "updated");
    expect(map.size).toBe(2);
    map.delete(ASSET);
    expect(map.size).toBe(1);
  });

  it("clear removes all entries", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    map.clear();
    expect(map.size).toBe(0);
    expect(map.has(ASSET)).toBe(false);
    expect(map.has(ORACLE)).toBe(false);
  });

  it("values iterates over all values", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const values = [...map.values()];
    expect(values).toHaveLength(2);
    expect(values).toContain("a");
    expect(values).toContain("b");
  });

  it("pkKeys yields PublicKey objects for all entries", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const keys = [...map.pkKeys()];
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => k.equals(ASSET))).toBe(true);
    expect(keys.some((k) => k.equals(ORACLE))).toBe(true);
  });

  it("pkEntries yields [PublicKey, value] tuples", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const entries = [...map.pkEntries()];
    expect(entries).toHaveLength(2);
    const assetEntry = entries.find(([k]) => k.equals(ASSET));
    const oracleEntry = entries.find(([k]) => k.equals(ORACLE));
    expect(assetEntry?.[1]).toBe("a");
    expect(oracleEntry?.[1]).toBe("b");
  });

  it("forEach visits every entry with correct arguments", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const visited: [string, string][] = [];
    map.forEach((value, key) => {
      visited.push([key.toBase58(), value]);
    });
    expect(visited).toHaveLength(2);
    expect(visited).toContainEqual([ASSET.toBase58(), "a"]);
    expect(visited).toContainEqual([ORACLE.toBase58(), "b"]);
  });

  it("forEach respects thisArg", () => {
    const map = new PkMap<string>([[ASSET, "a"]]);
    const ctx = { captured: "" };
    map.forEach(function (this: typeof ctx, value) {
      this.captured = value;
    }, ctx);
    expect(ctx.captured).toBe("a");
  });

  it("is iterable via Symbol.iterator (for...of)", () => {
    const map = new PkMap<string>([
      [ASSET, "a"],
      [ORACLE, "b"],
    ]);
    const entries: [PublicKey, string][] = [];
    for (const entry of map) {
      entries.push(entry);
    }
    expect(entries).toHaveLength(2);
    expect(entries.some(([k, v]) => k.equals(ASSET) && v === "a")).toBe(true);
    expect(entries.some(([k, v]) => k.equals(ORACLE) && v === "b")).toBe(true);
  });

  it("spread into array via Symbol.iterator", () => {
    const map = new PkMap<number>([
      [ASSET, 1],
      [ORACLE, 2],
    ]);
    const arr = [...map];
    expect(arr).toHaveLength(2);
  });

  it("throws on invalid base58 string keys", () => {
    expect(() => new PkMap<string>([["not-a-valid-key", "x"]])).toThrow();
    const map = new PkMap<string>();
    expect(() => map.set("also invalid!", "x")).toThrow();
    expect(() => map.get("also invalid!")).toThrow();
    expect(() => map.has("also invalid!")).toThrow();
    expect(() => map.delete("also invalid!")).toThrow();
  });
});
