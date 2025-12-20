import { AddressLookupTableAccount, PublicKey } from "@solana/web3.js";

interface LookupTableResponse {
  tables: string[]; // table addresses
  tx: string[]; // base64 encoded transactions
}

/**
 * Fetches GLAM specific lookup tables from GLAM API for the given vault state
 */
export async function fetchGlamLookupTableAccounts(
  statePda: PublicKey,
): Promise<AddressLookupTableAccount[]> {
  const glamApi = process.env.NEXT_PUBLIC_GLAM_API || process.env.GLAM_API;
  if (!glamApi) {
    return [];
  }

  let data = null;
  try {
    const response = await fetch(`${glamApi}/v0/lut/glam/?state=${statePda}`);
    data = await response.json();
  } catch (e) {
    console.error("Failed to fetch lookup tables:", e); // Fail open
    return [];
  }
  const lookupTables = data?.t || {}; // KVs: table pubkey -> base64 table data

  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  for (const [key, lookupTableData] of Object.entries(lookupTables)) {
    const account = new AddressLookupTableAccount({
      key: new PublicKey(key),
      state: AddressLookupTableAccount.deserialize(
        new Uint8Array(Buffer.from(lookupTableData as string, "base64")),
      ),
    });
    lookupTableAccounts.push(account);
  }
  return lookupTableAccounts;
}

export async function fetchCreateLookupTableTx(
  statePda: PublicKey,
  payer: PublicKey,
): Promise<LookupTableResponse | null> {
  const glamApi = process.env.NEXT_PUBLIC_GLAM_API || process.env.GLAM_API;
  if (!glamApi) {
    return null;
  }

  const response = await fetch(
    `${glamApi}/v0/lut/vault/create?state=${statePda}&payer=${payer}`,
  );
  const data: LookupTableResponse = await response.json();
  return data;
}

export async function getExtendLookupTableTx(
  statePda: PublicKey,
  payer: PublicKey,
): Promise<LookupTableResponse | null> {
  const glamApi = process.env.NEXT_PUBLIC_GLAM_API || process.env.GLAM_API;
  if (!glamApi) {
    return null;
  }

  const response = await fetch(
    `${glamApi}/v0/lut/vault/extend?state=${statePda}&payer=${payer}`,
  );
  const data: LookupTableResponse = await response.json();
  return data;
}
