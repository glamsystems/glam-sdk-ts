import { Connection, PublicKey } from "@solana/web3.js";

export function expectPublicKeyArrayEqual(
  actual: PublicKey[],
  expected: PublicKey[],
) {
  expect(actual.map((p) => p.toString())).toEqual(
    expected.map((p) => p.toString()),
  );
}

export const sleep = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const str2seed = (str: String) =>
  Uint8Array.from(
    Array.from(str)
      .map((letter) => letter.charCodeAt(0))
      .concat(new Array(32 - str.length).fill(0)),
  );

export const airdrop = async (
  connection: Connection,
  pubkey: PublicKey,
  lamports: number,
) => {
  const airdropTx = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(
    {
      ...(await connection.getLatestBlockhash()),
      signature: airdropTx,
    },
    "confirmed",
  );
  console.log(`Airdropped ${lamports} lamports to ${pubkey}:`, airdropTx);
};
