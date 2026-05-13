import { utils as anchorUtils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { sha256First8Bytes, stringToChars } from "../../src/utils/common";
import { getMintPda, getStatePda } from "../../src/utils/glamPDAs";

const STAGING_GLAM_PROTOCOL_PROGRAM = new PublicKey(
  "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz",
);
const STAGING_GLAM_MINT_PROGRAM = new PublicKey(
  "gstgm1M39mhgnvgyScGUDRwNn5kNVSd97hTtyow1Et5",
);
const TX_SIGNER = new PublicKey("gopsU2tqchr3HYG4KDVAz7RrXy5SL2A4GdRp1FLb7GZ");

const COLLIDING_VAULT_NAMES = ["GLAM xStocks", "Phoenix Vault Token"];

function historicalSdkStateInitKey(name: string): number[] {
  return [...Buffer.from(anchorUtils.sha256.hash(name)).subarray(0, 8)];
}

function hex(bytes: number[]): string {
  return Buffer.from(bytes).toString("hex");
}

describe("state PDA derivation", () => {
  it("reproduces the historical tokenized vault mint PDA collision", () => {
    const stateInitKeys = COLLIDING_VAULT_NAMES.map(historicalSdkStateInitKey);

    expect(stateInitKeys.map(hex)).toEqual([
      "efbfbdefbfbdefbf",
      "efbfbdefbfbdefbf",
    ]);

    const statePdas = stateInitKeys.map((key) =>
      getStatePda(key, TX_SIGNER, STAGING_GLAM_PROTOCOL_PROGRAM),
    );
    const mintPdas = statePdas.map((statePda) =>
      getMintPda(statePda, 0, STAGING_GLAM_MINT_PROGRAM),
    );

    expect(new Set(statePdas.map((pda) => pda.toBase58())).size).toBe(1);
    expect(new Set(mintPdas.map((pda) => pda.toBase58())).size).toBe(1);
    expect(statePdas[0].toBase58()).toBe(
      "ChDH3YGTeccdrseJG26UxuZDyTwcXssaymzeKpcYbhP",
    );
    expect(mintPdas[0].toBase58()).toBe(
      "Uyhr5iQkYwqVvhD7TduBZRTamTfj4tTfkkqumx1UgN7",
    );
  });

  it("derives distinct seeds and mint PDAs from raw sha256 bytes", async () => {
    const stateInitKeys = await Promise.all(
      COLLIDING_VAULT_NAMES.map((name) =>
        sha256First8Bytes(stringToChars(name)),
      ),
    );

    expect(stateInitKeys.map(hex)).toEqual([
      "96a888e48fcea49f",
      "a4f08db3e36cfbc5",
    ]);

    const statePdas = stateInitKeys.map((key) =>
      getStatePda(key, TX_SIGNER, STAGING_GLAM_PROTOCOL_PROGRAM),
    );
    const mintPdas = statePdas.map((statePda) =>
      getMintPda(statePda, 0, STAGING_GLAM_MINT_PROGRAM),
    );

    expect(statePdas.map((pda) => pda.toBase58())).toEqual([
      "Co8AQfeoe7vhUEUwo9r3cqtMPAJodmb19VaMvV242J6s",
      "8W7LQspUiw5rrrvjTzMmnPdQkULEF8d7bJG4Mo5QFuYu",
    ]);
    expect(mintPdas.map((pda) => pda.toBase58())).toEqual([
      "AdzhvpUK5teJfQJUkyKu1hYrFB3ZmRy2H925GLZiyCCw",
      "2K6fM277N1mpJBeUPiR9zsAB2DDeLcanQYNAFPksFpZe",
    ]);
  });
});
