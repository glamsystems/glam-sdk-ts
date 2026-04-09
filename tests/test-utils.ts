import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { USDC } from "../src";

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
  lamports: number = LAMPORTS_PER_SOL,
) => {
  try {
    const airdropTx = await connection.requestAirdrop(pubkey, lamports);
    await connection.confirmTransaction(
      {
        ...(await connection.getLatestBlockhash()),
        signature: airdropTx,
      },
      "confirmed",
    );
    console.log(
      `Airdropped ${lamports / LAMPORTS_PER_SOL} SOL to ${pubkey.toBase58()}:`,
      airdropTx,
    );
  } catch (error) {
    console.error("Airdrop failed:", error);
  }
};

export const mintUSDC = async (
  connection: Connection,
  recipient: PublicKey,
  amount: number,
) => {
  // USDC mint used in localnet test has been modified to have the test keypair as mint authority
  const mintAuthority = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        require("fs").readFileSync("./tests/test-keypair.json", {
          encoding: "utf-8",
        }),
      ),
    ),
  );

  // airdrop 1 SOL to mint authority to cover minting fee
  await airdrop(connection, mintAuthority.publicKey, 1_000_000_000);

  const recipientATA = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority,
    USDC,
    recipient,
    true,
  );

  const txSig = await mintTo(
    connection,
    mintAuthority,
    USDC,
    recipientATA.address,
    mintAuthority,
    amount * 10 ** 6,
  );

  console.log(
    `Minted ${amount} USDC to ${recipient} (ata ${recipientATA.address}: ${txSig}`,
  );
};
