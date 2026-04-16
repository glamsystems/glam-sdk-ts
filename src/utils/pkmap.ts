import { PublicKey } from "@solana/web3.js";

type PkMapKey = PublicKey | string;

function normalizePkMapKey(key: PkMapKey): string {
  return key instanceof PublicKey
    ? key.toBase58()
    : new PublicKey(key).toBase58();
}

/**
 * A Map implementation that uses PublicKey-compatible keys.
 *
 * This class extends the standard Map and allows using PublicKey objects
 * or base58 strings as keys by converting them to base58 strings internally.
 * This solves the problem of PublicKey object reference equality - two
 * PublicKey objects with the same address would normally be considered
 * different keys in a Map.
 *
 * @example
 * ```typescript
 * // Create empty map
 * const map = new PkMap<string>();
 * const key = new PublicKey("11111111111111111111111111111111");
 * map.set(key, "value");
 *
 * // Create with initial entries
 * const map2 = new PkMap<string>([
 *   ["11111111111111111111111111111111", "value1"],
 *   [new PublicKey("22222222222222222222222222222222"), "value2"]
 * ]);
 *
 * // Can retrieve with a different PublicKey object with same address
 * const sameKey = new PublicKey("11111111111111111111111111111111");
 * console.log(map.get(sameKey)); // "value"
 * ```
 */
export class PkMap<V> {
  private readonly _map = new Map<string, V>();

  /**
   * Creates a new PkMap instance.
   * @param entries - Optional initial entries as [PublicKey|string, V] pairs
   */
  constructor();
  constructor(entries?: readonly (readonly [PkMapKey, V])[] | null);
  constructor(entries?: Iterable<readonly [PkMapKey, V]> | null);
  constructor(
    entries?:
      | readonly (readonly [PkMapKey, V])[]
      | Iterable<readonly [PkMapKey, V]>
      | null,
  ) {
    if (entries) {
      for (const [key, value] of entries) {
        this._map.set(normalizePkMapKey(key), value);
      }
    }
  }

  /**
   * Associates the specified value with the specified PublicKey in this map.
   * @param key - The PublicKey or base58 string to use as the key
   * @param value - The value to associate with the key
   * @returns This PkMap instance for chaining
   */
  set(key: PkMapKey, value: V): this {
    this._map.set(normalizePkMapKey(key), value);
    return this;
  }

  /**
   * Returns the value associated with the specified key, or undefined if not found.
   * @param key - The PublicKey or base58 string whose associated value is to be returned
   * @returns The value associated with the specified key, or undefined
   */
  get(key: PkMapKey): V | undefined {
    return this._map.get(normalizePkMapKey(key));
  }

  /**
   * Returns true if this map contains a mapping for the specified key.
   * @param key - The PublicKey or base58 string whose presence in this map is to be tested
   * @returns true if this map contains a mapping for the specified key
   */
  has(key: PkMapKey): boolean {
    return this._map.has(normalizePkMapKey(key));
  }

  /**
   * Removes the mapping for the specified key from this map if present.
   * @param key - The PublicKey or base58 string whose mapping is to be removed
   * @returns true if the element was removed, false otherwise
   */
  delete(key: PkMapKey): boolean {
    return this._map.delete(normalizePkMapKey(key));
  }

  /**
   * Returns an iterator of all PublicKey keys in this map.
   * Note: This reconstructs PublicKey objects from the stored base58 strings.
   * @returns An iterator of PublicKey objects
   */
  *pkKeys(): IterableIterator<PublicKey> {
    for (const key of this._map.keys()) {
      yield new PublicKey(key);
    }
  }

  /**
   * Returns an iterator of [PublicKey, value] pairs for every entry in the map.
   * Note: This reconstructs PublicKey objects from the stored base58 strings.
   * @returns An iterator of [PublicKey, V] tuples
   */
  *pkEntries(): IterableIterator<[PublicKey, V]> {
    for (const [key, value] of this._map.entries()) {
      yield [new PublicKey(key), value];
    }
  }

  /**
   * Executes a provided function once per each PublicKey/value pair in the Map.
   * @param callbackfn - Function to execute for each entry
   * @param thisArg - Value to use as this when executing callback
   */
  forEach(
    callbackfn: (value: V, key: PublicKey, map: PkMap<V>) => void,
    thisArg?: any,
  ): void {
    for (const [key, value] of this.pkEntries()) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  // Additional Map-like methods for compatibility
  get size(): number {
    return this._map.size;
  }

  clear(): void {
    this._map.clear();
  }

  values(): IterableIterator<V> {
    return this._map.values();
  }

  [Symbol.iterator](): IterableIterator<[PublicKey, V]> {
    return this.pkEntries();
  }
}
